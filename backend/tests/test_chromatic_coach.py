"""Tests for ChromaticCoach engine (나쁜 버릇 감지 및 리포트 생성)."""

import numpy as np
import pytest

from app.engines.chromatic_coach import (
    ChromaticCoach,
    HIGH_FREQ_BOUNDARY_HZ,
    PICK_SCRATCH_HIGH_FREQ_RATIO,
    MUTE_FAIL_DB_THRESHOLD,
    TIMING_DEVIATION_RATIO,
    LEFT_HAND_DELAY_RATIO,
)
from app.models.schemas import BadHabitDetection, BadHabitType


@pytest.fixture
def coach():
    return ChromaticCoach(sr=22050)


# --- detectPickScratch ---

class TestDetectPickScratch:
    def test_no_scratch_low_high_freq(self, coach):
        """Low high-frequency content should not trigger pick scratch."""
        # Create spectrum with energy concentrated in low frequencies
        spectrum = np.zeros(1024)
        spectrum[:100] = 1.0  # energy only in low bins
        assert coach.detectPickScratch(spectrum) is False

    def test_scratch_high_freq_dominant(self, coach):
        """High-frequency dominant spectrum should trigger pick scratch."""
        spectrum = np.zeros(1024)
        nyquist = coach._sr / 2.0
        freq_per_bin = nyquist / len(spectrum)
        high_bin = int(HIGH_FREQ_BOUNDARY_HZ / freq_per_bin)
        # Put most energy in high frequencies
        spectrum[high_bin:] = 1.0
        spectrum[:high_bin] = 0.01
        assert coach.detectPickScratch(spectrum) is True

    def test_empty_spectrum(self, coach):
        assert coach.detectPickScratch(np.array([])) is False

    def test_zero_spectrum(self, coach):
        assert coach.detectPickScratch(np.zeros(512)) is False

    def test_boundary_just_below_threshold(self, coach):
        """Ratio exactly at threshold boundary should not trigger."""
        spectrum = np.zeros(1024)
        nyquist = coach._sr / 2.0
        freq_per_bin = nyquist / len(spectrum)
        high_bin = int(HIGH_FREQ_BOUNDARY_HZ / freq_per_bin)
        low_bins = high_bin
        high_bins = len(spectrum) - high_bin
        # Set energies so ratio = 0.14 (just below 0.15)
        # ratio = high_energy / total_energy
        # high_energy = high_bins * h^2, low_energy = low_bins * l^2
        # We want high_energy / (high_energy + low_energy) = 0.14
        spectrum[:high_bin] = 1.0
        # Solve: h^2 * high_bins / (h^2 * high_bins + low_bins) = 0.14
        # h^2 = 0.14 * low_bins / (high_bins * 0.86)
        h_sq = 0.14 * low_bins / (high_bins * 0.86)
        spectrum[high_bin:] = np.sqrt(h_sq)
        assert coach.detectPickScratch(spectrum) is False


# --- detectMuteFail ---

class TestDetectMuteFail:
    def test_no_mute_fail_quiet(self, coach):
        """Very quiet signal should not trigger mute failure."""
        # -40 dB corresponds to amplitude ~0.01; use something below that
        spectrum = np.array([0.001, 0.002, 0.001])
        assert coach.detectMuteFail(spectrum, target_string=1) is False

    def test_mute_fail_loud(self, coach):
        """Loud non-target string should trigger mute failure."""
        # amplitude 1.0 = 0 dB, well above -40 dB
        spectrum = np.array([1.0, 0.5, 0.8])
        assert coach.detectMuteFail(spectrum, target_string=1) is True

    def test_empty_spectrum(self, coach):
        assert coach.detectMuteFail(np.array([]), target_string=1) is False

    def test_zero_spectrum(self, coach):
        assert coach.detectMuteFail(np.zeros(10), target_string=1) is False

    def test_exactly_at_threshold(self, coach):
        """Amplitude exactly at -40 dB boundary."""
        # -40 dB = 10^(-40/20) = 0.01
        amplitude = 10 ** (MUTE_FAIL_DB_THRESHOLD / 20.0)
        spectrum = np.array([amplitude])
        # At exactly -40 dB, should NOT trigger (> not >=)
        assert coach.detectMuteFail(spectrum, target_string=1) is False

    def test_just_above_threshold(self, coach):
        amplitude = 10 ** (MUTE_FAIL_DB_THRESHOLD / 20.0) * 1.1
        spectrum = np.array([amplitude])
        assert coach.detectMuteFail(spectrum, target_string=1) is True


# --- detectTimingDeviation ---

class TestDetectTimingDeviation:
    def test_no_deviation_on_beat(self, coach):
        assert coach.detectTimingDeviation(1.0, 1.0, 0.5) is False

    def test_deviation_exceeds_threshold(self, coach):
        beat_interval = 0.5  # 120 BPM
        threshold = beat_interval * TIMING_DEVIATION_RATIO  # 0.1s
        onset = 1.0 + threshold + 0.01  # just over
        assert coach.detectTimingDeviation(onset, 1.0, beat_interval) is True

    def test_deviation_within_threshold(self, coach):
        beat_interval = 0.5
        threshold = beat_interval * TIMING_DEVIATION_RATIO
        onset = 1.0 + threshold - 0.01  # just under
        assert coach.detectTimingDeviation(onset, 1.0, beat_interval) is False

    def test_zero_beat_interval(self, coach):
        assert coach.detectTimingDeviation(1.0, 1.0, 0.0) is False

    def test_negative_deviation(self, coach):
        """Early onset should also be detected."""
        beat_interval = 0.5
        threshold = beat_interval * TIMING_DEVIATION_RATIO
        onset = 1.0 - threshold - 0.01
        assert coach.detectTimingDeviation(onset, 1.0, beat_interval) is True


# --- detectLeftHandDelay ---

class TestDetectLeftHandDelay:
    def test_no_delay(self, coach):
        assert coach.detectLeftHandDelay(0.5, 0.5) is False

    def test_delay_detected(self, coach):
        expected = 0.5
        actual = expected * LEFT_HAND_DELAY_RATIO + 0.01
        assert coach.detectLeftHandDelay(actual, expected) is True

    def test_just_under_threshold(self, coach):
        expected = 0.5
        actual = expected * LEFT_HAND_DELAY_RATIO - 0.01
        assert coach.detectLeftHandDelay(actual, expected) is False

    def test_zero_expected_interval(self, coach):
        assert coach.detectLeftHandDelay(0.5, 0.0) is False

    def test_faster_than_expected(self, coach):
        assert coach.detectLeftHandDelay(0.3, 0.5) is False


# --- generateReport ---

class TestGenerateReport:
    def test_empty_detections(self, coach):
        report = coach.generateReport("sess-1", [], total_notes=10)
        assert report.session_id == "sess-1"
        assert report.total_notes == 10
        assert report.habits == []
        assert report.most_frequent_section is None

    def test_single_type(self, coach):
        detections = [
            BadHabitDetection(
                type=BadHabitType.PICK_SCRATCH,
                timestamp=1.0,
                string_num=1,
                fret=1,
                details="test",
            ),
            BadHabitDetection(
                type=BadHabitType.PICK_SCRATCH,
                timestamp=2.0,
                string_num=1,
                fret=2,
                details="test",
            ),
        ]
        report = coach.generateReport("sess-2", detections, total_notes=10)
        assert len(report.habits) == 1
        assert report.habits[0].type == BadHabitType.PICK_SCRATCH
        assert report.habits[0].count == 2
        assert report.habits[0].ratio == pytest.approx(0.2)

    def test_multiple_types(self, coach):
        detections = [
            BadHabitDetection(type=BadHabitType.PICK_SCRATCH, timestamp=1.0, string_num=1, fret=1, details=""),
            BadHabitDetection(type=BadHabitType.MUTE_FAIL, timestamp=2.0, string_num=2, fret=3, details=""),
            BadHabitDetection(type=BadHabitType.TIMING_OFF, timestamp=3.0, string_num=3, fret=5, details=""),
            BadHabitDetection(type=BadHabitType.LEFT_HAND_DELAY, timestamp=4.0, string_num=4, fret=7, details=""),
        ]
        report = coach.generateReport("sess-3", detections, total_notes=20)
        assert len(report.habits) == 4
        total_count = sum(h.count for h in report.habits)
        assert total_count == 4

    def test_most_frequent_section(self, coach):
        """Detections clustered in one 5-second window should be identified."""
        detections = [
            BadHabitDetection(type=BadHabitType.TIMING_OFF, timestamp=10.1, string_num=1, fret=1, details=""),
            BadHabitDetection(type=BadHabitType.TIMING_OFF, timestamp=11.0, string_num=1, fret=2, details=""),
            BadHabitDetection(type=BadHabitType.TIMING_OFF, timestamp=12.5, string_num=1, fret=3, details=""),
            BadHabitDetection(type=BadHabitType.PICK_SCRATCH, timestamp=1.0, string_num=1, fret=1, details=""),
        ]
        report = coach.generateReport("sess-4", detections, total_notes=20)
        assert report.most_frequent_section is not None
        # Window index 2 (10-15s) has 3 detections
        assert report.most_frequent_section["start_time"] == 10.0
        assert report.most_frequent_section["end_time"] == 15.0

    def test_zero_total_notes_defaults(self, coach):
        detections = [
            BadHabitDetection(type=BadHabitType.MUTE_FAIL, timestamp=0.5, string_num=1, fret=0, details=""),
        ]
        report = coach.generateReport("sess-5", detections, total_notes=0)
        assert report.total_notes >= 1
        assert report.habits[0].ratio <= 1.0

    def test_ratio_sum_consistency(self, coach):
        """Sum of (count * total_notes) should reconstruct counts."""
        detections = [
            BadHabitDetection(type=BadHabitType.PICK_SCRATCH, timestamp=1.0, string_num=1, fret=1, details=""),
            BadHabitDetection(type=BadHabitType.PICK_SCRATCH, timestamp=2.0, string_num=1, fret=2, details=""),
            BadHabitDetection(type=BadHabitType.MUTE_FAIL, timestamp=3.0, string_num=2, fret=3, details=""),
        ]
        total_notes = 10
        report = coach.generateReport("sess-6", detections, total_notes=total_notes)
        for h in report.habits:
            assert h.count == pytest.approx(h.ratio * total_notes, abs=0.01)
