"""
flows.py
────────
Fetches active flows for an object type.

Critical design:
  1. Fetches ALL active flows once, filters by object type from metadata
  2. Populates _flow_id_registry so get_flow_details can do a direct lookup
  3. Returns enough info for agent to decide WHICH flows to inspect deeply
  4. Agent MUST call get_flow_details for any flow before concluding causation

Tooling API note:
  Flow fields queryable in SOQL: Id, Status
  FullName and Metadata are only via SObject endpoint, not SOQL.
  That is why we must fetch and iterate.
"""

from langchain.tools import tool
from app.salesforce.client import get_sf_client
from app.core.logger import get_logger

logger = get_logger(__name__)

# ── Flow ID registry: {full_name → id} ────────────────────────────
# Populated by get_flows_for_object, consumed by get_flow_details
# Module-level so it persists within the process lifetime
_flow_id_registry: dict[str, str] = {}


def get_flow_id_by_name(full_name: str) -> str | None:
    """Returns cached flow ID for a given FullName, or None."""
    return _flow_id_registry.get(full_name)


@tool
def get_flows_for_object(object_type: str) -> str:
    """
    Returns all active record-triggered flows for the given object type.
    Shows flow name, trigger type, and whether it has field updates.
    After calling this, use get_flow_details(flow_name) for any flow
    that could be related to your anomaly — this is mandatory before
    concluding a flow is the root cause.
    """
    global _flow_id_registry

    try:
        sf = get_sf_client()

        # Get all active flow IDs in one query
        result = sf.toolingexecute(
            "query/?q=SELECT+Id+FROM+Flow+WHERE+Status+%3D+%27Active%27"
        )

        if not result.get("records"):
            return f"No active flows found in the org."

        lines = [
            f"Active flows for {object_type}:",
            "─" * 60,
            "Note: Call get_flow_details(flow_name) for any flow listed here",
            "before concluding it caused the anomaly.",
            "",
        ]

        count = 0

        for record in result.get("records", []):
            try:
                flow = sf.toolingexecute(
                    f"sobjects/Flow/{record['Id']}"
                )

                metadata = flow.get("Metadata") or {}
                start    = metadata.get("start") or {}

                # Filter to this object type
                if start.get("object") != object_type:
                    continue

                full_name = flow.get("FullName", "")
                flow_id   = record["Id"]

                # Cache for get_flow_details fast lookup
                if full_name:
                    _flow_id_registry[full_name] = flow_id

                count += 1

                # Check if this flow has record updates or just actions
                has_updates = bool(metadata.get("recordUpdates"))
                has_actions = bool(metadata.get("actionCalls"))
                has_creates = bool(metadata.get("recordCreates"))

                update_hint = ""
                if has_updates:
                    update_hint = " ⚠️ HAS RECORD UPDATES — inspect with get_flow_details"
                elif has_actions:
                    update_hint = " (has actions — email/apex but no direct field updates)"
                elif has_creates:
                    update_hint = " (creates related records)"
                else:
                    update_hint = " (no record updates)"

                lines.append(f"Flow: {full_name}")
                lines.append(f"  Trigger      : {start.get('triggerType', 'unknown')}")
                lines.append(f"  Record Event : {start.get('recordTriggerType', 'unknown')}")
                lines.append(f"  Updates      : {update_hint}")
                lines.append("")

            except Exception:
                continue

        if count == 0:
            return f"No active flows found for object type '{object_type}'."

        logger.info(f"✅ Flows fetched: {count} for {object_type}")
        return "\n".join(lines)

    except Exception as exc:
        logger.warning(f"Flow fetch failed for {object_type}: {exc}")
        return f"Could not fetch flows for {object_type}: {str(exc)}"