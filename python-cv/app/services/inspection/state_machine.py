"""
AED Inspection State Machine.

Drives the entire automated inspection through well-defined states and
transitions. Each non-terminal state delegates frame understanding to
`gemini_service.analyze_inspection_frame` — there is no local YOLO/OCR
pipeline anymore; Gemini decides what's in frame, whether the step is
complete, and what the inspector should do next.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Callable, Dict, List, Optional
import time

import numpy as np
import structlog

from app.schemas.inspection import (
    InspectionState,
    StateResult,
    InspectionData,
    InspectionStatus,
)
from app.services import gemini_service
from app.services.inspection import frame_diff

logger = structlog.get_logger(__name__)

# Steps handled locally without a Gemini call.
_TERMINAL_STATES = (InspectionState.REPORT, InspectionState.COMPLETE)

# Ordered sequence the machine advances through.
_STATE_ORDER: List[InspectionState] = [
    InspectionState.WAIT_FOR_MACHINE,
    InspectionState.IDENTIFY_MACHINE,
    InspectionState.SERIAL_NUMBER,
    InspectionState.PADS_EXPIRY,
    InspectionState.BATTERY_CHECK,
    InspectionState.STATUS_CHECK,
    InspectionState.REPORT,
    InspectionState.COMPLETE,
]

# Maps each state onto the `current_step` value gemini_service expects.
_GEMINI_STEP: Dict[InspectionState, str] = {
    InspectionState.WAIT_FOR_MACHINE: "WAIT",
    InspectionState.IDENTIFY_MACHINE: "IDENTIFY",
    InspectionState.SERIAL_NUMBER: "SERIAL",
    InspectionState.PADS_EXPIRY: "PADS",
    InspectionState.BATTERY_CHECK: "BATTERY",
    InspectionState.STATUS_CHECK: "STATUS",
}

# Battery label isn't always present — give up and move on after this long.
BATTERY_CHECK_TIMEOUT_SECONDS = 45.0

# A state is "locked" once its required field(s) are confidently known —
# further frames skip Gemini entirely unless the scene changes enough to
# suggest a new device/angle (see `frame_diff.SCENE_CHANGE_THRESHOLD`).
_LOCK_FIELD: Dict[InspectionState, Callable[[InspectionData], bool]] = {
    InspectionState.IDENTIFY_MACHINE: lambda d: bool(d.manufacturer and d.model),
    InspectionState.SERIAL_NUMBER: lambda d: bool(d.serial_number),
    InspectionState.PADS_EXPIRY: lambda d: bool(d.pads_expiry),
    InspectionState.BATTERY_CHECK: lambda d: bool(d.battery_expiry),
    InspectionState.STATUS_CHECK: lambda d: d.status_indicator is not None,
}


def _clear_locked_field(state: InspectionState, data: InspectionData) -> None:
    """Drop a locked-in field so a real Gemini call re-populates it."""
    if state == InspectionState.IDENTIFY_MACHINE:
        data.manufacturer = None
        data.model = None
    elif state == InspectionState.SERIAL_NUMBER:
        data.serial_number = None
    elif state == InspectionState.PADS_EXPIRY:
        data.pads_expiry = None
    elif state == InspectionState.BATTERY_CHECK:
        data.battery_expiry = None
    elif state == InspectionState.STATUS_CHECK:
        data.status_indicator = None


def _locked_output_data(state: InspectionState, data: InspectionData) -> Optional[Dict[str, Any]]:
    """Wire-format payload for a synthesized (non-Gemini) locked result."""
    if state == InspectionState.IDENTIFY_MACHINE:
        out = {"manufacturer": data.manufacturer, "model": data.model}
    elif state == InspectionState.SERIAL_NUMBER:
        out = {"serial_number": data.serial_number}
    elif state == InspectionState.PADS_EXPIRY:
        out = {"pads_expiry": data.pads_expiry}
    elif state == InspectionState.BATTERY_CHECK:
        out = {"battery_expiry": data.battery_expiry}
    elif state == InspectionState.STATUS_CHECK:
        out = {"status_indicator": data.status_indicator}
        if data.status_indicator is not None:
            out["aed_status"] = "healthy" if data.status_indicator == "healthy" else "fault"
    else:
        out = {}
    out = {k: v for k, v in out.items() if v is not None}
    return out or None


@dataclass
class InspectionSession:
    """Holds all mutable state for one active inspection session."""

    session_id: str
    inspector_id: str
    started_at: float = field(default_factory=time.time)

    # Current state
    current_state: InspectionState = InspectionState.WAIT_FOR_MACHINE
    progress: int = 0
    state_entered_at: float = field(default_factory=time.time)

    # Detected machine (quick-access mirror of session.data)
    manufacturer: Optional[str] = None
    model: Optional[str] = None

    # Accumulated inspection data
    data: InspectionData = field(default_factory=InspectionData)

    # Frames captured for report
    captured_frames: List[bytes] = field(default_factory=list)

    # Signature of the last frame whose Gemini call confirmed the current
    # state's required field(s) — used to detect a scene change while a
    # state is locked (see `_LOCK_FIELD` / `_locked_output_data`).
    lock_signature: Optional[np.ndarray] = None


class InspectionStateMachine:
    """
    Orchestrates AED inspection through ordered states.

    `process_frame` is only invoked at the throttled cadence decided by the
    websocket handler — every call this makes to Gemini costs real quota,
    so callers must not call it per raw video frame.
    """

    def __init__(self, session: InspectionSession):
        self.session = session
        logger.info("state_machine.init", session_id=session.session_id)

    async def process_frame(
        self, image_bytes: bytes, frame_signature: Optional[np.ndarray] = None
    ) -> StateResult:
        session = self.session
        state = session.current_state

        if state in _TERMINAL_STATES:
            return self._handle_terminal(state)

        lock_check = _LOCK_FIELD.get(state)
        if lock_check and lock_check(session.data):
            diverged = (
                frame_signature is not None
                and session.lock_signature is not None
                and frame_diff.signature_diff(frame_signature, session.lock_signature)
                >= frame_diff.SCENE_CHANGE_THRESHOLD
            )
            if not diverged:
                return self._locked_result(state)
            # Scene changed enough to suggest a new device/angle — drop the
            # stale field and fall through to a real Gemini call below.
            _clear_locked_field(state, session.data)
            session.lock_signature = None

        gemini_step = _GEMINI_STEP[state]

        try:
            result = await gemini_service.analyze_inspection_frame(image_bytes, gemini_step)
        except Exception as exc:
            logger.exception("state_machine.gemini_error", state=state.value, error=str(exc))
            return StateResult(
                step=state.value,
                progress=session.progress,
                instruction="AI analysis is temporarily unavailable. Hold steady, retrying…",
                completed=False,
                status=InspectionStatus.ERROR,
                error=str(exc),
            )

        self._merge_data(state, result)
        session.progress = max(session.progress, result.progress)

        if lock_check and lock_check(session.data) and frame_signature is not None:
            session.lock_signature = frame_signature

        completed = result.completed
        if state == InspectionState.BATTERY_CHECK and not completed:
            if time.time() - session.state_entered_at > BATTERY_CHECK_TIMEOUT_SECONDS:
                logger.warning("state_machine.battery_timeout", session_id=session.session_id)
                completed = True

        status = InspectionStatus.WAITING if (
            state == InspectionState.WAIT_FOR_MACHINE and not completed
        ) else InspectionStatus.IN_PROGRESS

        out_data = result.data.model_dump(exclude_none=True)
        if state == InspectionState.STATUS_CHECK and result.data.status_indicator_ok is not None:
            # Wire-compatible key the frontend store reads for live status display.
            out_data["aed_status"] = "healthy" if result.data.status_indicator_ok else "fault"

        state_result = StateResult(
            step=state.value,
            progress=session.progress,
            instruction=result.instruction,
            completed=completed,
            status=status,
            data=out_data or None,
        )

        if completed:
            self._advance()

        return state_result

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    def _merge_data(self, state: InspectionState, result: gemini_service.GeminiAnalysisResult) -> None:
        """Fold newly-read fields into the session's accumulated data."""
        session = self.session
        d = result.data

        if d.manufacturer:
            session.data.manufacturer = d.manufacturer
            session.manufacturer = d.manufacturer
        if d.model:
            session.data.model = d.model
            session.model = d.model
        if d.serial_number:
            session.data.serial_number = d.serial_number
        if d.pads_expiry:
            session.data.pads_expiry = d.pads_expiry
        if d.battery_expiry:
            session.data.battery_expiry = d.battery_expiry

        if state == InspectionState.STATUS_CHECK and result.completed and d.status_indicator_ok is not None:
            session.data.status_indicator = "healthy" if d.status_indicator_ok else "fault"

    def _locked_result(self, state: InspectionState) -> StateResult:
        """Synthesize a completed result from already-known data, with no
        Gemini call — used once a state's required field(s) are locked."""
        session = self.session
        state_result = StateResult(
            step=state.value,
            progress=session.progress,
            instruction="Got it — hold steady, moving to the next step.",
            completed=True,
            status=InspectionStatus.IN_PROGRESS,
            data=_locked_output_data(state, session.data),
        )
        self._advance()
        return state_result

    def _advance(self) -> None:
        session = self.session
        idx = _STATE_ORDER.index(session.current_state)
        if idx < len(_STATE_ORDER) - 1:
            next_state = _STATE_ORDER[idx + 1]
            logger.info(
                "state_machine.transition",
                from_state=session.current_state.value,
                to_state=next_state.value,
            )
            session.current_state = next_state
            session.state_entered_at = time.time()

    def _handle_terminal(self, state: InspectionState) -> StateResult:
        if state == InspectionState.REPORT:
            return self._handle_report()
        return self._handle_complete()

    def _handle_report(self) -> StateResult:
        """Compile inspection data — report generation is fast, complete in one frame."""
        session = self.session
        session.data.inspection_result = _derive_result(session.data)
        session.data.completed_at = time.time()
        session.data.duration_seconds = session.data.completed_at - session.started_at

        self._advance()

        return StateResult(
            step="report",
            progress=95,
            instruction="Inspection complete. Generating your report…",
            completed=True,
            status=InspectionStatus.COMPLETE,
            data=session.data.__dict__,
        )

    def _handle_complete(self) -> StateResult:
        return StateResult(
            step="complete",
            progress=100,
            instruction="Inspection finished. You can now view or download your report.",
            completed=True,
            status=InspectionStatus.COMPLETE,
        )


# ------------------------------------------------------------------
# Module-level helpers
# ------------------------------------------------------------------

def _derive_result(data: InspectionData) -> str:
    """Derive overall pass/fail from gathered data.

    Expired consumables fail the inspection outright, regardless of what the
    status indicator shows — a healthy-looking status light doesn't override
    an expired pad or battery. PASS requires both expiry dates to have been
    captured and be unexpired; missing data means REVIEW, never PASS, since
    this is life-safety equipment.
    """
    from app.utils.date_parser import is_expired

    pads_expired = bool(data.pads_expiry) and is_expired(data.pads_expiry)
    battery_expired = bool(data.battery_expiry) and is_expired(data.battery_expiry)

    if data.status_indicator == "fault" or pads_expired or battery_expired:
        return "FAIL"
    if (
        data.status_indicator in ("healthy", "ready")
        and data.pads_expiry
        and data.battery_expiry
    ):
        return "PASS"
    return "REVIEW"
