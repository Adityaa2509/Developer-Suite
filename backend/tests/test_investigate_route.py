"""Tests for investigate.py route."""
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_tool_fetch_returns_200():
    r = client.post("/api/tools/fetch", json={
        "record_id": "500FAKE123",
        "object_type": "Case",
        "tools": ["triggers", "flows", "validation_rules"],
    })
    assert r.status_code == 200
    print(f"\n✅ Tool fetch 200: {list(r.json()['results'].keys())}")


def test_tool_fetch_has_results_key():
    r = client.post("/api/tools/fetch", json={
        "record_id": "500FAKE123",
        "object_type": "Case",
    })
    data = r.json()
    assert "results" in data
    assert "total_tools" in data
    assert "success_count" in data
    print(f"\n✅ Tool fetch shape: {data['total_tools']} tools, {data['success_count']} succeeded")


def test_detect_object_invalid():
    r = client.get("/api/tools/detect/ZZZZZZZZZ")
    assert r.status_code == 404
    print(f"\n✅ Invalid record ID returns 404")
