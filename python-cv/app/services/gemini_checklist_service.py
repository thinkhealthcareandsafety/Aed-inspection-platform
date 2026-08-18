"""
Gemini Vision Service — checklist mode.

One multimodal Gemini call per uploaded photo/video, scoped to a single
checklist item (see `checklist_items.py`). This replaces the old
continuous per-frame WebSocket state machine: the inspector captures or
uploads one piece of media per item, and gets one AI verdict back.
"""
from __future__ import annotations

import asyncio
import os
import tempfile
from typing import List, Optional

import cv2
import structlog
from google import genai
from google.genai import types
from pydantic import BaseModel, Field

from app.core.config import settings
from app.services.checklist_items import ChecklistItem, get_item
from app.utils import validators
from app.utils.date_parser import parse_expiry_date

logger = structlog.get_logger(__name__)

# Flash-lite is enough for a single still frame; the readiness-indicator
# item benefits from the stronger reasoning of the full flash model when
# judging a sequence of frames. (There is no "gemini-3.1-flash" — only
# the -lite variant exists at that version; 3.5 is the next full flash
# tier available.)
GEMINI_IMAGE_MODEL = "gemini-3.1-flash-lite"
GEMINI_VIDEO_MODEL = "gemini-3.5-flash"

REQUEST_TIMEOUT_SECONDS = 40.0

# Gemini's native video ingestion samples at roughly 1 frame/second. A
# quick LED flash (a few hundred ms) blinking every 4-5s can fall entirely
# between those samples and never be "seen" — not a misread, a sampling
# gap. We extract our own frames at a much higher effective rate and hand
# Gemini a chronological image sequence instead, so a brief flash can't be
# missed just because it landed off-beat from a 1fps sampler.
MAX_EXTRACTED_FRAMES = 20


class ChecklistAnalysisResult(BaseModel):
    passed: bool
    confidence: float = Field(ge=0.0, le=1.0)
    notes: str
    serial_number: Optional[str] = None
    expiry_date: Optional[str] = None
    expiry_raw_text: Optional[str] = None
    lot_number: Optional[str] = None
    battery_serial_number: Optional[str] = None
    present: Optional[bool] = None
    status: Optional[str] = None  # readiness_indicator only: ready | fault | unclear


_client: Optional[genai.Client] = None


def _get_client() -> genai.Client:
    global _client
    if _client is None:
        _client = genai.Client(api_key=settings.GEMINI_API_KEY)
    return _client


def _build_prompt(item: ChecklistItem, frame_count: Optional[int] = None) -> str:
    sequence_note = (
        (
            f"You are given {frame_count} still frames extracted evenly across "
            "a short video clip, in strict chronological order (the first "
            "image is the start of the clip, the last is the end). Treat "
            "them as one continuous observation of the same scene over "
            "time, not as separate unrelated photos — a change that "
            "appears in only one or two of the frames (e.g. a light "
            "turning on then off again) is exactly the kind of brief event "
            "you are looking for, not noise to discard.\n\n"
        )
        if frame_count
        else ""
    )
    return (
        "You are the vision engine for an AED (defibrillator) inspection "
        "checklist app. You receive photo(s) for exactly one checklist "
        "item and must return a single structured verdict.\n\n"
        f"{sequence_note}"
        f"Checklist item: {item.title}\n"
        f"Task: {item.prompt}\n\n"
        "Always set confidence (0.0-1.0) to your own honest certainty in "
        "this specific media — a blurry, distant, dark, or ambiguous capture "
        "should score low even if you still produced a best-effort answer. "
        "notes is one short, friendly sentence: if passed=false, tell the "
        "inspector exactly what to fix or recapture; if passed=true, briefly "
        "confirm what you saw. Leave any data field you cannot determine as "
        "null — never guess."
    )


def _mime_type_for(item: ChecklistItem, declared_content_type: Optional[str]) -> str:
    if declared_content_type and "/" in declared_content_type:
        return declared_content_type
    return "video/mp4" if item.media_type == "video" else "image/jpeg"


def _extract_frames(video_bytes: bytes, max_frames: int = MAX_EXTRACTED_FRAMES) -> List[bytes]:
    """Decode a video and return up to `max_frames` JPEG frames sampled
    evenly across its whole duration. Returns [] if the container/codec
    can't be decoded (caller falls back to native video ingestion)."""
    tmp_path = None
    try:
        with tempfile.NamedTemporaryFile(suffix=".mp4", delete=False) as tmp:
            tmp.write(video_bytes)
            tmp_path = tmp.name

        cap = cv2.VideoCapture(tmp_path)
        if not cap.isOpened():
            return []

        total = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        if total <= 0:
            cap.release()
            return []

        step = max(1, total // max_frames)
        frames: List[bytes] = []
        idx = 0
        while idx < total and len(frames) < max_frames:
            cap.set(cv2.CAP_PROP_POS_FRAMES, idx)
            ok, frame = cap.read()
            if ok:
                encoded, buf = cv2.imencode(".jpg", frame, [cv2.IMWRITE_JPEG_QUALITY, 85])
                if encoded:
                    frames.append(buf.tobytes())
            idx += step
        cap.release()
        return frames
    except Exception as exc:  # noqa: BLE001 — any decode failure just falls back
        logger.warning("checklist.frame_extraction_failed", error=str(exc))
        return []
    finally:
        if tmp_path:
            try:
                os.unlink(tmp_path)
            except OSError:
                pass


async def analyze_checklist_item(
    item_id: str, media_bytes: bytes, content_type: Optional[str] = None
) -> ChecklistAnalysisResult:
    """Analyse one uploaded photo/video against its checklist item prompt."""
    item = get_item(item_id)
    if item is None:
        raise ValueError(f"Unknown checklist item: {item_id}")

    client = _get_client()

    frames = _extract_frames(media_bytes) if item.media_type == "video" else []

    if frames:
        logger.info("checklist.frames_extracted", item_id=item_id, count=len(frames))
        contents = [types.Part.from_bytes(data=f, mime_type="image/jpeg") for f in frames]
        contents.append(_build_prompt(item, frame_count=len(frames)))
        model = GEMINI_VIDEO_MODEL
    else:
        mime_type = _mime_type_for(item, content_type)
        contents = [
            types.Part.from_bytes(data=media_bytes, mime_type=mime_type),
            _build_prompt(item),
        ]
        model = GEMINI_VIDEO_MODEL if item.media_type == "video" else GEMINI_IMAGE_MODEL

    try:
        response = await asyncio.wait_for(
            client.aio.models.generate_content(
                model=model,
                contents=contents,
                config=types.GenerateContentConfig(
                    response_mime_type="application/json",
                    response_schema=ChecklistAnalysisResult,
                    temperature=0.1,
                ),
            ),
            timeout=REQUEST_TIMEOUT_SECONDS,
        )
    except asyncio.TimeoutError as exc:
        raise TimeoutError(
            f"Gemini call for checklist item={item_id} exceeded {REQUEST_TIMEOUT_SECONDS}s"
        ) from exc

    parsed = response.parsed
    result = (
        parsed
        if isinstance(parsed, ChecklistAnalysisResult)
        else ChecklistAnalysisResult.model_validate_json(response.text)
    )

    return _apply_deterministic_checks(item, result)


def _apply_deterministic_checks(
    item: ChecklistItem, result: ChecklistAnalysisResult
) -> ChecklistAnalysisResult:
    """Downgrade an implausible read the same way the old state machine did
    — cheap, deterministic sanity checks independent of Gemini's own
    confidence score. Never upgrades a result, only vetoes bad ones."""
    if item.id == "serial_number" and result.serial_number:
        if not validators.is_plausible_serial(result.serial_number):
            logger.warning("checklist.implausible_serial", value=result.serial_number)
            return result.model_copy(
                update={
                    "passed": False,
                    "serial_number": None,
                    "notes": "Serial number reading looked implausible — please recapture with the label centred and in focus.",
                }
            )

    if item.id in ("pads_expiry", "battery_expiry") and result.expiry_date:
        plausible = validators.is_plausible_expiry(result.expiry_date)
        agrees = validators.expiry_cross_check_agrees(result.expiry_date, result.expiry_raw_text)
        if not plausible or not agrees:
            logger.warning(
                "checklist.implausible_expiry",
                item=item.id,
                value=result.expiry_date,
                raw=result.expiry_raw_text,
            )
            return result.model_copy(
                update={
                    "passed": False,
                    "expiry_date": None,
                    "notes": "Expiry date reading looked implausible — please recapture with the label centred, well lit, and in focus.",
                }
            )
        # Keep the deterministic parser's month/day if Gemini normalised to
        # month-only but the raw text had a day — free precision upgrade.
        if result.expiry_raw_text:
            deterministic = parse_expiry_date(result.expiry_raw_text)
            if deterministic and len(deterministic) > len(result.expiry_date):
                result = result.model_copy(update={"expiry_date": deterministic})

    return result
