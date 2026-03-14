"""Audio Source Separation Engine using Demucs for 4-stem separation."""

import hashlib
import logging
import os
import tempfile
from pathlib import Path
from typing import Optional

import numpy as np
import torch
import torchaudio

logger = logging.getLogger(__name__)

# Directory for cached separated tracks
CACHE_DIR = Path(tempfile.gettempdir()) / "guitar_practice_hub" / "separation_cache"
CACHE_DIR.mkdir(parents=True, exist_ok=True)


def _file_hash(file_path: str) -> str:
    """Compute SHA-256 hash of a file for cache keying."""
    h = hashlib.sha256()
    with open(file_path, "rb") as f:
        for chunk in iter(lambda: f.read(8192), b""):
            h.update(chunk)
    return h.hexdigest()


class AudioSourceSeparationEngine:
    """Demucs-based audio source separation engine.

    Separates mixed audio into 4 stems: vocals, drums, bass, guitar (other).
    Provides file-hash-based caching to avoid redundant processing.
    """

    def __init__(self, model_name: str = "htdemucs") -> None:
        self._model_name = model_name
        self._model: Optional[object] = None

    def _load_model(self) -> None:
        """Lazy-load the Demucs model on first use."""
        if self._model is not None:
            return
        try:
            from demucs.pretrained import get_model

            logger.info("Loading Demucs model: %s", self._model_name)
            self._model = get_model(self._model_name)
            self._model.eval()
            if torch.cuda.is_available():
                self._model.cuda()
                logger.info("Demucs model loaded on GPU")
            else:
                logger.info("Demucs model loaded on CPU")
        except Exception:
            logger.exception("Failed to load Demucs model")
            raise

    def separate(self, audio_path: str) -> dict[str, np.ndarray]:
        """Separate a mixed audio file into 4 stems.

        Args:
            audio_path: Path to the input audio file.

        Returns:
            Dict mapping stem names ('vocals', 'drums', 'bass', 'other')
            to numpy arrays of audio data.

        Raises:
            RuntimeError: If separation fails.
        """
        self._load_model()
        try:
            from demucs.apply import apply_model

            wav, sr = torchaudio.load(audio_path)
            # Demucs expects (batch, channels, samples)
            if wav.dim() == 1:
                wav = wav.unsqueeze(0)
            ref = wav.mean(0)
            wav = (wav - ref.mean()) / ref.std()
            wav = wav.unsqueeze(0)

            if torch.cuda.is_available():
                wav = wav.cuda()

            with torch.no_grad():
                sources = apply_model(self._model, wav)

            # sources shape: (batch, num_sources, channels, samples)
            sources = sources.squeeze(0).cpu().numpy()
            source_names = self._model.sources  # e.g. ['drums', 'bass', 'other', 'vocals']

            return {name: sources[i] for i, name in enumerate(source_names)}
        except Exception:
            logger.exception("Audio source separation failed for: %s", audio_path)
            raise RuntimeError("소스 분리 중 오류가 발생했습니다. 다시 시도해주세요.")

    def extract_guitar_track(self, audio_path: str) -> str:
        """Separate audio and extract the guitar track as a WAV file.

        Uses file-hash-based caching so the same input file is not processed
        twice.

        Args:
            audio_path: Path to the input audio file.

        Returns:
            Path to the extracted guitar track WAV file.

        Raises:
            ValueError: If no guitar track could be separated.
            RuntimeError: If processing fails.
        """
        file_hash = _file_hash(audio_path)
        cached_path = CACHE_DIR / f"{file_hash}_guitar.wav"

        if cached_path.exists():
            logger.info("Cache hit for guitar track: %s", cached_path)
            return str(cached_path)

        logger.info("Separating audio: %s (hash=%s)", audio_path, file_hash)
        try:
            stems = self.separate(audio_path)
        except RuntimeError:
            raise
        except Exception:
            logger.exception("Unexpected error during separation")
            raise RuntimeError("소스 분리 중 오류가 발생했습니다. 다시 시도해주세요.")

        # Demucs labels the guitar stem as 'other'
        guitar_audio = stems.get("other")
        if guitar_audio is None:
            raise ValueError(
                "오디오에서 기타 트랙을 분리할 수 없습니다. "
                "기타 연주가 포함된 오디오 파일을 업로드해주세요."
            )

        # Validate that the guitar track contains meaningful audio
        if np.max(np.abs(guitar_audio)) < 1e-6:
            raise ValueError(
                "오디오에서 기타 트랙을 분리할 수 없습니다. "
                "기타 연주가 포함된 오디오 파일을 업로드해주세요."
            )

        # Save as WAV
        guitar_tensor = torch.from_numpy(guitar_audio).float()
        if guitar_tensor.dim() == 1:
            guitar_tensor = guitar_tensor.unsqueeze(0)

        # Use the model's sample rate (default 44100 for htdemucs)
        sample_rate = self._model.samplerate if hasattr(self._model, "samplerate") else 44100
        torchaudio.save(str(cached_path), guitar_tensor, sample_rate)
        logger.info("Guitar track saved: %s", cached_path)

        return str(cached_path)
