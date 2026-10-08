"""A Defibtech's flashes are found on its bright yellow casing.

The scan wanted a flash brighter than everything near it. A yellow casing is
already ~250 in its red channel, so a green light beside it never was, and
every Defibtech clip came back "no flash" — a ready unit sent for a retake,
again and again. Greenness alone now carries a light on a bright body; the
tests that a steady green button and a shaking hand are never a flash still
hold, here on yellow too.
"""
from __future__ import annotations

import cv2
import numpy as np
import pytest

from app.services import readiness_frames


def _yellow_clip(tmp_path, name, flash_at=(), drift=1.0, seconds=6, fps=30, green_button=True):
    rng = np.random.default_rng(5)
    base = np.full((360, 480, 3), (40, 200, 245), np.uint8)  # BGR: Defibtech yellow
    cv2.rectangle(base, (30, 30), (200, 330), (60, 60, 60), -1)  # the screen
    cv2.line(base, (250, 0), (250, 360), (20, 150, 200), 3)  # seam
    if green_button:
        cv2.circle(base, (300, 150), 22, (90, 140, 30), -1)  # the On/Off button
    cv2.ellipse(base, (340, 150), (2, 3), 0, 0, 360, (150, 170, 170), -1)  # the light's window, small in frame
    lit = {int(t * fps) + k for t in flash_at for k in range(4)}
    out = cv2.VideoWriter(str(tmp_path / name), cv2.VideoWriter_fourcc(*"mp4v"), fps, (400, 300))
    pos = np.cumsum(rng.normal(0, drift, (seconds * fps, 2)), axis=0)
    for i in range(seconds * fps):
        img = base.copy()
        if i in lit:
            # An LED replaces the colour around it with its own green.
            mask = np.zeros(img.shape[:2], np.float32)
            cv2.ellipse(mask, (340, 150), (3, 4), 0, 0, 360, 1.0, -1)
            mask = cv2.GaussianBlur(mask, (0, 0), 1.5)[..., None]
            img = (img * (1 - mask) + np.array((70, 255, 110), np.float32) * mask).astype(np.uint8)
        dx, dy = pos[i]
        m = np.float32([[1, 0, -40 + dx], [0, 1, -30 + dy]])
        frame = cv2.warpAffine(img, m, (400, 300), borderMode=cv2.BORDER_REFLECT)
        noise = rng.normal(0, 3, frame.shape).astype(np.int16)
        out.write(np.clip(frame.astype(np.int16) + noise, 0, 255).astype(np.uint8))
    out.release()
    return (tmp_path / name).read_bytes()


@pytest.mark.unit
def test_flashes_on_a_yellow_unit_are_found(tmp_path):
    video = readiness_frames.prepare(_yellow_clip(tmp_path, "y.mp4", flash_at=(1.0, 3.5)))
    assert video is not None and video.flash_count == 2


@pytest.mark.unit
def test_a_yellow_unit_whose_light_never_comes_on_has_no_flashes(tmp_path):
    video = readiness_frames.prepare(_yellow_clip(tmp_path, "dark.mp4"))
    assert video is not None and video.flash_count == 0


@pytest.mark.unit
def test_a_green_button_on_yellow_under_a_shaking_hand_is_not_a_flash(tmp_path):
    video = readiness_frames.prepare(_yellow_clip(tmp_path, "shaky.mp4", drift=3.0))
    assert video is not None and video.flash_count == 0
