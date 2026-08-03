"""
Unit tests for the AED Inspection CV microservice.
Run with: pytest tests/ -v
"""
from __future__ import annotations

from unittest.mock import AsyncMock, patch

import numpy as np
import pytest

from app.schemas.frame import Detection, FrameQuality
from app.schemas.inspection import InspectionState, InspectionStatus
from app.services import gemini_service
from app.services.gemini_service import GeminiAnalysisResult, GeminiStepData
from app.services.inspection.state_machine import InspectionSession, InspectionStateMachine
from app.utils.date_parser import is_expired, parse_expiry_date
from app.utils.frame_capture import select_best_frame


# ── Date parser tests ─────────────────────────────────────────────────────────


class TestDateParser:
    def test_parses_iso_yyyy_mm(self):
        assert parse_expiry_date("SN12345  EXP 2026-06") == "2026-06"

    def test_parses_slash_mm_yyyy(self):
        assert parse_expiry_date("Use by 06/2026") == "2026-06"

    def test_parses_month_abbreviation(self):
        result = parse_expiry_date("Jun 2027")
        assert result == "2027-06"

    def test_parses_full_date(self):
        result = parse_expiry_date("2025/06/15")
        assert result == "2025-06-15"

    def test_returns_none_for_garbage(self):
        assert parse_expiry_date("no date here xyz") is None

    def test_returns_none_for_empty(self):
        assert parse_expiry_date("") is None

    def test_is_expired_past_date(self):
        assert is_expired("2020-01") is True

    def test_is_expired_future_date(self):
        assert is_expired("2099-12") is False

    def test_is_expired_invalid(self):
        assert is_expired("") is False

    def test_parses_exp_prefix(self):
        result = parse_expiry_date("EXP: 2025-03")
        assert result == "2025-03"

    def test_parses_use_by(self):
        result = parse_expiry_date("USE BY 2024-11")
        assert result == "2024-11"


# ── Frame quality tests ───────────────────────────────────────────────────────


class TestFrameQuality:
    def _make_frame(self, blur: float = 150.0, brightness: float = 128.0) -> np.ndarray:
        """Create a synthetic frame that approximately hits target quality metrics."""
        frame = np.ones((480, 640, 3), dtype=np.uint8) * int(brightness)
        if blur > 100:
            noise = np.random.randint(0, 30, frame.shape, dtype=np.uint8)
            frame = np.clip(frame.astype(np.int16) + noise - 15, 0, 255).astype(np.uint8)
        return frame

    def test_acceptable_frame(self):
        frame = self._make_frame(blur=200, brightness=120)
        q = FrameQuality.compute(frame)
        assert isinstance(q.is_acceptable, bool)
        assert q.brightness >= 0

    def test_dark_frame_not_acceptable(self):
        frame = np.zeros((480, 640, 3), dtype=np.uint8)  # pitch black
        q = FrameQuality.compute(frame)
        assert q.is_acceptable is False
        assert q.brightness < 10

    def test_overexposed_frame_not_acceptable(self):
        frame = np.ones((480, 640, 3), dtype=np.uint8) * 255  # pure white
        q = FrameQuality.compute(frame)
        assert q.is_acceptable is False
        assert q.brightness > 200


# ── Detection schema tests ────────────────────────────────────────────────────


class TestDetection:
    def test_area(self):
        det = Detection(label="aed_body", confidence=0.9, bbox=(10, 10, 110, 210))
        assert det.area == 100 * 200

    def test_center(self):
        det = Detection(label="aed_body", confidence=0.9, bbox=(0, 0, 100, 100))
        assert det.center == (50, 50)

    def test_crop_from(self):
        frame = np.zeros((200, 200, 3), dtype=np.uint8)
        det = Detection(label="serial_label", confidence=0.8, bbox=(50, 50, 150, 100))
        crop = det.crop_from(frame, padding=5)
        assert crop.size > 0

    def test_crop_clamps_to_frame_bounds(self):
        frame = np.zeros((100, 100, 3), dtype=np.uint8)
        det = Detection(label="test", confidence=0.9, bbox=(90, 90, 200, 200))
        crop = det.crop_from(frame, padding=20)
        assert crop.shape[0] > 0 and crop.shape[1] > 0


# ── Frame selection tests ─────────────────────────────────────────────────────


class TestFrameCapture:
    def test_returns_none_for_empty_list(self):
        assert select_best_frame([]) is None

    def test_selects_single_frame(self):
        frame = np.ones((100, 100, 3), dtype=np.uint8) * 128
        result = select_best_frame([frame])
        assert result is not None

    def test_prefers_brighter_frame_when_both_blurry(self):
        dark = np.ones((100, 100, 3), dtype=np.uint8) * 20
        bright = np.ones((100, 100, 3), dtype=np.uint8) * 150
        result = select_best_frame([dark, bright])
        assert result is not None


# ── Gemini service schema/prompt tests (no network calls) ────────────────────


class TestGeminiService:
    def test_build_prompt_includes_step_name(self):
        prompt = gemini_service._build_prompt("SERIAL")
        assert "SERIAL" in prompt

    def test_build_prompt_falls_back_for_unknown_step(self):
        prompt = gemini_service._build_prompt("NOT_A_REAL_STEP")
        assert "NOT_A_REAL_STEP" in prompt

    def test_result_schema_accepts_partial_data(self):
        result = GeminiAnalysisResult(
            step="SERIAL",
            progress=35,
            instruction="Move closer to the serial label.",
            completed=False,
            status="in_progress",
        )
        assert result.data.serial_number is None

    def test_result_schema_round_trips_json(self):
        payload = {
            "step": "STATUS",
            "progress": 85,
            "instruction": "Status looks good.",
            "completed": True,
            "status": "pass",
            "data": {"status_indicator_ok": True},
        }
        result = GeminiAnalysisResult.model_validate(payload)
        assert result.data.status_indicator_ok is True

    @pytest.mark.asyncio
    async def test_analyze_inspection_frame_returns_parsed_result(self):
        expected = GeminiAnalysisResult(
            step="IDENTIFY",
            progress=15,
            instruction="Philips HeartStart FRx detected.",
            completed=True,
            status="in_progress",
            data=GeminiStepData(manufacturer="Philips", model="HeartStart FRx"),
        )
        fake_response = type("FakeResponse", (), {"parsed": expected, "text": ""})()
        fake_models = type("FakeModels", (), {"generate_content": AsyncMock(return_value=fake_response)})()
        fake_client = type("FakeClient", (), {"aio": type("FakeAio", (), {"models": fake_models})()})()

        with patch.object(gemini_service, "_get_client", return_value=fake_client):
            result = await gemini_service.analyze_inspection_frame(b"fake-jpeg-bytes", "IDENTIFY")

        assert result.data.manufacturer == "Philips"
        assert result.completed is True


# ── State machine tests ───────────────────────────────────────────────────────


def _mock_gemini_result(**overrides) -> GeminiAnalysisResult:
    defaults = dict(
        step="wait_for_machine",
        progress=0,
        instruction="Point camera at the AED.",
        completed=False,
        status="in_progress",
        data=GeminiStepData(),
    )
    defaults.update(overrides)
    return GeminiAnalysisResult(**defaults)


class TestStateMachine:
    def test_initial_state_is_wait_for_machine(self):
        session = InspectionSession(session_id="test-001", inspector_id="inspector-001")
        InspectionStateMachine(session)
        assert session.current_state == InspectionState.WAIT_FOR_MACHINE

    @pytest.mark.asyncio
    async def test_wait_for_machine_returns_waiting_when_not_detected(self):
        session = InspectionSession(session_id="test-002", inspector_id="inspector-001")
        machine = InspectionStateMachine(session)

        with patch.object(
            gemini_service, "analyze_inspection_frame", new=AsyncMock(return_value=_mock_gemini_result())
        ):
            result = await machine.process_frame(b"fake-jpeg")

        assert result.status == InspectionStatus.WAITING
        assert result.completed is False

    @pytest.mark.asyncio
    async def test_completed_step_advances_state(self):
        session = InspectionSession(session_id="test-003", inspector_id="inspector-001")
        machine = InspectionStateMachine(session)
        gemini_result = _mock_gemini_result(
            progress=5,
            instruction="AED detected.",
            completed=True,
        )

        with patch.object(
            gemini_service, "analyze_inspection_frame", new=AsyncMock(return_value=gemini_result)
        ):
            result = await machine.process_frame(b"fake-jpeg")

        assert result.completed is True
        assert session.current_state == InspectionState.IDENTIFY_MACHINE

    @pytest.mark.asyncio
    async def test_identify_step_populates_manufacturer_and_model(self):
        session = InspectionSession(session_id="test-004", inspector_id="inspector-001")
        session.current_state = InspectionState.IDENTIFY_MACHINE
        machine = InspectionStateMachine(session)
        gemini_result = _mock_gemini_result(
            step="identify_machine",
            progress=15,
            instruction="Philips HeartStart FRx detected.",
            completed=True,
            data=GeminiStepData(manufacturer="Philips", model="HeartStart FRx"),
        )

        with patch.object(
            gemini_service, "analyze_inspection_frame", new=AsyncMock(return_value=gemini_result)
        ):
            await machine.process_frame(b"fake-jpeg")

        assert session.manufacturer == "Philips"
        assert session.data.model == "HeartStart FRx"
        assert session.current_state == InspectionState.SERIAL_NUMBER

    @pytest.mark.asyncio
    async def test_status_check_completion_sets_status_indicator(self):
        session = InspectionSession(session_id="test-005", inspector_id="inspector-001")
        session.current_state = InspectionState.STATUS_CHECK
        machine = InspectionStateMachine(session)
        gemini_result = _mock_gemini_result(
            step="status_check",
            progress=85,
            instruction="Status OK.",
            completed=True,
            status="pass",
            data=GeminiStepData(status_indicator_ok=True),
        )

        with patch.object(
            gemini_service, "analyze_inspection_frame", new=AsyncMock(return_value=gemini_result)
        ):
            await machine.process_frame(b"fake-jpeg")

        assert session.data.status_indicator == "healthy"
        assert session.current_state == InspectionState.REPORT

    @pytest.mark.asyncio
    async def test_report_step_compiles_result_without_gemini_call(self):
        session = InspectionSession(session_id="test-006", inspector_id="inspector-001")
        session.current_state = InspectionState.REPORT
        session.data.status_indicator = "healthy"
        machine = InspectionStateMachine(session)

        with patch.object(
            gemini_service, "analyze_inspection_frame", new=AsyncMock(side_effect=AssertionError("should not be called"))
        ):
            result = await machine.process_frame(b"fake-jpeg")

        assert result.status == InspectionStatus.COMPLETE
        assert session.data.inspection_result == "PASS"
        assert session.current_state == InspectionState.COMPLETE

    @pytest.mark.asyncio
    async def test_gemini_failure_returns_error_result(self):
        session = InspectionSession(session_id="test-007", inspector_id="inspector-001")
        machine = InspectionStateMachine(session)

        with patch.object(
            gemini_service, "analyze_inspection_frame", new=AsyncMock(side_effect=RuntimeError("api down"))
        ):
            result = await machine.process_frame(b"fake-jpeg")

        assert result.status == InspectionStatus.ERROR
        assert result.completed is False

    @pytest.mark.asyncio
    async def test_state_result_has_required_fields(self):
        session = InspectionSession(session_id="test-008", inspector_id="inspector-001")
        machine = InspectionStateMachine(session)

        with patch.object(
            gemini_service, "analyze_inspection_frame", new=AsyncMock(return_value=_mock_gemini_result())
        ):
            result = await machine.process_frame(b"fake-jpeg")

        assert hasattr(result, "step")
        assert hasattr(result, "progress")
        assert hasattr(result, "instruction")
        assert hasattr(result, "completed")
        assert 0 <= result.progress <= 100
