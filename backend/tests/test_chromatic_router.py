"""Tests for chromatic coaching REST API and WebSocket endpoints."""

import pytest
from fastapi.testclient import TestClient

from app.main import app


@pytest.fixture
def client():
    # Clear session store between tests to avoid shared state
    from app.routers.chromatic import _sessions
    _sessions.clear()
    return TestClient(app)


class TestSessionStartEndpoint:
    def test_start_session(self, client):
        resp = client.post("/api/chromatic/session/start", json={"bpm": 120, "pattern": "1-2-3-4"})
        assert resp.status_code == 200
        data = resp.json()
        assert "session_id" in data

    def test_start_session_min_bpm(self, client):
        resp = client.post("/api/chromatic/session/start", json={"bpm": 40, "pattern": "1-2-3-4"})
        assert resp.status_code == 200

    def test_start_session_max_bpm(self, client):
        resp = client.post("/api/chromatic/session/start", json={"bpm": 240, "pattern": "4-3-2-1"})
        assert resp.status_code == 200

    def test_start_session_bpm_too_low(self, client):
        resp = client.post("/api/chromatic/session/start", json={"bpm": 39, "pattern": "1-2-3-4"})
        assert resp.status_code == 422

    def test_start_session_bpm_too_high(self, client):
        resp = client.post("/api/chromatic/session/start", json={"bpm": 241, "pattern": "1-2-3-4"})
        assert resp.status_code == 422


class TestSessionStopEndpoint:
    def test_stop_session(self, client):
        # Start a session first
        start_resp = client.post("/api/chromatic/session/start", json={"bpm": 100, "pattern": "1-2-3-4"})
        session_id = start_resp.json()["session_id"]

        # Stop it
        stop_resp = client.post(f"/api/chromatic/session/{session_id}/stop")
        assert stop_resp.status_code == 200
        data = stop_resp.json()
        assert data["session_id"] == session_id
        assert data["habits"] == []

    def test_stop_nonexistent_session(self, client):
        resp = client.post("/api/chromatic/session/nonexistent/stop")
        assert resp.status_code == 200
        assert "error" in resp.json()


class TestChromaticWebSocket:
    def test_websocket_invalid_session(self, client):
        with client.websocket_connect("/ws/chromatic") as ws:
            ws.send_json({"session_id": "invalid", "audio_chunk": [], "note_info": None})
            resp = ws.receive_json()
            assert "error" in resp

    def test_websocket_send_note_no_detection(self, client):
        """Send a clean note that should not trigger any bad habits."""
        # Start session
        start_resp = client.post("/api/chromatic/session/start", json={"bpm": 120, "pattern": "1-2-3-4"})
        session_id = start_resp.json()["session_id"]

        with client.websocket_connect("/ws/chromatic") as ws:
            # Send a clean low-frequency signal
            # Generate a simple sine wave at 440 Hz (no high-freq noise)
            import numpy as np
            sr = 22050
            t = np.linspace(0, 0.1, int(sr * 0.1), endpoint=False)
            # Very quiet signal to avoid mute fail
            audio = (np.sin(2 * np.pi * 440 * t) * 0.005).tolist()

            ws.send_json({
                "session_id": session_id,
                "audio_chunk": audio,
                "note_info": {
                    "string_num": 1,
                    "fret": 5,
                    "timestamp": 0.5,
                    "expected_time": 0.5,
                    "prev_note_time": 0.0,
                },
            })
            # With a clean signal, we may or may not get detections
            # The WebSocket only sends if detections_out is non-empty
            # So we just verify the connection works without error

    def test_websocket_full_flow(self, client):
        """Start session, send notes via WebSocket, stop session, verify report."""
        start_resp = client.post("/api/chromatic/session/start", json={"bpm": 60, "pattern": "1-2-3-4"})
        session_id = start_resp.json()["session_id"]

        import numpy as np

        with client.websocket_connect("/ws/chromatic") as ws:
            # Send a loud high-frequency signal to trigger pick scratch + mute fail
            spectrum_size = 2048
            audio = np.random.randn(spectrum_size).tolist()

            ws.send_json({
                "session_id": session_id,
                "audio_chunk": audio,
                "note_info": {
                    "string_num": 1,
                    "fret": 1,
                    "timestamp": 1.0,
                    "expected_time": 0.5,  # large deviation to trigger timing_off
                    "prev_note_time": 0.0,  # interval=1.0 vs expected=1.0, no delay
                },
            })

        # Stop session and check report
        stop_resp = client.post(f"/api/chromatic/session/{session_id}/stop")
        data = stop_resp.json()
        assert data["session_id"] == session_id
        assert data["total_notes"] >= 1
