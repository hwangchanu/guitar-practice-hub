"""Unit tests for TabGenerationEngine."""

import os
import tempfile

import numpy as np
import pytest
import soundfile as sf

from app.engines.tab_generation import (
    GUITAR_OPEN_FREQUENCIES,
    FRET_RATIO,
    TabGenerationEngine,
)
from app.models.schemas import DetectedNote, TabNote


@pytest.fixture
def engine():
    return TabGenerationEngine(sr=22050)


@pytest.fixture
def sr():
    return 22050


def _make_sine(freq: float, duration: float, sr: int = 22050) -> np.ndarray:
    t = np.linspace(0, duration, int(sr * duration), endpoint=False)
    return 0.5 * np.sin(2 * np.pi * freq * t).astype(np.float32)


def _write_wav(audio: np.ndarray, sr: int = 22050) -> str:
    fd, path = tempfile.mkstemp(suffix=".wav")
    os.close(fd)
    sf.write(path, audio, sr)
    return path


def _make_guitar_tone(freq: float, duration: float, sr: int = 22050) -> np.ndarray:
    """Generate a guitar-like tone with harmonics for better detection."""
    t = np.linspace(0, duration, int(sr * duration), endpoint=False)
    # Fundamental + harmonics for more realistic guitar tone
    signal = 0.5 * np.sin(2 * np.pi * freq * t)
    signal += 0.25 * np.sin(2 * np.pi * 2 * freq * t)
    signal += 0.125 * np.sin(2 * np.pi * 3 * freq * t)
    # Apply envelope
    envelope = np.exp(-3.0 * t / duration)
    return (signal * envelope).astype(np.float32)


class TestMapToFretboard:
    """Tests for mapToFretboard method."""

    def test_open_string_frequencies(self, engine):
        """Open string frequencies should map to fret 0."""
        for string_num, freq in GUITAR_OPEN_FREQUENCIES.items():
            notes = [DetectedNote(time=0.0, frequency=freq, duration=0.5, amplitude=0.5)]
            result = engine.mapToFretboard(notes)
            assert len(result) == 1
            assert result[0].string_num == string_num
            assert result[0].fret == 0

    def test_known_fret_position(self, engine):
        """A known frequency should map to the correct string/fret."""
        # String 5 (A=110Hz), fret 5 = D = 110 * 2^(5/12) ≈ 146.83 Hz
        # But 146.83 is also string 4 open, so it should map to string 4 fret 0
        freq_d = GUITAR_OPEN_FREQUENCIES[4]  # D string open = 146.83
        notes = [DetectedNote(time=0.0, frequency=freq_d, duration=0.5, amplitude=0.5)]
        result = engine.mapToFretboard(notes)
        assert len(result) == 1
        assert result[0].string_num == 4
        assert result[0].fret == 0

    def test_string_range_clamped(self, engine):
        """String numbers must be in range 1-6."""
        notes = [DetectedNote(time=0.0, frequency=329.63, duration=0.5, amplitude=0.5)]
        result = engine.mapToFretboard(notes)
        assert len(result) == 1
        assert 1 <= result[0].string_num <= 6

    def test_fret_range_clamped(self, engine):
        """Fret numbers must be in range 0-24."""
        # Very high frequency that might exceed fret 24
        notes = [DetectedNote(time=0.0, frequency=1300.0, duration=0.5, amplitude=0.5)]
        result = engine.mapToFretboard(notes)
        assert len(result) == 1
        assert 0 <= result[0].fret <= 24

    def test_empty_notes(self, engine):
        """Empty input should return empty output."""
        result = engine.mapToFretboard([])
        assert result == []

    def test_multiple_notes_preserve_count(self, engine):
        """All input notes should produce output notes."""
        notes = [
            DetectedNote(time=0.0, frequency=110.0, duration=0.5, amplitude=0.5),
            DetectedNote(time=0.5, frequency=220.0, duration=0.5, amplitude=0.5),
            DetectedNote(time=1.0, frequency=330.0, duration=0.5, amplitude=0.5),
        ]
        result = engine.mapToFretboard(notes)
        assert len(result) == 3

    def test_all_results_have_valid_ranges(self, engine):
        """All mapped notes must have valid string and fret ranges."""
        notes = [
            DetectedNote(time=float(i) * 0.5, frequency=100.0 + i * 50, duration=0.5, amplitude=0.5)
            for i in range(10)
        ]
        result = engine.mapToFretboard(notes)
        for tab_note in result:
            assert 1 <= tab_note.string_num <= 6
            assert 0 <= tab_note.fret <= 24
