"""GET /api/v1/voice/{key} — one of the app's instruction lines, spoken."""
import re

import structlog
from fastapi import APIRouter, HTTPException, Response

from app.services import voice_service
from app.services.gemini_checklist_service import DailyLimitReached

logger = structlog.get_logger()
router = APIRouter()

_KEY = re.compile(r"^[0-9a-f]{8}$")


@router.get("/{key}")
async def speak(key: str) -> Response:
    if not _KEY.match(key) or voice_service.line_for(key) is None:
        raise HTTPException(status_code=404, detail="No such line")
    try:
        mp3 = await voice_service.record(key)
    except DailyLimitReached as exc:
        raise HTTPException(status_code=503, detail="AI is resting for today") from exc
    except Exception as exc:  # noqa: BLE001 — the page falls back to the phone's own voice
        logger.warning("voice.record_failed", key=key, error=str(exc) or type(exc).__name__)
        raise HTTPException(status_code=503, detail="Voice unavailable") from exc
    return Response(content=mp3, media_type="audio/mpeg")
