"""Single frame analysis REST endpoint (for testing / non-WS clients)."""
from __future__ import annotations

from fastapi import APIRouter, File, HTTPException, Query, UploadFile
from fastapi.responses import JSONResponse

from app.services import gemini_service

router = APIRouter()


@router.post("/analyse")
async def analyse_frame(
    file: UploadFile = File(...),
    step: str = Query(default="IDENTIFY", description="IDENTIFY | SERIAL | PADS | BATTERY | STATUS"),
):
    """Analyse a single JPEG/PNG frame for the given inspection step via Gemini."""
    contents = await file.read()
    if not contents:
        raise HTTPException(status_code=400, detail="Empty image file")

    result = await gemini_service.analyze_inspection_frame(contents, step.upper())
    return JSONResponse(result.model_dump())
