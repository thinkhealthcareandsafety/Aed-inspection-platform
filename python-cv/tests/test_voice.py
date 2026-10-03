"""The speaker button's lines: only the app's own, said clearly."""
from __future__ import annotations

import array
import io
import json
import struct
import wave
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.services import gemini_checklist_service as gemini
from app.services import voice_service


def _fnv(lang: str, text: str) -> str:
    """frontend/src/lib/voice-key.ts, in Python."""
    h = 0x811C9DC5
    for byte in f"{lang}\n{text}".encode("utf-8"):
        h ^= byte
        h = (h * 0x01000193) & 0xFFFFFFFF
    return f"{h:08x}"


@pytest.mark.unit
def test_every_line_is_named_the_way_the_page_names_it():
    lines = json.loads(voice_service.LINES_FILE.read_text(encoding="utf-8"))
    assert len(lines) > 40
    for line in lines:
        assert line["key"] == _fnv(line["lang"], line["text"]), line["text"]
        assert line["lang"] in voice_service.SAY


@pytest.mark.unit
def test_symbols_are_said_as_words():
    assert voice_service.spoken("en", "Photograph the small “SN” label.") == "Photograph the small S N label."
    assert "tick" in voice_service.spoken("en", "the green ✓ or red ✗")
    assert "रेत-घड़ी" in voice_service.spoken("hi", "⌛ निशान")
    assert voice_service.spoken("en", "SMART Pads II case") == "SMART Pads two case"


def _wav(samples, trailer: bytes = b"") -> bytes:
    buf = io.BytesIO()
    with wave.open(buf, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(24_000)
        w.writeframes(array.array("h", samples).tobytes())
    data = buf.getvalue() + trailer
    return data[:4] + struct.pack("<I", len(data) - 8) + data[8:]


@pytest.mark.unit
def test_only_the_audio_in_a_wav_is_played():
    # The model's WAV ends with a C2PA signature. Played as sound, it was a
    # burst of full-volume crackle after every line.
    speech = [5_000, -5_000] * 2_400
    signature = b"C2PA" + struct.pack("<I", 6_016) + bytes(range(256)) * 23 + b"\xff" * 128
    pcm = voice_service.samples_of(_wav(speech, signature))
    assert array.array("h", pcm).tolist() == speech


@pytest.mark.unit
def test_bare_samples_from_older_models_pass_through():
    raw = array.array("h", [1, -1, 2]).tobytes()
    assert voice_service.samples_of(raw) == raw


@pytest.mark.unit
def test_pedi_padz_is_said_as_a_name():
    assert voice_service.spoken("en", "the spare Pedi-padz II child pads") == "the spare Peedee Pads two child pads"


@pytest.mark.unit
def test_dead_air_at_either_end_is_cut():
    quiet, loud = [0] * 24_000, [8_000, -8_000] * 12_000
    pcm = array.array("h", quiet + loud + quiet).tobytes()
    trimmed = voice_service.trim_silence(pcm)
    assert len(trimmed) / 48_000 < 1.4  # one second of speech, ~0.1 s either side


def _tts_response(seconds: float = 1.0):
    part = MagicMock()
    part.inline_data.data = _wav([6_000, -6_000] * int(12_000 * seconds), b"C2PA" + struct.pack("<I", 4) + b"sig!")
    response = MagicMock()
    response.candidates = [MagicMock(content=MagicMock(parts=[part]))]
    return response


@pytest.mark.unit
def test_a_line_is_spoken_as_mp3():
    key = next(iter(voice_service._lines()))
    client = MagicMock()
    client.aio.models.generate_content = AsyncMock(return_value=_tts_response())
    with patch.object(gemini, "_get_client", return_value=client):
        res = TestClient(app).get(f"/api/v1/voice/{key}")
    assert res.status_code == 200
    assert res.headers["content-type"] == "audio/mpeg"
    assert len(res.content) > 1_000
    call = client.aio.models.generate_content.call_args.kwargs
    assert call["model"] == voice_service.TTS_MODEL
    assert call["config"].speech_config.voice_config.prebuilt_voice_config.voice_name == voice_service.VOICE
    # Only the words: a style direction in the contents is read out loud.
    assert call["contents"] == voice_service.spoken(voice_service.line_for(key)["lang"], voice_service.line_for(key)["text"])


@pytest.mark.unit
@pytest.mark.parametrize("key", ["00000000", "not-a-key", "5A021524"])
def test_nothing_but_the_apps_lines_is_spoken(key):
    client = MagicMock()
    client.aio.models.generate_content = AsyncMock(return_value=_tts_response())
    with patch.object(gemini, "_get_client", return_value=client):
        res = TestClient(app).get(f"/api/v1/voice/{key}")
    assert res.status_code == 404
    client.aio.models.generate_content.assert_not_called()


@pytest.mark.unit
def test_a_voice_outage_is_a_503_the_page_can_fall_back_from():
    key = next(iter(voice_service._lines()))
    client = MagicMock()
    client.aio.models.generate_content = AsyncMock(side_effect=RuntimeError("overloaded"))
    with patch.object(gemini, "_get_client", return_value=client):
        res = TestClient(app).get(f"/api/v1/voice/{key}")
    assert res.status_code == 503


@pytest.mark.unit
def test_speaking_counts_against_the_daily_ceiling(monkeypatch):
    monkeypatch.setattr(gemini, "DAILY_AI_CALL_LIMIT", 0)
    key = next(iter(voice_service._lines()))
    res = TestClient(app).get(f"/api/v1/voice/{key}")
    assert res.status_code == 503
