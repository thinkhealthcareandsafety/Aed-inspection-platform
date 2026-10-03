"""
What the vision model needs to know about each AED it inspects.

Every fact here comes from the manufacturer's own documentation:
  - Philips HeartStart FRx Owner's Manual (861304, edition 13)
  - Philips HeartStart OnSite (HS1) Owner's Manual (M5066A, edition 14)
  - ZOLL Fully Automatic AED Plus Administrator's Guide (9650-0311-01)
  - ZOLL "Instructions for the Installation of New Batteries and Battery
    Replacement Label" addendum to the AED Plus Administrator's Guide
  - ZOLL AED 3 Administrator's Guide (9650-000762-01 Rev. A, and
    9650-000752-01 Rev. L) and Operator's Manual (9650-002750-01 Rev. A)
  - Powerheart AED G3 Plus Operator and Service Manual (70-00914-01 F) and
    G3 9300A/9300E manual (70-00966-01 F)
  - Powerheart G5 User's Guide (70-02104-02 D)

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
from typing import Dict, Optional, Tuple


@dataclass(frozen=True)
class DeviceProfile:
    id: str
    name: str
    #: How to recognise the unit, so the model can say so when the photo
    #: shows a different one.
    appearance: str
    #: checklist item id -> device-specific guidance for that item.
    guidance: Dict[str, str] = field(default_factory=dict)
    #: The unit shows it is ready by BLINKING a light (Philips). Its ready
    #: verdict must then be backed by a flash found in the video itself —
    #: see readiness_frames.py. Units that show a steady symbol (ZOLL's
    #: green check) or unknown units are judged on what the model sees.
    blinking_ready: bool = False
    #: The maker, for telling when a photo shows a different brand of AED.
    brand: Optional[str] = None
    #: Other makers' names the same unit legitimately carries. Powerheart
    #: units are sold as Cardiac Science and, since ZOLL bought the line, as
    #: ZOLL — neither is "a different AED".
    brand_aliases: Tuple[str, ...] = ()
    #: Which retake message (gemini_checklist_service._OVERRIDE_NOTES) to
    #: show when a "ready" can't be backed by a frame: it names this unit's
    #: indicator and what its fault looks like.
    readiness_retake: str = "readiness_no_evidence"
    #: Set when the unit's battery carries NO expiry, only a manufacture
    #: date (Powerheart Intellisense batteries). The service then dates it
    #: itself: this many months from installation if that date is written
    #: on it, else from manufacture — never later than the truth, since a
    #: battery can't be installed before it is made.
    battery_life_months: Optional[int] = None


PHILIPS_FRX = DeviceProfile(
    id="Philips FRx",
    name="Philips HeartStart FRx",
    blinking_ready=True,
    brand="Philips",
    readiness_retake="readiness_no_blink",
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
            "The pads connector port is a small socket in the TOP-LEFT corner "
            "of the FRx's front face, above the dark grey panel. Empty, it "
            "shows as a recessed slot with two small dark rectangular "
            "openings side by side, and nothing comes out of it. Connected, "
            "a blue plug fills that slot and a pads cable runs out of it, "
            "towards the sealed SMART Pads II case (usually stored in the "
            "carry-case pocket, not on the unit). Pass only if the blue plug "
            "and its cable are visible in the port. If you can see the two "
            "openings, or no plug and cable at all, the pads are NOT "
            "connected — a fail. A loose or half-inserted plug is a fail."
        ),
        "readiness_indicator": (
            "The FRx's Ready light is a small green light on the front, near "
            "but separate from the green On/Off button. Never judge the On/Off "
            "button's colour: the button is green whether or not the unit is "
            "ready. In standby a healthy FRx BLINKS its Ready light green, the "
            "flashes several seconds apart, so most frames show it dark. Only a "
            "frame where the Ready light itself is visibly lit green shows it is "
            "ready; never assume it flashed between frames. "
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
    blinking_ready=True,
    brand="Philips",
    readiness_retake="readiness_no_blink",
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
            "once every 3 seconds, so most frames show it dark. Only a frame "
            "where the Ready light itself is visibly lit green shows it is "
            "ready; never assume it flashed between frames. Solid green means "
            "it is in use. The Ready "
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
    brand="ZOLL",
    readiness_retake="readiness_no_check",
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


ZOLL_AED_3 = DeviceProfile(
    id="Zoll AED 3",
    name="ZOLL AED 3",
    brand="ZOLL",
    readiness_retake="readiness_no_check_aed3",
    appearance=(
        "A lime-green ZOLL unit, upright, with a carry strap across the top "
        "and a colour touch screen in the centre of the front. Top left: a "
        "blue On/Off button with the small Status Indicator window just to "
        "its right. Below the screen: the Shock button (lightning bolt); "
        "bottom right: the Child button (two-children icon). The pads cable "
        "plugs in at the top right. The battery pack and the sealed pads "
        "package both fit into the back."
    ),
    guidance={
        "serial_number": (
            "The serial number is on the device label on the back of the AED, "
            "just above the left corner of the battery pack, beside 'SN' or "
            "the serial-number symbol; on its barcode line it may follow the "
            "GS1 field code '(21)', which is not part of the serial. The "
            "battery pack carries its own barcode label: that is not the "
            "AED's serial number, and neither is the REF/catalogue number."
        ),
        "pads_expiry": (
            "The AED 3 uses CPR Uni-padz (one pack for adults and children; "
            "CPR-D-padz, CPR Stat-padz, Stat-padz II and Pedi-padz II also "
            "fit). The sealed pads package sits in the back of the unit, "
            "label facing out, with its cable running to the connector on the "
            "front. The expiry date is printed beside the hourglass symbol on "
            "that label, year-month-day (for example 2024-04-19); a GS1 line "
            "may repeat it after '(17)' as YYMMDD."
        ),
        "battery_expiry": (
            "The AED 3 battery pack clicks into the back of the unit, its "
            "white label facing out. Report the INSTALL-BY date: ZOLL's own "
            "self-test fails the unit with CHANGE BATTERY once a fitted "
            "battery is past it. On the label it sits on the barcode line "
            "after the GS1 field code '(15)', as YYMMDD (for example "
            "'(15)280419' is 2028-04-19), and may also be printed beside the "
            "install-by or hourglass symbol. A date beside a factory symbol, "
            "or after '(11)', is the manufacture date."
        ),
        "battery_attached": (
            "The battery pack fits into the battery well in the back of the "
            "AED 3, notch lined up with the well, and is pushed in until it "
            "clicks. Correctly fitted it sits flush with the case, both side "
            "tabs latched. An empty well, a tilted pack, a raised end or a "
            "visible gap is a fail."
        ),
        "pads_connected": (
            "ZOLL requires the pads to be pre-connected at all times: the "
            "pads cable plugs into the defibrillation pad connector at the "
            "top right of the front, and the sealed pads package sits in the "
            "back. Pass only if the plug is fully seated in the connector. An "
            "empty connector or a loose, half-inserted plug is a fail — the "
            "AED would say PLUG IN PADS CABLE."
        ),
        "readiness_indicator": (
            "The AED 3 shows readiness in the small Status Indicator window "
            "at the top left of the front, just to the right of the blue "
            "On/Off button. A GREEN CHECK MARK in the window means it passed "
            "its last self-test and is ready (status='ready'); judge it on "
            "the frames where the check is visible, and never fail it for not "
            "blinking. A BLANK window, with no green check, means it failed "
            "its self-test or has no working battery and is NOT ready "
            "(status='fault') — but only call it blank when the window is "
            "clearly in view and in focus. Ignore the touch screen, the "
            "Shock and Child buttons and any reflection. In the first 4-5 "
            "seconds after the unit is switched on the window changes from "
            "blank to the check, which is normal. If the window can't be "
            "seen or read, status='unclear'."
        ),
        "child_key_pad": (
            "The AED 3 has no child key. Its CPR Uni-padz serve adults AND "
            "children: for a child the rescuer presses the Child button "
            "(two-children icon, bottom right of the front). Pedi-padz II "
            "(child-only pads) also fit. Set present=true and pass if the "
            "connected pads package is CPR Uni-padz (its label shows the "
            "child weight/age range, under 8 years / 25 kg) or a sealed "
            "Pedi-padz II pack is present. If the connected pads are adult-"
            "only (CPR-D-padz, CPR Stat-padz or Stat-padz II) and no Pedi-"
            "padz II is present, set present=false, passed=false and say the "
            "unit has no child pads."
        ),
    },
)


POWERHEART_G3 = DeviceProfile(
    id="Zoll Powerheart G3",
    name="Cardiac Science (ZOLL) Powerheart G3",
    brand="Cardiac Science",
    brand_aliases=("ZOLL",),
    readiness_retake="readiness_no_rescue_ready",
    battery_life_months=48,
    appearance=(
        "A flat, navy-blue and yellow Cardiac Science Powerheart AED G3 with "
        "a carry handle and a clear plastic lid that opens with a yellow "
        "button. Through the lid you can see the sealed pads package and its "
        "expiry date. The round Rescue Ready status indicator is beside the "
        "handle. Under the lid: a diagnostic panel (battery gauge, pads and "
        "service lights) and a text display. The battery fits into the "
        "bottom of the unit."
    ),
    guidance={
        "serial_number": (
            "Cardiac Science puts the serial and model numbers on the label "
            "on the UNDERSIDE of the AED. Report the number beside 'SN' or "
            "the serial-number symbol. The model number (such as 9390A, "
            "9300A, 9300P) and the REF are not the serial, and neither is "
            "the battery's own label."
        ),
        "pads_expiry": (
            "The G3 uses sealed defibrillation pads (adult 9131; child 9730) "
            "stored in the lid, connected by their cable. The expiry date is "
            "beside the hourglass ('use pads by this date') symbol on the "
            "pads package and is visible through the clear lid without "
            "opening it; it is printed on the front and the back of the "
            "package, year-month-day (for example 2019-12-28). A date beside "
            "a factory symbol is the manufacture date."
        ),
        "battery_expiry": (
            "The G3's Intellisense lithium battery (9146 or 9145) fits into "
            "the bottom of the unit. It carries NO expiry date: its label "
            "shows the date it was MANUFACTURED (factory symbol, year and "
            "month, sometimes a day). Cardiac Science guarantees it for 4 "
            "years from installation, with a 5-year shelf life before "
            "installation. Put that date in manufacture_date and leave "
            "expiry_date null — the app works out the replacement date. If "
            "an installation date has been written on the battery or a "
            "sticker on it, put it in install_date. These notes override the "
            "general date rules above: on this battery the manufacture date "
            "IS the date to read, a missing expiry is normal, and notes must "
            "never ask the inspector to find one. Set date_legible=true only "
            "if you read the manufacture date with certainty."
        ),
        "battery_attached": (
            "The battery fits into a slot in the BOTTOM of the G3 and is "
            "pressed down until it clicks. Correctly fitted it is flush with "
            "the case. An empty slot, a battery sitting raised or crooked, or "
            "a gap is a fail. With the lid open, a red battery light on the "
            "diagnostic panel's gauge means the battery is low."
        ),
        "pads_connected": (
            "The pads must be pre-connected: the pads package sits in the "
            "lid and its cable's connector plugs into the pad socket under "
            "the lid. Pass only if the connector is fully plugged in. With "
            "the lid open, a lit Pads indicator (pads icon on the diagnostic "
            "panel) means the pads are not connected or not usable — a fail. "
            "An empty socket or a loose connector is a fail."
        ),
        "readiness_indicator": (
            "The G3 has NO blinking ready light. Its Rescue Ready status "
            "indicator is the round window beside the carry handle. GREEN "
            "(with no black X) means the self-tests passed and it is Rescue "
            "Ready: status='ready'; never fail it for not blinking. RED with "
            "a BLACK X means it needs attention and is not ready: "
            "status='fault'. Opening or closing the lid runs a self-test "
            "during which the indicator turns red for about 5 seconds and "
            "then back to green — red that turns green within the clip is "
            "normal and ready. Judge only this indicator, never the yellow "
            "lid button or a reflection. If it can't be seen or its colour "
            "read, status='unclear'."
        ),
        "child_key_pad": (
            "The G3's child option is a separate sealed pack of 9730 "
            "Pediatric Attenuated Defibrillation Electrodes, for children up "
            "to 8 years or 25 kg (55 lb), kept with the AED as a spare while "
            "the adult pads stay connected. Pass if a sealed pediatric pads "
            "pack is present."
        ),
    },
)


POWERHEART_G5 = DeviceProfile(
    id="Zoll Powerheart G5",
    name="Cardiac Science (ZOLL) Powerheart G5",
    brand="Cardiac Science",
    brand_aliases=("ZOLL",),
    readiness_retake="readiness_no_rescue_ready",
    battery_life_months=48,
    appearance=(
        "An upright, orange Powerheart G5 (Cardiac Science or ZOLL) with a "
        "grey carry handle and a lid. The front of the lid has a large AED "
        "heart graphic and a small window, marked YEAR/MM, showing the pads' "
        "expiry date. The round Rescue Ready indicator is at the top right, "
        "beside the handle. Under the lid: the pads in their holders, the "
        "pad socket, and a display panel with battery, pads and service "
        "lights. The battery fits into the bottom of the unit."
    ),
    guidance={
        "serial_number": (
            "The serial number is on the device label after 'SN' or the "
            "serial-number symbol (on the back of the unit), and is repeated "
            "inside the battery compartment on the bottom. On a barcode line "
            "it may follow '(21)', which is not part of the serial. The "
            "model/REF number (for example G5A-80A) is not the serial, and "
            "neither is the battery's own label."
        ),
        "pads_expiry": (
            "The G5's pads (XELAED001 adult, XELAED002 adult with CPR "
            "feedback device, XELAED003 paediatric) come in a sealed package "
            "kept in the lid. The pads' expiry date shows through the "
            "expiration window on the front of the lid (marked YEAR/MM) and "
            "is printed beside the hourglass symbol on the package. A date "
            "beside a factory symbol is the manufacture date."
        ),
        "battery_expiry": (
            "The G5's Intellisense lithium battery (XBTAED001) fits into the "
            "bottom of the unit. It carries NO expiry date: its label shows "
            "the date it was MANUFACTURED (factory symbol). ZOLL guarantees "
            "it for 4 years from installation, with a 5-year shelf life "
            "before installation. Put that date in manufacture_date and leave "
            "expiry_date null — the app works out the replacement date. If "
            "an installation date has been written on the battery or a "
            "sticker on it, put it in install_date. These notes override the "
            "general date rules above: on this battery the manufacture date "
            "IS the date to read, a missing expiry is normal, and notes must "
            "never ask the inspector to find one. Set date_legible=true only "
            "if you read the manufacture date with certainty."
        ),
        "battery_attached": (
            "The battery fits into the compartment in the BOTTOM of the G5: "
            "it is lowered in and pressed down until it clicks, and its tab "
            "latches. Correctly fitted it is flush with the case. An empty "
            "compartment, a battery sitting raised or crooked, or a gap is a "
            "fail. With the lid open, a red battery light on the display "
            "panel means the battery is low."
        ),
        "pads_connected": (
            "The adult pads must be pre-connected: the package sits in the "
            "pad package holders under the lid and its connector plugs into "
            "the pad socket. Pass only if the connector is fully plugged in. "
            "With the lid open, a lit pads indicator on the display panel "
            "means the pads are not connected or not usable — a fail. An "
            "empty socket or a loose connector is a fail."
        ),
        "readiness_indicator": (
            "The G5 has NO blinking ready light. Its Rescue Ready indicator "
            "is the round window at the top right, beside the handle, "
            "ringed by the words RESCUE READY. GREEN means the self-tests "
            "passed and it is Rescue Ready: status='ready'; never fail it "
            "for not blinking. RED means it needs attention and is not "
            "ready: status='fault'. Closing the lid runs a self-test during "
            "which the indicator turns red for a few seconds and then back to "
            "green — red that turns green within the clip is normal and "
            "ready. Judge only this indicator, never the orange case or a "
            "reflection. If it can't be seen or its colour read, "
            "status='unclear'."
        ),
        "child_key_pad": (
            "The G5's child option is XELAED003 paediatric pads, for "
            "children 8 or under or 25 kg (55 lb) or less. ZOLL says they "
            "are NOT to be pre-connected: keep them sealed beside the AED, "
            "with the adult pads connected. Pass if a sealed paediatric pads "
            "pack is present and stored beside the AED. If paediatric pads "
            "are the ones plugged into the AED, set present=true but "
            "passed=false and say to reconnect adult pads and keep the "
            "paediatric pads beside it."
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
            "blinks in standby (Philips and others), a status window with a "
            "green check/tick (ZOLL), or a Rescue Ready indicator that is "
            "green or red (Cardiac Science Powerheart). A red light, a red X, "
            "a blank status window, a flashing service or i-button, or "
            "chirping means the unit is not ready."
        ),
        "child_key_pad": (
            "Child options differ by brand: an infant/child key (Philips FRx), "
            "an infant/child pads cartridge (Philips HS1), pads that serve "
            "adults and children with a Child button (ZOLL CPR Uni-padz), or a "
            "separate pack of paediatric pads (ZOLL Pedi-padz II, Powerheart "
            "and others)."
        ),
    },
)


PROFILES: Dict[str, DeviceProfile] = {
    profile.id: profile
    for profile in (PHILIPS_FRX, PHILIPS_HS1, ZOLL_AED_PLUS, ZOLL_AED_3, POWERHEART_G3, POWERHEART_G5)
}


def get_profile(aed_model: Optional[str]) -> DeviceProfile:
    """The profile for a model id as the app stores it ('Philips FRx'),
    or the generic one when the model is missing or unknown."""
    if not aed_model:
        return GENERIC
    return PROFILES.get(aed_model.strip(), GENERIC)
