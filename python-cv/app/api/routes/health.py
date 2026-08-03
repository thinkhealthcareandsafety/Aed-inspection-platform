"""Health check endpoints."""
from fastapi import APIRouter, HTTPException
from app.core.config import settings

router = APIRouter()


@router.get("/")
async def health():
    return {
        "status": "ok",
        "service": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "gemini_configured": bool(settings.GEMINI_API_KEY),
    }


@router.get("/ready")
async def readiness():
    if not settings.GEMINI_API_KEY:
        raise HTTPException(status_code=503, detail="GEMINI_API_KEY not configured")
    return {"ready": True}
