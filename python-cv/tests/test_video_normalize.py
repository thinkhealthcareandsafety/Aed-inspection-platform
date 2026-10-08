"""Whatever the phone filmed, the scan reads the same small clip.

A 30 MB clip used to be refused ("File too large") and a browser's WebM, with
no frame count in its header, fell back to sending the raw video. Each is
now converted first; the flashes found must be the same as in the original.
"""
from __future__ import annotations

import subprocess

import cv2
import pytest

from app.services import readiness_frames, video_normalize
from tests.test_readiness import _clip

pytestmark = pytest.mark.skipif(not video_normalize.available(), reason="ffmpeg not installed")


def _reencode(src: str, dst: str, *args: str) -> str:
    subprocess.run(
        [video_normalize._ffmpeg(), "-nostdin", "-loglevel", "error", "-y", "-i", src, *args, dst],
        check=True,
    )
    return dst


def _probe(data: bytes, tmp_path) -> tuple[int, int, float]:
    path = tmp_path / "probe.mp4"
    path.write_bytes(data)
    cap = cv2.VideoCapture(str(path))
    try:
        return int(cap.get(cv2.CAP_PROP_FRAME_WIDTH)), int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT)), cap.get(cv2.CAP_PROP_FPS)
    finally:
        cap.release()


@pytest.mark.unit
def test_a_large_high_frame_rate_clip_is_shrunk_and_keeps_every_flash(tmp_path):
    _clip(tmp_path, "src.mp4", flash_at=(1.0, 3.0))
    big = _reencode(
        str(tmp_path / "src.mp4"), str(tmp_path / "big.mp4"),
        "-vf", "scale=1920:1440,fps=60", "-c:v", "libx264", "-crf", "12",
    )
    out = video_normalize.normalize(big)
    assert out is not None
    width, height, fps = _probe(out, tmp_path)
    assert max(width, height) == video_normalize.LONG_EDGE
    assert round(fps) == video_normalize.FPS
    video = readiness_frames.prepare(out)
    assert video is not None and video.flash_count == 2


@pytest.mark.unit
def test_a_browser_webm_is_read_and_its_flashes_found(tmp_path):
    _clip(tmp_path, "src.mp4", flash_at=(1.0, 3.0))
    webm = _reencode(str(tmp_path / "src.mp4"), str(tmp_path / "rec.webm"), "-c:v", "libvpx", "-b:v", "2M")
    out = video_normalize.normalize(webm)
    assert out is not None
    video = readiness_frames.prepare(out)
    assert video is not None and video.flash_count == 2


@pytest.mark.unit
def test_a_dark_light_stays_dark_after_conversion(tmp_path):
    _clip(tmp_path, "dark.mp4")
    out = video_normalize.normalize(str(tmp_path / "dark.mp4"))
    assert out is not None
    video = readiness_frames.prepare(out)
    assert video is not None and video.flash_count == 0


@pytest.mark.unit
def test_something_that_is_not_a_video_is_not_converted(tmp_path):
    junk = tmp_path / "junk.mp4"
    junk.write_bytes(b"not a video" * 100)
    assert video_normalize.normalize(str(junk)) is None
