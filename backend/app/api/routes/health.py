from fastapi import APIRouter
from app.core.config import get_settings
from app.core.logger import get_logger

router = APIRouter()
logger = get_logger(__name__)


@router.get("/health", summary="Basic liveness check")
async def health_check():
    s = get_settings()
    return {
        "status": "healthy",
        "app": s.APP_NAME,
        "version": s.APP_VERSION,
    }


@router.get("/health/detailed", summary="Check all service connections")
async def detailed_health():
    s = get_settings()
    services = {}

    # Salesforce
    try:
        from app.salesforce.client import get_sf_client
        sf = get_sf_client()
        services["salesforce"] = {
            "status": "connected",
            "instance": sf.sf_instance,
        }
    except Exception as exc:
        services["salesforce"] = {"status": "error", "detail": str(exc)}

    # Chroma
    try:
        from app.rag.chroma_client import get_chroma_client
        client = get_chroma_client()
        services["chroma"] = {
            "status": "connected",
            "collections": len(client.list_collections()),
        }
    except Exception as exc:
        services["chroma"] = {"status": "error", "detail": str(exc)}

    # SQLite
    try:
        from app.db.database import engine
        with engine.connect() as conn:
            conn.execute(__import__("sqlalchemy").text("SELECT 1"))
        services["sqlite"] = {"status": "connected"}
    except Exception as exc:
        services["sqlite"] = {"status": "error", "detail": str(exc)}

    all_ok = all(v.get("status") == "connected" for v in services.values())

    return {
        "app": s.APP_NAME,
        "version": s.APP_VERSION,
        "overall": "healthy" if all_ok else "degraded",
        "services": services,
    }
