"""
Schemas for frame analysis results from object detection pipeline.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import List, Optional, Tuple
import numpy as np


@dataclass
class Detection:
    """Single object detection result."""
    label: str
    confidence: float
    bbox: Tuple[int, int, int, int]  # x1, y1, x2, y2
    track_id: Optional[int] = None

    @property
    def area(self) -> int:
        x1, y1, x2, y2 = self.bbox
        return max(0, x2 - x1) * max(0, y2 - y1)

    @property
    def center(self) -> Tuple[int, int]:
        x1, y1, x2, y2 = self.bbox
        return ((x1 + x2) // 2, (y1 + y2) // 2)

    def crop_from(self, image: np.ndarray, padding: int = 10) -> np.ndarray:
        h, w = image.shape[:2]
        x1, y1, x2, y2 = self.bbox
        x1 = max(0, x1 - padding)
        y1 = max(0, y1 - padding)
        x2 = min(w, x2 + padding)
        y2 = min(h, y2 + padding)
        return image[y1:y2, x1:x2]


@dataclass
class FrameQuality:
    """Quality metrics for a captured frame."""
    blur_score: float       # Laplacian variance — higher = sharper
    brightness: float       # Mean pixel value 0–255
    contrast: float         # Std dev of pixel values
    is_acceptable: bool

    @classmethod
    def compute(cls, frame: np.ndarray) -> "FrameQuality":
        import cv2
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        blur = float(cv2.Laplacian(gray, cv2.CV_64F).var())
        brightness = float(gray.mean())
        contrast = float(gray.std())
        acceptable = (
            blur >= 80.0
            and 35.0 <= brightness <= 225.0
            and contrast >= 25.0
        )
        return cls(
            blur_score=blur,
            brightness=brightness,
            contrast=contrast,
            is_acceptable=acceptable,
        )


@dataclass
class FrameAnalysis:
    """Full analysis result for one video frame."""
    frame: np.ndarray
    detections: List[Detection] = field(default_factory=list)
    quality: Optional[FrameQuality] = None
    timestamp: float = 0.0

    def get_detection(self, label: str) -> Optional[Detection]:
        """Return highest-confidence detection with given label."""
        matches = [d for d in self.detections if d.label == label]
        return max(matches, key=lambda d: d.confidence) if matches else None

    def has_label(self, label: str, min_conf: float = 0.5) -> bool:
        return any(
            d.label == label and d.confidence >= min_conf
            for d in self.detections
        )
