"""
Gemini Vision Service — checklist mode.

One multimodal Gemini call per uploaded photo/video, scoped to a single
checklist item (see `checklist_items.py`). This replaces the old
continuous per-frame WebSocket state machine: the inspector captures or
uploads one piece of media per item, and gets one AI verdict back.
"""
from __future__ import annotations

import asyncio
from datetime import date, datetime, timezone
from typing import List, Optional

import structlog
from google import genai
from google.genai import errors, types
from pydantic import BaseModel, Field

from app.core.config import settings
from app.services.checklist_items import ChecklistItem, get_item
from app.services import readiness_frames
from app.services.device_profiles import DeviceProfile, get_profile
from app.utils import validators
from app.utils.date_parser import expiry_last_valid_day, parse_all_expiry_dates, parse_gs1_dates

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
# demand" 503 — too eager for a spike that usually clears in seconds. Each
# model keeps retrying with short backoff inside the overall budget (see
# _first_answer), which absorbs that without surfacing a failure to the
# inspector mid-checklist. Only Google-side (5xx) errors and stalled calls
# are retried — a bad request or auth failure (4xx) won't fix itself.
RETRY_BACKOFF_SECONDS = (1.0, 2.5)
OVERALL_TIMEOUT_SECONDS = 35.0
# A video is one check per inspection, and a required one: it gets a longer
# budget so hedged retries can finish. Still inside the browser's upload
# timeout (60 s of analysis on top of the upload itself).
VIDEO_TIMEOUT_SECONDS = 50.0
# No single call may hold the budget hostage: an overloaded model's refusal
# alone can take 12-16 s to arrive.
PER_ATTEMPT_TIMEOUT_SECONDS = 18.0
# How long the stronger model runs alone before the next one in the chain is
# asked too. A healthy 3.6 answers a 20-frame sequence in ~6.5 s, so it
# usually wins; when it is overloaded, the fallback's answer is already on
# its way.
HEDGE_DELAY_SECONDS = 4.0

# How the video reaches the model — every frame scanned for the Ready
# light's flashes, then labelled frames sent — lives in readiness_frames.py.


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
    # readiness_indicator only: the numbered frames (or, for a raw video,
    # the seconds) in which the model can see the ready signal. A "ready"
    # with none is not accepted — see _check_readiness.
    ready_frames: Optional[List[int]] = None
    # The same message as `notes`, in Hindi, when the inspector is using the
    # app in Hindi. `notes` stays English: it is what the PDF report and the
    # sales team read.
    notes_hi: Optional[str] = None


# Languages the inspector's feedback can be written in, besides English.
SUPPORTED_LANGUAGES = {"hi"}

_HINDI_MONTHS = (
    "जनवरी", "फ़रवरी", "मार्च", "अप्रैल", "मई", "जून",
    "जुलाई", "अगस्त", "सितंबर", "अक्टूबर", "नवंबर", "दिसंबर",
)

# The fixed messages this module writes when it overrules the model. Each
# replaces the model's own notes — so each needs its Hindi form too, or a
# Hindi reader would be shown the model's now-contradicted verdict.
_OVERRIDE_NOTES = {
    "implausible_serial": (
        "Serial number reading looked implausible — please recapture with the label centred and in focus.",
        "सीरियल नंबर ठीक से नहीं पढ़ा जा सका। लेबल को बीच में रखकर, साफ़ और फ़ोकस में फिर से फ़ोटो लें।",
    ),
    "manufacture_as_expiry": (
        "That date is the manufacture date, not the expiry date. Look for the date marked "
        "'Install before' or with an hourglass symbol and photograph that part of the label.",
        "यह बनने की तारीख है, एक्सपायरी की नहीं। 'Install before' या रेत-घड़ी (⌛) वाले निशान के पास "
        "लिखी तारीख ढूँढें और लेबल के उस हिस्से की फ़ोटो लें।",
    ),
    "readiness_no_blink": (
        "We couldn't see the green Ready light flash. Film only the small Ready light (not the "
        "On/Off button), up close and steady, for at least 10 seconds. If it never flashes, "
        "the AED needs attention.",
        "हमें हरी Ready लाइट जलती हुई नहीं दिखी। सिर्फ़ छोटी Ready लाइट (On/Off बटन नहीं) का पास से, "
        "फ़ोन स्थिर रखकर, कम से कम 10 सेकंड का वीडियो बनाएँ। अगर यह कभी नहीं जलती, तो AED को जाँच की ज़रूरत है।",
    ),
    "readiness_no_check": (
        "We couldn't clearly see a green check in the status window. Film the window on the "
        "handle up close and steady for about 5 seconds. A red X means the AED needs attention.",
        "हमें स्टेटस विंडो में हरा ✓ साफ़ नहीं दिखा। हैंडल पर लगी विंडो का पास से, फ़ोन स्थिर रखकर, "
        "करीब 5 सेकंड का वीडियो बनाएँ। लाल ✗ का मतलब है कि AED को जाँच की ज़रूरत है।",
    ),
    "readiness_no_evidence": (
        "We couldn't clearly see the AED's ready signal. Film the readiness indicator up close "
        "and steady for at least 10 seconds.",
        "हमें AED का रेडी सिग्नल साफ़ नहीं दिखा। रेडीनेस इंडिकेटर का पास से, फ़ोन स्थिर रखकर, "
        "कम से कम 10 सेकंड का वीडियो बनाएँ।",
    ),
    "implausible_expiry": (
        "Expiry date reading looked implausible — please recapture with the label centred, well lit, and in focus.",
        "एक्सपायरी डेट ठीक से नहीं पढ़ी जा सकी। लेबल को बीच में रखकर, अच्छी रोशनी में और फ़ोकस में फिर से फ़ोटो लें।",
    ),
}


def _override_notes(key: str, language: Optional[str]) -> dict:
    english, hindi = _OVERRIDE_NOTES[key]
    return {"notes": english, "notes_hi": hindi if language == "hi" else None}


def _expired_notes(item_id: str, last_valid: date, language: Optional[str]) -> dict:
    what = "pads" if item_id == "pads_expiry" else "battery"
    english = (
        f"The {what} expired on {last_valid.strftime('%d %b %Y')}. "
        f"Replace the {what} before this AED is relied on in an emergency."
    )
    hindi = None
    if language == "hi":
        when = f"{last_valid.day} {_HINDI_MONTHS[last_valid.month - 1]} {last_valid.year}"
        hindi = (
            f"पैड्स {when} को एक्सपायर हो चुके हैं। किसी इमरजेंसी में इस AED पर भरोसा करने से पहले पैड्स बदलें।"
            if what == "pads"
            else f"बैटरी {when} को एक्सपायर हो चुकी है। किसी इमरजेंसी में इस AED पर भरोसा करने से पहले बैटरी बदलें।"
        )
    return {"notes": english, "notes_hi": hindi}


_client: Optional[genai.Client] = None


def _get_client() -> genai.Client:
    global _client
    if _client is None:
        _client = genai.Client(api_key=settings.GEMINI_API_KEY)
    return _client


def _build_prompt(
    item: ChecklistItem,
    profile: DeviceProfile,
    frame_count: Optional[int] = None,
    language: Optional[str] = None,
    duration: Optional[float] = None,
) -> str:
    clip = f"a {duration:.0f}-second video clip" if duration else "a short video clip"
    sequence_note = (
        (
            f"You are given {frame_count} still frames from {clip}, in strict "
            "chronological order, each preceded by its label (\"Frame 3 — "
            "1.2 s\"). They are not evenly spaced. Treat them as one "
            "continuous observation of the same scene over time, not as "
            "separate photos: a change seen in only one or two frames (a "
            "light turning on, then off again) is exactly the kind of brief "
            "event to look for. Refer to frames by their numbers.\n\n"
        )
        if frame_count
        else ""
    )
    guidance = profile.guidance.get(item.id)
    device_notes = f"Device notes for this item ({profile.name}):\n{guidance}\n\n" if guidance else ""
    language_rule = (
        "Also fill notes_hi with the same message as notes, in simple, "
        "everyday Hindi in Devanagari script, the way site staff in India "
        "speak: keep common product words in their usual Hindi form (AED, "
        "पैड्स, बैटरी, सीरियल नंबर, एक्सपायरी डेट, फ़ोटो, वीडियो). Keep notes "
        "itself in English."
        if language == "hi"
        else "Leave notes_hi null."
    )
    return (
        "You are the vision engine for an AED (defibrillator) inspection "
        "checklist app. You receive photo(s) for exactly one checklist "
        "item and must return a single structured verdict.\n\n"
        # The model has no reliable sense of the current date. Without this it
        # judged a 2026 expiry as "still valid" in late 2026. The server makes
        # the final expired/not-expired call regardless; this keeps the notes
        # it writes consistent with that verdict.
        f"Today's date is {datetime.now(timezone.utc).date().isoformat()}. "
        "A date earlier than today is in the past.\n\n"
        # Which unit this is. Every device-specific fact the model is given
        # comes from this profile, so it never judges one brand by another's
        # layout. If the photo shows something else, it says so.
        f"DEVICE: {profile.name}. {profile.appearance} If the image clearly "
        "shows a different device, say so in notes and judge only what you "
        "can see.\n\n"
        f"{sequence_note}"
        f"Checklist item: {item.title}\n"
        f"Task: {item.prompt}\n\n"
        f"{device_notes}"
        "Always set confidence (0.0-1.0) to your own honest certainty in "
        "this specific media — a blurry, distant, dark, or ambiguous capture "
        "should score low even if you still produced a best-effort answer. "
        "notes is one short, friendly sentence: if passed=false, tell the "
        "inspector exactly what to fix or recapture; if passed=true, briefly "
        "confirm what you saw. Leave any data field you cannot determine as "
        f"null — never guess. {language_rule}"
    )


def _mime_type_for(item: ChecklistItem, declared_content_type: Optional[str]) -> str:
    if declared_content_type and "/" in declared_content_type:
        return declared_content_type
    return "video/mp4" if item.media_type == "video" else "image/jpeg"


async def analyze_checklist_item(
    item_id: str,
    media_bytes: bytes,
    content_type: Optional[str] = None,
    *,
    aed_model: Optional[str] = None,
    language: Optional[str] = None,
) -> ChecklistAnalysisResult:
    """Analyse one uploaded photo/video against its checklist item prompt,
    for the given AED model (profile) and inspector language."""
    item = get_item(item_id)
    if item is None:
        raise ValueError(f"Unknown checklist item: {item_id}")

    profile = get_profile(aed_model)
    lang = language if language in SUPPORTED_LANGUAGES else None
    logger.info("checklist.analyze", item_id=item_id, profile=profile.id, language=lang or "en")

    client = _get_client()

    video = readiness_frames.prepare(media_bytes) if item.media_type == "video" else None

    if video:
        logger.info(
            "checklist.frames_prepared",
            item_id=item_id,
            count=len(video.frames),
            flashes=video.flash_count,
            duration=video.duration,
        )
        contents = []
        for number, (frame, at) in enumerate(zip(video.frames, video.times), start=1):
            contents.append(types.Part(text=f"Frame {number} — {at:.1f} s"))
            contents.append(types.Part.from_bytes(data=frame, mime_type="image/jpeg"))
        contents.append(
            _build_prompt(item, profile, frame_count=len(video.frames), language=lang, duration=video.duration)
        )
        models = list(GEMINI_VIDEO_MODELS)
    else:
        mime_type = _mime_type_for(item, content_type)
        contents = [
            types.Part.from_bytes(data=media_bytes, mime_type=mime_type),
            _build_prompt(item, profile, language=lang),
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

    async def _keep_trying(model: str, head_start: float):
        """One model's lane: wait out its head start, then call it — and, on
        a Google-side error or a stalled call, call it again — until it
        answers or the overall budget cancels it."""
        await asyncio.sleep(head_start)
        attempt = 0
        while True:
            attempt += 1
            if attempt > 1 or head_start > 0:
                logger.info("checklist.gemini_attempt", item_id=item_id, model=model, attempt=attempt)
            try:
                return await asyncio.wait_for(_call_once(model), timeout=PER_ATTEMPT_TIMEOUT_SECONDS)
            except (errors.ServerError, asyncio.TimeoutError) as exc:
                logger.warning(
                    "checklist.gemini_server_error",
                    item_id=item_id,
                    model=model,
                    attempt=attempt,
                    error=str(exc) or type(exc).__name__,
                )
                await asyncio.sleep(RETRY_BACKOFF_SECONDS[min(attempt - 1, len(RETRY_BACKOFF_SECONDS) - 1)])

    async def _first_answer():
        """Hedged calls: each model in the chain gets its own lane, started
        HEDGE_DELAY_SECONDS after the one before it, and the first answer
        wins. Measured against production, an overloaded model can take
        12-16 s just to say "503 high demand"; walking the chain in order
        spent the whole budget on those refusals before the healthy model
        was ever asked, and the video check timed out for everyone."""
        lanes = [
            asyncio.create_task(_keep_trying(model, index * HEDGE_DELAY_SECONDS))
            for index, model in enumerate(models)
        ]
        try:
            last_error: Optional[BaseException] = None
            for finished in asyncio.as_completed(lanes):
                try:
                    return await finished
                except asyncio.CancelledError:
                    raise
                except Exception as exc:  # a 4xx: this lane gave up for good
                    last_error = exc
            raise last_error  # type: ignore[misc]
        finally:
            for lane in lanes:
                lane.cancel()

    budget = VIDEO_TIMEOUT_SECONDS if item.media_type == "video" else OVERALL_TIMEOUT_SECONDS
    try:
        response = await asyncio.wait_for(_first_answer(), timeout=budget)
    except asyncio.TimeoutError as exc:
        raise TimeoutError(f"Gemini call for checklist item={item_id} exceeded {budget}s") from exc

    parsed = response.parsed
    result = (
        parsed
        if isinstance(parsed, ChecklistAnalysisResult)
        else ChecklistAnalysisResult.model_validate_json(response.text)
    )

    return _apply_deterministic_checks(item, result, language=lang, profile=profile, video=video)


def _check_readiness(
    result: ChecklistAnalysisResult,
    profile: Optional[DeviceProfile],
    video: Optional[readiness_frames.ReadinessFrames],
    language: Optional[str],
) -> ChecklistAnalysisResult:
    """A readiness pass has to be backed by something checkable.

    - The model must name the frames (or, for a raw video, the seconds) in
      which it sees the ready signal. A "ready" it can't point to is not
      accepted — that is how a unit whose light never came on used to pass.
    - A unit that proves readiness by blinking (Philips) must also have
      blinked: if the scan of every frame found no flash at all, no reading
      of the frames by the model can pass it.
    - passed follows status, never the other way round, so a "passed" with
      no status, or a status of fault with passed=true, can't slip through.
    It only ever turns a pass into "unclear" — a retake, with exactly what
    to film — and never turns a fail into a pass."""
    status = (result.status or "").strip().lower()
    if status not in ("ready", "fault", "unclear"):
        status = "ready" if result.passed else "unclear"

    reason = None
    if status == "ready":
        cited = [n for n in (result.ready_frames or []) if n >= 0]
        if video is not None:
            cited = [n for n in cited if 1 <= n <= len(video.frames)]
        if not cited:
            reason = "no evidence"
        elif profile is not None and profile.blinking_ready and video is not None and video.flash_count == 0:
            reason = "no flash in video"

    if reason:
        logger.info(
            "checklist.readiness_overruled",
            reason=reason,
            profile=getattr(profile, "id", None),
            cited=result.ready_frames,
            flashes=getattr(video, "flash_count", None),
        )
        key = (
            "readiness_no_blink"
            if profile is not None and profile.blinking_ready
            else "readiness_no_check"
            if profile is not None and profile.id == "Zoll AED Plus"
            else "readiness_no_evidence"
        )
        return result.model_copy(
            update={
                "status": "unclear",
                "passed": False,
                "confidence": min(result.confidence, 0.5),
                **_override_notes(key, language),
            }
        )
    return result.model_copy(update={"status": status, "passed": status == "ready"})


def _apply_deterministic_checks(
    item: ChecklistItem,
    result: ChecklistAnalysisResult,
    *,
    today: Optional[date] = None,
    language: Optional[str] = None,
    profile: Optional[DeviceProfile] = None,
    video: Optional[readiness_frames.ReadinessFrames] = None,
) -> ChecklistAnalysisResult:
    """Downgrade an implausible read the same way the old state machine did
    — cheap, deterministic sanity checks independent of Gemini's own
    confidence score. Never upgrades a verdict, only vetoes bad ones; the
    only values it changes are ones a standard defines (a GS1 field code
    copied into a serial, a GS1 expiry the model read differently)."""
    # Hindi feedback only when it was asked for — never a stray one.
    if language != "hi" and result.notes_hi:
        result = result.model_copy(update={"notes_hi": None})

    if item.id == "readiness_indicator":
        return _check_readiness(result, profile, video, language)

    if item.id == "serial_number" and result.serial_number:
        # "(21) X14K718292" on a ZOLL label is field code + serial; "SN: ..."
        # on a Philips one is caption + serial. Only the serial is stored.
        cleaned = validators.normalise_serial(result.serial_number)
        if cleaned != result.serial_number:
            result = result.model_copy(update={"serial_number": cleaned or None})
        if not validators.is_plausible_serial(result.serial_number):
            logger.warning("checklist.implausible_serial", value=result.serial_number)
            return result.model_copy(
                update={
                    "passed": False,
                    "serial_number": None,
                    **_override_notes("implausible_serial", language),
                }
            )

    if item.id in ("pads_expiry", "battery_expiry") and result.expiry_date:
        gs1 = parse_gs1_dates(result.expiry_raw_text or "")

        # A manufacture date reported as the expiry is the worst failure mode
        # here — it makes fresh stock look years dead, raises a false alarm
        # with the customer, and puts a bogus entry in the replacement
        # pipeline. If the model handed back the same date for both, or the
        # date the barcode itself labels as production, it read one date and
        # guessed at its meaning; refuse it rather than publish it.
        gs1_production = gs1.get("11")
        if (result.manufacture_date and result.manufacture_date == result.expiry_date) or (
            gs1_production and gs1_production == result.expiry_date and gs1.get("17") != result.expiry_date
        ):
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
                    **_override_notes("manufacture_as_expiry", language),
                }
            )

        # A GS1 '(17)' field is the expiry by definition of the standard —
        # no symbol to interpret, no date order to guess. When the model's
        # reading of the printed dates disagrees with it, the barcode wins.
        gs1_expiry = gs1.get("17")
        if gs1_expiry and gs1_expiry[:7] != result.expiry_date[:7]:
            logger.warning(
                "checklist.expiry_corrected_from_gs1",
                item=item.id,
                model_said=result.expiry_date,
                gs1=gs1_expiry,
            )
            result = result.model_copy(update={"expiry_date": gs1_expiry})

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
                    **_override_notes("implausible_expiry", language),
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

        # The verdict on an expiry is decided here, against the server's own
        # clock — never by the model. The model has no grounded sense of the
        # current date: in production it failed pads marked 2024-06 but PASSED
        # pads marked 2026-03 and 2026-08, both already expired, because to it
        # 2026 did not yet look like the past. An AED inspection that calls
        # expired pads "ready" is failing at the single thing it exists to do.
        reference_day = today or datetime.now(timezone.utc).date()
        last_valid = expiry_last_valid_day(result.expiry_date)
        if last_valid is not None and last_valid < reference_day:
            logger.warning(
                "checklist.expired_consumable",
                item=item.id,
                expiry=result.expiry_date,
                model_said_passed=result.passed,
            )
            return result.model_copy(
                update={"passed": False, **_expired_notes(item.id, last_valid, language)}
            )

    return result
