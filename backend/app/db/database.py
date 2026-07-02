"""
database.py
───────────
SQLite via SQLAlchemy.
Stores: investigation records, steps, hypotheses, RCA reports.
"""
import uuid
import json
from datetime import datetime
from sqlalchemy import (
    create_engine, Column, String, Text,
    DateTime, Float, Integer,
)
from sqlalchemy.orm import DeclarativeBase, sessionmaker
from app.core.config import get_settings
from app.core.logger import get_logger

logger = get_logger(__name__)
settings = get_settings()

engine = create_engine(
    settings.DATABASE_URL,
    connect_args={"check_same_thread": False},
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass


class Investigation(Base):
    """One row per investigation job."""
    __tablename__ = "investigations"

    id           = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    record_id    = Column(String, nullable=False)
    object_type  = Column(String)
    anomaly      = Column(Text)
    status       = Column(String, default="pending")
    steps        = Column(Text, default="[]")      # JSON list of step strings
    hypotheses   = Column(Text, default="[]")      # JSON list of {name, confidence}
    rca_report   = Column(Text)                    # JSON final report
    confidence   = Column(Float, default=0.0)
    loop_count   = Column(Integer, default=0)
    created_at   = Column(DateTime, default=datetime.utcnow)
    completed_at = Column(DateTime, nullable=True)
    causal_chain = Column(Text, default="[]")
    total_tokens = Column(Integer, default=0)
    total_cost_usd = Column(Float, default=0.0)
    feedback_rating = Column(String, nullable=True)
    feedback_notes  = Column(Text, nullable=True)




def init_db() -> None:
    """Create all tables. Called on FastAPI startup."""
    Base.metadata.create_all(bind=engine)
    logger.info("✅ SQLite tables ready")


def get_db():
    """Dependency injector for FastAPI routes."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
