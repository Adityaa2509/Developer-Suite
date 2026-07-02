"""
graph.py
────────
The LangGraph StateGraph for DevMind Investigate.

Graph structure:
  START
    ↓
  agent_node  ← (loops back here after every tool execution)
    ↓
  should_continue?
    → "tools"     → tool_node → back to agent_node
    → "reporter"  → reporter_node
                       ↓
                      END


"""

from langgraph.graph import StateGraph, END
from langgraph.prebuilt import ToolNode

from app.agent.state import InvestigationState
from app.agent.nodes.agent import agent_node
from app.agent.nodes.reporter import reporter_node
from app.agent.conditions import should_continue
from app.tools.registry import ALL_TOOLS
from app.core.logger import get_logger

logger = get_logger(__name__)


def build_investigation_graph():
    """
    Builds and compiles the investigation StateGraph.
    Returns a compiled LangGraph ready for invocation.
    """
    # ── Define graph with state schema ────────────────────────────
    graph = StateGraph(InvestigationState)

    # ── Add nodes ─────────────────────────────────────────────────
    graph.add_node("agent",    agent_node)
    graph.add_node("tools",    ToolNode(ALL_TOOLS))
    graph.add_node("reporter", reporter_node)

    # ── Set entry point ───────────────────────────────────────────
    graph.set_entry_point("agent")

    # ── Conditional routing after agent ──────────────────────────
    graph.add_conditional_edges(
        "agent",
        should_continue,
        {
            "tools":    "tools",
            "reporter": "reporter",
        },
    )

    # ── After tools → always back to agent ───────────────────────
    graph.add_edge("tools", "agent")

    # ── After reporter → end ─────────────────────────────────────
    graph.add_edge("reporter", END)

    # ── Compile ───────────────────────────────────────────────────
    compiled = graph.compile()
    logger.info("✅ Investigation graph compiled")
    return compiled


# Singleton graph instance
investigation_graph = build_investigation_graph()


def build_initial_state(
    job_id:          str,
    record_id:       str,
    object_type:     str,
    anomaly:         str,
    running_user_id: str | None = None,
) -> InvestigationState:
    """
    Builds the initial state dict to kick off an investigation.
    """
    return {
        "job_id":          job_id,
        "record_id":       record_id,
        "object_type":     object_type,
        "anomaly":         anomaly,
        "running_user_id": running_user_id,
        "messages":        [],
        "hypotheses":      [],
        "loop_count":      0,
        "max_confidence":  0.0,
        "steps":           [
            {
                "step_number": 1,
                "type":        "info",
                "message":     f"Investigation started for {object_type} {record_id}",
            }
        ],
        "final_report":    None,
    }
