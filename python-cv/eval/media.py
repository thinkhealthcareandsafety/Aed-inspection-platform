"""
Test media for the evaluation: close-ups cut from the site's real reference
photos, the ways a phone photo goes wrong in a stairwell, and generated
readiness clips with known truth.

Every transform is seeded, so a run today and a run in a month see exactly
the same pixels — a change in score is a change in the system, not the data.
"""
from __future__ import annotations

from pathlib import Path
from typing import Optional, Tuple

import cv2
import numpy as np

REPO = Path(__file__).resolve().parents[2]
REFERENCE = REPO / "frontend" / "public" / "reference"
SAMPLE_CAPTURES = REPO / "backend" / "src" / "scripts" / "sample-captures" / "sample"
CACHE = Path(__file__).resolve().parent / ".cache"

#: What the phone sends: the client re-encodes to 1600 px JPEG at 0.82.
UPLOAD_LONG_EDGE = 1600
UPLOAD_QUALITY = 82


def load(name: str) -> np.ndarray:
    path = SAMPLE_CAPTURES / name[len("sample:"):] if name.startswith("sample:") else REFERENCE / name
    img = cv2.imread(str(path))
    if img is None:
        raise FileNotFoundError(path)
    return img


def close_up(img: np.ndarray, centre: Tuple[float, float], width: float) -> np.ndarray:
    """A 4:3 close-up centred on a part, `width` as a share of the photo —
    what an inspector told to "photograph the label, close enough to read"
    actually sends."""
    h, w = img.shape[:2]
    cw = int(w * width)
    ch = int(cw * 3 / 4)
    x0 = int(min(max(0, centre[0] * w - cw / 2), w - cw))
    y0 = int(min(max(0, centre[1] * h - ch / 2), h - ch))
    return cv2.resize(img[y0:y0 + ch, x0:x0 + cw], (1200, 900), interpolation=cv2.INTER_LANCZOS4)


def degrade(img: np.ndarray, how: Optional[str]) -> np.ndarray:
    """The ways a field photo goes wrong."""
    if not how:
        return img
    rng = np.random.default_rng(11)
    h, w = img.shape[:2]
    if how == "blur_mild":  # a slightly shaky hand
        return cv2.GaussianBlur(img, (0, 0), 2.0)
    if how == "blur_heavy":  # moved during the shot
        return cv2.GaussianBlur(img, (0, 0), 9.0)
    if how == "dim":  # a dark stairwell, no flash
        out = img.astype(np.float32) * 0.28 + rng.normal(0, 7, img.shape)
        return np.clip(out, 0, 255).astype(np.uint8)
    if how == "glare":  # a ceiling light reflected across the label
        yy, xx = np.mgrid[0:h, 0:w]
        blob = np.exp(-(((xx - w * 0.58) / (w * 0.16)) ** 2 + ((yy - h * 0.5) / (h * 0.22)) ** 2))
        out = img.astype(np.float32) + blob[..., None] * 235
        return np.clip(out, 0, 255).astype(np.uint8)
    if how == "tilt":  # taken at an angle
        m = cv2.getRotationMatrix2D((w / 2, h / 2), 16, 1.05)
        return cv2.warpAffine(img, m, (w, h), borderMode=cv2.BORDER_REPLICATE)
    if how == "jpeg_low":  # an old phone, or a forwarded photo
        ok, buf = cv2.imencode(".jpg", img, [cv2.IMWRITE_JPEG_QUALITY, 12])
        return cv2.imdecode(buf, cv2.IMREAD_COLOR)
    if how == "far":  # taken from across the room, then zoomed
        small = cv2.resize(img, (w // 4, h // 4), interpolation=cv2.INTER_AREA)
        return cv2.resize(small, (w, h), interpolation=cv2.INTER_LINEAR)
    raise ValueError(how)


def upload_bytes(img: np.ndarray) -> bytes:
    h, w = img.shape[:2]
    scale = min(1.0, UPLOAD_LONG_EDGE / max(h, w))
    if scale < 1:
        img = cv2.resize(img, (int(w * scale), int(h * scale)), interpolation=cv2.INTER_AREA)
    ok, buf = cv2.imencode(".jpg", img, [cv2.IMWRITE_JPEG_QUALITY, UPLOAD_QUALITY])
    assert ok
    return buf.tobytes()


# ── Readiness clips ─────────────────────────────────────────────────────────
# Filmed close on the indicator, by a hand that drifts and jitters, with
# sensor noise. HS1: a ~130 ms green flash of the Ready light every 3 s, or
# none. ZOLL: the status window shows a steady green check, or a red X.

def _write(path: Path, frames, fps: int, size: Tuple[int, int]) -> None:
    out = cv2.VideoWriter(str(path), cv2.VideoWriter_fourcc(*"mp4v"), fps, size)
    for f in frames:
        out.write(f)
    out.release()


def _handheld(n: int, seed: int, scale: float):
    rng = np.random.default_rng(seed)
    drift = np.cumsum(rng.normal(0, 0.8 * scale, (n, 2)), axis=0)
    return drift + rng.normal(0, 1.2 * scale, (n, 2)), rng


def hs1_clip(flash_starts, seconds: int, green_button: bool = False, shake: float = 1.0, seed: int = 7) -> bytes:
    src = load("philips-hs1-front.jpg")
    led, button = (980, 118), (974, 174)
    fps, n = 30, seconds * 30
    lit = {int(s * fps) + k for s in flash_starts for k in range(4)}
    pos, rng = _handheld(n, seed, shake)

    def make():
        for i in range(n):
            img = src.copy()
            if green_button:  # an FRx's green On/Off button, beside the light
                cv2.circle(img, button, 34, (40, 150, 40), -1)
                cv2.circle(img, (button[0] - 8, button[1] - 10), 12, (90, 200, 90), -1)
            if i in lit:
                glow = np.zeros_like(img)
                cv2.ellipse(glow, led, (15, 7), 0, 0, 360, (60, 255, 90), -1)
                img = cv2.add(img, cv2.GaussianBlur(glow, (0, 0), 6))
                cv2.ellipse(img, led, (10, 4), 0, 0, 360, (190, 255, 200), -1)
            dx, dy = pos[i]
            m = np.float32([[1.6, 0, -968 + dx], [0, 1.6, 71 + dy]])
            f = cv2.warpAffine(img, m, (960, 720), borderMode=cv2.BORDER_REFLECT)
            yield np.clip(f.astype(np.int16) + rng.normal(0, 4, f.shape), 0, 255).astype(np.uint8)

    key = f"hs1-{seconds}s-{'-'.join(map(str, flash_starts)) or 'dark'}-{int(green_button)}-{shake}"
    return _cached(key, make, fps, (960, 720))


def zoll_clip(symbol: str, seconds: int = 4, seed: int = 5) -> bytes:
    """The AED Plus status window (left of the handle) showing a green check
    or a red X."""
    src = load("zoll-aed-plus-pads-connected.jpg")
    cx, cy = 720, 716  # the status window
    fps, n = 30, seconds * 30
    pos, rng = _handheld(n, seed, 0.8)
    base = src.copy()
    cv2.rectangle(base, (cx - 34, cy - 22), (cx + 34, cy + 22), (35, 35, 35), -1)
    if symbol == "check":
        cv2.polylines(base, [np.array([[cx - 16, cy + 1], [cx - 4, cy + 12], [cx + 18, cy - 13]])], False,
                      (40, 200, 60), 7, cv2.LINE_AA)
    else:
        cv2.line(base, (cx - 14, cy - 14), (cx + 14, cy + 14), (40, 40, 220), 7, cv2.LINE_AA)
        cv2.line(base, (cx - 14, cy + 14), (cx + 14, cy - 14), (40, 40, 220), 7, cv2.LINE_AA)
    def make():
        for i in range(n):
            dx, dy = pos[i]
            m = np.float32([[2.0, 0, -cx * 2.0 + 480 + dx], [0, 2.0, -cy * 2.0 + 300 + dy]])
            f = cv2.warpAffine(base, m, (960, 720), borderMode=cv2.BORDER_REFLECT)
            yield np.clip(f.astype(np.int16) + rng.normal(0, 4, f.shape), 0, 255).astype(np.uint8)

    return _cached(f"zoll-{symbol}-{seconds}s", make, fps, (960, 720))


def _cached(key: str, make, fps: int, size) -> bytes:
    """Generated once, then read back: the frames are only drawn if the
    clip isn't on disk yet."""
    CACHE.mkdir(exist_ok=True)
    path = CACHE / f"{key}.mp4"
    if not path.exists():
        _write(path, make(), fps, size)
    return path.read_bytes()
