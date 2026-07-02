"""
chroma_client.py
────────────────
Single source of truth for the chromadb client.
ALL other modules (indexer, searcher, memory) must use
get_chroma_client() and pass client= to Chroma.

Never create chromadb.PersistentClient anywhere else — 
two clients pointing at the same directory causes the
"different settings" crash.
"""

import chromadb
from chromadb.config import Settings as ChromaSettings
from app.core.config import get_settings
from app.core.logger import get_logger

logger = get_logger(__name__)

_chroma_client: chromadb.PersistentClient | None = None


def get_chroma_client() -> chromadb.PersistentClient:
    """
    Returns the singleton chromadb client.
    Creates it on first call, reuses on all subsequent calls.
    """
    global _chroma_client

    if _chroma_client is None:
        s = get_settings()
        _chroma_client = chromadb.PersistentClient(
            path=s.CHROMA_PERSIST_DIR,
            settings=ChromaSettings(
                anonymized_telemetry=False,
                allow_reset=True,
            ),
        )
        logger.info(f"✅ Chroma singleton created at {s.CHROMA_PERSIST_DIR}")

    return _chroma_client


def get_or_create_collection(name: str):
    """Gets or creates a named Chroma collection."""
    client = get_chroma_client()
    col = client.get_or_create_collection(name=name)
    logger.debug(f"Collection ready: {name}")
    return col