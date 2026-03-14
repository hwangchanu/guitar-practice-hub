"""Unit tests for PerformanceAnalysisEngine."""

import tempfile
import os

import librosa
import numpy as np
import pytest
import soundfile as sf

from app.engines.analysis import PerformanceAnalysisEngine, _clamp_score


@pytest.fixture
def engine():
    """Create a PerformanceAnalysisEngine instance."""
    return PerformanceAnalysisEngine(sr=22050)


@pytest.fixture
def sr():
    return 22050


def _make_sine(freq: float, duration: float, sr: int = 22050) -> np.ndarray:
    """Generate a sine wave at the given frequency."""
    t = np.linspace(0, duration, int(sr * duration), endpoint=False)
    return 0.5 * np.sin(2 * np.pi * freq * t).astype(np.float32)


def _write_wav(audio: np.ndarray, sr: int = 22050) -> str:
    """Write audio to a temporary WAV file and return the path."""
    fd, path = tempfile.mkstemp(suffix=".wav")
    os.close(fd)
    sf.write(path, audio, sr)
    return path


# --- _clamp_score tests ---

class TestClampScore:
    def test_clamp_within_range(self):
        assert _clamp_score(50.0) == 50

    def test_clamp_below_zero(self):
        assert _clamp_score(-10.0) == 0

    def test_clamp_above_hundred(self):
        assert _clamp_score(150.0) == 100

    def test_clamp_zero(self):
        assert _clamp_score(0.0) == 0

    def test_clamp_hundred(self):
        assert _clamp_score(100.0) == 100

    def test_clamp_rounds(self):
        assert _clamp_score(50.6) == 51
        assert _clamp_score(50.4) == 50


# --- analyzePitch tests ---

class TestAnalyzePitch:
    def test_identical_signals_high_score(self, engine, sr):
        """Identical audio should produce a high pitch score."""
        audio = _make_sine(440.0, 2.0, sr)
        score = engine.analyzePitch(audio, audio.copy())
        assert 0 <= score <= 100
        assert score >= 80

    def test_different_frequencies_lower_score(self, engine, sr):
        """Very different frequencies should produce a lower score."""
        ref = _make_sine(440.0, 2.0, sr)
        user = _make_sine(880.0, 2.0, sr)
        score = engine.analyzePitch(ref, user)
        assert 0 <= score <= 100

    def test_silent_audio_returns_zero(self, engine, sr):
        """Silent audio should return 0."""
        silent = np.zeros(sr * 2, dtype=np.float32)
        score = engine.analyzePitch(silent, silent)
        assert score == 0

    def test_score_always_in_range(self, engine, sr):
        ref = _make_sine(330.0, 1.0, sr)
        user = _make_sine(660.0, 1.0, sr)
        score = engine.analyzePitch(ref, user)
        assert 0 <= score <= 100


# --- analyzeRhythm tests ---

class TestAnalyzeRhythm:
    def test_identical_signals_high_score(self, engine, sr):
        audio = _make_sine(440.0, 2.0, sr)
        score = engine.analyzeRhythm(audio, audio.copy())
        assert 0 <= score <= 100

    def test_both_silent_returns_100(self, engine, sr):
        silent = np.zeros(sr * 2, dtype=np.float32)
        score = engine.analyzeRhythm(silent, silent)
        assert score == 100

    def test_one_silent_returns_zero(self, engine, sr):
        audio = _make_sine(440.0, 2.0, sr)
        silent = np.zeros(sr * 2, dtype=np.float32)
        score = engine.analyzeRhythm(audio, silent)
        assert score == 0

    def test_score_always_in_range(self, engine, sr):
        ref = _make_sine(440.0, 2.0, sr)
        user = _make_sine(220.0, 2.0, sr)
        score = engine.analyzeRhythm(ref, user)
        assert 0 <= score <= 100


# --- analyzeTiming tests ---

class TestAnalyzeTiming:
    def test_identical_signals_high_score(self, engine, sr):
        audio = _make_sine(440.0, 2.0, sr)
        score = engine.analyzeTiming(audio, audio.copy())
        assert 0 <= score <= 100

    def test_both_silent_returns_100(self, engine, sr):
        silent = np.zeros(sr * 2, dtype=np.float32)
        score = engine.analyzeTiming(silent, silent)
        assert score == 100

    def test_one_silent_returns_zero(self, engine, sr):
        audio = _make_sine(440.0, 2.0, sr)
        silent = np.zeros(sr * 2, dtype=np.float32)
        score = engine.analyzeTiming(audio, silent)
        assert score == 0

    def test_score_always_in_range(self, engine, sr):
        ref = _make_sine(440.0, 2.0, sr)
        user = _make_sine(220.0, 2.0, sr)
        score = engine.analyzeTiming(ref, user)
        assert 0 <= score <= 100


# --- calculateOverallScore tests ---

class TestCalculateOverallScore:
    def test_all_perfect(self, engine):
        assert engine.calculateOverallScore(100, 100, 100) == 100

    def test_all_zero(self, engine):
        assert engine.calculateOverallScore(0, 0, 0) == 0

    def test_weighted_average(self, engine):
        # pitch=100*0.4 + rhythm=0*0.3 + timing=0*0.3 = 40
        assert engine.calculateOverallScore(100, 0, 0) == 40

    def test_result_in_range(self, engine):
        score = engine.calculateOverallScore(75, 80, 60)
        assert 0 <= score <= 100

    def test_clamped_high_inputs(self, engine):
        # Even if somehow inputs exceed 100, result is clamped
        score = engine.calculateOverallScore(100, 100, 100)
        assert score <= 100


# --- identifyDifferentSections tests ---

class TestIdentifyDifferentSections:
    def test_identical_signals_no_sections(self, engine, sr):
        audio = _make_sine(440.0, 4.0, sr)
        sections = engine.identifyDifferentSections(audio, audio.copy())
        # Identical signals should have no different sections
        assert isinstance(sections, list)
        for s in sections:
            assert s["start_time"] >= 0
            assert s["end_time"] > s["start_time"]

    def test_different_signals_finds_sections(self, engine, sr):
        ref = _make_sine(440.0, 4.0, sr)
        silent = np.zeros(sr * 4, dtype=np.float32)
        sections = engine.identifyDifferentSections(ref, silent)
        assert isinstance(sections, list)
        assert len(sections) > 0
        for s in sections:
            assert s["start_time"] >= 0
            assert s["end_time"] > s["start_time"]

    def test_section_times_within_duration(self, engine, sr):
        ref = _make_sine(440.0, 4.0, sr)
        user = np.zeros(sr * 4, dtype=np.float32)
        duration = 4.0
        sections = engine.identifyDifferentSections(ref, user, audio_duration=duration)
        for s in sections:
            assert s["start_time"] >= 0
            assert s["end_time"] <= duration
            assert s["end_time"] > s["start_time"]

    def test_empty_audio_returns_empty(self, engine):
        empty = np.array([], dtype=np.float32)
        sections = engine.identifyDifferentSections(empty, empty, audio_duration=0.0)
        assert sections == []

    def test_different_length_signals(self, engine, sr):
        ref = _make_sine(440.0, 3.0, sr)
        user = _make_sine(440.0, 5.0, sr)
        sections = engine.identifyDifferentSections(ref, user)
        assert isinstance(sections, list)
        for s in sections:
            assert s["start_time"] >= 0
            assert s["end_time"] > s["start_time"]


# --- Full analyze() integration test ---

class TestAnalyzeIntegration:
    def test_analyze_with_wav_files(self, engine, sr):
        """Full analyze() method with actual WAV files."""
        ref_audio = _make_sine(440.0, 2.0, sr)
        user_audio = _make_sine(440.0, 2.0, sr)

        ref_path = _write_wav(ref_audio, sr)
        user_path = _write_wav(user_audio, sr)

        try:
            result = engine.analyze(ref_path, user_path)
            assert 0 <= result.overall_score <= 100
            assert 0 <= result.pitch_score <= 100
            assert 0 <= result.rhythm_score <= 100
            assert 0 <= result.timing_score <= 100
            assert isinstance(result.different_sections, list)
        finally:
            os.unlink(ref_path)
            os.unlink(user_path)

    def test_analyze_invalid_path_raises(self, engine):
        """analyze() with invalid paths should raise RuntimeError."""
        with pytest.raises(RuntimeError, match="분석 중 오류가 발생했습니다"):
            engine.analyze("/nonexistent/ref.wav", "/nonexistent/user.wav")
