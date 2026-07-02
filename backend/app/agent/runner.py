"""
runner.py
─────────
Runs the LangGraph investigation graph ONCE.
Uses ThreadPoolExecutor for timeout — NOT signal.SIGALRM
(signal only works from main thread; BackgroundTasks run in threads).
"""

from concurrent.futures import ThreadPoolExecutor, TimeoutError as FuturesTimeoutError

from app.agent.graph import investigation_graph, build_initial_state
from app.db.writer import (
    create_investigation_record,
    append_step,
    save_final_report,
    mark_investigation_failed,
)
from app.tools.record import detect_object_type
from app.core.logger import get_logger

logger = get_logger(__name__)

INVESTIGATION_TIMEOUT_SECONDS = 180   # 3 minutes


def run_investigation_background(
    job_id: str,
    record_id: str,
    object_type: str | None,
    anomaly: str,
    running_user_id: str | None,
    focus_areas: str | None = None,
) -> None:
    """
    Runs investigation in FastAPI BackgroundTask.
    ThreadPoolExecutor provides the timeout — no signal module used.
    Each node writes its own steps to SQLite.
    """

    # ── Auto-detect object type ───────────────────────────────────
    if not object_type:
        object_type = detect_object_type(record_id)
    if not object_type:
        object_type = "Unknown"

    # ── Create SQLite record ──────────────────────────────────────
    create_investigation_record(
        job_id=job_id,
        record_id=record_id,
        object_type=object_type,
        anomaly=anomaly,
        running_user_id=running_user_id,
    )

    append_step(job_id, {
        "step_number": 1,
        "type": "info",
        "message": f"Investigation started — {object_type} {record_id}",
    })

     # ── Pre-fetch investigation context ───────────────────────────
    pre_context = None
    try:
        append_step(job_id, {
            "step_number": 2,
            "type":        "info",
            "message":     "Scanning record, validation rules, flows, and automation...",
        })

        from app.tools.pre_fetch import run_pre_fetch
        pre_context = run_pre_fetch(
            record_id=record_id,
            object_type=object_type,
            running_user_id=running_user_id,
            anomaly=anomaly,  
        )

        append_step(job_id, {
            "step_number": 3,
            "type":        "success",
            "message":     "Pre-scan complete — analysing findings...",
        })

    except Exception as e:
        logger.warning(f"Pre-fetch failed: {e} — continuing without pre-context")
        append_step(job_id, {
            "step_number": 3,
            "type":        "warning",
            "message":     "Pre-scan incomplete — agent will investigate manually",
        })


    # ── Pre-index org metadata (bypassed to prevent SQLite thread locks) ──
    # We skip pre-indexing here because:
    # 1. The agent already receives all triggers, flows, and VRs in pre_context.
    # 2. Accessing Chroma across concurrent threads can deadlock SQLite.
    logger.info(f"Skipping metadata pre-indexing for {object_type}")


    logger.info(f"Running investigation {job_id[:8]}... | {object_type} {record_id}")

    try:
        initial_state = build_initial_state(
            job_id=job_id,
            record_id=record_id,
            object_type=object_type,
            anomaly=anomaly,
            running_user_id=running_user_id,
        )

        # Inject focus areas if provided
        if focus_areas:
            initial_state["focus_areas"] = focus_areas

        if pre_context:
            initial_state["pre_context"] = pre_context    

        # ── Run with ThreadPoolExecutor timeout ───────────────────
        # This is thread-safe unlike signal.SIGALRM
        with ThreadPoolExecutor(max_workers=1) as executor:
            future = executor.submit(
                investigation_graph.invoke,
                initial_state,
            )
            try:
                final_state = future.result(timeout=INVESTIGATION_TIMEOUT_SECONDS)
            except FuturesTimeoutError:
                logger.warning(f"Investigation {job_id[:8]} timed out after {INVESTIGATION_TIMEOUT_SECONDS}s")
                append_step(job_id, {
                    "step_number": 99,
                    "type": "warning",
                    "message": "Investigation timed out after 3 minutes — partial results saved",
                })
                mark_investigation_failed(
                    job_id,
                    "Investigation timed out. Try with a more specific anomaly description."
                )
                return

        # ── Safety-net: save report if reporter didn't already ────
        report = final_state.get("final_report")
        if report:
            save_final_report(job_id, report, report.get("confidence", 0.0))
        else:
            save_final_report(
                job_id,
                {
                    "root_cause": "Investigation complete — see steps for details",
                    "confidence": 50.0,
                    "evidence": [],
                    "next_steps": ["Review the investigation steps above"],
                    "other_findings": [],
                    "ruled_out": [],
                },
                50.0,
            )

    except Exception as exc:
        logger.error(f"Investigation {job_id[:8]} failed: {exc}")
        mark_investigation_failed(job_id, str(exc))