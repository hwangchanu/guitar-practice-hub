"""REST API endpoints for performance analysis (연주 비교 분석)."""

import logging
import os
import tempfile
import uuid
from typing import Any

from fastapi import APIRouter, BackgroundTasks, HTTPException, UploadFile, File

from ..engines.analysis import PerformanceAnalysisEngine
from ..engines.separation import AudioSourceSeparationEngine

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/analysis", tags=["analysis"])

# In-memory task store (swap for Redis/DB in production)
_tasks: dict[str, dict[str, Any]] = {}

# Shared engine instances (lazy-loaded)
_analysis_engine: PerformanceAnalysisEngine | None = None
_separation_engine: AudioSourceSeparationEngine | None = None


def _get_analysis_engine() -> PerformanceAnalysisEngine:
    global _analysis_engine
    if _analysis_engine is None:
        _analysis_engine = PerformanceAnalysisEngine()
    return _analysis_engine


def _get_separation_engine() -> AudioSourceSeparationEngine:
    global _separation_engine
    if _separation_engine is None:
        _separation_engine = AudioSourceSeparationEngine()
    return _separation_engine


def _run_analysis(task_id: str, original_path: str, user_path: str) -> None:
    """Background task that performs source separation then analysis."""
    guitar_track_path: str | None = None
    try:
        # Step 1: Extract guitar track from original audio
        sep_engine = _get_separation_engine()
        guitar_track_path = sep_engine.extract_guitar_track(original_path)

        # Step 2: Analyze user performance against the guitar track
        analysis_engine = _get_analysis_engine()
        result = analysis_engine.analyze(guitar_track_path, user_path)

        _tasks[task_id] = {
            "status": "completed",
            "result": result.model_dump(),
            "error_message": None,
        }
        logger.info("Analysis task %s completed", task_id)
    except Exception as exc:
        _tasks[task_id] = {
            "status": "failed",
            "result": None,
            "error_message": "분석 중 오류가 발생했습니다. 다시 시도해주세요.",
        }
        logger.exception("Analysis task %s failed: %s", task_id, exc)
    finally:
        # Clean up temp files
        for path in (original_path, user_path, guitar_track_path):
            if path is not None:
                try:
                    if os.path.exists(path):
                        os.remove(path)
                except OSError:
                    logger.warning("Failed to clean up temp file: %s", path)


async def _save_upload(upload: UploadFile) -> str:
    """Save an uploaded file to a temp location and return the path."""
    suffix = os.path.splitext(upload.filename or "audio.wav")[1]
    tmp = tempfile.NamedTemporaryFile(delete=False, suffix=suffix)
    try:
        content = await upload.read()
        tmp.write(content)
        tmp.flush()
        tmp.close()
        return tmp.name
    except Exception:
        tmp.close()
        os.unlink(tmp.name)
        raise HTTPException(status_code=500, detail="파일 저장에 실패했습니다.")


@router.post("")
async def request_analysis(
    background_tasks: BackgroundTasks,
    original: UploadFile | None = File(None),
    user_audio: UploadFile | None = File(None),
):
    """Upload original + user audio and start performance analysis.

    Returns a task ID that can be polled for status.
    """
    if original is None or user_audio is None:
        raise HTTPException(
            status_code=422,
            detail="원곡과 연주 오디오를 모두 제공해주세요.",
        )

    task_id = str(uuid.uuid4())

    original_path = await _save_upload(original)
    user_path = await _save_upload(user_audio)

    _tasks[task_id] = {
        "status": "processing",
        "result": None,
        "error_message": None,
    }

    background_tasks.add_task(_run_analysis, task_id, original_path, user_path)

    return {"task_id": task_id, "status": "processing"}


@router.get("/{task_id}")
async def get_analysis_status(task_id: str):
    """Poll the status of an analysis task."""
    task = _tasks.get(task_id)
    if task is None:
        raise HTTPException(status_code=404, detail="작업을 찾을 수 없습니다.")

    return {
        "task_id": task_id,
        "status": task["status"],
        "result": task.get("result"),
        "error_message": task.get("error_message"),
    }
