"""
pre_fetch.py
────────────
Pre-fetches ALL investigation context before the agent starts.
IMPORTANT: search_past_investigations runs FIRST so the agent
has relevant history immediately in message 1.
"""

from app.salesforce.client import get_sf_client
from app.core.logger import get_logger

logger = get_logger(__name__)


def run_pre_fetch(
    record_id:       str,
    object_type:     str,
    running_user_id: str | None = None,
    anomaly:         str = "",
) -> str:
    sections = []

    def _section(title: str, content: str) -> None:
        sections.append(f"{'='*60}\n{title}\n{'='*60}\n{content}\n")

    def _safe(fn, **kwargs) -> str:
        try:
            return fn(**kwargs)
        except Exception as e:
            return f"(Could not fetch — {str(e)[:80]})"

    # ── 0. Past investigations — FIRST so agent has context immediately ──
    if anomaly:
        from concurrent.futures import ThreadPoolExecutor, TimeoutError as FuturesTimeoutError
        try:
            from app.rag.searcher import search_past_investigations
            with ThreadPoolExecutor(max_workers=1) as executor:
                future = executor.submit(
                    search_past_investigations.func,
                    object_type=object_type,
                    anomaly_description=anomaly,
                )
                past = future.result(timeout=6.0)
            _section(
                "PAST INVESTIGATIONS — Similar Cases (check these FIRST)",
                past,
            )
        except FuturesTimeoutError:
            logger.warning("Past investigation search timed out — continuing without RAG context")
        except Exception as e:
            logger.warning(f"Past investigation search failed in pre-fetch: {e}")

    # ── 1. Record ─────────────────────────────────────────────────
    from app.tools.record import get_record
    _section(
        "RECORD — Current Field Values",
        _safe(get_record.func, record_id=record_id, object_type=object_type),
    )

    # ── 2. Field history ──────────────────────────────────────────
    from app.tools.history import get_record_history
    _section(
        "FIELD HISTORY — What Changed and When",
        _safe(get_record_history.func, record_id=record_id, object_type=object_type),
    )

    # ── 3. VR evaluation — MOST CRITICAL for save errors ─────────
    from app.tools.vr_evaluator import evaluate_validation_rules
    _section(
        "VALIDATION RULE EVALUATION — Which Rules Are Currently Firing",
        _safe(evaluate_validation_rules.func, record_id=record_id, object_type=object_type),
    )

    # ── 4. Approval lock ──────────────────────────────────────────
    from app.tools.approval_processes import get_approval_instance_for_record
    _section(
        "APPROVAL LOCK — Is Record Currently Locked?",
        _safe(get_approval_instance_for_record.func, record_id=record_id),
    )

    # ── 5. Flow inventory (with record-update hints) ───────────────
    from app.tools.flows import get_flows_for_object
    _section(
        "ACTIVE FLOWS — Inventory (call get_flow_details for HAS RECORD UPDATES flows)",
        _safe(get_flows_for_object.func, object_type=object_type),
    )

    # ── 6. Triggers ───────────────────────────────────────────────
    from app.tools.triggers import get_triggers_for_object
    _section(
        "APEX TRIGGERS — (call get_apex_class_body if trigger body not sufficient)",
        _safe(get_triggers_for_object.func, object_type=object_type),
    )

    # ── 7. Assignment rules (Case/Lead only) ──────────────────────
    if object_type in ("Case", "Lead"):
        from app.tools.assignment_rules import get_assignment_rules_for_object
        _section(
            "ASSIGNMENT RULES — (only relevant for OwnerId assignment anomalies)",
            _safe(get_assignment_rules_for_object.func, object_type=object_type),
        )

    # ── 8. OWD ────────────────────────────────────────────────────
    from app.tools.sharing import get_owd_for_object
    _section(
        "OWD — Sharing Model",
        _safe(get_owd_for_object.func, object_type=object_type),
    )

    # ── 9. Running user ───────────────────────────────────────────
    if running_user_id:
        from app.tools.permissions import get_user_profile_and_permsets
        _section(
            "RUNNING USER — Profile and Permission Sets",
            _safe(get_user_profile_and_permsets.func, user_id=running_user_id),
        )

    context = "\n".join(sections)
    logger.info(
        f"✅ Pre-fetch complete: {object_type} {record_id} "
        f"({len(context)} chars, {len(sections)} sections)"
    )
    return context