"""Unit tests for the tab generation router endpoints."""

import io
from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.routers import tab as tab_module


@pytest.fixture(autouse=True)
def _clear_tasks():
    """Clear the in-memory task store before each test."""
    tab_module._tasks.clear()
    yield
    tab_module._tasks.clear()


@pytest.fixture
def client():
    return TestClient(app)


def _make_fake_wav(name: str = "test.wav") -> tuple[str, io.BytesIO, str]:
    buf = io.BytesIO(b"RIFF" + b"\x00" * 100)
    buf.seek(0)
    return (name, buf, "audio/wav")


class TestPostTab:
    """Tests for POST /api/tab."""

    def test_returns_task_id_and_processing_status(self, client):
        with patch.object(tab_module, "_run_tab_generation"):
            response = client.post(
                "/api/tab",
                files={"file": _make_fake_wav()},
            )
        assert response.status_code == 200
        data = response.json()
        assert "task_id" in data
        assert data["status"] == "processing"

    def test_missing_file_returns_422(self, client):
        response = client.post("/api/tab")
        assert response.status_code == 422


class TestGetTab:
    """Tests for GET /api/tab/{task_id}."""

    def test_unknown_task_id_returns_404(self, client):
        response = client.get("/api/tab/nonexistent-id")
        assert response.status_code == 404
        assert "작업을 찾을 수 없습니다" in response.json()["detail"]

    def test_processing_task_returns_status(self, client):
        tab_module._tasks["test-123"] = {
            "status": "processing",
            "result": None,
            "tab_text": None,
            "error_message": None,
        }
        response = client.get("/api/tab/test-123")
        assert response.status_code == 200
        data = response.json()
        assert data["task_id"] == "test-123"
        assert data["status"] == "processing"

    def test_completed_task_returns_result_and_text(self, client):
        fake_result = {
            "notes": [{"time": 0.0, "string_num": 1, "fret": 5}],
            "tuning": ["E", "A", "D", "G", "B", "E"],
        }
        tab_module._tasks["done-456"] = {
            "status": "completed",
            "result": fake_result,
            "tab_text": "TUNING: E A D G B E\nNOTES:\n0.0|1|5",
            "error_message": None,
        }
        response = client.get("/api/tab/done-456")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "completed"
        assert data["result"]["notes"][0]["fret"] == 5
        assert "TUNING:" in data["tab_text"]

    def test_failed_task_returns_error_message(self, client):
        tab_module._tasks["fail-789"] = {
            "status": "failed",
            "result": None,
            "tab_text": None,
            "error_message": "타브 악보 생성 중 오류가 발생했습니다. 다시 시도해주세요.",
        }
        response = client.get("/api/tab/fail-789")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "failed"
        assert "타브 악보 생성 중 오류" in data["error_message"]
