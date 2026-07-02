from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_health_returns_200():
    r = client.get("/api/health")
    assert r.status_code == 200


def test_health_returns_app_name():
    r = client.get("/api/health")
    assert r.json()["app"] == "Sherlock"


def test_health_status_is_healthy():
    r = client.get("/api/health")
    assert r.json()["status"] == "healthy"
