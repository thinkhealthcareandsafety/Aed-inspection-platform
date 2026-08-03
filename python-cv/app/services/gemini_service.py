"""
Gemini Vision Service.

Single entry point for all AI-driven AED inspection analysis. Replaces the
previous YOLO detection + manufacturer-plugin + OCR pipeline with one
multimodal call per analysed frame.
"""
from __future__ import annotations

import asyncio
from typing import Optional

import structlog
from google import genai
from google.genai import types
from pydantic import BaseModel, Field

from app.core.config import settings

logger = structlog.get_logger(__name__)

GEMINI_MODEL = "gemini-3.1-flash-lite"

# A hung call must not freeze the inspection session indefinitely — better
# to surface a timeout as a retryable error than to block forever.
REQUEST_TIMEOUT_SECONDS = 20.0

# Steps understood by the prompt. WAIT covers the initial "locate the
# machine" phase; the remaining five map 1:1 onto the inspection state
# machine's phases (IDENTIFY, SERIAL, PADS, BATTERY, STATUS).
_STEP_PROMPTS = {
    "WAIT": (
        "Determine whether a wall-mounted or portable AED (automated external "
        "defibrillator) is clearly visible and reasonably centred in frame."
    ),
    "IDENTIFY": (
        "Identify the AED's manufacturer and model from its casing, logo, and "
        "any visible branding text."
    ),
    "SERIAL": (
        "Locate the manufacturer's serial number label (often on the back or "
        "underside of the unit) and read the serial number exactly as printed."
    ),
    "PADS": (
        "Locate the electrode pads label and read the pads expiry date "
        "(normalise to YYYY-MM or YYYY-MM-DD)."
    ),
    "BATTERY": (
        "Locate the battery compartment label and read the battery expiry date "
        "(normalise to YYYY-MM or YYYY-MM-DD)."
    ),
    "STATUS": (
        "Check the AED's status indicator (LED, LCD icon, or tick/cross window) "
        "and determine whether it shows the unit is ready for use (pass) or "
        "faulted (fail)."
    ),
}


class GeminiStepData(BaseModel):
    manufacturer: Optional[str] = None
    model: Optional[str] = None
    serial_number: Optional[str] = None
    pads_expiry: Optional[str] = None
    battery_expiry: Optional[str] = None
    status_indicator_ok: Optional[bool] = None


class GeminiAnalysisResult(BaseModel):
    step: str
    progress: int = Field(ge=0, le=100)
    instruction: str
    completed: bool
    status: str  # "in_progress" | "pass" | "fail"
    data: GeminiStepData = Field(default_factory=GeminiStepData)


_client: Optional[genai.Client] = None


def _get_client() -> genai.Client:
    global _client
    if _client is None:
        _client = genai.Client(api_key=settings.GEMINI_API_KEY)
    return _client


def _build_prompt(current_step: str) -> str:
    task = _STEP_PROMPTS.get(current_step, _STEP_PROMPTS["IDENTIFY"])
    return (
        "You are the vision engine for an automated AED (defibrillator) "
        "inspection app. You receive one live camera frame at a time and must "
        f"respond with the current inspection step's result.\n\n"
        f"Current step: {current_step}\n"
        f"Task: {task}\n\n"
        "Only set completed=true once you are confident in the reading for "
        "this step. progress is the overall inspection completion percentage "
        "(0-100), increasing monotonically as steps complete. instruction is "
        "a short, friendly sentence telling the inspector what to do next "
        "(e.g. where to move the camera). Leave any data field you cannot "
        "read as null — never guess."
    )


async def analyze_inspection_frame(
    image_bytes: bytes, current_step: str
) -> GeminiAnalysisResult:
    """
    Analyse a single JPEG frame for the given inspection step.

    Replaces the previous YOLO + manufacturer-plugin + OCR pipeline with a
    single multimodal Gemini call. Raises on API failure — callers should
    catch and degrade gracefully (see InspectionStateMachine.process_frame).
    """
    client = _get_client()

    try:
        response = await asyncio.wait_for(
            client.aio.models.generate_content(
                model=GEMINI_MODEL,
                contents=[
                    types.Part.from_bytes(data=image_bytes, mime_type="image/jpeg"),
                    _build_prompt(current_step),
                ],
                config=types.GenerateContentConfig(
                    response_mime_type="application/json",
                    response_schema=GeminiAnalysisResult,
                    temperature=0.1,
                ),
            ),
            timeout=REQUEST_TIMEOUT_SECONDS,
        )
    except asyncio.TimeoutError as exc:
        raise TimeoutError(
            f"Gemini call for step={current_step} exceeded {REQUEST_TIMEOUT_SECONDS}s"
        ) from exc

    parsed = response.parsed
    if isinstance(parsed, GeminiAnalysisResult):
        return parsed

    # Fallback: SDK didn't populate .parsed — validate the raw JSON text.
    return GeminiAnalysisResult.model_validate_json(response.text)
