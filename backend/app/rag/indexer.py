"""
indexer.py
──────────
Indexes Salesforce org metadata into Chroma before investigation.
Uses the shared chromadb client — no conflict with searcher/memory.
"""

from langchain_chroma import Chroma
from langchain_core.documents import Document
from app.rag.embeddings import get_embeddings
from app.rag.chroma_client import get_chroma_client
from app.core.config import get_settings
from app.core.logger import get_logger

logger = get_logger(__name__)


def _collection_exists(collection_name: str) -> bool:
    try:
        client = get_chroma_client()
        col = client.get_collection(collection_name)
        return col.count() > 0
    except Exception:
        return False


def index_object_metadata(object_type: str, force: bool = False) -> int:
    """
    Indexes automation metadata for an object into Chroma.
    Skips if already indexed (unless force=True).
    """
    collection_name = f"{object_type.lower()}_metadata"

    if not force and _collection_exists(collection_name):
        logger.info(f"✅ {collection_name} already indexed — skipping")
        return 0

    logger.info(f"Indexing metadata for {object_type}...")
    docs = []

    # Triggers
    try:
        from app.tools.triggers import get_triggers_for_object
        result = get_triggers_for_object.func(object_type=object_type)
        if "No active" not in result and "failed" not in result.lower():
            docs.append(Document(
                page_content=result,
                metadata={"type": "triggers", "object": object_type}
            ))
    except Exception as e:
        logger.warning(f"Could not index triggers: {e}")

    # Flows
    try:
        from app.tools.flows import get_flows_for_object
        result = get_flows_for_object.func(object_type=object_type)
        if "No flows" not in result and "failed" not in result.lower():
            docs.append(Document(
                page_content=result,
                metadata={"type": "flows", "object": object_type}
            ))
    except Exception as e:
        logger.warning(f"Could not index flows: {e}")

    # Validation Rules
    try:
        from app.tools.validation_rules import get_validation_rules_for_object
        result = get_validation_rules_for_object.func(object_type=object_type)
        if "No active" not in result:
            docs.append(Document(
                page_content=result,
                metadata={"type": "validation_rules", "object": object_type}
            ))
    except Exception as e:
        logger.warning(f"Could not index validation rules: {e}")

    # Assignment Rules
    try:
        from app.tools.assignment_rules import get_assignment_rules_for_object
        result = get_assignment_rules_for_object.func(object_type=object_type)
        if "only available" not in result:
            docs.append(Document(
                page_content=result,
                metadata={"type": "assignment_rules", "object": object_type}
            ))
    except Exception as e:
        logger.warning(f"Could not index assignment rules: {e}")

    if not docs:
        logger.info(f"No metadata to index for {object_type}")
        return 0

    # Use shared client — avoids "different settings" conflict
    vectorstore = Chroma(
        client=get_chroma_client(),
        collection_name=collection_name,
        embedding_function=get_embeddings(),
    )
    ids = [f"{object_type}_{doc.metadata['type']}" for doc in docs]
    vectorstore.add_documents(documents=docs, ids=ids)

    logger.info(f"✅ Indexed {len(docs)} metadata docs for {object_type}")
    return len(docs)