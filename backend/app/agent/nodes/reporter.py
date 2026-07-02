"""
reporter.py
───────────
The final node in the investigation graph.
Called when the agent has finished gathering evidence.

Takes all accumulated messages (tool results + LLM reasoning)
and asks the LLM to produce a structured JSON RCA report.

The report format is defined in REPORTER_SYSTEM_PROMPT.
"""

import json
from langchain_core.messages import SystemMessage, HumanMessage
from app.agent.state import InvestigationState
from app.agent.prompts import REPORTER_SYSTEM_PROMPT
from app.core.llm import get_llm_with_fallbacks
from app.core.logger import get_logger
from app.core.llm import get_reporter_llm

logger = get_logger(__name__)


def _build_evidence_summary(messages) -> str:
    """
    Extracts tool results from messages into a readable evidence summary.
    Helps the reporter LLM focus on what was actually found.
    """
    evidence_parts = []
    for msg in messages:
        # ToolMessages contain the actual tool output
        if hasattr(msg, "content") and hasattr(msg, "name"):
            tool_name = getattr(msg, "name", "unknown_tool")
            content   = str(msg.content)[:1000]   # cap per tool
            evidence_parts.append(f"[{tool_name}]\n{content}")

    return "\n\n".join(evidence_parts) if evidence_parts else "No tool results available."


def reporter_node(state: InvestigationState) -> dict:
    """
    Final investigation node.
    Generates the structured RCA report from all evidence gathered.

    Returns state updates:
      final_report: parsed RCA dict
      steps:        final step showing root cause
    """
    logger.info(
        f"Reporter node — generating RCA for "
        f"{state['object_type']} {state['record_id']}"
    )

   
    llm = get_reporter_llm()  # no tools needed — just JSON output

    evidence_summary = _build_evidence_summary(state["messages"])

    reporter_message = HumanMessage(
        content=f"""
Investigation Summary:
  Record     : {state['object_type']} {state['record_id']}
  Anomaly    : {state['anomaly']}
  Loops run  : {state['loop_count']}

Evidence gathered from tools:
{evidence_summary}

Based on ALL the evidence above, write the Root Cause Analysis JSON report.
"""
    )

    response = llm.invoke([
        SystemMessage(content=REPORTER_SYSTEM_PROMPT),
        reporter_message,
    ])

    job_id = state.get("job_id")
    if job_id:
        try:
            from app.core.token_tracker import track_llm_usage
            track_llm_usage(job_id, response)
        except Exception as e:
            logger.warning(f"Could not track token usage in reporter: {e}")

    # ── Parse the JSON report ─────────────────────────────────────
    report_dict = _parse_report(response.content, state)

    # ── Build the final step for LWC display ─────────────────────
    root_cause  = report_dict.get("root_cause", "Investigation complete")
    confidence  = report_dict.get("confidence", 0.0)
    step_type   = "success" if confidence >= 70 else "warning"

    final_step = {
        "step_number": len(state["steps"]) + 1,
        "type":        step_type,
        "message":     f"Analysis complete — root cause identified ({confidence:.0f}% confidence)",
    }

    logger.info(f"✅ RCA complete: {root_cause[:80]} ({confidence}%)")

    # ── Replace the return block in reporter_node with this ──────────

    # Write final step to SQLite immediately
    if job_id:
        try:
            from app.db.writer import append_step, save_final_report as db_save
            append_step(job_id, final_step)
            db_save(job_id, report_dict, report_dict.get("confidence", 0.0))
            try:
                from app.rag.memory import save_investigation_to_memory
                save_investigation_to_memory(
                    job_id=job_id,
                    record_id=state["record_id"],
                    object_type=state["object_type"],
                    anomaly=state["anomaly"],
                    report=report_dict,
                )
            except Exception as e:
                logger.warning(f"Could not save to RAG memory: {e}")
        except Exception as e:
            logger.warning(f"Could not write report to SQLite: {e}")
    
            

    return {
        "final_report":   report_dict,
        "steps":          [final_step],
        "max_confidence": confidence,
    }


def _parse_report(raw_content: str, state: InvestigationState) -> dict:
    clean = raw_content.strip()
    if clean.startswith("```"):
        lines = clean.split("\n")
        clean = "\n".join(lines[1:-1]) if len(lines) > 2 else clean

    try:
        report = json.loads(clean)

        # ── Ensure all required fields ────────────────────────────
        report.setdefault("root_cause",     "Unable to determine root cause")
        report.setdefault("confidence",     50.0)
        report.setdefault("evidence",       [])
        report.setdefault("other_findings", [])
        report.setdefault("next_steps",     [])
        report.setdefault("ruled_out",      [])

        # ── Enforce causal_chain ──────────────────────────────────
        if "causal_chain" not in report or not report["causal_chain"]:
            # Build a minimal chain from root_cause if missing
            logger.warning("Reporter did not include causal_chain — building minimal chain")
            report["causal_chain"] = [
                {
                    "step": 1,
                    "actor": "Unknown — investigation did not trace origin",
                    "action": "Triggered the anomaly",
                    "component_type": "Unknown",
                    "component_name": "N/A",
                    "field_changed": "N/A",
                    "outcome": report.get("root_cause", "See evidence")
                }
            ]
            # Penalise confidence if chain is missing
            if report["confidence"] > 60:
                original = report["confidence"]
                report["confidence"] = min(report["confidence"], 55.0)
                logger.warning(
                    f"Confidence reduced from {original}% to {report['confidence']}% "
                    f"— causal chain was incomplete"
                )

        # ── Validate each chain step ──────────────────────────────
        required_step_fields = [
            "step", "actor", "action", "component_type",
            "component_name", "field_changed", "outcome"
        ]
        for i, step in enumerate(report["causal_chain"]):
            for field in required_step_fields:
                if field not in step:
                    step[field] = "N/A"

        return report

    except json.JSONDecodeError:
        logger.warning("Reporter returned non-JSON — using fallback")
        return {
            "root_cause":    raw_content[:300],
            "confidence":    40.0,
            "causal_chain":  [
                {
                    "step": 1,
                    "actor": "Unknown",
                    "action": "See raw output",
                    "component_type": "Unknown",
                    "component_name": "N/A",
                    "field_changed": "N/A",
                    "outcome": raw_content[:150]
                }
            ],
            "evidence":      ["Raw reporter output — JSON parse failed"],
            "other_findings": [],
            "next_steps":    ["Review the investigation steps manually"],
            "ruled_out":     [],
            "parse_error":   True,
        }