from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.routes.health import router as health_router
from app.core.config import get_settings
from app.core.logger import get_logger
from app.api.routes.investigate import router as investigate_router
from app.api.routes.copilot import router as copilot_router
from app.api.routes.permissions import router as permissions_router

logger = get_logger(__name__)
settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # ── Startup ───────────────────────────────────────────────────
    logger.info(f"🚀  {settings.APP_NAME} v{settings.APP_VERSION} starting")
    logger.info(f"    Debug : {settings.DEBUG}")
    logger.info(f"    LLM   : {settings.GEMINI_MODEL_PRIMARY}")

    # Initialise SQLite tables on startup
    from app.db.database import init_db
    init_db()
    logger.info("    SQLite tables initialised")

    yield

    # ── Shutdown ──────────────────────────────────────────────────
    logger.info("👋  Sherlock 🕵️ shutting down")


app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description=settings.APP_DESCRIPTION,
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)


app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health_router, prefix="/api", tags=["Health"])
app.include_router(investigate_router, prefix="/api", tags=["Investigate"])
app.include_router(copilot_router, prefix="/api/copilot", tags=["Copilot"])
app.include_router(permissions_router, prefix="/api", tags=["Permissions"])