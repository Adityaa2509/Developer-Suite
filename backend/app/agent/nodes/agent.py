"""
agent.py
────────
Main investigation agent node.
Receives pre-fetched context in state['pre_context'].
Uses loop calls only for deep inspection (get_flow_details, get_trigger_details).
"""

from langchain_core.messages import SystemMessage, HumanMessage, ToolMessage
from app.agent.state import InvestigationState
from app.agent.prompts import INVESTIGATION_SYSTEM_PROMPT, build_initial_message
from app.tools.registry import ALL_TOOLS
from app.core.llm import get_llm_with_fallbacks
from app.core.config import get_settings
from app.core.logger import get_logger

logger = get_logger(__name__)

TOOL_DISPLAY_NAMES = {
    "get_record": "inspecting record fields",
    "get_record_history": "analyzing field history",
    "evaluate_validation_rules": "evaluating validation rules",
    "get_approval_instance_for_record": "checking approval status",
    "get_approval_processes_for_object": "scanning approval processes",
    "get_flows_for_object": "scanning active flows",
    "get_flow_details": "analyzing flow elements",
    "get_triggers_for_object": "scanning object triggers",
    "get_apex_class_body": "reading Apex class code",
    "get_async_jobs": "checking async Apex jobs",
    "investigate_async_execution": "correlating async execution",
    "get_scheduled_jobs": "checking scheduled tasks",
    "get_cross_object_flows": "scanning cross-object flows",
    "get_related_record_changes": "checking related record changes",
    "get_user_profile_and_permsets": "checking user permissions",
    "get_field_level_security": "checking field-level security",
    "get_debug_logs": "analyzing debug logs",
    "search_past_investigations": "searching past cases",
    "get_owd_for_object": "inspecting sharing defaults",
    "get_record_sharing": "analyzing sharing rules",
    "get_assignment_rules_for_object": "checking assignment rules",
    "find_user_by_name": "looking up user details"
}

_llm_with_tools = None
_gemini_with_tools = None

# Groq free-tier TPM limit is 12,000 tokens/min. We target 9,000 as a safe budget
# (system + initial task take ~3,000 tokens, leaving 9,000 for conversation history).
GROQ_SAFE_HISTORY_TOKENS = 9_000

# Gemini 2.0 Flash supports 1M token context — used as overflow fallback.


def _estimate_tokens(messages: list) -> int:
    """Rough estimate: 1 token ≈ 4 characters."""
    total = sum(len(str(getattr(m, 'content', '') or '')) for m in messages)
    return total // 4


def _trim_history(messages: list, max_tokens: int = GROQ_SAFE_HISTORY_TOKENS) -> list:
    """
    Drop the OLDEST ToolMessage results first (they hold large raw JSON dumps)
    until the history fits within max_tokens. Falls back to dropping any old
    message if no ToolMessages remain.
    """
    trimmed = list(messages)
    while _estimate_tokens(trimmed) > max_tokens and len(trimmed) > 1:
        # Prefer removing the oldest ToolMessage (cheapest information lost)
        removed = False
        for i, msg in enumerate(trimmed):
            if isinstance(msg, ToolMessage):
                trimmed.pop(i)
                removed = True
                break
        if not removed:
            trimmed.pop(0)   # last resort: drop oldest message of any kind
    return trimmed


def _get_llm_with_tools():
    global _llm_with_tools
    if _llm_with_tools is None:
        _llm_with_tools = get_llm_with_fallbacks(tools=ALL_TOOLS)
    return _llm_with_tools


def _get_gemini_with_tools():
    """Gemini-first LLM with 1M-token context for overflow requests."""
    global _gemini_with_tools
    if _gemini_with_tools is None:
        from langchain_google_genai import ChatGoogleGenerativeAI
        from langchain_groq import ChatGroq
        s = get_settings()
        # Primary: Gemini (large context)
        primary = ChatGoogleGenerativeAI(
            model=s.GEMINI_MODEL_PRIMARY,
            google_api_key=s.GEMINI_API_KEY,
            temperature=0.1,
            convert_system_message_to_human=True,
            max_retries=2,
        )
        fallbacks = []
        if s.GEMINI_API_KEY_FALLBACK:
            fallbacks.append(ChatGoogleGenerativeAI(
                model=s.GEMINI_MODEL_PRIMARY,
                google_api_key=s.GEMINI_API_KEY_FALLBACK,
                temperature=0.1,
                convert_system_message_to_human=True,
                max_retries=2,
            ))
        fallbacks.append(ChatGoogleGenerativeAI(
            model=s.GEMINI_MODEL_FALLBACK,
            google_api_key=s.GEMINI_API_KEY,
            temperature=0.1,
            convert_system_message_to_human=True,
            max_retries=2,
        ))
        if s.GEMINI_API_KEY_FALLBACK:
            fallbacks.append(ChatGoogleGenerativeAI(
                model=s.GEMINI_MODEL_FALLBACK,
                google_api_key=s.GEMINI_API_KEY_FALLBACK,
                temperature=0.1,
                convert_system_message_to_human=True,
                max_retries=2,
            ))
        # Last resort: Groq with trimmed context
        fallbacks.append(ChatGroq(
            model=s.GROQ_MODEL,
            api_key=s.GROQ_API_KEY,
            temperature=0.1,
            max_retries=3,
        ))
        _gemini_with_tools = primary.with_fallbacks(
            [m.bind_tools(ALL_TOOLS) for m in fallbacks],
            exceptions_to_handle=(Exception,),
        ).bind_tools(ALL_TOOLS)
        logger.info("Gemini overflow LLM initialised (1M context window).")
    return _gemini_with_tools


def agent_node(state: InvestigationState) -> dict:
    loop = state["loop_count"]
    llm  = _get_llm_with_tools()

    logger.info(
        f"Agent loop {loop + 1} | {state['record_id']} | "
        f"messages: {len(state['messages'])}"
    )

    system  = SystemMessage(content=INVESTIGATION_SYSTEM_PROMPT)
    base_task = build_initial_message(
        record_id=state["record_id"],
        object_type=state["object_type"],
        anomaly=state["anomaly"],
        focus_areas=state.get("focus_areas"),
        running_user_id=state.get("running_user_id"),
    )

    pre_context = state.get("pre_context") or ""

    if pre_context:
        initial_content = f"""
{pre_context}

{'='*60}
INVESTIGATION TASK
{'='*60}
{base_task}

━━━ HOW TO USE THE PRE-SCAN ━━━

The pre-scan is a STARTING POINT, not a conclusion.
Your job is to build the COMPLETE causal chain — not just name one component.

STEP 1 — CHECK PAST INVESTIGATIONS (if not already in pre-scan):
  The pre-scan may include similar past cases.
  If a match is found, use it to guide your investigation order.
  But still verify the chain against this specific record.

STEP 2 — IDENTIFY BLOCKERS AND CHANGERS:
  • VALIDATION RULE EVALUATION → shows what is blocking saves (the BLOCKER)
  • ACTIVE FLOWS section → shows what is changing fields (the CHANGER)
  • APPROVAL LOCK → shows if record is locked (the BLOCKER)
  • TRIGGERS → shows Apex automation (may be the ORIGIN)

STEP 3 — BUILD THE CHAIN BACKWARDS:
  For every blocker or changer found, ask:
    "What caused this component to execute?"
    "Was this triggered by user action or by another automation?"

  Example: VR is LIKELY_FIRING
    → Ask: Who tried to save? The user directly, or automation?
    → Check: Are there triggers in the pre-scan? If yes, inspect them.
    → Check: Are there flows with record updates? If yes, inspect them.
    → Only conclude "direct user save blocked by VR" if NO automation is present.

  Example: Flow has RECORD UPDATES
    → Call get_flow_details(flow_name) to confirm which fields it sets.
    → Then ask: What triggered this flow? (record-triggered = user save/update)
    → Build: User action → Flow triggered → Record update element → Field changed

  Example: Trigger found in pre-scan
    → Call get_apex_class_body if trigger delegates to a handler.
    → Check if trigger enqueues async work (look for System.enqueueJob or Database.executeBatch).
    → If async found → call get_async_jobs and investigate_async_execution.
    → Build: User action → Trigger → Queueable/Batch → DML → VR blocks / field changes

STEP 4 — ONLY REPORT WHEN CHAIN IS COMPLETE:
  Do NOT report until you can state ALL of:
    ✓ What user action or system event started the chain
    ✓ What automation ran first (Flow, Trigger)
    ✓ What automation ran next (Apex class, Queueable, Batch) if any
    ✓ What the final outcome was (blocked by VR, field updated, etc.)

  Incomplete chain = continue investigating.
  Even if you are 95% sure about the blocker, trace where it came from.

STEP 5 — TOOLS ALREADY COVERED IN PRE-SCAN (do NOT re-call):
  get_record, get_record_history, evaluate_validation_rules,
  get_approval_instance_for_record, get_flows_for_object,
  get_assignment_rules_for_object, get_owd_for_object, get_triggers_for_object

  USE YOUR LOOPS FOR:
  get_flow_details, get_apex_class_body, get_async_jobs,
  investigate_async_execution, get_cross_object_flows,
  get_related_record_changes, find_user_by_name,
  get_field_level_security, get_debug_logs
"""
    else:
        initial_content = base_task

    initial      = HumanMessage(content=initial_content)

    # ── Trim history to stay within Groq's 12K TPM free-tier limit ──────────
    history = state["messages"]
    original_count = len(history)
    history = _trim_history(history, max_tokens=GROQ_SAFE_HISTORY_TOKENS)
    if len(history) < original_count:
        logger.info(
            f"Trimmed message history {original_count} → {len(history)} messages "
            f"(~{_estimate_tokens(history)} tokens) to fit Groq 12K TPM limit"
        )

    all_messages = [system, initial] + history

    # ── Invoke: try standard chain, overflow to Gemini if still too large ───
    estimated = _estimate_tokens(all_messages)
    if estimated > GROQ_SAFE_HISTORY_TOKENS + 3500:   # > ~12K total
        logger.info(
            f"Message payload ~{estimated} tokens — routing directly to Gemini "
            "(1M context window) to bypass Groq TPM limit."
        )
        llm = _get_gemini_with_tools()
    else:
        llm = _get_llm_with_tools()

    response     = llm.invoke(all_messages)

    job_id = state.get("job_id")
    if job_id:
        try:
            from app.core.token_tracker import track_llm_usage
            track_llm_usage(job_id, response)
        except Exception as e:
            logger.warning(f"Could not track token usage: {e}")

    tool_calls = getattr(response, "tool_calls", []) or []

    if tool_calls:
        tool_names = [tc["name"] for tc in tool_calls]
        unique_names = list(dict.fromkeys(tool_names))
        display_names = [TOOL_DISPLAY_NAMES.get(name, name.replace("_", " ")) for name in unique_names]
        if len(display_names) == 1:
            step_msg = f"Deep inspection: {display_names[0]}"
        elif len(display_names) <= 3:
            step_msg = f"Deep inspection: {', '.join(display_names)}"
        else:
            step_msg = f"Deep inspection: running analysis tools ({', '.join(display_names[:3])}... +{len(display_names)-3} more)"
        step_type  = "info"
    else:
        step_msg  = "Chain complete — writing root cause analysis"
        step_type = "success"


    new_step = {
        "step_number": len(state["steps"]) + 1,
        "type":        step_type,
        "message":     step_msg,
    }

    if job_id:
        try:
            from app.db.writer import append_step
            append_step(job_id, new_step)
        except Exception as e:
            logger.warning(f"Could not write step: {e}")


    return {
        "messages":   [response],
        "loop_count": loop + 1,
        "steps":      [new_step],
    }