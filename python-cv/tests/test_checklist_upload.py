"""The upload endpoint takes any phone's video, however large."""
from __future__ import annotations

from unittest.mock import AsyncMock, patch

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.api.routes import checklist
from app.services import video_normalize
from tests.test_readiness import _clip

app = FastAPI()
app.include_router(checklist.router, prefix="/api/v1/checklist")
client = TestClient(app)


class _Result:
    def model_dump(self):
        return {"passed": True}


@pytest.mark.unit
@pytest.mark.skipif(not video_normalize.available(), reason="ffmpeg not installed")
def test_a_30_mb_video_is_accepted_and_sent_on_small(tmp_path):
    # A real clip with 30 MB of trailing data: the size a 4K phone clip is.
    data = _clip(tmp_path, "c.mp4", flash_at=(1.0,)) + b"\0" * (30 * 1024 * 1024)
    with patch.object(checklist.gemini_checklist_service, "analyze_checklist_item", AsyncMock(return_value=_Result())) as analyze:
        res = client.post(
            "/api/v1/checklist/readiness_indicator/analyze",
            files={"file": ("big.mp4", data, "video/mp4")},
        )
    assert res.status_code == 200
    sent, content_type = analyze.call_args.args[1], analyze.call_args.args[2]
    assert content_type == "video/mp4"
    assert len(sent) < 2 * 1024 * 1024


@pytest.mark.unit
def test_a_large_video_nothing_can_read_gets_a_clear_refusal():
    with patch.object(checklist.video_normalize, "normalize", return_value=None):
        res = client.post(
            "/api/v1/checklist/readiness_indicator/analyze",
            files={"file": ("x.mp4", b"\1" * (20 * 1024 * 1024), "video/mp4")},
        )
    assert res.status_code == 422
    assert "record it again" in res.json()["detail"]


@pytest.mark.unit
def test_a_photo_past_the_photo_limit_is_refused():
    res = client.post(
        "/api/v1/checklist/serial_number/analyze",
        files={"file": ("x.jpg", b"\1" * (checklist.MAX_IMAGE_BYTES + 1), "image/jpeg")},
    )
    assert res.status_code == 413


@pytest.mark.unit
@pytest.mark.skipif(not video_normalize.available(), reason="ffmpeg not installed")
def test_a_file_that_is_not_a_video_is_refused_clearly_not_sent_to_the_ai():
    with patch.object(checklist.gemini_checklist_service, "analyze_checklist_item", AsyncMock()) as analyze:
        res = client.post(
            "/api/v1/checklist/readiness_indicator/analyze",
            files={"file": ("x.mp4", b"not a video" * 100, "video/mp4")},
        )
    assert res.status_code == 422
    analyze.assert_not_called()
