"""
Cheap local frame-change detection.

Used to avoid spending Gemini API quota re-analyzing a frame that hasn't
meaningfully changed since the last frame that was actually sent for
analysis.
"""
from __future__ import annotations

import cv2
import numpy as np

# Mean per-pixel intensity delta (0-255) above which a frame is considered
# different enough to be worth a fresh Gemini call.
CHANGE_THRESHOLD = 6.0

# Larger delta above which we assume the inspector has moved to a new
# device/angle, not just held the same one steady — used to bust a
# state's locked-in result.
SCENE_CHANGE_THRESHOLD = 25.0


def compute_signature(frame: np.ndarray, size: tuple[int, int] = (32, 32)) -> np.ndarray:
    """Tiny grayscale thumbnail used as a cheap frame fingerprint."""
    gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
    return cv2.resize(gray, size, interpolation=cv2.INTER_AREA)


def signature_diff(a: np.ndarray, b: np.ndarray) -> float:
    """Mean absolute per-pixel difference between two signatures."""
    return float(np.abs(a.astype(int) - b.astype(int)).mean())
