"""
WebSocket endpoint for live inspection frame processing.

Protocol:
  Client → Server: Binary JPEG frame bytes
  Server → Client: JSON StateResult message

The client (browser) sends video frames from getUserMedia via canvas.toBlob().
The backend proxies them here unchanged. Gemini is expensive and rate
limited, so we do NOT analyse every incoming frame — see `_should_analyze`.
"""
from __future__ import annotations

import asyncio
import json
import time
import uuid
from typing import Dict, Optional

import cv2
import numpy as np
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query
import structlog

from app.schemas.frame import FrameQuality
from app.schemas.inspection import InspectionState, InspectionStatus, StateResult
from app.services.inspection import frame_diff
from app.services.inspection.state_machine import InspectionSession, InspectionStateMachine

router = APIRouter()
logger = structlog.get_logger(__name__)

# Active sessions: session_id → state machine
_active_sessions: Dict[str, InspectionStateMachine] = {}

_TERMINAL_STATES = (InspectionState.REPORT, InspectionState.COMPLETE)

# Gemini calls are throttled to this cadence (seconds) to control latency
# and API quota usage. A frame that fails the local quality gate (blurry/
# dark/overexposed) never reaches Gemini at all — see the quality check in
# the main loop below, which sends locally-derived feedback instead.
#
# Kept conservative for the free tier's per-model daily/per-minute request
# caps — a paid key can safely lower this back down to 1.5-2s.
_THROTTLE_SECONDS = 5.0
_MAX_WAIT_SECONDS = 10.0


def _should_analyze(
    state: InspectionState,
    last_analysis_ts: float,
    now: float,
    frame_changed: bool,
) -> bool:
    """Caller must already have confirmed frame quality is acceptable — an
    unusable (blurry/dark/overexposed) frame is never worth a Gemini call."""
    if state in _TERMINAL_STATES:
        return True  # free — no Gemini call, resolve immediately
    elapsed = now - last_analysis_ts
    if elapsed >= _MAX_WAIT_SECONDS:
        return True  # liveness guarantee — periodic check-in on a usable frame
    if elapsed >= _THROTTLE_SECONDS and frame_changed:
        return True
    return False


def _quality_instruction(quality: FrameQuality) -> str:
    """Local, no-Gemini-needed feedback for a frame that failed the quality
    gate — derived from metrics we already computed on-device."""
    if quality.blur_score < 80.0:
        return "Image is blurry — hold the camera steady and let it focus."
    if quality.brightness < 35.0:
        return "Too dark — move to better lighting."
    if quality.brightness > 225.0:
        return "Too bright — reduce glare or step back from direct light."
    return "Low contrast — frame the AED clearly against the background."


@router.websocket("/inspect")
async def inspection_websocket(
    websocket: WebSocket,
    session_id: str = Query(default=None),
    inspector_id: str = Query(default="anonymous"),
):
    await websocket.accept()
    sid = session_id or str(uuid.uuid4())
    logger.info("ws.connected", session_id=sid, inspector=inspector_id)

    # Create session + state machine
    session = InspectionSession(session_id=sid, inspector_id=inspector_id)
    machine = InspectionStateMachine(session)
    _active_sessions[sid] = machine

    frame_count = 0
    last_analysis_ts = 0.0
    last_result: Optional[StateResult] = None
    last_signature: Optional[np.ndarray] = None

    try:
        await websocket.send_text(
            json.dumps({
                "type": "session_ready",
                "session_id": sid,
                "message": "Inspection session started. Click Start and point camera at the AED.",
            })
        )

        while True:
            try:
                # Receive raw frame bytes (JPEG) from client
                data = await asyncio.wait_for(websocket.receive_bytes(), timeout=8.0)
            except asyncio.TimeoutError:
                await websocket.send_text(
                    json.dumps({"type": "keepalive", "ts": time.time()})
                )
                continue

            frame_count += 1

            # Cheap local quality check (blur/brightness) — used to gate
            # Gemini calls and to keep the UI's live quality meter fresh.
            nparr = np.frombuffer(data, np.uint8)
            frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
            if frame is None:
                continue
            quality = FrameQuality.compute(frame)
            signature = frame_diff.compute_signature(frame)
            frame_changed = (
                last_signature is None
                or frame_diff.signature_diff(signature, last_signature) >= frame_diff.CHANGE_THRESHOLD
            )

            now = time.time()
            state = machine.session.current_state

            if state not in _TERMINAL_STATES and not quality.is_acceptable:
                # Never spend Gemini quota on a frame that isn't analysable —
                # give the inspector instant local feedback instead. Skips
                # the throttle timer entirely so the next *good* frame is
                # still eligible for analysis right away.
                await websocket.send_text(json.dumps({
                    "type": "state_update",
                    "session_id": sid,
                    "frame_number": frame_count,
                    "timestamp": time.time(),
                    "step": state.value,
                    "progress": machine.session.progress,
                    "instruction": _quality_instruction(quality),
                    "completed": False,
                    "status": (
                        InspectionStatus.WAITING
                        if state == InspectionState.WAIT_FOR_MACHINE
                        else InspectionStatus.IN_PROGRESS
                    ).value,
                    "detections": [],
                    "frame_quality": {
                        "blur": round(quality.blur_score, 1),
                        "brightness": round(quality.brightness, 1),
                        "acceptable": quality.is_acceptable,
                    },
                }))
                continue

            try:
                if _should_analyze(state, last_analysis_ts, now, frame_changed):
                    last_analysis_ts = now
                    last_signature = signature
                    state_result = await machine.process_frame(data, signature)
                    last_result = state_result
                elif last_result is not None:
                    state_result = last_result
                else:
                    continue  # nothing analysed yet — wait for the first pass
            except Exception as e:
                logger.exception("ws.frame_error", error=str(e))
                await websocket.send_text(
                    json.dumps({
                        "type": "error",
                        "message": "Frame processing error",
                        "detail": str(e),
                    })
                )
                continue

            # Build response payload
            payload = {
                "type": "state_update",
                "session_id": sid,
                "frame_number": frame_count,
                "timestamp": time.time(),
                **state_result.model_dump(),
                # No local object detection anymore — kept for UI compatibility.
                "detections": [],
                "frame_quality": {
                    "blur": round(quality.blur_score, 1),
                    "brightness": round(quality.brightness, 1),
                    "acceptable": quality.is_acceptable,
                },
            }

            await websocket.send_text(json.dumps(payload))

            # If inspection is complete, close gracefully
            if state_result.status == InspectionStatus.COMPLETE and state_result.completed:
                logger.info(
                    "ws.inspection_complete",
                    session_id=sid,
                    frames_processed=frame_count,
                )
                await websocket.send_text(
                    json.dumps({
                        "type": "inspection_complete",
                        "session_id": sid,
                        "data": session.data.__dict__,
                    })
                )
                break

    except WebSocketDisconnect:
        logger.info("ws.disconnected", session_id=sid, frames=frame_count)
    except Exception as e:
        logger.exception("ws.unexpected_error", session_id=sid, error=str(e))
        try:
            await websocket.send_text(
                json.dumps({"type": "fatal_error", "message": str(e)})
            )
        except Exception:
            pass
    finally:
        _active_sessions.pop(sid, None)
        logger.info("ws.session_cleaned", session_id=sid)
