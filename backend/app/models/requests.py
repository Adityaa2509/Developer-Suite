from pydantic import BaseModel, Field
from typing import Optional


class InvestigationRequest(BaseModel):
    record_id: str = Field(
        ...,
        description="Salesforce record ID to investigate",
        example="500ABC123DEF456"
    )
    anomaly: str = Field(
        ...,
        description="Plain English description of what went wrong",
        min_length=10,
        example="Case was not assigned to Support queue after creation"
    )
    object_type: Optional[str] = Field(
        default=None,
        description="Object API name. Auto-detected from record ID if not provided.",
        example="Case"
    )
    running_user_id: Optional[str] = Field(
        default=None,
        description="ID of the user who experienced the issue. Used for permission checks.",
        example="005ABC123DEF456"
    )


class ToolFetchRequest(BaseModel):
    record_id: str
    object_type: str
    running_user_id: Optional[str] = None
    tools: list[str] = Field(
        default=["record", "history", "triggers", "flows",
                 "validation_rules", "assignment_rules",
                 "approval_processes", "permissions", "sharing"],
        description="Which tools to run"
    )
