"""
conditions.py
─────────────
Conditional edge functions for LangGraph.

should_continue: called after agent_node to route to either
  - "tools"     (agent wants more evidence)
  - "reporter"  (agent is done investigating)

The decision is simple: does the last message have tool calls?
  YES → agent wants to call tools → route to ToolNode
  NO  → agent is done thinking → route to Reporter
"""

from app.agent.state import InvestigationState
from app.core.config import get_settings
from app.core.logger import get_logger

logger = get_logger(__name__)




def should_continue(state: InvestigationState) -> str:
    """
    Routes from agent_node to either 'tools' or 'reporter'.

    Returns 'tools'    if agent made tool_calls in its last message
    Returns 'reporter' if no tool_calls OR max loops reached
    """
    s = get_settings()

    # Safety: stop if too many loops (prevents infinite investigation)
    if state["loop_count"] >= s.MAX_INVESTIGATION_LOOPS:
        logger.warning(
            f"Max loops ({s.MAX_INVESTIGATION_LOOPS}) reached — forcing reporter"
        )
        return "reporter"

    last_message = state["messages"][-1] if state["messages"] else None
    if last_message is None:
        return "reporter"

    tool_calls = getattr(last_message, "tool_calls", []) or []

    if tool_calls:
        logger.debug(f"Routing to tools ({len(tool_calls)} calls)")
        return "tools"

    logger.debug("No tool calls — routing to reporter")
    return "reporter"
