"""Chromatic Coach Engine for real-time bad habit detection during chromatic exercises."""

import logging
from collections import Counter
from typing import Optional

import numpy as np

from app.models.schemas import (
    BadHabitDetection,
    BadHabitReport,
    BadHabitSummary,
    BadHabitType,
)

logger = logging.getLogger(__name__)

# Thresholds
PICK_SCRATCH_HIGH_FREQ_RATIO = 0.15  # 15% high-frequency noise ratio
MUTE_FAIL_DB_THRESHOLD = -40.0  # -40 dB
TIMING_DEVIATION_RATIO = 0.20  # 20% of beat interval
LEFT_HAND_DELAY_RATIO = 1.3  # actual interval > expected * 1.3

# Frequency boundary for "high frequency" noise detection (Hz)
HIGH_FREQ_BOUNDARY_HZ = 4000

# Default sample rate
DEFAULT_SR = 22050


class ChromaticCoach:
    """Engine for detecting bad habits during chromatic guitar exercises.

    Analyzes audio spectrum data to detect:
    - Pick scratch (피크 비빔): excessive high-frequency noise
    - Mute failure (뮤트 실패): unwanted string ringing
    - Timing deviation (박자 이탈): onset timing off from metronome beat
    - Left hand delay (왼손 지연): slow transitions between consecutive notes
    """

    def __init__(self, sr: int = DEFAULT_SR) -> None:
        self._sr = sr

    def detectPickScratch(self, spectrum: np.ndarray) -> bool:
        """Detect pick scratch (피크 비빔) from audio spectrum.

        Pick scratch is identified when the ratio of high-frequency noise
        energy to total signal energy exceeds 15%.

        Args:
            spectrum: 1-D magnitude spectrum array (frequency bins from 0 to Nyquist).

        Returns:
            True if pick scratch is detected, False otherwise.
        """
        if spectrum.size == 0:
            return False

        total_energy = np.sum(spectrum ** 2)
        if total_energy == 0:
            return False

        # Determine the bin index corresponding to the high-frequency boundary
        nyquist = self._sr / 2.0
        freq_per_bin = nyquist / len(spectrum)
        high_freq_bin = int(HIGH_FREQ_BOUNDARY_HZ / freq_per_bin) if freq_per_bin > 0 else len(spectrum)
        high_freq_bin = min(high_freq_bin, len(spectrum))

        high_freq_energy = np.sum(spectrum[high_freq_bin:] ** 2)
        ratio = float(high_freq_energy / total_energy)

        return ratio > PICK_SCRATCH_HIGH_FREQ_RATIO

    def detectMuteFail(self, spectrum: np.ndarray, target_string: int) -> bool:
        """Detect mute failure (뮤트 실패) on non-target strings.

        Mute failure is identified when the amplitude of non-target string
        frequency bands exceeds -40 dB.

        Args:
            spectrum: 1-D magnitude spectrum representing non-target string
                      frequency band energy. Values should be in linear amplitude.
            target_string: The string number currently being played (1-6).

        Returns:
            True if mute failure is detected, False otherwise.
        """
        if spectrum.size == 0:
            return False

        # Convert linear amplitude to dB; avoid log of zero
        max_amplitude = np.max(spectrum)
        if max_amplitude <= 0:
            return False

        amplitude_db = float(20.0 * np.log10(max_amplitude))
        return amplitude_db > MUTE_FAIL_DB_THRESHOLD

    def detectTimingDeviation(
        self, onset_time: float, expected_time: float, beat_interval: float
    ) -> bool:
        """Detect timing deviation (박자 이탈).

        Timing deviation is identified when the absolute difference between
        the actual onset time and the expected time exceeds 20% of the beat interval.

        Args:
            onset_time: Actual onset time in seconds.
            expected_time: Expected onset time based on metronome in seconds.
            beat_interval: Duration of one beat in seconds.

        Returns:
            True if timing deviation is detected, False otherwise.
        """
        if beat_interval <= 0:
            return False

        deviation = abs(onset_time - expected_time)
        threshold = beat_interval * TIMING_DEVIATION_RATIO
        return deviation > threshold

    def detectLeftHandDelay(
        self, actual_interval: float, expected_interval: float
    ) -> bool:
        """Detect left hand delay (왼손 지연).

        Left hand delay is identified when the actual interval between
        consecutive notes exceeds the expected interval by more than 30%.

        Args:
            actual_interval: Actual time interval between consecutive notes (seconds).
            expected_interval: Expected time interval between consecutive notes (seconds).

        Returns:
            True if left hand delay is detected, False otherwise.
        """
        if expected_interval <= 0:
            return False

        return actual_interval > expected_interval * LEFT_HAND_DELAY_RATIO

    def generateReport(
        self,
        session_id: str,
        detections: list[BadHabitDetection],
        total_notes: int,
    ) -> BadHabitReport:
        """Generate a summary report from a list of bad habit detections.

        Aggregates detections by type, calculates occurrence ratios,
        and identifies the most frequent time section.

        Args:
            session_id: Unique session identifier.
            detections: List of BadHabitDetection instances from the session.
            total_notes: Total number of notes played in the session.

        Returns:
            BadHabitReport with per-type summaries and most frequent section.
        """
        if total_notes <= 0:
            total_notes = max(len(detections), 1)

        # Count by type
        type_counts: Counter[BadHabitType] = Counter()
        for d in detections:
            type_counts[d.type] += 1

        habits: list[BadHabitSummary] = []
        for habit_type in BadHabitType:
            count = type_counts.get(habit_type, 0)
            if count > 0:
                habits.append(
                    BadHabitSummary(
                        type=habit_type,
                        count=count,
                        ratio=round(count / total_notes, 4),
                    )
                )

        # Identify most frequent section using 5-second windows
        most_frequent_section: Optional[dict] = None
        if detections:
            window_size = 5.0
            window_counts: Counter[int] = Counter()
            for d in detections:
                window_idx = int(d.timestamp / window_size) if window_size > 0 else 0
                window_counts[window_idx] += 1

            if window_counts:
                most_common_window = window_counts.most_common(1)[0][0]
                most_frequent_section = {
                    "start_time": round(most_common_window * window_size, 3),
                    "end_time": round((most_common_window + 1) * window_size, 3),
                }

        return BadHabitReport(
            session_id=session_id,
            total_notes=total_notes,
            habits=habits,
            most_frequent_section=most_frequent_section,
        )
