"""
AED Inspection Checklist — item catalogue.

Replaces the old continuous live-video state machine with 10 discrete
checklist items split into 3 sections. Each item is satisfied by a single
uploaded photo (or, for the readiness indicator, a short video) and one
Gemini call. Scoped specifically to the two devices this app supports:
Philips HeartStart FRx and HeartStart HS1.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Literal, Optional

MediaType = Literal["image", "video"]

_PHILIPS_CONTEXT = (
    "The device being inspected is a Philips HeartStart FRx or HeartStart "
    "HS1 AED — both bright orange/yellow rugged cases with a green "
    "flashing status light on the front and a single push-button "
    "operation. Use this knowledge of Philips FRx/HS1 label placement and "
    "part appearance to read the image accurately, but do not assume a "
    "device is a Philips unit if the image clearly shows otherwise — "
    "flag that in `notes` instead of guessing."
)


@dataclass(frozen=True)
class ChecklistItem:
    id: str
    section: int
    order: int
    title: str
    description: str
    media_type: MediaType
    required: bool
    prompt: str


CHECKLIST_ITEMS: list[ChecklistItem] = [
    # ── Section 1 — Consumables & identification ────────────────────────
    ChecklistItem(
        id="serial_number",
        section=1,
        order=1,
        title="Serial number",
        description="Live photo of the manufacturer serial number label.",
        media_type="image",
        required=True,
        prompt=(
            f"{_PHILIPS_CONTEXT}\n\n"
            "Find the manufacturer serial number label. On the FRx it is on "
            "the back of the case; on the HS1 it is on the underside/back "
            "near the battery compartment, often printed near a barcode. "
            "Read the serial number exactly as printed (letters and digits, "
            "keep leading zeros). This is fine print — if it is too small, "
            "angled, glared, or blurry to read with certainty, do not "
            "guess: leave serial_number null, set passed=false, and explain "
            "in notes what the inspector should change (move closer, "
            "reduce glare, hold steady)."
        ),
    ),
    ChecklistItem(
        id="pads_expiry",
        section=1,
        order=2,
        title="Pads expiry",
        description="Photo of the electrode pads packaging expiry date.",
        media_type="image",
        required=True,
        prompt=(
            f"{_PHILIPS_CONTEXT}\n\n"
            "Find the electrode pads label — either on the sealed pads "
            "cartridge/pouch itself or the pads connector cassette. Read "
            "the expiry date exactly as printed into expiry_raw_text, and "
            "also set expiry_date normalised to YYYY-MM or YYYY-MM-DD. "
            "This is fine print — if unclear, leave both null, set "
            "passed=false, and explain what to fix in notes."
        ),
    ),
    ChecklistItem(
        id="battery_expiry",
        section=1,
        order=3,
        title="Battery expiry",
        description="Photo of the battery label expiry date. Lot & serial number are optional.",
        media_type="image",
        required=True,
        prompt=(
            f"{_PHILIPS_CONTEXT}\n\n"
            "Find the battery label (Philips FRx/HS1 batteries are usually "
            "a black or dark-grey pack, model M5070A or similar, that slides "
            "into the back/bottom of the unit). Read the expiry date "
            "exactly as printed into expiry_raw_text, and also set "
            "expiry_date normalised to YYYY-MM or YYYY-MM-DD. This is fine "
            "print — if unclear, leave both null, set passed=false, and "
            "explain what to fix in notes.\n\n"
            "Also try to read the battery's LOT number and serial number if "
            "visible on the same label — set lot_number and "
            "battery_serial_number if legible. These two fields are "
            "optional: never fail the check or lower pass/confidence just "
            "because they are missing or unreadable — only the expiry date "
            "is mandatory for this item."
        ),
    ),
    # ── Section 2 — Physical status ──────────────────────────────────────
    ChecklistItem(
        id="battery_attached",
        section=2,
        order=4,
        title="Battery attached",
        description="Photo confirming the battery is fully seated in the machine.",
        media_type="image",
        required=True,
        prompt=(
            f"{_PHILIPS_CONTEXT}\n\n"
            "Determine whether the battery pack is fully and correctly "
            "inserted/latched into the AED body, with no visible gap, tilt, "
            "or the release latch left unseated. Set passed=true only if the "
            "battery is clearly, fully attached. If the photo doesn't show "
            "the battery compartment clearly enough to judge, set "
            "passed=false and ask the inspector for a clearer angle in notes."
        ),
    ),
    ChecklistItem(
        id="pads_connected",
        section=2,
        order=5,
        title="Pads connected",
        description="Photo confirming the pads connector is plugged into the machine.",
        media_type="image",
        required=True,
        prompt=(
            f"{_PHILIPS_CONTEXT}\n\n"
            "Determine whether the electrode pads connector is firmly "
            "plugged into the AED's pads port (on the FRx this is a small "
            "connector socket on the top edge; on the HS1 the pads "
            "cartridge slots into the top of the case). Set passed=true only "
            "if the connection is clearly seated with no visible gap. If "
            "unclear, set passed=false and ask for a clearer angle in notes."
        ),
    ),
    ChecklistItem(
        id="readiness_indicator",
        section=2,
        order=6,
        title="Readiness indicator",
        description="Short video of the status-light blink pattern.",
        media_type="video",
        required=True,
        prompt=(
            f"{_PHILIPS_CONTEXT}\n\n"
            "WHERE TO LOOK — this is the single most common mistake, avoid "
            "it: the readiness indicator is a SMALL round status LED, not "
            "the large green power button. On the FRx it sits just above "
            "or beside the big green circular ON/OFF button (the button "
            "printed with a power symbol and the number '1' — that button "
            "itself is NOT the indicator, ignore its color/state entirely, "
            "even if it is lit or green). On the HS1 the equivalent small "
            "status light/window is near the carry-handle end of the case. "
            "Locate that small LED specifically before judging anything.\n\n"
            "HOW TO JUDGE IT — a healthy, ready-to-use unit blinks that "
            "small LED green on a slow cycle; the gap between flashes "
            "varies by unit and can be as long as 4-5 seconds, so a short "
            "clip may only catch ONE flash, or catch it right at the very "
            "start or end of the clip — that is completely normal and is "
            "NOT a fault. Watch the ENTIRE clip carefully, frame by frame, "
            "start to finish. If you see even ONE distinct green flash of "
            "that small LED anywhere in the clip, that alone is sufficient "
            "evidence: set status='ready', passed=true. Only set "
            "status='fault' if that small LED is clearly, unambiguously "
            "lit solid RED, or you can positively confirm it stays "
            "completely dark/off for the full clip with the LED plainly "
            "in frame and in focus the whole time. Do not require seeing "
            "a full on-off-on cycle — one confirmed green flash is enough "
            "to pass.\n\n"
            "If you cannot clearly identify the small LED's position or "
            "color at all in this clip (e.g. it's completely out of frame, "
            "far too dark to make out any color, or too blurry/shaky to "
            "tell), set status='unclear', passed=false, and say "
            "specifically in notes what to fix — e.g. 'record at least "
            "10 seconds since blinks can be up to 5 seconds apart', 'move "
            "closer to the small status LED, not the power button', or "
            "'hold the camera steady and well lit'. Reserve 'unclear' for "
            "genuinely unusable footage — if the LED is visible at all, "
            "prefer making a 'ready'/'fault' call over 'unclear'."
        ),
    ),
    # ── Section 3 — Accessories & signage (all optional) ─────────────────
    ChecklistItem(
        id="child_key_pad",
        section=3,
        order=7,
        title="Child key / child pads",
        description="Photo of the paediatric key or child pads, if present.",
        media_type="image",
        required=False,
        prompt=(
            f"{_PHILIPS_CONTEXT}\n\n"
            "Determine whether a paediatric/child key (FRx) or child pads "
            "cartridge (HS1) is present and stored with the unit. Set "
            "present=true/false and passed=true if present and in good "
            "condition. This accessory is optional on many deployments — "
            "if genuinely absent, set present=false, passed=false, and note "
            "'not present' rather than treating it as unreadable."
        ),
    ),
    ChecklistItem(
        id="aed_cabinet",
        section=3,
        order=8,
        title="AED cabinet",
        description="Photo of the wall cabinet/case housing the AED.",
        media_type="image",
        required=False,
        prompt=(
            f"{_PHILIPS_CONTEXT}\n\n"
            "Assess the AED wall cabinet or carry case: door/lid closes "
            "properly, no cracked glass or broken latch, visible and "
            "unobstructed. Set passed=true if the cabinet looks intact and "
            "usable, false with a reason in notes otherwise."
        ),
    ),
    ChecklistItem(
        id="first_response_kit",
        section=3,
        order=9,
        title="Fast response kit",
        description="Photo of the accompanying rescue kit (gloves, razor, scissors, mask).",
        media_type="image",
        required=False,
        prompt=(
            f"{_PHILIPS_CONTEXT}\n\n"
            "Check whether a fast/first response kit (gloves, razor, "
            "scissors, CPR face shield) is present alongside the AED. Set "
            "present=true/false and passed=true if present and appears "
            "complete/unopened. If absent, set present=false, passed=false, "
            "note 'not present'."
        ),
    ),
    ChecklistItem(
        id="emergency_contacts",
        section=3,
        order=10,
        title="Emergency contacts sticker",
        description="Photo confirming an emergency contact sticker is on the machine or cabinet.",
        media_type="image",
        required=False,
        prompt=(
            f"{_PHILIPS_CONTEXT}\n\n"
            "Check whether an emergency contact sticker/label (e.g. local "
            "emergency number, site contact, 'call 911/999/112 first') is "
            "affixed to the AED unit or its cabinet and legible. Set "
            "present=true/false and passed=true if present and legible. If "
            "absent or illegible, set present=false, passed=false, and say "
            "why in notes."
        ),
    ),
]

_BY_ID = {item.id: item for item in CHECKLIST_ITEMS}


def get_item(item_id: str) -> Optional[ChecklistItem]:
    return _BY_ID.get(item_id)
