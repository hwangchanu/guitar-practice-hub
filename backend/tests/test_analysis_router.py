"""Unit tests for the analysis router endpoints."""

import io
from unittest.mock import patch, MagicMock

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.routers import analysis as analysis_module


@pytest.fixture(autouse=True)
def _clear_tasks():
    """Clear the in-memory task store before each test."""
    analysis_module._tasks.clear()
    yield
    analysis_module._tasks.clear()


@pytest.fixture
def client():
    return TestClient(app)


def _make_fake_wav(name: str = "test.wav") -> tuple[str, io.BytesIO, str]:
    """Return a tuple suitable for TestClient file upload."""
    buf = io.BytesIO(b"RIFF" + b"\x00" * 100)
    buf.seek(0)
    return (name, buf, "audio/wav")


class TestPostAnalysis:
    """Tests for POST /api/analysis."""

    def test_returns_task_id_and_processing_status(self, client):
        """Uploading both files should return a task_id and processing status."""
        with patch.object(analysis_module, "_run_analysis"):
            response = client.post(
                "/api/analysis",
                files={
                    "original": _make_fake_wav("original.wav"),
                    "user_audio": _make_fake_wav("user.wav"),
                },
            )
        assert response.status_code == 200
        data = response.json()
        assert "task_id" in data
        assert data["status"] == "processing"

    def test_missing_both_files_returns_error(self, client):
        """Posting with no files should return 422 with Korean error message."""
        response = client.post("/api/analysis")
        assert response.status_code == 422

    def test_missing_user_audio_returns_error(self, client):
        """Posting with only original file should return 422."""
        response = client.post(
            "/api/analysis",
            files={"original": _make_fake_wav("original.wav")},
        )
        assert response.status_code == 422

    def test_missing_original_returns_error(self, client):
        """Posting with only user_audio file should return 422."""
        response = client.post(
            "/api/analysis",
            files={"user_audio": _make_fake_wav("user.wav")},
        )
        assert response.status_code == 422


class TestGetAnalysis:
    """Tests for GET /api/analysis/{task_id}."""

    def test_unknown_task_id_returns_404(self, client):
        """Polling a non-existent task should return 404."""
        response = client.get("/api/analysis/nonexistent-id")
        assert response.status_code == 404
        assert "작업을 찾을 수 없습니다" in response.json()["detail"]

    def test_existing_task_returns_status(self, client):
        """A known task should return its current status."""
        analysis_module._tasks["test-123"] = {
            "status": "processing",
            "result": None,
            "error_message": None,
        }
        response = client.get("/api/analysis/test-123")
        assert response.status_code == 200
        data = response.json()
        assert data["task_id"] == "test-123"
        assert data["status"] == "processing"

    def test_completed_task_returns_result(self, client):
        """A completed task should include the analysis result."""
        fake_result = {
            "overall_score": 85,
            "pitch_score": 90,
            "rhythm_score": 80,
            "timing_score": 82,
            "different_sections": [{"start_time": 1.0, "end_time": 3.0}],
        }
        analysis_module._tasks["done-456"] = {
            "status": "completed",
            "result": fake_result,
            "error_message": None,
        }
        response = client.get("/api/analysis/done-456")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "completed"
        assert data["result"]["overall_score"] == 85

    def test_failed_task_returns_error_message(self, client):
        """A failed task should include the error message."""
        analysis_module._tasks["fail-789"] = {
            "status": "failed",
            "result": None,
            "error_message": "분석 중 오류가 발생했습니다. 다시 시도해주세요.",
        }
        response = client.get("/api/analysis/fail-789")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "failed"
        assert "분석 중 오류" in data["error_message"]
