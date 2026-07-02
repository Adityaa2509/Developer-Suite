from pydantic import BaseModel
from typing import Optional, Any


class ToolResult(BaseModel):
    tool_name:  str
    status:     str       # "success" | "empty" | "error" | "skipped"
    data:       Any       # raw result — list or dict
    error:      Optional[str] = None
    count:      int = 0


class Hypothesis(BaseModel):
    name:        str
    confidence:  float = 0.0
    evidence:    list[str] = []
    ruled_out:   bool = False


class InvestigationStep(BaseModel):
    step_number: int
    type:        str    # "info" | "success" | "error" | "warning"
    message:     str


class RCAReport(BaseModel):
    root_cause:       str
    confidence:       float
    evidence:         list[str]
    other_findings:   list[str] = []
    next_steps:       list[str] = []
    ruled_out:        list[str] = []


class InvestigationResponse(BaseModel):
    job_id:       str
    record_id:    str
    object_type:  str
    anomaly:      str
    status:       str
    steps:        list[InvestigationStep] = []
    hypotheses:   list[Hypothesis] = []
    report:       Optional[RCAReport] = None
    new_steps:    list[InvestigationStep] = []   # only new since last poll


class ToolFetchResponse(BaseModel):
    record_id:   str
    object_type: str
    results:     dict[str, ToolResult]
    total_tools: int
    success_count: int
