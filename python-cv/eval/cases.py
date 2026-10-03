"""
The evaluation set: every case is a capture with a truth that was checked
by eye against the label itself.

Expectations
  pass    — it must pass, with the right reading where there is one.
  fail    — it must not pass (expired, faulty, wrong photo, wrong AED).
  either  — a degraded capture: reading it correctly or asking for a retake
            are both fine; passing it with a WRONG reading is not.

Truths (read off the reference photos, 30 Sep 2026)
  HS1 serial  A18A-06336        FRx serial  B17C-0051 + 6 or 8 (the last
  ZOLL serial X14K718292          digit is not resolvable at source size)
  HS1 battery install-before 2028-12-31      FRx battery 2022-12 (expired)
  Pads: HS1 2019/05, FRx 2020-09, ZOLL 2022-12-28 — all expired; the
  sample HS1 cartridge, re-dated from its own digits, 2026/11 — in date.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Callable, Optional, Tuple

from eval.media import close_up, degrade, hs1_clip, load, upload_bytes, zoll_clip

HS1, FRX, ZOLL = "Philips HS1", "Philips FRx", "Zoll AED Plus"


@dataclass(frozen=True)
class Case:
    id: str
    item: str
    model: str
    expect: str  # pass | fail | either
    build: Callable[[], bytes] = field(repr=False)
    content_type: str = "image/jpeg"
    serial: Optional[str] = None  # regex over letters and digits only
    expiry: Optional[str] = None  # YYYY-MM
    tags: Tuple[str, ...] = ()


def photo(name: str, centre=None, width=None, how: Optional[str] = None) -> Callable[[], bytes]:
    def build() -> bytes:
        img = load(name)
        if centre:
            img = close_up(img, centre, width)
        return upload_bytes(degrade(img, how))

    return build


def video(make: Callable[[], bytes]) -> Callable[[], bytes]:
    return make


# Close-ups of each label, framed the way the app's instructions ask.
HS1_SN = ("philips-hs1-back.jpg", (0.455, 0.868), 0.30)
FRX_SN = ("philips-frx-back.jpg", (0.46, 0.835), 0.30)
ZOLL_SN = ("zoll-aed-plus-back.jpg", (0.384, 0.627), 0.40)
HS1_BATT = ("philips-hs1-back.jpg", (0.17, 0.49), 0.36)
FRX_BATT = ("philips-frx-back.jpg", (0.21, 0.49), 0.34)
HS1_PADS_OLD = ("philips-hs1-pads.jpg", (0.505, 0.72), 0.30)
FRX_PADS = ("philips-frx-pads.jpg", (0.522, 0.70), 0.30)
ZOLL_PADS = ("zoll-aed-plus-pads.jpg", (0.566, 0.50), 0.32)
HS1_PADS_VALID = "sample:pads_expiry.jpg"  # already a close-up

HS1_SERIAL, FRX_SERIAL, ZOLL_SERIAL = r"A18A06336", r"B17C0051[68]", r"X14K71[86]292"


def _cases():
    c = []
    add = c.append

    # ── Serial number ──────────────────────────────────────────────────────
    add(Case("sn-hs1", "serial_number", HS1, "pass", photo(*HS1_SN), serial=HS1_SERIAL, tags=("clean",)))
    add(Case("sn-frx", "serial_number", FRX, "pass", photo(*FRX_SN), serial=FRX_SERIAL, tags=("clean",)))
    add(Case("sn-zoll", "serial_number", ZOLL, "pass", photo(*ZOLL_SN), serial=ZOLL_SERIAL, tags=("clean",)))
    add(Case("sn-hs1-whole-back", "serial_number", HS1, "either", photo("philips-hs1-back.jpg"),
             serial=HS1_SERIAL, tags=("degraded", "far")))
    for how in ("blur_mild", "blur_heavy", "dim", "glare", "tilt", "jpeg_low", "far"):
        add(Case(f"sn-hs1-{how}", "serial_number", HS1, "either", photo(*HS1_SN, how=how),
                 serial=HS1_SERIAL, tags=("degraded", how)))
    add(Case("sn-zoll-blur_heavy", "serial_number", ZOLL, "either", photo(*ZOLL_SN, how="blur_heavy"),
             serial=ZOLL_SERIAL, tags=("degraded", "blur_heavy")))
    add(Case("sn-wrong-photo", "serial_number", HS1, "fail", photo("aed-cabinet.jpg"), tags=("wrong_photo",)))
    add(Case("sn-wrong-model", "serial_number", HS1, "fail", photo(*ZOLL_SN), tags=("wrong_model",)))

    # ── Pads expiry ────────────────────────────────────────────────────────
    add(Case("pads-hs1-valid", "pads_expiry", HS1, "pass", photo(HS1_PADS_VALID), expiry="2026-11", tags=("clean",)))
    add(Case("pads-hs1-expired", "pads_expiry", HS1, "fail", photo(*HS1_PADS_OLD), expiry="2019-05", tags=("clean",)))
    add(Case("pads-frx-expired", "pads_expiry", FRX, "fail", photo(*FRX_PADS), expiry="2020-09", tags=("clean",)))
    add(Case("pads-zoll-expired", "pads_expiry", ZOLL, "fail", photo(*ZOLL_PADS), expiry="2022-12", tags=("clean",)))
    for how in ("blur_mild", "blur_heavy", "dim", "glare", "tilt"):
        add(Case(f"pads-hs1-valid-{how}", "pads_expiry", HS1, "either", photo(HS1_PADS_VALID, how=how),
                 expiry="2026-11", tags=("degraded", how)))
    add(Case("pads-wrong-photo", "pads_expiry", HS1, "fail", photo("rescue-kit.jpg"), tags=("wrong_photo",)))

    # ── Battery expiry ─────────────────────────────────────────────────────
    add(Case("batt-hs1", "battery_expiry", HS1, "pass", photo(*HS1_BATT), expiry="2028-12", tags=("clean",)))
    add(Case("batt-frx-expired", "battery_expiry", FRX, "fail", photo(*FRX_BATT), expiry="2022-12", tags=("clean",)))
    add(Case("batt-hs1-whole-back", "battery_expiry", HS1, "either", photo("philips-hs1-back.jpg"),
             expiry="2028-12", tags=("degraded", "far")))
    for how in ("dim", "tilt", "blur_heavy"):
        add(Case(f"batt-hs1-{how}", "battery_expiry", HS1, "either", photo(*HS1_BATT, how=how),
                 expiry="2028-12", tags=("degraded", how)))

    # ── Battery attached ───────────────────────────────────────────────────
    add(Case("attached-hs1", "battery_attached", HS1, "pass", photo("philips-hs1-back.jpg"), tags=("clean",)))
    add(Case("attached-frx", "battery_attached", FRX, "pass", photo("philips-frx-back.jpg"), tags=("clean",)))
    add(Case("attached-zoll", "battery_attached", ZOLL, "pass", photo("zoll-aed-plus-battery-fitted.jpg"), tags=("clean",)))
    add(Case("attached-zoll-missing", "battery_attached", ZOLL, "fail", photo("zoll-aed-plus-battery-missing.jpg"),
             tags=("clean", "fault")))
    add(Case("attached-zoll-missing-dim", "battery_attached", ZOLL, "fail",
             photo("zoll-aed-plus-battery-missing.jpg", how="dim"), tags=("degraded", "fault")))
    add(Case("attached-wrong-model", "battery_attached", HS1, "fail", photo("zoll-aed-plus-battery-fitted.jpg"),
             tags=("wrong_model",)))

    # ── Pads connected ─────────────────────────────────────────────────────
    add(Case("connected-hs1", "pads_connected", HS1, "pass", photo("philips-hs1-front.jpg"), tags=("clean",)))
    add(Case("connected-zoll", "pads_connected", ZOLL, "pass", photo("zoll-aed-plus-pads-connected.jpg"), tags=("clean",)))
    add(Case("connected-zoll-unplugged", "pads_connected", ZOLL, "fail", photo("zoll-aed-plus-pads-unplugged.jpg"),
             tags=("clean", "fault")))
    add(Case("connected-zoll-unplugged-blur", "pads_connected", ZOLL, "fail",
             photo("zoll-aed-plus-pads-unplugged.jpg", how="blur_mild"), tags=("degraded", "fault")))
    # An FRx with nothing in its pads port, sent in by the owner on 3 Oct
    # 2026: the model passed it one time in two, "the plug inserted".
    add(Case("connected-frx-unplugged", "pads_connected", FRX, "fail",
             photo("repo:python-cv/eval/media/frx-pads-unplugged.png"), tags=("clean", "fault")))
    add(Case("connected-wrong-photo", "pads_connected", HS1, "fail", photo("philips-hs1-back.jpg"),
             tags=("wrong_photo",)))
    add(Case("connected-wrong-model", "pads_connected", HS1, "fail", photo("zoll-aed-plus-pads-connected.jpg"),
             tags=("wrong_model",)))

    # ── Optional extras ────────────────────────────────────────────────────
    add(Case("child-frx-key", "child_key_pad", FRX, "pass", photo("philips-frx-child-key.jpg"), tags=("clean",)))
    add(Case("cabinet", "aed_cabinet", HS1, "pass", photo("aed-cabinet.jpg"), tags=("clean",)))
    add(Case("cabinet-wrong-photo", "aed_cabinet", HS1, "fail", photo("rescue-kit.jpg"), tags=("wrong_photo",)))
    add(Case("kit", "first_response_kit", HS1, "pass", photo("rescue-kit.jpg"), tags=("clean",)))
    add(Case("kit-wrong-photo", "first_response_kit", HS1, "fail", photo("aed-cabinet.jpg"), tags=("wrong_photo",)))

    # ── Readiness (video) ──────────────────────────────────────────────────
    vid = dict(content_type="video/mp4")
    add(Case("ready-hs1-blink", "readiness_indicator", HS1, "pass",
             video(lambda: hs1_clip([1.2, 4.2, 7.2], 10)), tags=("clean",), **vid))
    add(Case("ready-hs1-dark", "readiness_indicator", HS1, "fail",
             video(lambda: hs1_clip([], 10)), tags=("clean", "fault"), **vid))
    add(Case("ready-hs1-one-flash", "readiness_indicator", HS1, "pass",
             video(lambda: hs1_clip([2.6], 4)), tags=("clean",), **vid))
    add(Case("ready-frx-blink-button", "readiness_indicator", FRX, "pass",
             video(lambda: hs1_clip([0.8, 5.5], 10, green_button=True, shake=2.5)), tags=("clean",), **vid))
    add(Case("ready-frx-dark-button", "readiness_indicator", FRX, "fail",
             video(lambda: hs1_clip([], 10, green_button=True, shake=2.5)), tags=("clean", "fault"), **vid))
    add(Case("ready-zoll-check", "readiness_indicator", ZOLL, "pass",
             video(lambda: zoll_clip("check")), tags=("clean",), **vid))
    add(Case("ready-zoll-x", "readiness_indicator", ZOLL, "fail",
             video(lambda: zoll_clip("x")), tags=("clean", "fault"), **vid))
    return c


CASES = _cases()
