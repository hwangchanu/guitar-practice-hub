"""REST API and WebSocket endpoints for chromatic coaching (크로매틱 코칭)."""

import logging
import uuid
from typing import Any

import numpy as np
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from pydantic import BaseModel, Field

from ..engines.chromatic_coach import ChromaticCoach
from ..models.schemas import BadHabitDetection, BadHabitType

logger = logging.getLogger(__name__)

router = APIRouter(tags=["chromatic"])

# In-memory session store
_sessions: dict[str, dict[str, Any]] = {}

# Shared engine instance (lazy-loaded)
_coach: ChromaticCoach | None = None


def _get_coach() -> ChromaticCoach:
    global _coach
    if _coach is None:
        _coach = ChromaticCoach()
    return _coach


class SessionStartRequest(BaseModel):
    bpm: int = Field(ge=40, le=240)
    pattern: str


class SessionStartResponse(BaseModel):
    session_id: str


@router.post("/api/chromatic/session/start")
async def start_session(request: SessionStartRequest) -> SessionStartResponse:
    """Start a new chromatic coaching session."""
    session_id = str(uuid.uuid4())
    beat_interval = 60.0 / request.bpm

    _sessions[session_id] = {
        "bpm": request.bpm,
        "pattern": request.pattern,
        "beat_interval": beat_interval,
        "detections": [],
        "total_notes": 0,
        "status": "active",
    }

    logger.info("Chromatic session %s started: bpm=%d, pattern=%s", session_id, request.bpm, request.pattern)
    return SessionStartResponse(session_id=session_id)


@router.post("/api/chromatic/session/{session_id}/stop")
async def stop_session(session_id: str):
    """Stop a chromatic coaching session and return the bad habit report."""
    session = _sessions.get(session_id)
    if session is None:
        return {"error": "세션을 찾을 수 없습니다."}

    session["status"] = "stopped"
    coach = _get_coach()

    detections = [
        BadHabitDetection(**d) if isinstance(d, dict) else d
        for d in session["detections"]
    ]

    report = coach.generateReport(
        session_id=session_id,
        detections=detections,
        total_notes=session["total_notes"],
    )

    logger.info("Chromatic session %s stopped. Total notes: %d, detections: %d",
                session_id, session["total_notes"], len(detections))

    return report.model_dump()


@router.websocket("/ws/chromatic")
async def chromatic_websocket(websocket: WebSocket):
    """WebSocket endpoint for real-time chromatic coaching.

    Expects JSON messages with:
    - session_id: str
    - audio_chunk: list[float] (PCM samples)
    - note_info: {string_num: int, fret: int, timestamp: float} (optional)

    Sends back BadHabitDetection events as JSON when bad habits are detected.
    """
    await websocket.accept()
    logger.info("WebSocket chromatic connection accepted")

    try:
        while True:
            data = await websocket.receive_json()

            session_id = data.get("session_id")
            session = _sessions.get(session_id) if session_id else None
            if session is None or session.get("status") != "active":
                await websocket.send_json({"error": "유효하지 않은 세션입니다."})
                continue

            coach = _get_coach()
            audio_chunk = data.get("audio_chunk", [])
            note_info = data.get("note_info")
            detections_out: list[dict] = []

            if audio_chunk and note_info:
                spectrum = np.abs(np.fft.rfft(np.array(audio_chunk, dtype=np.float32)))
                string_num = note_info.get("string_num", 1)
                fret = note_info.get("fret", 0)
                timestamp = note_info.get("timestamp", 0.0)

                session["total_notes"] += 1

                # Check pick scratch
                if coach.detectPickScratch(spectrum):
                    det = BadHabitDetection(
                        type=BadHabitType.PICK_SCRATCH,
                        timestamp=timestamp,
                        string_num=string_num,
                        fret=fret,
                        details="피크가 줄을 비비듯이 지나가며 잡음이 발생했습니다.",
                    )
                    detections_out.append(det.model_dump())
                    session["detections"].append(det.model_dump())

                # Check mute failure
                if coach.detectMuteFail(spectrum, string_num):
                    det = BadHabitDetection(
                        type=BadHabitType.MUTE_FAIL,
                        timestamp=timestamp,
                        string_num=string_num,
                        fret=fret,
                        details="연주하지 않는 줄에서 불필요한 울림이 감지되었습니다.",
                    )
                    detections_out.append(det.model_dump())
                    session["detections"].append(det.model_dump())

                # Check timing deviation
                expected_time = note_info.get("expected_time")
                if expected_time is not None:
                    if coach.detectTimingDeviation(timestamp, expected_time, session["beat_interval"]):
                        det = BadHabitDetection(
                            type=BadHabitType.TIMING_OFF,
                            timestamp=timestamp,
                            string_num=string_num,
                            fret=fret,
                            details="메트로놈 박자에서 벗어났습니다.",
                        )
                        detections_out.append(det.model_dump())
                        session["detections"].append(det.model_dump())

                # Check left hand delay
                prev_time = note_info.get("prev_note_time")
                if prev_time is not None:
                    actual_interval = timestamp - prev_time
                    expected_interval = session["beat_interval"]
                    if coach.detectLeftHandDelay(actual_interval, expected_interval):
                        det = BadHabitDetection(
                            type=BadHabitType.LEFT_HAND_DELAY,
                            timestamp=timestamp,
                            string_num=string_num,
                            fret=fret,
                            details="왼손 운지 전환이 느립니다.",
                        )
                        detections_out.append(det.model_dump())
                        session["detections"].append(det.model_dump())

            if detections_out:
                await websocket.send_json({"detections": detections_out})

    except WebSocketDisconnect:
        logger.info("WebSocket chromatic connection closed")
    except Exception as exc:
        logger.exception("WebSocket chromatic error: %s", exc)
        try:
            await websocket.close()
        except Exception:
            pass
