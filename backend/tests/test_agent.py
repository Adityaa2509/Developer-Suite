"""
Tests for the LangGraph investigation agent.
Includes a live end-to-end test using a real SF record.
"""
import pytest
from langchain_core.messages import AIMessage, ToolMessage
from app.agent.graph import build_investigation_graph, build_initial_state
from app.agent.nodes.agent import agent_node
from app.agent.nodes.reporter import reporter_node
from app.agent.conditions import should_continue
from app.salesforce.client import get_sf_client


def test_graph_compiles():
    graph = build_investigation_graph()
    assert graph is not None
    print("\n✅ LangGraph compiled successfully")


def test_build_initial_state():
    state = build_initial_state(
        job_id="test-123",
        record_id="500ABC",
        object_type="Case",
        anomaly="Not assigned to queue",
    )
    assert state["record_id"] == "500ABC"
    assert state["loop_count"] == 0
    assert len(state["steps"]) == 1
    assert state["final_report"] is None
    print("\n✅ Initial state built correctly")


def test_should_continue_with_tool_calls():
    msg = AIMessage(content="", tool_calls=[
        {"name": "get_record", "args": {"record_id": "500ABC"}, "id": "call_1"}
    ])
    state = {"messages": [msg], "loop_count": 0}
    assert should_continue(state) == "tools"
    print("\n✅ should_continue routes to tools correctly")


def test_should_continue_without_tool_calls():
    msg = AIMessage(content="I have enough evidence to conclude.")
    state = {"messages": [msg], "loop_count": 0}
    assert should_continue(state) == "reporter"
    print("\n✅ should_continue routes to reporter correctly")


def test_should_continue_max_loops():
    msg = AIMessage(content="", tool_calls=[
        {"name": "get_record", "args": {}, "id": "1"}
    ])
    state = {"messages": [msg], "loop_count": 999}
    assert should_continue(state) == "reporter"
    print("\n✅ should_continue max loops safety works")


def test_reporter_with_fake_evidence():
    """Test reporter generates a report even with minimal evidence."""
    state = build_initial_state(
        job_id="test-rpt",
        record_id="500FAKE",
        object_type="Case",
        anomaly="Test anomaly for reporter test",
    )
    # Add a fake tool result as a ToolMessage
    fake_tool_msg = ToolMessage(
        content="Assignment Rule 'Support_Route' is INACTIVE",
        tool_call_id="fake_call",
        name="get_assignment_rules_for_object"
    )
    state["messages"] = [fake_tool_msg]

    result = reporter_node(state)

    assert "final_report" in result
    assert result["final_report"] is not None
    assert "root_cause" in result["final_report"]
    assert "confidence" in result["final_report"]
    print(f"\n✅ Reporter generated RCA: {result['final_report']['root_cause'][:80]}")


def test_full_investigation_with_real_record():
    """
    End-to-end test using a real Account from the org.
    Verifies the full agent loop runs without crashing.
    Note: This hits live APIs — may take 30-60 seconds.
    """
    sf = get_sf_client()
    accounts = sf.query("SELECT Id FROM Account LIMIT 1")

    if accounts["totalSize"] == 0:
        print("\n⚠️  No Account records — skipping live agent test")
        return

    record_id = accounts["records"][0]["Id"]

    from app.agent.graph import investigation_graph, build_initial_state
    initial_state = build_initial_state(
        job_id="test-live",
        record_id=record_id,
        object_type="Account",
        anomaly="Testing investigation on a real Account record",
    )

    # Run with a low max_loops for speed
    import os
    os.environ["MAX_INVESTIGATION_LOOPS"] = "2"

    final_state = investigation_graph.invoke(initial_state)

    assert final_state is not None
    assert len(final_state["messages"]) > 0
    assert final_state["loop_count"] > 0
    print(f"\n✅ Live investigation complete")
    print(f"   Loops run     : {final_state['loop_count']}")
    print(f"   Messages      : {len(final_state['messages'])}")
    print(f"   Steps         : {len(final_state['steps'])}")
    if final_state["final_report"]:
        print(f"   Root cause    : {final_state['final_report']['root_cause'][:80]}")
        print(f"   Confidence    : {final_state['final_report']['confidence']}%")
