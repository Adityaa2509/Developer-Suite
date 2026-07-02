"""
searcher.py
───────────
RAG search tools. Uses shared chromadb client.
"""

from langchain.tools import tool
from langchain_chroma import Chroma
from app.rag.embeddings import get_embeddings
from app.rag.chroma_client import get_chroma_client
from app.core.config import get_settings
from app.core.logger import get_logger

logger = get_logger(__name__)


@tool
def search_org_metadata(object_type: str, query: str) -> str:
    """
    Searches pre-indexed org metadata for the given object type.
    Use this BEFORE calling live Salesforce API tools for faster results.
    Returns relevant automation components related to your query.
    """
    try:
        collection_name = f"{object_type.lower()}_metadata"

        vectorstore = Chroma(
            client=get_chroma_client(),         # ← shared client, no conflict
            collection_name=collection_name,
            embedding_function=get_embeddings(),
        )

        if vectorstore._collection.count() == 0:
            return (
                f"No metadata indexed for {object_type}. "
                f"Use the direct Salesforce API tools instead."
            )

        results = vectorstore.similarity_search_with_relevance_scores(query, k=3)

        if not results:
            return f"No relevant metadata found for query: {query}"

        lines = [
            f"Org metadata for {object_type} — query: '{query}'",
            "─" * 60,
        ]
        for doc, score in results:
            comp_type = doc.metadata.get("type", "unknown")
            lines.append(f"\n[{comp_type.upper()}] Relevance: {score:.2f}")
            lines.append(doc.page_content[:600])

        return "\n".join(lines)

    except Exception as exc:
        logger.warning(f"RAG search failed: {exc}")
        return f"Metadata search unavailable: {str(exc)}"


@tool
def search_past_investigations(object_type: str, anomaly_description: str) -> str:
    """
    Searches past investigations for similar issues on the same object.
    Use this at the START of investigation — may find the answer immediately.
    """
    try:
        collection_name = "past_investigations"

        vectorstore = Chroma(
            client=get_chroma_client(),         # ← shared client
            collection_name=collection_name,
            embedding_function=get_embeddings(),
        )

        if vectorstore._collection.count() == 0:
            return "No past investigations found. Proceed with full investigation."

        query   = f"{object_type}: {anomaly_description}"
        results = vectorstore.similarity_search_with_relevance_scores(query, k=6)

        if not results:
            return "No similar past investigations found. Proceed with full investigation."

        # Sort corrected and verified documents to the top, then sort by score descending
        def get_sort_key(item):
            doc, score = item
            status = doc.metadata.get("status", "")
            priority = 2 if status == "corrected" else (1 if status == "verified" else 0)
            return (priority, score)

        sorted_results = sorted(results, key=get_sort_key, reverse=True)
        final_results = sorted_results[:3]

        if final_results[0][1] < 0.5:
            return "No similar past investigations found. Proceed with full investigation."

        lines = ["Similar past investigations found:", "─" * 60]
        for doc, score in final_results:
            if score >= 0.5:
                status_suffix = " [CORRECTED]" if doc.metadata.get("status") == "corrected" else ""
                lines.append(f"\nMatch ({score:.0%} similar){status_suffix}:")
                # Do not truncate to 500 to ensure USER CORRECTION block is fully preserved
                lines.append(doc.page_content)

        lines.append(
            "\n⚡ Suggestion: prioritise these root causes — "
            "but still verify with get_flow_details or evaluate_validation_rules before concluding."
        )
        return "\n".join(lines)

    except Exception as exc:
        logger.warning(f"Past investigation search failed: {exc}")
        return "Past investigation search unavailable — proceed normally."