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
from google.genai import errors, types
from pydantic import BaseModel, Field

from app.core.config import settings
from app.services.checklist_items import ChecklistItem, get_item
from app.utils import validators
from app.utils.date_parser import parse_all_expiry_dates

logger = structlog.get_logger(__name__)

# Flash-lite is enough for a single still frame; the readiness-indicator
# item benefits from the stronger reasoning of the full flash model when
# judging a sequence of frames. (There is no "gemini-3.1-flash" — only
# the -lite variant exists at that version; 3.5 is the next full flash
# tier available.)
GEMINI_IMAGE_MODEL = "gemini-3.1-flash-lite"

# Video goes through a fallback chain rather than a single model.
#
# gemini-3.5-flash was the sole video model and began returning 503 Service
# Unavailable persistently — measured against production: every video check
# failed after ~37s while image checks succeeded in ~3s on the lite model.
# Retrying one unhealthy model three times just burned the whole timeout
# budget and surfaced as "the AI service is busy", which read like a Google
# outage when a perfectly healthy model was sitting next to it.
#
# Order is most-capable-first; each entry is tried in turn on a 5xx, so one
# model losing capacity degrades quality slightly instead of failing the
# inspection. Measured on a 20-frame sequence: 3.6 answered in ~6.5s, the
# lite model in ~5s, while 3.5 and 3.7 were both returning 503s.
GEMINI_VIDEO_MODELS = ("gemini-3.6-flash", "gemini-3.1-flash-lite")

# Google's own SDK retries internally, but has been observed giving up
# within a few seconds even on a transient "model experiencing high
# demand" 503 — too eager for a spike that usually clears in seconds. A
# few extra attempts with short backoff, bounded well under the frontend
# upload's 45s timeout, absorb that without surfacing a failure to the
# inspector mid-checklist. Only retried for Google-side (5xx) errors —
# a bad request or auth failure (4xx) won't fix itself by retrying.
MAX_ATTEMPTS = 3
RETRY_BACKOFF_SECONDS = (1.0, 2.5)
OVERALL_TIMEOUT_SECONDS = 35.0

# Gemini's native video ingestion samples at roughly 1 frame/second. A
# quick LED flash (a few hundred ms) blinking every 4-5s can fall entirely
# between those samples and never be "seen" — not a misread, a sampling
# gap. We extract our own frames at a much higher effective rate and hand
# Gemini a chronological image sequence instead, so a brief flash can't be
# missed just because it landed off-beat from a 1fps sampler.
MAX_EXTRACTED_FRAMES = 20
# Long edge for extracted frames. A 1080p capture yields ~1.7MB of JPEG across
# 20 frames; at 640px that is ~0.13MB — a 13x smaller request for a status LED
# that is still unmistakable at this size. The payload is round-tripped on
# every video check, so this is the difference between a 6s answer and a
# timeout on a field connection.
FRAME_LONG_EDGE = 640


class ChecklistAnalysisResult(BaseModel):
    passed: bool
    confidence: float = Field(ge=0.0, le=1.0)
    notes: str
    serial_number: Optional[str] = None
    expiry_date: Optional[str] = None
    expiry_raw_text: Optional[str] = None
    # Captured so the manufacture date can never be mistaken for the expiry:
    # a Philips battery label carries both, and reading the wrong one reports
    # a five-year-old-stock battery as already dead.
    manufacture_date: Optional[str] = None
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
                h, w = frame.shape[:2]
                longest = max(h, w)
                if longest > FRAME_LONG_EDGE:
                    scale = FRAME_LONG_EDGE / longest
                    frame = cv2.resize(
                        frame,
                        (max(1, int(w * scale)), max(1, int(h * scale))),
                        interpolation=cv2.INTER_AREA,
                    )
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
        models = list(GEMINI_VIDEO_MODELS)
    else:
        mime_type = _mime_type_for(item, content_type)
        contents = [
            types.Part.from_bytes(data=media_bytes, mime_type=mime_type),
            _build_prompt(item),
        ]
        models = list(GEMINI_VIDEO_MODELS) if item.media_type == "video" else [GEMINI_IMAGE_MODEL]

    async def _call_once(model: str):
        return await client.aio.models.generate_content(
            model=model,
            contents=contents,
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                response_schema=ChecklistAnalysisResult,
                temperature=0.1,
            ),
        )

    async def _call_with_retry():
        """Retry a model briefly, then move down the chain.

        A 503 means that model has no capacity right now; hammering it is
        pointless while a healthy sibling exists. Retries stay short so the
        whole chain still fits inside OVERALL_TIMEOUT_SECONDS.
        """
        last_error: Optional[errors.ServerError] = None
        # With a chain, spend fewer attempts per model: moving to a healthy
        # model beats a third try on one that just told us it has no capacity,
        # and the whole walk has to finish inside the overall timeout.
        attempts_per_model = MAX_ATTEMPTS if len(models) == 1 else 2
        for model_index, model in enumerate(models):
            for attempt in range(attempts_per_model):
                try:
                    if model_index > 0 or attempt > 0:
                        logger.info(
                            "checklist.gemini_attempt",
                            item_id=item_id,
                            model=model,
                            attempt=attempt + 1,
                        )
                    return await _call_once(model)
                except errors.ServerError as exc:
                    last_error = exc
                    logger.warning(
                        "checklist.gemini_server_error",
                        item_id=item_id,
                        model=model,
                        attempt=attempt + 1,
                        remaining_models=len(models) - model_index - 1,
                        error=str(exc),
                    )
                    if attempt < attempts_per_model - 1:
                        await asyncio.sleep(RETRY_BACKOFF_SECONDS[attempt])
        raise last_error  # type: ignore[misc]

    try:
        response = await asyncio.wait_for(_call_with_retry(), timeout=OVERALL_TIMEOUT_SECONDS)
    except asyncio.TimeoutError as exc:
        raise TimeoutError(
            f"Gemini call for checklist item={item_id} exceeded {OVERALL_TIMEOUT_SECONDS}s"
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
        # A manufacture date reported as the expiry is the worst failure mode
        # here — it makes fresh stock look years dead, raises a false alarm
        # with the customer, and puts a bogus entry in the replacement
        # pipeline. If the model handed back the same date for both, it read
        # one date and guessed at its meaning; refuse it rather than publish it.
        if result.manufacture_date and result.manufacture_date == result.expiry_date:
            logger.warning(
                "checklist.expiry_equals_manufacture",
                item=item.id,
                value=result.expiry_date,
                raw=result.expiry_raw_text,
            )
            return result.model_copy(
                update={
                    "passed": False,
                    "expiry_date": None,
                    "notes": (
                        "That date is the manufacture date, not the expiry date. "
                        "Look for the date marked 'Install before' or with an "
                        "hourglass symbol and photograph that part of the label."
                    ),
                }
            )

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
        # Only ever upgrade to a more precise form of the SAME month. Taking the
        # first date in the raw text would, on a Philips battery, swap a correct
        # "2031-11" for the manufacture date "2026-01-13" simply because it has
        # a day in it.
        if result.expiry_raw_text and len(result.expiry_date) == 7:
            for candidate in parse_all_expiry_dates(result.expiry_raw_text):
                if len(candidate) == 10 and candidate.startswith(result.expiry_date):
                    result = result.model_copy(update={"expiry_date": candidate})
                    break

    return result
