"""
writer.py
─────────
Writes investigation progress to SQLite in real time.

Why this matters:
  The LangGraph agent runs in a FastAPI BackgroundTask.
  The LWC component polls every 3 seconds for new steps.
  This writer is the bridge — steps are written here
  as the agent runs, and the poll endpoint reads them.

Thread safety:
  SQLAlchemy sessions are not thread-safe.
  We create a new session per write to avoid conflicts.
"""

import json
from datetime import datetime
from app.db.database import SessionLocal, Investigation
from app.core.logger import get_logger

logger = get_logger(__name__)


def create_investigation_record(
    job_id:          str,
    record_id:       str,
    object_type:     str,
    anomaly:         str,
    running_user_id: str | None = None,
) -> None:
    """Creates the initial Investigation row in SQLite."""
    db = SessionLocal()
    try:
        inv = Investigation(
            id=job_id,
            record_id=record_id,
            object_type=object_type,
            anomaly=anomaly,
            status="running",
            steps=json.dumps([]),
            hypotheses=json.dumps([]),
            rca_report=None,
            confidence=0.0,
            loop_count=0,
        )
        db.add(inv)
        db.commit()
        logger.info(f"✅ Investigation record created: {job_id}")
    except Exception as exc:
        logger.error(f"Failed to create investigation record: {exc}")
        db.rollback()
    finally:
        db.close()


def append_step(job_id: str, step: dict) -> None:
    """
    Appends a single step dict to the investigation's steps JSON column.
    Steps are stored as a JSON array — new steps appended on each call.
    """
    db = SessionLocal()
    try:
        inv = db.query(Investigation).filter_by(id=job_id).first()
        if not inv:
            logger.warning(f"Investigation {job_id} not found for step append")
            return

        current_steps = json.loads(inv.steps or "[]")
        current_steps.append(step)
        inv.steps      = json.dumps(current_steps)
        inv.loop_count = step.get("step_number", inv.loop_count)
        db.commit()
    except Exception as exc:
        logger.error(f"Failed to append step: {exc}")
        db.rollback()
    finally:
        db.close()


def save_final_report(job_id: str, report: dict, confidence: float) -> None:
    db = SessionLocal()
    try:
        inv = db.query(Investigation).filter_by(id=job_id).first()
        if not inv:
            return
        inv.rca_report   = json.dumps(report)
        inv.confidence   = confidence
        inv.status       = "complete"
        inv.completed_at = datetime.utcnow()
        # Save causal chain separately for easy querying
        chain = report.get("causal_chain", [])
        if hasattr(inv, "causal_chain"):
            inv.causal_chain = json.dumps(chain)
        db.commit()
        logger.info(
            f"✅ Investigation {job_id[:8]} complete "
            f"({confidence}%, chain: {len(chain)} steps)"
        )
    except Exception as exc:
        logger.error(f"Failed to save report: {exc}")
    finally:
        db.close()

def mark_investigation_failed(job_id: str, error: str) -> None:
    """Marks an investigation as failed with an error message."""
    db = SessionLocal()
    try:
        inv = db.query(Investigation).filter_by(id=job_id).first()
        if inv:
            inv.status     = "failed"
            inv.rca_report = json.dumps({"error": error})
            db.commit()
    except Exception as exc:
        logger.error(f"Failed to mark investigation failed: {exc}")
    finally:
        db.close()


def update_token_usage(job_id: str, tokens: int, cost: float) -> None:
    """Updates and increments the total tokens and total cost for the investigation."""
    db = SessionLocal()
    try:
        inv = db.query(Investigation).filter_by(id=job_id).first()
        if not inv:
            return
        inv.total_tokens = (inv.total_tokens or 0) + tokens
        inv.total_cost_usd = (inv.total_cost_usd or 0.0) + cost
        db.commit()
    except Exception as exc:
        logger.error(f"Failed to update token usage: {exc}")
        db.rollback()
    finally:
        db.close()


def save_investigation_feedback(job_id: str, rating: str, notes: str | None = None) -> None:
    """Saves upvote/downvote and notes in SQLite and triggers vector store updates."""
    db = SessionLocal()
    try:
        inv = db.query(Investigation).filter_by(id=job_id).first()
        if inv:
            inv.feedback_rating = rating
            inv.feedback_notes  = notes
            db.commit()
            logger.info(f"✅ Saved SQL feedback for job {job_id[:8]}: {rating}")
            
            # Trigger Chroma DB memory update
            try:
                from app.rag.memory import update_investigation_memory
                update_investigation_memory(job_id, rating, notes)
            except Exception as e:
                logger.warning(f"Failed to update vector memory for feedback: {e}")
    except Exception as exc:
        logger.error(f"Failed to save feedback: {exc}")
        db.rollback()
    finally:
        db.close()


def get_investigation_state(job_id: str) -> dict | None:
    """
    Returns the current investigation state for polling.
    Used by the GET /api/investigate/{job_id} endpoint.
    """
    db = SessionLocal()
    try:
        inv = db.query(Investigation).filter_by(id=job_id).first()
        if not inv:
            return None

        return {
            "job_id":      inv.id,
            "record_id":   inv.record_id,
            "object_type": inv.object_type,
            "anomaly":     inv.anomaly,
            "status":      inv.status,
            "steps":       json.loads(inv.steps or "[]"),
            "confidence":  inv.confidence,
            "loop_count":  inv.loop_count,
            "report":      json.loads(inv.rca_report) if inv.rca_report else None,
            "created_at":  str(inv.created_at),
            "completed_at": str(inv.completed_at) if inv.completed_at else None,
            "total_tokens": inv.total_tokens or 0,
            "total_cost_usd": inv.total_cost_usd or 0.0,
            "feedback_rating": inv.feedback_rating,
            "feedback_notes": inv.feedback_notes,
        }
    except Exception as exc:
        logger.error(f"Failed to get investigation state: {exc}")
        return None
    finally:
        db.close()

