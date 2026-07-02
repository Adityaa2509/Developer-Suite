"""
registry.py
───────────
Central registry for all DevMind investigation tools.

Two purposes:
  1. Provides ALL_TOOLS list for LangGraph agent (Day 3)
  2. Provides fetch_all_tools() for the API endpoint — runs
     every tool for a record and returns structured results

Tool naming convention matches Day 3 agent tool selection.
"""

from app.tools.record             import get_record, detect_object_type
from app.tools.history            import get_record_history
from app.tools.triggers           import get_triggers_for_object
from app.tools.flows              import get_flows_for_object
from app.tools.validation_rules   import get_validation_rules_for_object
from app.tools.assignment_rules   import get_assignment_rules_for_object
from app.tools.approval_processes import (
    get_approval_processes_for_object,
    get_approval_instance_for_record,
)
from app.tools.debug_logs         import get_debug_logs
from app.tools.permissions        import (
    get_user_profile_and_permsets,
    get_field_level_security,
)
from app.tools.sharing            import get_owd_for_object, get_record_sharing
from app.models.responses         import ToolResult
from app.core.logger              import get_logger
from app.rag.searcher import search_org_metadata, search_past_investigations
from app.tools.flow_details import get_flow_details
from app.tools.async_apex import (
     get_async_jobs,
    get_scheduled_jobs,
    get_apex_class_body,
    investigate_async_execution,
)
from app.tools.vr_evaluator       import evaluate_validation_rules 
from app.tools.cross_object import get_cross_object_flows,get_related_record_changes
from app.tools.user_lookup import find_user_by_name

logger = get_logger(__name__)

# ── Tool list for LangGraph agent (Day 3 uses this) ───────────────
ALL_TOOLS = [
    find_user_by_name, 
    search_past_investigations,   
    search_org_metadata, 
    get_record,
    get_record_history,
    get_triggers_for_object,
    get_flows_for_object,
    get_validation_rules_for_object,
    evaluate_validation_rules,
     get_flow_details,
     get_async_jobs,
    get_scheduled_jobs,
    get_apex_class_body,
    investigate_async_execution,
    get_cross_object_flows,
    get_related_record_changes,
    get_assignment_rules_for_object,
    get_approval_processes_for_object,
    get_approval_instance_for_record,
    get_debug_logs,
    get_user_profile_and_permsets,
    get_field_level_security,
    get_owd_for_object,
    get_record_sharing,
   
]


def fetch_all_tools(
    record_id: str,
    object_type: str,
    running_user_id: str | None = None,
    tools_to_run: list[str] | None = None,
) -> dict[str, ToolResult]:
    """
    Runs all investigation tools for a record and returns structured results.
    Used by the FastAPI endpoint and as context for the agent.

    Each tool result is wrapped in ToolResult with status:
      success  — tool ran and returned data
      empty    — tool ran but found nothing (not an error)
      error    — tool failed with an exception
      skipped  — tool was excluded from tools_to_run
    """
    results: dict[str, ToolResult] = {}

    def _run(name: str, fn, **kwargs) -> ToolResult:
        if tools_to_run and name not in tools_to_run:
            return ToolResult(tool_name=name, status="skipped", data=None, count=0)
        try:
            data = fn(**kwargs)
            is_empty = (
                isinstance(data, str) and (
                    "No " in data[:30] or "not found" in data.lower()
                )
            )
            return ToolResult(
                tool_name=name,
                status="empty" if is_empty else "success",
                data=data,
                count=0 if is_empty else 1,
            )
        except Exception as exc:
            logger.warning(f"Tool {name} failed: {exc}")
            return ToolResult(
                tool_name=name, status="error", data=None, error=str(exc)
            )

    logger.info(f"Fetching all tools for {object_type} {record_id}")

    results["record"]       = _run("record",       get_record.func,
                                    record_id=record_id, object_type=object_type)
    results["history"]      = _run("history",      get_record_history.func,
                                    record_id=record_id, object_type=object_type)
    results["triggers"]     = _run("triggers",     get_triggers_for_object.func,
                                    object_type=object_type)
    results["flows"]        = _run("flows",         get_flows_for_object.func,
                                    object_type=object_type)
    results["validation_rules"] = _run("validation_rules",
                                    get_validation_rules_for_object.func,
                                    object_type=object_type)
    results["assignment_rules"] = _run("assignment_rules",
                                    get_assignment_rules_for_object.func,
                                    object_type=object_type)
    results["approval_processes"] = _run("approval_processes",
                                    get_approval_processes_for_object.func,
                                    object_type=object_type)
    results["approval_instance"] = _run("approval_instance",
                                    get_approval_instance_for_record.func,
                                    record_id=record_id)
    results["debug_logs"]   = _run("debug_logs",   get_debug_logs.func,
                                    record_id=record_id, hours_back=24)
    results["owd"]          = _run("owd",           get_owd_for_object.func,
                                    object_type=object_type)
    results["record_sharing"] = _run("record_sharing", get_record_sharing.func,
                                    record_id=record_id, object_type=object_type)

    if running_user_id:
        results["profile_permsets"] = _run("profile_permsets",
                                    get_user_profile_and_permsets.func,
                                    user_id=running_user_id)
        results["fls"]              = _run("fls",
                                    get_field_level_security.func,
                                    user_id=running_user_id,
                                    object_type=object_type)

    success = sum(1 for r in results.values() if r.status == "success")
    logger.info(f"✅ Tool fetch complete: {success}/{len(results)} tools succeeded")

    return results
