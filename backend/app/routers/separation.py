"""REST API endpoints for audio source separation."""

import logging
import os
import tempfile
import uuid
from typing import Any

from fastapi import APIRouter, BackgroundTasks, HTTPException, UploadFile

from ..engines.separation import AudioSourceSeparationEngine

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/separation", tags=["separation"])

# In-memory task store (swap for Redis/DB in production)
_tasks: dict[str, dict[str, Any]] = {}

# Shared engine instance (lazy-loaded)
_engine: AudioSourceSeparationEngine | None = None


def _get_engine() -> AudioSourceSeparationEngine:
    global _engine
    if _engine is None:
        _engine = AudioSourceSeparationEngine()
    return _engine


def _run_separation(task_id: str, file_path: str) -> None:
    """Background task that performs the actual separation."""
    try:
        engine = _get_engine()
        guitar_path = engine.extract_guitar_track(file_path)
        _tasks[task_id] = {
            "status": "completed",
            "guitar_track_path": guitar_path,
            "error_message": None,
        }
        logger.info("Separation task %s completed", task_id)
    except ValueError as exc:
        _tasks[task_id] = {
            "status": "failed",
            "guitar_track_path": None,
            "error_message": str(exc),
        }
        logger.warning("Separation task %s failed (validation): %s", task_id, exc)
    except Exception as exc:
        _tasks[task_id] = {
            "status": "failed",
            "guitar_track_path": None,
            "error_message": "소스 분리 중 오류가 발생했습니다. 다시 시도해주세요.",
        }
        logger.exception("Separation task %s failed: %s", task_id, exc)
    finally:
        # Clean up the uploaded temp file
        try:
            if os.path.exists(file_path):
                os.remove(file_path)
        except OSError:
            logger.warning("Failed to clean up temp file: %s", file_path)


@router.post("")
async def request_separation(file: UploadFile, background_tasks: BackgroundTasks):
    """Upload an audio file and start source separation.

    Returns a task ID that can be polled for status.
    """
    task_id = str(uuid.uuid4())

    # Save uploaded file to a temp location
    suffix = os.path.splitext(file.filename or "audio.wav")[1]
    tmp = tempfile.NamedTemporaryFile(delete=False, suffix=suffix)
    try:
        content = await file.read()
        tmp.write(content)
        tmp.flush()
        tmp.close()
    except Exception:
        tmp.close()
        os.unlink(tmp.name)
        raise HTTPException(status_code=500, detail="파일 저장에 실패했습니다.")

    _tasks[task_id] = {
        "status": "processing",
        "guitar_track_path": None,
        "error_message": None,
    }

    background_tasks.add_task(_run_separation, task_id, tmp.name)

    return {"task_id": task_id, "status": "processing"}


@router.get("/{task_id}")
async def get_separation_status(task_id: str):
    """Poll the status of a separation task."""
    task = _tasks.get(task_id)
    if task is None:
        raise HTTPException(status_code=404, detail="작업을 찾을 수 없습니다.")

    return {
        "task_id": task_id,
        "status": task["status"],
        "guitar_track_path": task.get("guitar_track_path"),
        "error_message": task.get("error_message"),
    }
