"""
Any phone's video, made into the one kind of clip the readiness scan reads.

What arrives is whatever the phone made: a 4K HEVC .mov from an iPhone, a
60 fps clip from an Android, a WebM from the in-app recorder with no frame
count in its header (which OpenCV can't stride through, so it fell back to
sending the raw video). Sizes ran from 2 MB to over 100 MB, and anything over
25 MB was refused outright.

None of that detail is used: the scan works at 256 px and the model sees
640 px frames. So every clip is re-encoded first to H.264, 640 px on its long
edge, a constant 30 fps, no audio, the first 40 seconds. A 60 MB 4K clip
becomes about 1-2 MB that OpenCV always opens, with true timestamps for the
flash timing, and the rest of the pipeline never sees the difference between
phones.
"""
from __future__ import annotations

import os
import shutil
import subprocess
import tempfile
from typing import Optional

import structlog

logger = structlog.get_logger(__name__)

#: Long edge of the normalised clip — the size the model's frames are sent at.
LONG_EDGE = 640
#: Constant frame rate. A Philips flash lasts ~0.1 s: three frames at 30 fps.
FPS = 30
#: Only the start of a long clip is kept; 40 s holds many blinks of any unit.
MAX_SECONDS = 40
#: A 4K HEVC clip on a small server takes a while to decode; past this, give up.
TIMEOUT_SECONDS = 150


def _ffmpeg() -> Optional[str]:
    found = shutil.which("ffmpeg")
    if found:
        return found
    try:  # A bundled binary, where one is installed (local development).
        import imageio_ffmpeg  # type: ignore

        return imageio_ffmpeg.get_ffmpeg_exe()
    except Exception:  # noqa: BLE001
        return None


def available() -> bool:
    return _ffmpeg() is not None


def normalize(src_path: str) -> Optional[bytes]:
    """The clip at `src_path` as a small, standard MP4 — or None when it
    can't be converted (not a video, or no ffmpeg), so the caller can fall
    back to the original."""
    exe = _ffmpeg()
    if exe is None:
        logger.warning("video.normalize_unavailable")
        return None
    fd, out_path = tempfile.mkstemp(suffix=".mp4")
    os.close(fd)
    try:
        cmd = [
            exe, "-nostdin", "-hide_banner", "-loglevel", "error", "-y",
            "-i", src_path,
            "-map", "0:v:0", "-an", "-sn", "-dn",
            "-t", str(MAX_SECONDS),
            "-vf", (
                f"scale={LONG_EDGE}:{LONG_EDGE}:force_original_aspect_ratio=decrease:"
                f"force_divisible_by=2,fps={FPS}"
            ),
            "-c:v", "libx264", "-preset", "veryfast", "-crf", "23",
            "-pix_fmt", "yuv420p", "-movflags", "+faststart",
            "-threads", "2",
            out_path,
        ]
        done = subprocess.run(cmd, capture_output=True, timeout=TIMEOUT_SECONDS)
        if done.returncode != 0:
            logger.warning("video.normalize_failed", error=done.stderr.decode(errors="replace")[-400:])
            return None
        with open(out_path, "rb") as fh:
            data = fh.read()
        if not data:
            return None
        logger.info("video.normalized", bytes_in=os.path.getsize(src_path), bytes_out=len(data))
        return data
    except subprocess.TimeoutExpired:
        logger.warning("video.normalize_timeout", seconds=TIMEOUT_SECONDS)
        return None
    except Exception as exc:  # noqa: BLE001 — any failure falls back to the original
        logger.warning("video.normalize_error", error=str(exc))
        return None
    finally:
        try:
            os.unlink(out_path)
        except OSError:
            pass
