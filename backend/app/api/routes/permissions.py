"""
permissions.py
──────────────
FastAPI route for permissions agent background job polling.

GET /api/permissions/status/{job_id}
  Returns the current status of a background permissions agent job.
  LWC polls every 3 seconds until status is 'complete' or 'failed'.
"""
from fastapi import APIRouter, HTTPException
from app.agent.permissions_jobs import PERMISSIONS_JOBS
from app.core.logger import get_logger

router = APIRouter()
logger = get_logger(__name__)


@router.get("/permissions/status/{job_id}")
async def poll_permissions_status(job_id: str):
    """
    Poll the status of a background permissions agent job.
    Returns:
      status: 'running' | 'complete' | 'failed'
      result: the full agent response (only when complete/failed)
    """
    job = PERMISSIONS_JOBS.get(job_id)
    if not job:
        raise HTTPException(
            status_code=404,
            detail=f"Permissions job {job_id} not found"
        )
    return job
