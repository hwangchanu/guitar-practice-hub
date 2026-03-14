"""Pydantic data models for Guitar Practice Hub backend."""

from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field


class SeparationResult(BaseModel):
    task_id: str
    status: str  # "processing", "completed", "failed"
    guitar_track_path: Optional[str] = None
    error_message: Optional[str] = None


class DetectedNote(BaseModel):
    time: float  # 시작 시간 (초)
    frequency: float  # Hz
    duration: float  # 지속 시간 (초)
    amplitude: float  # 음량


class TabNote(BaseModel):
    time: float
    string_num: int = Field(ge=1, le=6)
    fret: int = Field(ge=0, le=24)


class TabData(BaseModel):
    notes: list[TabNote]
    tuning: list[str] = ["E", "A", "D", "G", "B", "E"]


class AnalysisResult(BaseModel):
    overall_score: int = Field(ge=0, le=100)
    pitch_score: int = Field(ge=0, le=100)
    rhythm_score: int = Field(ge=0, le=100)
    timing_score: int = Field(ge=0, le=100)
    different_sections: list[dict]  # [{start_time, end_time}]


class BadHabitType(str, Enum):
    PICK_SCRATCH = "pick_scratch"
    MUTE_FAIL = "mute_fail"
    TIMING_OFF = "timing_off"
    LEFT_HAND_DELAY = "left_hand_delay"


class BadHabitDetection(BaseModel):
    type: BadHabitType
    timestamp: float
    string_num: int
    fret: int
    details: str


class BadHabitSummary(BaseModel):
    type: BadHabitType
    count: int
    ratio: float = Field(ge=0.0, le=1.0)


class BadHabitReport(BaseModel):
    session_id: str
    total_notes: int
    habits: list[BadHabitSummary]
    most_frequent_section: Optional[dict] = None  # {start_time, end_time}
