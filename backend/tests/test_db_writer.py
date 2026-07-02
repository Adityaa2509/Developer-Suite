"""Tests for SQLite step writer."""
import json
from app.db.writer import (
    create_investigation_record,
    append_step,
    save_final_report,
    get_investigation_state,
    mark_investigation_failed,
)
from app.db.database import init_db

TEST_JOB = "test-writer-day3"


def setup_module(module):
    init_db()


def test_create_investigation_record():
    create_investigation_record(
        job_id=TEST_JOB,
        record_id="500TEST",
        object_type="Case",
        anomaly="Test anomaly"
    )
    state = get_investigation_state(TEST_JOB)
    assert state is not None
    assert state["record_id"] == "500TEST"
    assert state["status"] == "running"
    print("\n✅ Investigation record created in SQLite")


def test_append_step():
    append_step(TEST_JOB, {
        "step_number": 1,
        "type": "info",
        "message": "Testing step write"
    })
    state = get_investigation_state(TEST_JOB)
    steps = state["steps"]
    assert len(steps) >= 1
    assert steps[-1]["message"] == "Testing step write"
    print(f"\n✅ Step appended: {len(steps)} steps total")


def test_append_multiple_steps():
    for i in range(3):
        append_step(TEST_JOB, {
            "step_number": i + 10,
            "type": "success",
            "message": f"Step {i + 10}"
        })
    state = get_investigation_state(TEST_JOB)
    assert len(state["steps"]) >= 4
    print(f"\n✅ Multiple steps appended: {len(state['steps'])} total")


def test_save_final_report():
    report = {
        "root_cause": "Assignment rule inactive",
        "confidence": 87.0,
        "evidence": ["Rule found inactive"],
        "other_findings": [],
        "next_steps": ["Activate the rule"],
        "ruled_out": []
    }
    save_final_report(TEST_JOB, report, 87.0)
    state = get_investigation_state(TEST_JOB)
    assert state["status"] == "complete"
    assert state["confidence"] == 87.0
    assert state["report"]["root_cause"] == "Assignment rule inactive"
    print("\n✅ Final report saved and status = complete")


def test_get_investigation_nonexistent():
    result = get_investigation_state("does-not-exist-xyz")
    assert result is None
    print("\n✅ Non-existent job_id returns None correctly")
