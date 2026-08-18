"""Checklist item analysis endpoint — one Gemini call per uploaded photo/video."""
from __future__ import annotations

import structlog
from fastapi import APIRouter, File, HTTPException, UploadFile

from app.services import gemini_checklist_service
from app.services.checklist_items import CHECKLIST_ITEMS, get_item

logger = structlog.get_logger(__name__)
router = APIRouter()

MAX_UPLOAD_BYTES = 25 * 1024 * 1024  # 25MB — generous for a phone photo/short clip


@router.get("/items")
async def list_items():
    """The checklist catalogue — 3 sections, 10 items. Source of truth the
    frontend/backend can mirror without hand-syncing prompt text."""
    return {
        "items": [
            {
                "id": item.id,
                "section": item.section,
                "order": item.order,
                "title": item.title,
                "description": item.description,
                "mediaType": item.media_type,
                "required": item.required,
            }
            for item in CHECKLIST_ITEMS
        ]
    }


@router.post("/{item_id}/analyze")
async def analyze_item(item_id: str, file: UploadFile = File(...)):
    item = get_item(item_id)
    if item is None:
        raise HTTPException(status_code=404, detail=f"Unknown checklist item '{item_id}'")

    contents = await file.read()
    if not contents:
        raise HTTPException(status_code=400, detail="Empty upload")
    if len(contents) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail="File too large")

    try:
        result = await gemini_checklist_service.analyze_checklist_item(
            item_id, contents, file.content_type
        )
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except TimeoutError as exc:
        logger.error("checklist.analyze_timeout", item_id=item_id, error=str(exc))
        raise HTTPException(status_code=504, detail=str(exc)) from exc
    except Exception as exc:
        logger.exception("checklist.analyze_error", item_id=item_id, error=str(exc))
        raise HTTPException(status_code=502, detail="AI analysis failed") from exc

    return result.model_dump()
