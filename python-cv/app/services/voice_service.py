"""The app's instructions, read aloud.

Each line is one the inspection screen shows: a check's name and what to
photograph, in English or Hindi, for each AED model. They are listed in
app/data/voice_lines.json (written by frontend/scripts/voice-lines.tsx from
the app's own copy) and only those can be spoken — this is not a general
text-to-speech service anyone could spend the AI budget on.

A line is recorded by Gemini text-to-speech the first time it is asked for.
The backend keeps every recording on its disk, so each is made once.
"""
from __future__ import annotations

import array
import asyncio
import io
import json
import wave
from functools import lru_cache
from pathlib import Path
from typing import Optional

import lameenc
import structlog
from google.genai import types

from app.services import gemini_checklist_service as gemini

logger = structlog.get_logger()

LINES_FILE = Path(__file__).resolve().parents[1] / "data" / "voice_lines.json"
TTS_MODEL = "gemini-3.8-flash-tts"
# Google's "clear" voice. One voice for every line: no fallback model, since
# a line recorded once in another voice would be kept for good.
VOICE = "Erinome"
SAMPLE_RATE = 24_000
TIMEOUT_SECONDS = 45

# The words alone, with no spoken-style direction. This model reads a
# direction ("Say clearly and warmly: …") aloud as part of the line, and has
# no separate place for one; the language it hears from the script itself.

# What a voice can't read off the screen: symbols, codes, slashes.
SAY = {
    "en": [
        ("“SN”", "S N"), ("⌛", "hourglass"), ("✓", "tick"), ("✗", "cross"),
        ("Pedi-padz II", "Peedee Pads two"), ("CPR Uni-padz", "C P R Uni Pads"), (" II", " two"),
        ("Child key / child pads", "Child key, or child pads"),
        ("infant/child", "infant or child"), ("On/Off", "On-Off"), ("—", ","),
    ],
    "hi": [
        ("“SN”", "S N"), ("⌛", "रेत-घड़ी"), ("✓", "सही का निशान"), ("✗", "क्रॉस का निशान"),
        ("Pedi-padz II", "Peedee Pads टू"), ("CPR Uni-padz", "C P R Uni Pads"), (" II", " टू"),
        ("चाइल्ड Key / चाइल्ड पैड्स", "चाइल्ड Key या चाइल्ड पैड्स"),
        ("इन्फ़ैंट/चाइल्ड", "इन्फ़ैंट या चाइल्ड"), ("On/Off", "On-Off"), ("—", ","),
    ],
}


@lru_cache(maxsize=1)
def _lines() -> dict:
    return {line["key"]: line for line in json.loads(LINES_FILE.read_text(encoding="utf-8"))}


def line_for(key: str) -> Optional[dict]:
    return _lines().get(key)


def spoken(lang: str, text: str) -> str:
    for a, b in SAY[lang]:
        text = text.replace(a, b)
    return text.replace("“", "").replace("”", "")


def samples_of(audio: bytes) -> bytes:
    """The 16-bit mono samples in what the model sent.

    This model sends a WAV file, and after the audio that file carries a
    C2PA block (Google's signature marking it as AI-made). Read as raw
    samples, the header was a click at the start and the signature a burst
    of full-volume crackle at the end of every line. Only the audio itself,
    the "data" chunk, is taken. Older models sent bare samples; those pass
    through unchanged."""
    if audio[:4] != b"RIFF":
        return audio
    with wave.open(io.BytesIO(audio)) as wav:
        if (wav.getnchannels(), wav.getsampwidth(), wav.getframerate()) != (1, 2, SAMPLE_RATE):
            raise ValueError(
                f"Unexpected audio: {wav.getnchannels()} ch, {wav.getsampwidth() * 8} bit, {wav.getframerate()} Hz"
            )
        return wav.readframes(wav.getnframes())


def trim_silence(pcm: bytes, keep_ms: int = 120) -> bytes:
    """Cut dead air at either end, so the voice starts the moment it's tapped."""
    samples = array.array("h", pcm)
    step = 240
    loud = [i for i in range(0, len(samples), step) if max(abs(x) for x in samples[i:i + step]) > 600]
    if not loud:
        return pcm
    pad = SAMPLE_RATE * keep_ms // 1000
    start, end = max(loud[0] - pad, 0), min(loud[-1] + step + pad, len(samples))
    return samples[start:end].tobytes()


def to_mp3(pcm: bytes) -> bytes:
    encoder = lameenc.Encoder()
    encoder.set_bit_rate(64)
    encoder.set_in_sample_rate(SAMPLE_RATE)
    encoder.set_channels(1)
    encoder.set_quality(2)
    return bytes(encoder.encode(pcm) + encoder.flush())


async def record(key: str) -> bytes:
    """The line's recording, as MP3. KeyError for a line that isn't the app's."""
    line = _lines()[key]
    gemini._spend_call()  # the same daily ceiling as every other AI call
    response = await asyncio.wait_for(
        gemini._get_client().aio.models.generate_content(
            model=TTS_MODEL,
            contents=spoken(line["lang"], line["text"]),
            config=types.GenerateContentConfig(
                response_modalities=["AUDIO"],
                speech_config=types.SpeechConfig(
                    voice_config=types.VoiceConfig(prebuilt_voice_config=types.PrebuiltVoiceConfig(voice_name=VOICE))
                ),
            ),
        ),
        timeout=TIMEOUT_SECONDS,
    )
    pcm = trim_silence(samples_of(response.candidates[0].content.parts[0].inline_data.data))
    mp3 = to_mp3(pcm)
    logger.info("voice.recorded", key=key, lang=line["lang"], seconds=round(len(pcm) / (SAMPLE_RATE * 2), 1),
                kb=len(mp3) // 1024)
    return mp3
