"""Checklist item analysis endpoint — one Gemini call per uploaded photo/video."""
from __future__ import annotations

import asyncio
import os
import tempfile
from typing import Optional

import structlog
from fastapi import APIRouter, File, Form, HTTPException, UploadFile

from app.services import gemini_checklist_service, video_normalize
from app.services.checklist_items import CHECKLIST_ITEMS, get_item

logger = structlog.get_logger(__name__)
router = APIRouter()

#: A photo, however large the phone's camera.
MAX_IMAGE_BYTES = 25 * 1024 * 1024
#: A video straight off any phone's own camera: 20 s of 4K is ~150 MB. It is
#: written to disk, never held whole in memory, and shrunk before analysis
#: (see video_normalize), so its size costs only upload time.
MAX_VIDEO_BYTES = 250 * 1024 * 1024
#: Largest video Gemini takes inline, for the rare clip ffmpeg can't convert.
MAX_INLINE_VIDEO_BYTES = 19 * 1024 * 1024
CHUNK_BYTES = 1024 * 1024


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


async def _save_upload(file: UploadFile, path: str, limit: int) -> int:
    """Copies the upload to `path` a chunk at a time; refuses it past `limit`."""
    size = 0
    with open(path, "wb") as out:
        while True:
            chunk = await file.read(CHUNK_BYTES)
            if not chunk:
                break
            size += len(chunk)
            if size > limit:
                raise HTTPException(status_code=413, detail="File too large")
            out.write(chunk)
    return size


@router.post("/{item_id}/analyze")
async def analyze_item(
    item_id: str,
    file: UploadFile = File(...),
    # Which AED this is ('Philips FRx', 'Zoll AED 3', 'Defibtech Lifeline VIEW'…), so
    # the prompt describes the unit actually in the photo. Optional: an older
    # caller that doesn't send it gets the brand-neutral profile.
    aed_model: Optional[str] = Form(None),
    # The inspector's language; 'hi' adds Hindi feedback alongside English.
    lang: Optional[str] = Form(None),
    # 'guided' when the clip was filmed with the in-app camera (light kept in
    # the circle at the centre).
    capture: Optional[str] = Form(None),
):
    item = get_item(item_id)
    if item is None:
        raise HTTPException(status_code=404, detail=f"Unknown checklist item '{item_id}'")

    is_video = item.media_type == "video"
    content_type = file.content_type
    with tempfile.TemporaryDirectory(prefix="aed_upload_") as tmpdir:
        src = os.path.join(tmpdir, "upload")
        size = await _save_upload(file, src, MAX_VIDEO_BYTES if is_video else MAX_IMAGE_BYTES)
        if size == 0:
            raise HTTPException(status_code=400, detail="Empty upload")

        if is_video:
            # Every phone's format made into one small, standard clip.
            contents = await asyncio.to_thread(video_normalize.normalize, src)
            if contents is not None:
                content_type = "video/mp4"
            elif size <= MAX_INLINE_VIDEO_BYTES and not video_normalize.available():
                # No ffmpeg on this server (a misconfigured image): the small
                # clip goes to the model as it is, as it did before.
                contents = await asyncio.to_thread(_read, src)
            else:
                logger.warning("checklist.video_unreadable", item_id=item_id, bytes=size, content_type=content_type)
                raise HTTPException(
                    status_code=422,
                    detail="We couldn't read this video. Please record it again in the app.",
                )
        else:
            contents = await asyncio.to_thread(_read, src)

    try:
        result = await gemini_checklist_service.analyze_checklist_item(
            item_id, contents, content_type, aed_model=aed_model, language=lang, guided=capture == "guided"
        )
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except gemini_checklist_service.DailyLimitReached as exc:
        raise HTTPException(status_code=503, detail="The AI service has reached today's limit.") from exc
    except TimeoutError as exc:
        logger.error("checklist.analyze_timeout", item_id=item_id, error=str(exc))
        raise HTTPException(status_code=504, detail=str(exc)) from exc
    except Exception as exc:
        logger.exception("checklist.analyze_error", item_id=item_id, error=str(exc))
        raise HTTPException(status_code=502, detail="AI analysis failed") from exc

    return result.model_dump()


def _read(path: str) -> bytes:
    with open(path, "rb") as fh:
        return fh.read()
