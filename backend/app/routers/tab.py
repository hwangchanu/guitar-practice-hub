"""REST API endpoints for guitar tab generation (타브 악보 생성)."""

import logging
import os
import tempfile
import uuid
from typing import Any

from fastapi import APIRouter, BackgroundTasks, HTTPException, UploadFile

from ..engines.separation import AudioSourceSeparationEngine
from ..engines.tab_generation import TabGenerationEngine
from ..engines.tab_formatter import TabFormatter

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/tab", tags=["tab"])

# In-memory task store (swap for Redis/DB in production)
_tasks: dict[str, dict[str, Any]] = {}

# Shared engine instances (lazy-loaded)
_tab_engine: TabGenerationEngine | None = None
_separation_engine: AudioSourceSeparationEngine | None = None
_tab_formatter: TabFormatter | None = None


def _get_tab_engine() -> TabGenerationEngine:
    global _tab_engine
    if _tab_engine is None:
        _tab_engine = TabGenerationEngine()
    return _tab_engine


def _get_separation_engine() -> AudioSourceSeparationEngine:
    global _separation_engine
    if _separation_engine is None:
        _separation_engine = AudioSourceSeparationEngine()
    return _separation_engine


def _get_tab_formatter() -> TabFormatter:
    global _tab_formatter
    if _tab_formatter is None:
        _tab_formatter = TabFormatter()
    return _tab_formatter


def _run_tab_generation(task_id: str, file_path: str) -> None:
    """Background task: source separation then tab generation."""
    guitar_track_path: str | None = None
    try:
        # Step 1: Extract guitar track from uploaded audio
        sep_engine = _get_separation_engine()
        guitar_track_path = sep_engine.extract_guitar_track(file_path)

        # Step 2: Generate tab from the guitar track
        tab_engine = _get_tab_engine()
        tab_data = tab_engine.generate(guitar_track_path)

        # Step 3: Also produce a text representation
        formatter = _get_tab_formatter()
        tab_text = formatter.formatToText(tab_data)

        _tasks[task_id] = {
            "status": "completed",
            "result": tab_data.model_dump(),
            "tab_text": tab_text,
            "error_message": None,
        }
        logger.info("Tab generation task %s completed", task_id)
    except ValueError as exc:
        _tasks[task_id] = {
            "status": "failed",
            "result": None,
            "tab_text": None,
            "error_message": str(exc),
        }
        logger.warning("Tab generation task %s failed (validation): %s", task_id, exc)
    except Exception as exc:
        _tasks[task_id] = {
            "status": "failed",
            "result": None,
            "tab_text": None,
            "error_message": "타브 악보 생성 중 오류가 발생했습니다. 다시 시도해주세요.",
        }
        logger.exception("Tab generation task %s failed: %s", task_id, exc)
    finally:
        for path in (file_path, guitar_track_path):
            if path is not None:
                try:
                    if os.path.exists(path):
                        os.remove(path)
                except OSError:
                    logger.warning("Failed to clean up temp file: %s", path)


@router.post("")
async def request_tab_generation(file: UploadFile, background_tasks: BackgroundTasks):
    """Upload an audio file and start tab generation.

    Returns a task ID that can be polled for status.
    """
    task_id = str(uuid.uuid4())

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
        "result": None,
        "tab_text": None,
        "error_message": None,
    }

    background_tasks.add_task(_run_tab_generation, task_id, tmp.name)

    return {"task_id": task_id, "status": "processing"}


@router.get("/{task_id}")
async def get_tab_status(task_id: str):
    """Poll the status of a tab generation task."""
    task = _tasks.get(task_id)
    if task is None:
        raise HTTPException(status_code=404, detail="작업을 찾을 수 없습니다.")

    return {
        "task_id": task_id,
        "status": task["status"],
        "result": task.get("result"),
        "tab_text": task.get("tab_text"),
        "error_message": task.get("error_message"),
    }
