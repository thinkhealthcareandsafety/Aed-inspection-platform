"""Health check endpoints."""
from fastapi import APIRouter, HTTPException
from app.core.config import settings
from app.services import video_normalize
from app.services.gemini_checklist_service import ai_calls_today

router = APIRouter()


@router.get("/")
async def health():
    return {
        "status": "ok",
        "service": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "gemini_configured": bool(settings.GEMINI_API_KEY),
        # How much of today's AI-call ceiling is spent — watch this, not the bill.
        "ai_calls_today": ai_calls_today(),
        # Every readiness video is converted with ffmpeg; without it, any
        # clip over ~19 MB is refused.
        "video_conversion": video_normalize.available(),
    }


@router.get("/ready")
async def readiness():
    if not settings.GEMINI_API_KEY:
        raise HTTPException(status_code=503, detail="GEMINI_API_KEY not configured")
    return {"ready": True}
