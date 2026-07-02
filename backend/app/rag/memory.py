"""
memory.py — uses shared chromadb client.
"""

from langchain_chroma import Chroma
from langchain_core.documents import Document
from app.rag.embeddings import get_embeddings
from app.rag.chroma_client import get_chroma_client
from app.core.logger import get_logger
from datetime import datetime

logger = get_logger(__name__)


def save_investigation_to_memory(
    job_id: str,
    record_id: str,
    object_type: str,
    anomaly: str,
    report: dict,
) -> None:
    if not report or not report.get("root_cause"):
        return

    confidence = report.get("confidence", 0.0)
    if confidence < 60.0:
        return

    try:
        evidence_text  = "\n".join(f"  • {e}" for e in report.get("evidence", []))
        next_steps_text = "\n".join(f"  {i+1}. {s}" for i, s in enumerate(report.get("next_steps", [])))
        ruled_out_text  = "\n".join(f"  • {r}" for r in report.get("ruled_out", []))

        doc_content = f"""Investigation: {object_type} — {anomaly}
Date: {datetime.now().strftime('%Y-%m-%d')}
Confidence: {confidence}%

Root Cause: {report['root_cause']}

Evidence:
{evidence_text or '  None recorded'}

Next Steps:
{next_steps_text or '  None recorded'}

Ruled Out:
{ruled_out_text or '  None recorded'}
"""

        vectorstore = Chroma(
            client=get_chroma_client(),         # ← shared client
            collection_name="past_investigations",
            embedding_function=get_embeddings(),
        )

        vectorstore.add_documents(
            documents=[Document(
                page_content=doc_content,
                metadata={
                    "job_id":      job_id,
                    "object_type": object_type,
                    "anomaly":     anomaly[:200],
                    "root_cause":  report["root_cause"][:200],
                    "confidence":  confidence,
                    "date":        datetime.now().isoformat(),
                }
            )],
            ids=[job_id],
        )

        logger.info(
            f"✅ Saved investigation to memory: {object_type} — "
            f"{report['root_cause'][:60]} ({confidence}%)"
        )

    except Exception as exc:
        logger.warning(f"Could not save to investigation memory: {exc}")


def update_investigation_memory(job_id: str, rating: str, correction: str | None = None) -> None:
    """Updates the Chroma memory for a job by marking it verified, correcting it, or deleting it."""
    try:
        vectorstore = Chroma(
            client=get_chroma_client(),
            collection_name="past_investigations",
            embedding_function=get_embeddings(),
        )

        if rating == "upvote":
            res = vectorstore.get(ids=[job_id])
            if res and res.get("documents") and len(res["documents"]) > 0:
                doc_content = res["documents"][0]
                old_metadata = res["metadatas"][0] if (res.get("metadatas") and len(res["metadatas"]) > 0) else {}
                old_metadata["status"] = "verified"
                
                # Delete and re-add to update metadata
                vectorstore.delete(ids=[job_id])
                vectorstore.add_documents(
                    documents=[Document(page_content=doc_content, metadata=old_metadata)],
                    ids=[job_id]
                )
                logger.info(f"✅ Chroma memory marked as verified for job {job_id[:8]}")
        elif rating == "downvote":
            if correction:
                res = vectorstore.get(ids=[job_id])
                if res and res.get("documents") and len(res["documents"]) > 0:
                    doc_content = res["documents"][0]
                    old_metadata = res["metadatas"][0] if (res.get("metadatas") and len(res["metadatas"]) > 0) else {}
                    old_metadata["status"] = "corrected"
                    old_metadata["correction"] = correction[:200]
                    
                    # Append user correction to content
                    new_content = doc_content + f"\n\n⚠️ USER CORRECTION: {correction}\n"
                    
                    # Delete and re-add with corrected content and metadata
                    vectorstore.delete(ids=[job_id])
                    vectorstore.add_documents(
                        documents=[Document(page_content=new_content, metadata=old_metadata)],
                        ids=[job_id]
                    )
                    logger.info(f"✅ Chroma memory updated with user correction for job {job_id[:8]}")
            else:
                # If downvoted without notes, simply wipe the incorrect memory
                vectorstore.delete(ids=[job_id])
                logger.info(f"✅ Chroma memory deleted for job {job_id[:8]}")
    except Exception as exc:
        logger.warning(f"Could not update investigation memory: {exc}")