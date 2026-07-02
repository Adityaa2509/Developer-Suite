"""
approval_processes.py
─────────────────────
Reads Approval Process metadata AND checks if the specific record
is currently stuck in an approval process instance.
"""

from langchain.tools import tool
from app.salesforce.client import get_sf_client
from app.core.logger import get_logger

logger = get_logger(__name__)


@tool
def get_approval_processes_for_object(object_type: str) -> str:
    """
    Finds all active Approval Processes for the given object.
    Returns process names and their state.
    Use this when a record may be locked or stuck in an approval step.
    """
    try:
        sf = get_sf_client()
        result = sf.tooling.query(f"""
            SELECT Id, DeveloperName, Name, SobjectType,
                   Description, State, Type
            FROM ProcessDefinition
            WHERE SobjectType = '{object_type}'
            AND Type = 'Approval'
            AND State = 'Active'
        """)

        if result["totalSize"] == 0:
            return f"No active Approval Processes found for {object_type}."

        lines = [
            f"Active Approval Processes for {object_type}: {result['totalSize']} found",
            "─" * 60,
        ]

        for r in result["records"]:
            lines.append(f"\nProcess: {r.get('DeveloperName', r.get('Name', 'N/A'))}")
            lines.append(f"  Label      : {r.get('Name', '')}")
            lines.append(f"  State      : {r.get('State', '')}")
            lines.append(f"  Description: {r.get('Description') or 'No description'}")
            lines.append("")

        logger.info(f"✅ Approval processes: {result['totalSize']} for {object_type}")
        return "\n".join(lines)

    except Exception as exc:
        logger.warning(f"Approval process fetch failed: {exc}")
        return f"Could not read approval processes for {object_type}: {str(exc)}"


@tool
def get_approval_instance_for_record(record_id: str) -> str:
    """
    Checks if the specific record is currently IN an approval process.
    A record that is 'Pending' in ProcessInstance is LOCKED for editing.
    Use this to check if the record is stuck waiting for an approver.
    """
    try:
        sf = get_sf_client()
        result = sf.query(f"""
            SELECT Id, Status, TargetObjectId,
                   ProcessDefinition.Name,
                   CreatedDate, LastModifiedDate,
                   SubmittedById
            FROM ProcessInstance
            WHERE TargetObjectId = '{record_id}'
            ORDER BY CreatedDate DESC
            LIMIT 5
        """)

        if result["totalSize"] == 0:
            return f"No approval process instances found for record {record_id}. The record has not been submitted for approval."

        lines = [
            f"Approval instances for {record_id}: {result['totalSize']} found",
            "─" * 60,
        ]

        for r in result["records"]:
            status = r.get("Status", "")
            flag = "⚠️  STUCK" if status == "Pending" else "✅"
            lines.append(f"\n{flag} Process: {(r.get('ProcessDefinition') or {}).get('Name', 'N/A')}")
            lines.append(f"  Status         : {status}")
            lines.append(f"  Submitted       : {r.get('CreatedDate', '')}")
            lines.append(f"  Last Modified   : {r.get('LastModifiedDate', '')}")
            if status == "Pending":
                lines.append(f"  ⚠️  Record is LOCKED — cannot be edited while pending approval")
            lines.append("")

        logger.info(f"✅ Approval instance check done for {record_id}")
        return "\n".join(lines)

    except Exception as exc:
        logger.warning(f"Approval instance fetch failed: {exc}")
        return f"Could not read approval instances for {record_id}: {str(exc)}"
