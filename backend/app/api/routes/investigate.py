"""
investigate.py
──────────────
FastAPI routes for DevMind Investigate.

POST /api/investigate
  Starts a new investigation as a BackgroundTask.
  Returns job_id immediately — investigation runs async.

GET /api/investigate/{job_id}
  Returns current state of an investigation.
  Used by LWC polling every 3 seconds.
  Returns: status, all steps so far, hypotheses, report (when done).

POST /api/tools/fetch  (from Day 2 — kept unchanged)
GET  /api/tools/detect (from Day 2 — kept unchanged)
"""

import uuid
from fastapi import APIRouter, HTTPException, BackgroundTasks
from app.models.requests import InvestigationRequest, ToolFetchRequest
from app.models.responses import ToolFetchResponse
from app.tools.record import detect_object_type
from app.tools.registry import fetch_all_tools
from app.agent.runner import run_investigation_background
from app.db.writer import get_investigation_state
from app.core.logger import get_logger

router  = APIRouter()
logger  = get_logger(__name__)


# ══════════════════════════════════════════════════════════════════
# ── INVESTIGATION ENDPOINTS
# ══════════════════════════════════════════════════════════════════

@router.post(
    "/investigate",
    summary="Start a new record investigation",
    status_code=202,
)
async def start_investigation(
    request: InvestigationRequest,
    background_tasks: BackgroundTasks,
):
    """
    Starts a DevMind investigation as a background task.
    Returns job_id immediately — investigation runs asynchronously.
    Poll GET /investigate/{job_id} every 3 seconds for progress.
    """
    job_id      = str(uuid.uuid4())
    object_type = request.object_type or detect_object_type(request.record_id)

    logger.info(
        f"New investigation: {job_id} | "
        f"{object_type} {request.record_id}"
    )

    background_tasks.add_task(
        run_investigation_background,
        job_id=job_id,
        record_id=request.record_id,
        object_type=object_type,
        anomaly=request.anomaly,
        running_user_id=request.running_user_id,
    )

    return {
        "job_id":      job_id,
        "status":      "started",
        "record_id":   request.record_id,
        "object_type": object_type,
        "message":     "Investigation started. Poll /api/investigate/{job_id} for progress.",
    }


@router.get(
    "/investigate/{job_id}",
    summary="Poll investigation progress",
)
async def poll_investigation(job_id: str):
    """
    Returns the current state of an investigation.
    LWC calls this every 3 seconds.

    Response includes:
      status      : 'running' | 'complete' | 'failed'
      steps       : all steps so far (LWC appends these to the feed)
      confidence  : current highest hypothesis confidence
      report      : full RCA report (only when status = 'complete')
    """
    state = get_investigation_state(job_id)

    if not state:
        raise HTTPException(
            status_code=404,
            detail=f"Investigation {job_id} not found",
        )

    return state


@router.post(
    "/investigate/{job_id}/feedback",
    summary="Save user feedback for an investigation",
)
async def save_feedback(job_id: str, request: dict):
    rating = request.get("rating")
    notes = request.get("notes")
    if rating not in ("upvote", "downvote"):
        raise HTTPException(
            status_code=400,
            detail="Rating must be 'upvote' or 'downvote'",
        )

    from app.db.writer import save_investigation_feedback
    save_investigation_feedback(job_id, rating, notes)
    return {"status": "success"}



# ══════════════════════════════════════════════════════════════════
# ── TOOL ENDPOINTS (from Day 2 — unchanged)
# ══════════════════════════════════════════════════════════════════

@router.post(
    "/tools/fetch",
    response_model=ToolFetchResponse,
    summary="Run all investigation tools for a record",
)
async def run_tool_fetch(request: ToolFetchRequest):
    """Runs all investigation tools — returns raw data without agent reasoning."""
    logger.info(f"Tool fetch: {request.object_type} {request.record_id}")

    try:
        results = fetch_all_tools(
            record_id=request.record_id,
            object_type=request.object_type,
            running_user_id=request.running_user_id,
            tools_to_run=request.tools or None,
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))

    success_count = sum(1 for r in results.values() if r.status == "success")
    return ToolFetchResponse(
        record_id=request.record_id,
        object_type=request.object_type,
        results=results,
        total_tools=len(results),
        success_count=success_count,
    )


@router.get(
    "/tools/detect/{record_id}",
    summary="Auto-detect Salesforce object type",
)
async def detect_object(record_id: str):
    obj_type = detect_object_type(record_id)
    if not obj_type:
        raise HTTPException(
            status_code=404,
            detail=f"Cannot determine object type for: {record_id}",
        )
    return {"record_id": record_id, "object_type": obj_type}
