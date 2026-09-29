"""
What the vision model needs to know about each AED it inspects.

Every fact here comes from the manufacturer's own documentation:
  - Philips HeartStart FRx Owner's Manual (861304, edition 13)
  - Philips HeartStart OnSite (HS1) Owner's Manual (M5066A, edition 14)
  - ZOLL Fully Automatic AED Plus Administrator's Guide (9650-0311-01)
  - ZOLL "Instructions for the Installation of New Batteries and Battery
    Replacement Label" addendum to the AED Plus Administrator's Guide

The prompts used to describe every unit as a Philips. That failed healthy
ZOLLs — whose ready signal is a steady green tick in a window, judged
against a Philips "small LED that blinks" — and described even the Philips
units wrongly (the M5070A battery as "black or dark-grey"; it is blue; the
HS1's pads cartridge as slotting into "the top of the case"; it fits a well
on the front). A prompt that describes the wrong device fails good units
or passes broken ones, so nothing goes in here that the manufacturer
doesn't say.

A profile supplies the device-specific WHERE and WHAT for each checklist
item; the device-neutral task and judging rules stay in checklist_items.py.
An unknown model gets the generic profile, which describes AEDs in general.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Dict, Optional


@dataclass(frozen=True)
class DeviceProfile:
    id: str
    name: str
    #: How to recognise the unit, so the model can say so when the photo
    #: shows a different one.
    appearance: str
    #: checklist item id -> device-specific guidance for that item.
    guidance: Dict[str, str] = field(default_factory=dict)


PHILIPS_FRX = DeviceProfile(
    id="Philips FRx",
    name="Philips HeartStart FRx",
    appearance=(
        "A rugged blue-grey Philips unit, wider than it is tall, usually kept "
        "in a carry case. Front: a green On/Off button, a blue i-button that "
        "flashes when the unit needs attention, an orange Shock button, and a "
        "small green Ready light. Back: the battery compartment and small "
        "white labels, one of them the serial number."
    ),
    guidance={
        "serial_number": (
            "The serial number is on the small white label at the bottom "
            "centre of the back panel, printed after 'SN:' (for example "
            "'SN: B17C-00516') above a barcode. The label beside it reads "
            "'SERVICE #' — that is not the serial number, and neither is the "
            "REF/model number (861304) on the large label."
        ),
        "pads_expiry": (
            "The FRx uses HeartStart SMART Pads II: a grey plastic pads case "
            "on a cable that ends in a blue plug. The expiration date is on "
            "the small white label near the bottom of the front of the case, "
            "beside an hourglass symbol and under the words 'EXPIRATION DATE' "
            "(for example 2020-09), with the LOT number beneath it. The case "
            "stays sealed until it is used."
        ),
        "battery_expiry": (
            "The FRx uses the M5070A lithium battery: a blue pack that clicks "
            "into the compartment on the back of the unit. Its label is often "
            "printed sideways and reads 'Install before' followed by the date "
            "(for example 'Install before 2022-12'). Philips says the battery "
            "must be installed before that date — it is the one to report. A "
            "date beside a factory symbol is the manufacture date."
        ),
        "battery_attached": (
            "The blue M5070A battery sits in the compartment on the back of "
            "the FRx. Correctly fitted, its bottom end is seated first and its "
            "top (latch) end is pressed down until it clicks, so the battery "
            "lies flush with the case. A raised latch end, a visible gap, a "
            "tilted battery or an empty compartment is a fail."
        ),
        "pads_connected": (
            "The SMART Pads II cable ends in a blue plug that must be pushed "
            "fully into the FRx's pads connector port; the sealed pads case "
            "itself is usually stored in the carry-case pocket rather than "
            "attached to the unit. Pass only if the blue plug is fully seated "
            "in the port. A loose, half-inserted or unplugged connector is a "
            "fail."
        ),
        "readiness_indicator": (
            "The FRx's Ready light is a small green light on the front, near "
            "but separate from the green On/Off button. Never judge the On/Off "
            "button's colour: the button is green whether or not the unit is "
            "ready. In standby a healthy FRx BLINKS its Ready light green, the "
            "flashes several seconds apart — gaps between flashes are normal. "
            "Solid green means it is in use or running a self-test. The Ready "
            "light off, or a flashing blue i-button, means the FRx needs "
            "attention (a failed self-test, a pads problem, a child key left "
            "installed, or low battery)."
        ),
        "child_key_pad": (
            "The FRx's child option is the Infant/Child Key: a blue key with a "
            "pink pivoting ring, showing an infant/child pads-placement diagram "
            "and '< 55 LBS / 25 KG'. Philips instructs NOT to store the FRx "
            "with the key installed: left in the slot at the top centre of the "
            "front panel, it puts the unit in child mode and makes it chirp. "
            "Pass if the key is present and stored beside the AED. If it is "
            "inserted in the FRx, set present=true but passed=false and say to "
            "remove it and keep it beside the AED."
        ),
    },
)


PHILIPS_HS1 = DeviceProfile(
    id="Philips HS1",
    name="Philips HeartStart HS1 (OnSite)",
    appearance=(
        "A rounded blue Philips unit with a grip on its left side and a clear "
        "pads cartridge with a green PULL handle fitted in a well on the "
        "front. Front, right side: a small green Ready light in the upper "
        "right, a green On/Off button, a blue i-button and an orange Shock "
        "button. Back: the battery recess and small white labels, one of "
        "them the serial number."
    ),
    guidance={
        "serial_number": (
            "The serial number is on the small white label at the bottom "
            "centre of the back, printed after 'SN:' (for example "
            "'SN: A18A-06336') above a barcode. The neighbouring 'SERVICE #' "
            "label and the REF/model number on the large label are not the "
            "serial number."
        ),
        "pads_expiry": (
            "The HS1 uses a SMART Pads Cartridge: a clear plastic cartridge "
            "with a green PULL handle, fitted in the cartridge well on the "
            "front of the unit. The expiry date is printed on a small label "
            "just below the body diagram, beside an hourglass symbol (for "
            "example 2019/05), with the LOT number underneath. An infant/child "
            "cartridge also carries a teddy-bear icon."
        ),
        "battery_expiry": (
            "The HS1 uses the M5070A lithium battery: a blue pack inserted in "
            "the recess on the back. Its label is often printed sideways and "
            "carries more than one date. Report the install-before date — "
            "marked by an arrow pointing into a bracket or the words 'Install "
            "before' (for example 2028-12-31) — never the date beside the "
            "factory symbol, which is when the battery was made."
        ),
        "battery_attached": (
            "The blue M5070A battery sits in a recess on the back of the HS1 "
            "and should lie flush and latched, with no gap or raised end. An "
            "empty recess, a tilted battery or a raised edge is a fail."
        ),
        "pads_connected": (
            "On the HS1 the pads cartridge IS the connection — there is no "
            "separate cable to plug in. Pass if a pads cartridge is fitted in "
            "the cartridge well on the front, clicked into place, with its "
            "green PULL handle pushed all the way down. Fail if the well is "
            "empty, the cartridge sits raised or crooked, or the green handle "
            "is pulled up (pulling it starts a rescue and opens the "
            "cartridge)."
        ),
        "readiness_indicator": (
            "The HS1's Ready light is a small green light in the upper right "
            "of the front, just above the green On/Off button. Never judge the "
            "On/Off button's colour: it is green whether or not the unit is "
            "ready. In standby a healthy HS1 BLINKS its Ready light green about "
            "once every 3 seconds. Solid green means it is in use. The Ready "
            "light off, a flashing blue i-button or chirping means the unit "
            "needs attention."
        ),
        "child_key_pad": (
            "The HS1's child option is the Infant/Child SMART Pads Cartridge: "
            "a pads cartridge marked with a teddy-bear icon and a patient-"
            "weight limit (under 25 kg / 55 lbs). Philips recommends keeping "
            "the ADULT cartridge fitted and storing the infant/child cartridge "
            "beside the AED as a spare. Pass if a sealed infant/child "
            "cartridge is present. If it is fitted in place of the adult "
            "cartridge, still pass, but note that Philips recommends keeping "
            "the adult cartridge fitted."
        ),
    },
)


ZOLL_AED_PLUS = DeviceProfile(
    id="Zoll AED Plus",
    name="ZOLL AED Plus",
    appearance=(
        "A bright lime-green ZOLL unit with a hinged cover and a moulded "
        "carry handle. Under the cover: a grey panel of step pictograms, an "
        "optional small screen and the electrode connector. On the left of "
        "the handle is the Status Indicator window; on the right, the power "
        "button. The battery compartment is on the back and holds ten "
        "lithium 123 photo cells."
    ),
    guidance={
        "serial_number": (
            "The serial number is on a barcode label on the back of the unit, "
            "just below the carry handle, printed in GS1 style as "
            "'(21) X14K718292'. The '(21)' is the barcode's field code for "
            "'serial number' and is NOT part of the serial: report only what "
            "follows it (X14K718292). The large lime label lower down carries "
            "regulatory text, not the serial."
        ),
        "pads_expiry": (
            "The AED Plus uses CPR-D-padz (one-piece adult electrodes; Stat-"
            "padz II also exist), kept pre-connected and folded under the "
            "unit's cover, supplied in a sealed pack that often comes in a "
            "white box. The expiry date sits beside an hourglass symbol on the "
            "front label (for example 2022-12-28) and is repeated with the LOT "
            "on the end of the box. A GS1 line such as '(17)221228' encodes "
            "the same expiry as YYMMDD."
        ),
        "battery_expiry": (
            "The AED Plus runs on ten lithium 123 photo cells in a battery "
            "well on the back. The date that matters is handwritten on the "
            "white 'REPLACE BATTERIES ON OR BEFORE:' label (battery-over-"
            "hourglass symbol) stuck just below the Status Indicator window on "
            "the handle — report that date. A ZOLL battery pack's own label "
            "may show an 'Install before' date: its shelf life before fitting. "
            "The date printed on each individual cell (Duracell 'YYYY/MM', or "
            "'MMYY') is the cell's MANUFACTURE date according to ZOLL — never "
            "report it as the expiry. If a cell date is the only date visible, "
            "set expiry_date=null and passed=false, and ask for a photo of the "
            "'Replace batteries on or before' label below the status window."
        ),
        "battery_attached": (
            "The battery compartment is on the back, under a cover. With the "
            "cover off, all ten 123 cells should be seated in the battery "
            "well, correctly oriented, none missing. With the cover on, pass "
            "if it is closed and latched flush, and note that the cells "
            "themselves were not visible. An empty well, a missing cell or a "
            "loose cover is a fail."
        ),
        "pads_connected": (
            "The electrodes must be pre-connected: their cable plugs into the "
            "electrode connector on the unit, under the cover beside the "
            "pictogram panel, with the pads folded inside the cover. Pass only "
            "if the plug is fully seated in the connector. An empty socket or "
            "a loose plug is a fail — ZOLL notes the unit fails its self-test "
            "and shows a red X when the electrodes are not connected."
        ),
        "readiness_indicator": (
            "The AED Plus has NO blinking ready light. Its Status Indicator is "
            "a small window on the LEFT side of the carry handle that shows a "
            "symbol: a GREEN CHECK MARK means the unit passed its last self-"
            "test and is ready for use; a RED X means it failed and is not "
            "ready. The green check is normally steady — a steady green check "
            "through the clip is a PASS (status='ready'); never fail it for "
            "not blinking. A red X is a fault (status='fault') — except for "
            "the first 4-5 seconds after the unit is switched on, when the "
            "window shows a red X before changing to the check, which is "
            "normal. If the window can't be seen or read, status='unclear'."
        ),
        "child_key_pad": (
            "The AED Plus's child option is Pedi-padz II: a separate sealed "
            "pack of infant/child electrodes with child placement diagrams, "
            "for children under 8 years / 25 kg. Adult CPR-D-padz should "
            "normally be the ones connected; Pedi-padz II are kept with the "
            "AED as a spare. Pass if a sealed Pedi-padz II pack is present."
        ),
    },
)


GENERIC = DeviceProfile(
    id="generic",
    name="an automated external defibrillator (AED) whose make and model were not given",
    appearance=(
        "Identify the make and model from the image if you can, and mention "
        "it in notes. Do not assume a particular brand's layout."
    ),
    guidance={
        "serial_number": (
            "Serial number labels are usually on the back or underside, marked "
            "'SN', 'S/N' or 'SER', or in GS1 barcode text after '(21)'."
        ),
        "readiness_indicator": (
            "AEDs show readiness in different ways: a small green light that "
            "blinks in standby (Philips and others), or a status window with a "
            "green check/tick (ZOLL). A red light, a red X, a flashing service "
            "or i-button, or chirping means the unit is not ready."
        ),
        "child_key_pad": (
            "Child options differ by brand: an infant/child key (Philips FRx), "
            "an infant/child pads cartridge (Philips HS1), or a separate pack "
            "of paediatric pads (ZOLL Pedi-padz II and others)."
        ),
    },
)


PROFILES: Dict[str, DeviceProfile] = {
    profile.id: profile for profile in (PHILIPS_FRX, PHILIPS_HS1, ZOLL_AED_PLUS)
}


def get_profile(aed_model: Optional[str]) -> DeviceProfile:
    """The profile for a model id as the app stores it ('Philips FRx'),
    or the generic one when the model is missing or unknown."""
    if not aed_model:
        return GENERIC
    return PROFILES.get(aed_model.strip(), GENERIC)
