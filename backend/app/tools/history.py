"""
history.py
──────────
Reads field-level change history for a Salesforce record.
This is critical for investigation — shows exactly what changed,
when it changed, who changed it, and what the old value was.

Works for objects with history tracking enabled.
History object convention: {ObjectType}History
"""

from langchain.tools import tool
from app.salesforce.client import get_sf_client
from app.core.logger import get_logger

logger = get_logger(__name__)


# Mapping of standard objects to their history relationship field
HISTORY_PARENT_FIELD = {
    "Account": "AccountId",
    "Case": "CaseId",
    "Contact": "ContactId",
    "Lead": "LeadId",
    "Opportunity": "OpportunityId",
}


@tool
def get_record_history(record_id: str, object_type: str) -> str:
    """
    Fetches the complete field change history for a record.

    Shows:
    - Which field changed
    - Old value
    - New value
    - When it changed
    - Who changed it

    Returns a timeline ordered oldest → newest.
    """

    try:
        sf = get_sf_client()

        history_object = f"{object_type}History"

        parent_field = HISTORY_PARENT_FIELD.get(object_type)

        if not parent_field:
            return (
                f"History lookup is currently not supported for "
                f"{object_type}. Only standard objects are supported."
            )

        query = f"""
            SELECT {parent_field},
                   OldValue,
                   NewValue,
                   CreatedDate,
                   CreatedBy.Name
            FROM {history_object}
            WHERE {parent_field} = '{record_id}'
            ORDER BY CreatedDate ASC
        """

        result = sf.query(query)

        if result["totalSize"] == 0:
            return (
                f"No field history found for {record_id}. "
                f"History tracking may not be enabled for "
                f"{object_type}, or no tracked fields have changed."
            )

        lines = [
            f"Field Change History: {object_type} {record_id}",
            f"Total changes: {result['totalSize']}",
            "─" * 60,
        ]

        for record in result["records"]:
            field = record.get("Field", "unknown")
            old_value = record.get("OldValue", "(empty)")
            new_value = record.get("NewValue", "(empty)")
            changed_at = record.get("CreatedDate", "")
            changed_by = (
                (record.get("CreatedBy") or {})
                .get("Name", "unknown")
            )

            lines.append(
                f"[{changed_at}] "
                f"{changed_by} changed "
                f"{field}: "
                f"'{old_value}' → '{new_value}'"
            )

        logger.info(
            f"✅ History fetched: "
            f"{result['totalSize']} changes for {record_id}"
        )

        return "\n".join(lines)

    except Exception as exc:
        logger.warning(
            f"History fetch failed for "
            f"{object_type} {record_id}: {exc}"
        )

        return (
            f"Could not read history for {object_type} {record_id}. "
            f"History tracking may not be enabled."
        )