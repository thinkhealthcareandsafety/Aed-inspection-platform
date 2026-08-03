"""
Frame capture utilities — JPEG encoding and quality selection.
"""
from __future__ import annotations

from typing import Optional
import cv2
import numpy as np


def capture_frame_jpeg(frame: np.ndarray, quality: int = 85) -> bytes:
    """Encode a BGR numpy array as JPEG bytes."""
    _, buf = cv2.imencode(".jpg", frame, [cv2.IMWRITE_JPEG_QUALITY, quality])
    return buf.tobytes()


def select_best_frame(frames: list[np.ndarray]) -> Optional[np.ndarray]:
    """
    From a list of frames, select the sharpest well-lit one.
    Returns None if list is empty.
    """
    if not frames:
        return None

    from app.schemas.frame import FrameQuality
    scored = [(FrameQuality.compute(f), f) for f in frames]
    # Filter acceptable frames
    acceptable = [(q, f) for q, f in scored if q.is_acceptable]
    if not acceptable:
        # Fallback: best blur score even if not "acceptable"
        acceptable = scored
    # Sort by blur score descending (sharper = higher)
    best_quality, best_frame = max(acceptable, key=lambda x: x[0].blur_score)
    return best_frame
