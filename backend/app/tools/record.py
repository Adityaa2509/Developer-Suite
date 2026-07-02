"""
record.py
─────────
Fetches a Salesforce record and detects its object type.

Key capability: auto-detect object type from the 3-char record ID prefix.
This means the agent only needs a record ID — it figures out the object.
"""

from langchain.tools import tool
from app.salesforce.client import get_sf_client
from app.core.logger import get_logger

logger = get_logger(__name__)

# ── Key prefix cache ──────────────────────────────────────────────
_prefix_map: dict[str, str] = {}


def build_prefix_map() -> dict[str, str]:
    """
    Builds a map of {key_prefix: object_api_name} from the org.
    Cached after first call.
    """
    global _prefix_map
    if _prefix_map:
        return _prefix_map

    try:
        sf = get_sf_client()
        result = sf.query(
            "SELECT KeyPrefix, QualifiedApiName "
            "FROM EntityDefinition "
            "WHERE KeyPrefix != null "
            "ORDER BY QualifiedApiName"
        )
        _prefix_map = {
            r["KeyPrefix"]: r["QualifiedApiName"]
            for r in result["records"]
            if r["KeyPrefix"]
        }
        logger.info(f"✅ Key prefix map built: {len(_prefix_map)} objects")
    except Exception as exc:
        logger.warning(f"⚠️  Could not build prefix map: {exc}")
        # Fallback to common objects
        _prefix_map = {
            "500": "Case", "006": "Opportunity", "00Q": "Lead",
            "003": "Contact", "001": "Account", "00T": "Task",
            "00U": "Event", "0Q0": "Quote",
        }

    return _prefix_map


COMMON_PREFIXES = {
    "500": "Case",
    "006": "Opportunity",
    "00Q": "Lead",
    "003": "Contact",
    "001": "Account",
    "00T": "Task",
    "00U": "Event",
    "0Q0": "Quote",
}


def detect_object_type(record_id: str) -> str | None:
    """Returns the object API name for a given record ID, or None."""
    if len(record_id) < 3:
        return None
    prefix = record_id[:3]
    if prefix in COMMON_PREFIXES:
        return COMMON_PREFIXES[prefix]
    return build_prefix_map().get(prefix)



@tool
def get_record(record_id: str, object_type: str = "") -> str:
    """
    Fetches a Salesforce record by ID.
    Auto-detects the object type from the record ID prefix if not provided.
    Returns all key fields formatted as a readable string.
    Use this as the first step of any investigation.
    """
    try:
        sf = get_sf_client()

        # Detect object type if not given
        if not object_type:
            detected_type = detect_object_type(record_id)
            if not detected_type:
             return f"ERROR: Cannot determine object type for record ID {record_id}"
            object_type = detected_type

        # Describe the object to get queryable fields
        try:
            describe = getattr(sf, object_type).describe()
            fields = [
                f["name"] for f in describe["fields"]
                if not f.get("deprecatedAndHidden", False)
            ][:60]  # cap at 60 fields to avoid SOQL length limit
        except Exception:
            fields = ["Id", "Name", "CreatedDate", "LastModifiedDate",
                      "OwnerId", "CreatedById"]

        fields_str = ", ".join(fields)
        result = sf.query(
            f"SELECT {fields_str} FROM {object_type} WHERE Id = '{record_id}'"
        )

        if result["totalSize"] == 0:
            return f"ERROR: Record {record_id} not found in {object_type}"

        record = result["records"][0]

        # Format as readable output
        lines = [f"Record: {object_type} | ID: {record_id}", "─" * 50]
        for key, val in record.items():
            if key != "attributes" and val is not None:
                lines.append(f"  {key}: {val}")

        logger.info(f"✅ Record fetched: {object_type} {record_id}")
        return "\n".join(lines)

    except Exception as exc:
        logger.error(f"get_record failed: {exc}")
        return f"ERROR fetching record {record_id}: {str(exc)}"
