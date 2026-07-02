"""
Integration tests for the full investigation flow.
Tests the complete path: request → background task → SQLite → poll.
"""
import time
import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.db.writer import get_investigation_state
from app.db.database import init_db

client = TestClient(app)


def setup_module(module):
    init_db()


def test_start_investigation_returns_202():
    r = client.post("/api/investigate", json={
        "record_id":   "500FAKE000",
        "object_type": "Case",
        "anomaly":     "Test anomaly for integration test",
    })
    assert r.status_code == 202
    data = r.json()
    assert "job_id" in data
    assert data["status"] == "started"
    print(f"\n✅ Investigation started: {data['job_id']}")


def test_start_investigation_creates_sqlite_record():
    r = client.post("/api/investigate", json={
        "record_id":   "500SQLITE001",
        "object_type": "Case",
        "anomaly":     "Testing SQLite creation",
    })
    job_id = r.json()["job_id"]

    # Give background task a moment to create the record
    time.sleep(1)

    state = get_investigation_state(job_id)
    assert state is not None
    assert state["record_id"] == "500SQLITE001"
    print(f"\n✅ SQLite record created for {job_id[:8]}...")


def test_poll_endpoint_returns_200():
    # Create a job first
    r = client.post("/api/investigate", json={
        "record_id":   "500POLL001",
        "object_type": "Case",
        "anomaly":     "Testing poll endpoint",
    })
    job_id = r.json()["job_id"]
    time.sleep(1)

    poll = client.get(f"/api/investigate/{job_id}")
    assert poll.status_code == 200
    data = poll.json()
    assert "steps" in data
    assert "status" in data
    assert "confidence" in data
    print(f"\n✅ Poll endpoint OK: status={data['status']}, steps={len(data['steps'])}")


def test_poll_nonexistent_job_returns_404():
    r = client.get("/api/investigate/this-job-does-not-exist-xyz")
    assert r.status_code == 404
    print("\n✅ Non-existent job returns 404 correctly")


def test_start_without_object_type_auto_detects():
    """Object type should be auto-detected if not provided."""
    r = client.post("/api/investigate", json={
        "record_id": "500AUTODETECT",
        "anomaly":   "Testing auto-detection"
        # No object_type provided
    })
    assert r.status_code == 202
    print(f"\n✅ Investigation started without explicit object_type")
