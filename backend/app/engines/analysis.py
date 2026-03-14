"""Performance Analysis Engine for comparing user guitar performance against reference audio."""

import logging
from typing import Optional

import librosa
import numpy as np

from app.models.schemas import AnalysisResult

logger = logging.getLogger(__name__)

# Default sample rate for audio loading
DEFAULT_SR = 22050

# Weights for overall score calculation
PITCH_WEIGHT = 0.4
RHYTHM_WEIGHT = 0.3
TIMING_WEIGHT = 0.3

# Window size in seconds for section comparison
SECTION_WINDOW_SEC = 2.0

# Threshold for identifying different sections (lower similarity = more different)
DIFFERENCE_THRESHOLD = 0.5


def _clamp_score(value: float) -> int:
    """Clamp a float value to an integer in the 0-100 range."""
    return int(max(0, min(100, round(value))))


class PerformanceAnalysisEngine:
    """Engine for analyzing user guitar performance against a reference track.

    Uses librosa for pitch detection, onset detection, and spectral analysis
    to produce similarity scores and identify sections with large differences.
    """

    def __init__(self, sr: int = DEFAULT_SR) -> None:
        self._sr = sr

    def analyze(self, reference_path: str, user_path: str) -> AnalysisResult:
        """Analyze user performance against a reference audio file.

        Args:
            reference_path: Path to the reference (original) audio file.
            user_path: Path to the user's performance audio file.

        Returns:
            AnalysisResult with scores and identified different sections.

        Raises:
            RuntimeError: If analysis fails.
        """
        try:
            logger.info(
                "Starting performance analysis: reference=%s, user=%s",
                reference_path,
                user_path,
            )

            ref_audio, _ = librosa.load(reference_path, sr=self._sr)
            user_audio, _ = librosa.load(user_path, sr=self._sr)

            pitch_score = self.analyzePitch(ref_audio, user_audio)
            rhythm_score = self.analyzeRhythm(ref_audio, user_audio)
            timing_score = self.analyzeTiming(ref_audio, user_audio)
            overall_score = self.calculateOverallScore(pitch_score, rhythm_score, timing_score)

            audio_duration = max(len(ref_audio), len(user_audio)) / self._sr
            different_sections = self.identifyDifferentSections(
                ref_audio, user_audio, audio_duration
            )

            logger.info(
                "Analysis complete: overall=%d, pitch=%d, rhythm=%d, timing=%d, sections=%d",
                overall_score,
                pitch_score,
                rhythm_score,
                timing_score,
                len(different_sections),
            )

            return AnalysisResult(
                overall_score=overall_score,
                pitch_score=pitch_score,
                rhythm_score=rhythm_score,
                timing_score=timing_score,
                different_sections=different_sections,
            )
        except Exception as exc:
            logger.exception("Performance analysis failed: %s", exc)
            raise RuntimeError("분석 중 오류가 발생했습니다. 다시 시도해주세요.") from exc

    def analyzePitch(self, reference: np.ndarray, user: np.ndarray) -> int:
        """Analyze pitch accuracy between reference and user audio.

        Uses librosa.pyin for pitch tracking, then compares pitch contours
        using correlation on overlapping voiced frames.

        Args:
            reference: Reference audio signal as numpy array.
            user: User audio signal as numpy array.

        Returns:
            Pitch accuracy score as integer in 0-100 range.
        """
        try:
            fmin = librosa.note_to_hz("C2")
            fmax = librosa.note_to_hz("C7")

            ref_f0, ref_voiced, _ = librosa.pyin(
                reference, fmin=fmin, fmax=fmax, sr=self._sr
            )
            user_f0, user_voiced, _ = librosa.pyin(
                user, fmin=fmin, fmax=fmax, sr=self._sr
            )

            if ref_f0 is None or user_f0 is None:
                return 0

            # Align lengths
            min_len = min(len(ref_f0), len(user_f0))
            ref_f0 = ref_f0[:min_len]
            user_f0 = user_f0[:min_len]
            ref_voiced = ref_voiced[:min_len]
            user_voiced = user_voiced[:min_len]

            # Only compare frames where both are voiced
            both_voiced = ref_voiced & user_voiced
            if not np.any(both_voiced):
                return 0

            ref_pitched = ref_f0[both_voiced]
            user_pitched = user_f0[both_voiced]

            # Convert to cents for perceptually meaningful comparison
            # cents = 1200 * log2(f_user / f_ref)
            with np.errstate(divide="ignore", invalid="ignore"):
                cent_diff = 1200.0 * np.log2(user_pitched / ref_pitched)

            cent_diff = cent_diff[np.isfinite(cent_diff)]
            if len(cent_diff) == 0:
                return 0

            # Score based on mean absolute cent deviation
            # 0 cents = perfect, 100 cents = one semitone off
            mean_abs_cents = np.mean(np.abs(cent_diff))

            # Map: 0 cents -> 100, >=200 cents -> 0
            score = max(0.0, 100.0 - (mean_abs_cents / 2.0))
            return _clamp_score(score)

        except Exception:
            logger.exception("Pitch analysis failed")
            return 0

    def analyzeRhythm(self, reference: np.ndarray, user: np.ndarray) -> int:
        """Analyze rhythm accuracy between reference and user audio.

        Uses librosa onset detection to compare onset patterns.

        Args:
            reference: Reference audio signal as numpy array.
            user: User audio signal as numpy array.

        Returns:
            Rhythm accuracy score as integer in 0-100 range.
        """
        try:
            ref_onsets = librosa.onset.onset_detect(
                y=reference, sr=self._sr, units="time"
            )
            user_onsets = librosa.onset.onset_detect(
                y=user, sr=self._sr, units="time"
            )

            if len(ref_onsets) == 0 and len(user_onsets) == 0:
                return 100  # Both silent, perfect match
            if len(ref_onsets) == 0 or len(user_onsets) == 0:
                return 0

            # Compare onset counts — penalize large differences
            count_ratio = min(len(ref_onsets), len(user_onsets)) / max(
                len(ref_onsets), len(user_onsets)
            )

            # Compare inter-onset intervals (IOI)
            ref_ioi = np.diff(ref_onsets)
            user_ioi = np.diff(user_onsets)

            if len(ref_ioi) == 0 or len(user_ioi) == 0:
                return _clamp_score(count_ratio * 100)

            # Align IOI lengths
            min_ioi_len = min(len(ref_ioi), len(user_ioi))
            ref_ioi = ref_ioi[:min_ioi_len]
            user_ioi = user_ioi[:min_ioi_len]

            # Compute IOI similarity using correlation
            if np.std(ref_ioi) > 0 and np.std(user_ioi) > 0:
                correlation = np.corrcoef(ref_ioi, user_ioi)[0, 1]
                if np.isnan(correlation):
                    correlation = 0.0
                # Map correlation from [-1, 1] to [0, 1]
                ioi_similarity = (correlation + 1.0) / 2.0
            else:
                # Constant IOI — compare means
                mean_diff = abs(np.mean(ref_ioi) - np.mean(user_ioi))
                max_mean = max(np.mean(ref_ioi), np.mean(user_ioi), 1e-6)
                ioi_similarity = max(0.0, 1.0 - mean_diff / max_mean)

            # Combine count ratio and IOI similarity
            score = (count_ratio * 0.4 + ioi_similarity * 0.6) * 100
            return _clamp_score(score)

        except Exception:
            logger.exception("Rhythm analysis failed")
            return 0

    def analyzeTiming(self, reference: np.ndarray, user: np.ndarray) -> int:
        """Analyze timing alignment between reference and user audio.

        Compares onset timing positions between reference and user,
        measuring how closely user onsets align with reference onsets.

        Args:
            reference: Reference audio signal as numpy array.
            user: User audio signal as numpy array.

        Returns:
            Timing match score as integer in 0-100 range.
        """
        try:
            ref_onsets = librosa.onset.onset_detect(
                y=reference, sr=self._sr, units="time"
            )
            user_onsets = librosa.onset.onset_detect(
                y=user, sr=self._sr, units="time"
            )

            if len(ref_onsets) == 0 and len(user_onsets) == 0:
                return 100
            if len(ref_onsets) == 0 or len(user_onsets) == 0:
                return 0

            # For each reference onset, find the closest user onset
            timing_errors = []
            for ref_t in ref_onsets:
                diffs = np.abs(user_onsets - ref_t)
                min_diff = np.min(diffs)
                timing_errors.append(min_diff)

            timing_errors = np.array(timing_errors)

            # Average timing error in seconds
            mean_error = np.mean(timing_errors)

            # Map: 0s error -> 100, >=0.5s error -> 0
            score = max(0.0, 100.0 - (mean_error / 0.5) * 100.0)
            return _clamp_score(score)

        except Exception:
            logger.exception("Timing analysis failed")
            return 0

    def calculateOverallScore(
        self, pitch_score: int, rhythm_score: int, timing_score: int
    ) -> int:
        """Calculate overall similarity score as a weighted average.

        Weights: pitch 40%, rhythm 30%, timing 30%.

        Args:
            pitch_score: Pitch accuracy score (0-100).
            rhythm_score: Rhythm accuracy score (0-100).
            timing_score: Timing match score (0-100).

        Returns:
            Overall similarity score as integer in 0-100 range.
        """
        weighted = (
            pitch_score * PITCH_WEIGHT
            + rhythm_score * RHYTHM_WEIGHT
            + timing_score * TIMING_WEIGHT
        )
        return _clamp_score(weighted)

    def identifyDifferentSections(
        self,
        reference: np.ndarray,
        user: np.ndarray,
        audio_duration: Optional[float] = None,
    ) -> list[dict]:
        """Identify sections with large differences between reference and user audio.

        Segments audio into fixed-size windows, compares spectral features
        (RMS energy and spectral centroid) in each window, and identifies
        windows where divergence exceeds a threshold.

        Args:
            reference: Reference audio signal as numpy array.
            user: User audio signal as numpy array.
            audio_duration: Total audio duration in seconds. If None,
                computed from the longer signal.

        Returns:
            List of dicts with 'start_time' and 'end_time' keys (in seconds).
            All start_time >= 0, end_time > start_time, end_time <= audio_duration.
        """
        try:
            if audio_duration is None:
                audio_duration = max(len(reference), len(user)) / self._sr

            if audio_duration <= 0:
                return []

            window_samples = int(SECTION_WINDOW_SEC * self._sr)
            if window_samples <= 0:
                return []

            # Pad shorter signal to match longer
            max_len = max(len(reference), len(user))
            ref_padded = np.pad(reference, (0, max(0, max_len - len(reference))))
            user_padded = np.pad(user, (0, max(0, max_len - len(user))))

            different_sections: list[dict] = []
            num_windows = max(1, int(np.ceil(max_len / window_samples)))

            for i in range(num_windows):
                start_sample = i * window_samples
                end_sample = min(start_sample + window_samples, max_len)

                ref_window = ref_padded[start_sample:end_sample]
                user_window = user_padded[start_sample:end_sample]

                if len(ref_window) == 0 or len(user_window) == 0:
                    continue

                # Compare RMS energy
                ref_rms = np.sqrt(np.mean(ref_window**2))
                user_rms = np.sqrt(np.mean(user_window**2))
                max_rms = max(ref_rms, user_rms, 1e-10)
                rms_diff = abs(ref_rms - user_rms) / max_rms

                # Compare spectral centroid (mean over frames)
                ref_centroid = librosa.feature.spectral_centroid(
                    y=ref_window, sr=self._sr
                )
                user_centroid = librosa.feature.spectral_centroid(
                    y=user_window, sr=self._sr
                )
                ref_c_mean = np.mean(ref_centroid) if ref_centroid.size > 0 else 0.0
                user_c_mean = np.mean(user_centroid) if user_centroid.size > 0 else 0.0
                max_c = max(ref_c_mean, user_c_mean, 1e-10)
                centroid_diff = abs(ref_c_mean - user_c_mean) / max_c

                # Combined divergence
                divergence = (rms_diff + centroid_diff) / 2.0

                if divergence > DIFFERENCE_THRESHOLD:
                    start_time = max(0.0, start_sample / self._sr)
                    end_time = min(end_sample / self._sr, audio_duration)

                    # Ensure validity: end_time > start_time
                    if end_time > start_time:
                        different_sections.append(
                            {
                                "start_time": round(start_time, 3),
                                "end_time": round(end_time, 3),
                            }
                        )

            return different_sections

        except Exception:
            logger.exception("Section identification failed")
            return []
