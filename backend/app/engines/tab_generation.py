"""Tab Generation Engine for converting guitar audio to tablature notation."""

import logging

import librosa
import numpy as np

from app.models.schemas import DetectedNote, TabData, TabNote

logger = logging.getLogger(__name__)

# Default sample rate for audio loading
DEFAULT_SR = 22050

# Guitar standard tuning open-string frequencies (Hz), indexed by string number 1-6
# String 1 = high E, String 6 = low E
GUITAR_OPEN_FREQUENCIES: dict[int, float] = {
    1: 329.63,  # high E
    2: 246.94,  # B
    3: 196.00,  # G
    4: 146.83,  # D
    5: 110.00,  # A
    6: 82.41,   # low E
}

# Frequency ratio per fret (equal temperament)
FRET_RATIO = 2 ** (1 / 12)

# Valid ranges
MIN_STRING = 1
MAX_STRING = 6
MIN_FRET = 0
MAX_FRET = 24

# Minimum guitar frequency (low E open = 82.41 Hz)
MIN_GUITAR_FREQ = 80.0
# Maximum guitar frequency (string 1, fret 24 ≈ 329.63 * 2^(24/12) ≈ 1318.5 Hz)
MAX_GUITAR_FREQ = 1400.0


class TabGenerationEngine:
    """Engine for generating guitar tablature from audio files.

    Uses librosa for pitch and onset detection, then maps detected notes
    to guitar fretboard positions to produce structured tab data.
    """

    def __init__(self, sr: int = DEFAULT_SR) -> None:
        self._sr = sr

    def generate(self, audio_path: str) -> TabData:
        """Generate tablature from an audio file.

        Args:
            audio_path: Path to the guitar audio file.

        Returns:
            TabData with detected notes mapped to fretboard positions.

        Raises:
            ValueError: If no guitar notes are detected.
            RuntimeError: If tab generation fails.
        """
        try:
            logger.info("Starting tab generation: %s", audio_path)

            detected_notes = self.detectNotes(audio_path)

            if not detected_notes:
                raise ValueError(
                    "기타 음을 감지할 수 없습니다. "
                    "기타 연주가 포함된 오디오 파일을 업로드해주세요."
                )

            tab_notes = self.mapToFretboard(detected_notes)
            tab_data = self.generateTab(tab_notes)

            logger.info(
                "Tab generation complete: %d notes detected", len(tab_data.notes)
            )
            return tab_data
        except ValueError:
            raise
        except Exception as exc:
            logger.exception("Tab generation failed: %s", exc)
            raise RuntimeError(
                "타브 악보 생성 중 오류가 발생했습니다. 다시 시도해주세요."
            ) from exc

    def detectNotes(self, audio_path: str) -> list[DetectedNote]:
        """Detect notes from an audio file using librosa pitch and onset detection.

        Uses librosa.pyin for pitch tracking and librosa.onset.onset_detect
        for onset detection, then combines them into a list of detected notes.

        Args:
            audio_path: Path to the audio file.

        Returns:
            List of DetectedNote with time, frequency, duration, and amplitude.
        """
        try:
            y, sr = librosa.load(audio_path, sr=self._sr)

            if len(y) == 0:
                return []

            # Pitch detection using pyin
            fmin = librosa.note_to_hz("E2")  # lowest guitar note
            fmax = librosa.note_to_hz("E6")  # well above highest guitar note
            f0, voiced_flag, voiced_prob = librosa.pyin(
                y, fmin=fmin, fmax=fmax, sr=sr
            )

            if f0 is None:
                return []

            # Onset detection
            onset_frames = librosa.onset.onset_detect(y=y, sr=sr)
            onset_times = librosa.frames_to_time(onset_frames, sr=sr)

            if len(onset_times) == 0:
                return []

            # Convert pitch frame times
            hop_length = 512  # librosa default
            pitch_times = librosa.frames_to_time(
                np.arange(len(f0)), sr=sr, hop_length=hop_length
            )

            # RMS energy for amplitude estimation
            rms = librosa.feature.rms(y=y, hop_length=hop_length)[0]

            detected_notes: list[DetectedNote] = []

            for i, onset_time in enumerate(onset_times):
                # Find the pitch frame closest to this onset
                frame_idx = np.argmin(np.abs(pitch_times - onset_time))

                # Skip if not voiced or frequency is NaN
                if not voiced_flag[frame_idx] or np.isnan(f0[frame_idx]):
                    continue

                frequency = float(f0[frame_idx])

                # Filter out non-guitar frequencies
                if frequency < MIN_GUITAR_FREQ or frequency > MAX_GUITAR_FREQ:
                    continue

                # Estimate duration: time until next onset or end of audio
                if i + 1 < len(onset_times):
                    duration = float(onset_times[i + 1] - onset_time)
                else:
                    duration = float(len(y) / sr - onset_time)

                duration = max(duration, 0.01)  # minimum duration

                # Get amplitude from RMS at this frame
                rms_idx = min(frame_idx, len(rms) - 1)
                amplitude = float(rms[rms_idx])

                detected_notes.append(
                    DetectedNote(
                        time=round(float(onset_time), 4),
                        frequency=round(frequency, 2),
                        duration=round(duration, 4),
                        amplitude=round(amplitude, 6),
                    )
                )

            logger.info("Detected %d notes from audio", len(detected_notes))
            return detected_notes

        except Exception:
            logger.exception("Note detection failed")
            return []

    def mapToFretboard(self, notes: list[DetectedNote]) -> list[TabNote]:
        """Map detected notes to guitar fretboard positions.

        For each note, finds the string/fret combination whose frequency
        is closest to the detected frequency. Uses standard tuning.

        Args:
            notes: List of detected notes with frequency information.

        Returns:
            List of TabNote with string_num (1-6) and fret (0-24).
        """
        tab_notes: list[TabNote] = []

        for note in notes:
            best_string = MIN_STRING
            best_fret = MIN_FRET
            best_diff = float("inf")

            for string_num, open_freq in GUITAR_OPEN_FREQUENCIES.items():
                # Calculate fret number: freq = open_freq * 2^(fret/12)
                # fret = 12 * log2(freq / open_freq)
                if note.frequency <= 0 or open_freq <= 0:
                    continue

                ratio = note.frequency / open_freq
                if ratio <= 0:
                    continue

                fret_float = 12.0 * np.log2(ratio)
                fret = int(round(fret_float))

                # Clamp fret to valid range
                fret = max(MIN_FRET, min(MAX_FRET, fret))

                # Calculate the actual frequency for this string/fret
                actual_freq = open_freq * (FRET_RATIO ** fret)
                diff = abs(note.frequency - actual_freq)

                if diff < best_diff:
                    best_diff = diff
                    best_string = string_num
                    best_fret = fret

            # Final clamping to ensure valid ranges
            best_string = max(MIN_STRING, min(MAX_STRING, best_string))
            best_fret = max(MIN_FRET, min(MAX_FRET, best_fret))

            tab_notes.append(
                TabNote(
                    time=note.time,
                    string_num=best_string,
                    fret=best_fret,
                )
            )

        logger.info("Mapped %d notes to fretboard positions", len(tab_notes))
        return tab_notes

    def generateTab(self, tab_notes: list[TabNote]) -> TabData:
        """Generate structured tab data from mapped fretboard notes.

        Args:
            tab_notes: List of TabNote with string/fret positions.

        Returns:
            TabData with notes sorted by time and standard tuning.
        """
        # Sort notes by time
        sorted_notes = sorted(tab_notes, key=lambda n: n.time)

        return TabData(
            notes=sorted_notes,
            tuning=["E", "A", "D", "G", "B", "E"],
        )
