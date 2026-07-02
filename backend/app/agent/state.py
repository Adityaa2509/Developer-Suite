import operator
from typing import TypedDict, Annotated, Optional
from langchain_core.messages import BaseMessage


class InvestigationState(TypedDict):
    # ── Identity ──────────────────────────────────────────────────
    job_id:          str
    record_id:       str
    object_type:     str
    anomaly:         str
    running_user_id: Optional[str]
    focus_areas:     Optional[str]

    # ── Pre-fetched context ───────────────────────────────────────
    pre_context: Optional[str]     # ← NEW: injected before agent starts

    # ── Agent reasoning ───────────────────────────────────────────
    messages: Annotated[list[BaseMessage], operator.add]

    # ── Investigation progress ────────────────────────────────────
    hypotheses:     list[dict]
    loop_count:     int
    max_confidence: float

    # ── Output ───────────────────────────────────────────────────
    steps:        Annotated[list[dict], operator.add]
    final_report: Optional[dict]