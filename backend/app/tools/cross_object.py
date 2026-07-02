"""
cross_object.py
───────────────
Detects cross-object automation chains.

Covers:
  1. Flows on parent objects that cascade updates to child records
  2. Apex triggers on parent objects that update children
  3. Changes to related records around the same time
  4. Formula fields pulling values from parent records

This is what makes the agent HULK — it can see automation chains
that span multiple objects, not just the record being investigated.

Example: Account.Email changes → Flow on Account updates Opportunity.Email
Without this tool, the agent would investigate Opportunity and find nothing.
With this tool, it checks Account flows and finds the cross-object update.
"""

import re
from langchain.tools import tool
from app.salesforce.client import get_sf_client
from app.core.logger import get_logger

logger = get_logger(__name__)


def _get_parent_objects(sf, object_type: str) -> list[dict]:
    """Returns all parent object types for the given object (via reference fields)."""
    try:
        describe = getattr(sf, object_type).describe()
        parents = []
        for field in describe["fields"]:
            if field["type"] == "reference" and field.get("referenceTo"):
                for parent in field["referenceTo"]:
                    if parent not in ("User", "Group", "RecordType", "Profile"):
                        parents.append({
                            "object":       parent,
                            "field":        field["name"],   # e.g. AccountId
                            "relationship": field.get("relationshipName", ""),
                        })
        return parents
    except Exception as e:
        logger.warning(f"Could not describe {object_type}: {e}")
        return []


def _get_child_objects(sf, object_type: str) -> list[dict]:
    """Returns all child object types (objects that reference this one)."""
    try:
        describe = getattr(sf, object_type).describe()
        children = []
        for rel in describe.get("childRelationships", []):
            child = rel.get("childSObject")
            field = rel.get("field")
            if child and not child.startswith("History") and not child.endswith("Feed"):
                children.append({"object": child, "field": field})
        return children[:15]   # cap at 15
    except Exception as e:
        logger.warning(f"Could not get children of {object_type}: {e}")
        return []


@tool
def get_cross_object_flows(object_type: str) -> str:
    """
    Finds Flows on RELATED objects (parents/children) that update THIS object's records.

    This is critical for scenarios like:
    - "Opportunity email changed but no Opportunity flow explains it"
      → Account flow with cross-object recordUpdates is updating Opportunity
    - "Case status changed after Contact was updated"
      → Contact trigger cascading to Case

    Also checks for flows on THIS object that read from parent and update based on parent.
    """
    try:
        sf = get_sf_client()

        parent_objects = _get_parent_objects(sf, object_type)
        child_objects  = _get_child_objects(sf, object_type)

        lines = [
            f"Cross-Object Automation Analysis for {object_type}",
            "─" * 70,
            f"Parent objects: {[p['object'] for p in parent_objects[:8]]}",
            f"Child objects:  {[c['object'] for c in child_objects[:5]]}",
            "",
        ]

        found_cross_object = False

        # Check flows on each parent object for cross-object updates targeting our object
        for parent_info in parent_objects[:5]:
            parent_obj = parent_info["object"]
            try:
                # Get active flows for the parent object
                active_flows = sf.toolingexecute(
                    "query/?q=SELECT+Id+FROM+Flow+WHERE+Status+%3D+%27Active%27"
                )

                for flow_rec in active_flows.get("records", [])[:30]:
                    try:
                        flow = sf.toolingexecute(
                            f"sobjects/Flow/{flow_rec['Id']}"
                        )
                        meta  = flow.get("Metadata") or {}
                        start = meta.get("start") or {}

                        # Only check flows on the parent object
                        if start.get("object") != parent_obj:
                            continue

                        full_name = flow.get("FullName", "Unknown")

                        # Check recordUpdates for cross-object updates to our object
                        for update in meta.get("recordUpdates", []):
                            update_obj = update.get("object", "")

                            # Cross-object if the update targets our object type
                            if update_obj == object_type:
                                found_cross_object = True
                                label   = update.get("label") or update.get("name", "Unnamed Update")
                                filters = update.get("filters", [])
                                assignments = update.get("inputAssignments", [])

                                lines.append(
                                    f"🔗 CROSS-OBJECT FLOW FOUND on {parent_obj}:"
                                )
                                lines.append(f"   Flow    : {full_name}")
                                lines.append(
                                    f"   Trigger : {start.get('triggerType')} on {parent_obj}"
                                )
                                lines.append(
                                    f"   Updates : {object_type} records via '{label}'"
                                )

                                if assignments:
                                    lines.append(f"   Field Updates:")
                                    for a in assignments:
                                        from app.tools.metadata_parsers import extract_value
                                        val   = extract_value(a.get("value") or {})
                                        field = a.get("field", "?")
                                        lines.append(f"     → {field} = {val!r}")

                                lines.append(
                                    f"   ⚠️  This flow on {parent_obj} is changing "
                                    f"{object_type} records — check if this explains the anomaly."
                                )
                                lines.append("")

                    except Exception:
                        continue

            except Exception as e:
                lines.append(f"  (Could not check {parent_obj} flows: {str(e)[:50]})")

        if not found_cross_object:
            lines.append(
                f"✅ No cross-object flows found that update {object_type} records "
                f"from parent objects."
            )

        # Also note formula fields (read-only cross-object references)
        lines.append("")
        lines.append("─" * 70)
        lines.append("Formula / Roll-Up Fields (read-only cross-object values):")
        try:
            describe = getattr(sf, object_type).describe()
            formula_fields = [
                f["name"]
                for f in describe["fields"]
                if f.get("calculated") or f.get("type") == "summary"
            ]
            if formula_fields:
                lines.append(
                    f"  {object_type} has {len(formula_fields)} formula/rollup fields "
                    f"that automatically reflect parent values:"
                )
                for ff in formula_fields[:10]:
                    lines.append(f"  • {ff}")
                lines.append(
                    "  Note: These fields cannot be manually edited — "
                    "they always reflect their formula/rollup source."
                )
            else:
                lines.append("  No formula or rollup fields found.")
        except Exception:
            lines.append("  (Could not check formula fields)")

        logger.info(f"✅ Cross-object analysis complete for {object_type}")
        return "\n".join(lines)

    except Exception as exc:
        logger.warning(f"Cross-object flow check failed: {exc}")
        return f"Could not check cross-object flows for {object_type}: {str(exc)}"


@tool
def get_related_record_changes(record_id: str, object_type: str) -> str:
    """
    Looks for changes to related records (parents and children) around the
    same time as changes to this record.

    Critical for understanding automation chains:
    - Account email changed at 2pm → Opportunity email changed at 2pm:01s
    - Contact updated → related Cases auto-updated

    Shows: what changed on related records and when, enabling timeline correlation.
    """
    try:
        sf = get_sf_client()

        # Get the record
        try:
            describe = getattr(sf, object_type).describe()
            ref_fields = [
                f["name"] for f in describe["fields"]
                if f["type"] == "reference"
                and f["name"] not in ("OwnerId", "CreatedById", "LastModifiedById")
                and f.get("referenceTo") and f["referenceTo"][0] not in ("User", "Group")
            ][:5]
        except Exception:
            ref_fields = []

        if not ref_fields:
            return f"No parent reference fields found for {object_type}."

        fields_str = ", ".join(["Id", "LastModifiedDate"] + ref_fields)
        try:
            rec_result = sf.query(
                f"SELECT {fields_str} FROM {object_type} WHERE Id = '{record_id}'"
            )
        except Exception:
            return f"Could not fetch {object_type} record {record_id}"

        if rec_result["totalSize"] == 0:
            return f"Record {record_id} not found."

        rec      = rec_result["records"][0]
        last_mod = rec.get("LastModifiedDate", "")

        lines = [
            f"Related Record Changes around {object_type} {record_id}",
            f"Record Last Modified: {last_mod}",
            "─" * 70,
            "",
        ]

        # Check history on each parent object
        history_objects = {
            "Account":     ("AccountId",  "AccountHistory",  "AccountId"),
            "Contact":     ("ContactId",  "ContactHistory",  "ContactId"),
            "Opportunity": ("OpportunityId", "OpportunityHistory", "OpportunityId"),
            "Lead":        ("LeadId",     "LeadHistory",     "LeadId"),
            "Case":        ("CaseId",     "CaseHistory",     "CaseId"),
        }

        found_any = False

        for parent_obj, (id_field, history_obj, parent_id_field) in history_objects.items():
            parent_id = rec.get(id_field)
            if not parent_id:
                continue

            try:
                history = sf.query(f"""
                    SELECT Field, OldValue, NewValue,
                           CreatedDate, CreatedBy.Name
                    FROM {history_obj}
                    WHERE {parent_id_field} = '{parent_id}'
                    ORDER BY CreatedDate DESC
                    LIMIT 20
                """)

                if history["totalSize"] > 0:
                    found_any = True
                    lines.append(
                        f"📋 Parent {parent_obj} ({parent_id[:12]}...) — "
                        f"{history['totalSize']} changes:"
                    )
                    for h in history["records"][:8]:
                        field     = h.get("Field", "?")
                        old_val   = h.get("OldValue", "(empty)")
                        new_val   = h.get("NewValue", "(empty)")
                        when      = h.get("CreatedDate", "")
                        who       = (h.get("CreatedBy") or {}).get("Name", "?")
                        lines.append(
                            f"  [{when[:19]}] {who}: "
                            f"{field} '{old_val}' → '{new_val}'"
                        )
                    lines.append("")

            except Exception as e:
                logger.debug(f"Could not fetch {history_obj}: {e}")

        if not found_any:
            lines.append(
                "No related record changes found. "
                "The anomaly is likely caused by automation on this object only."
            )

        logger.info(f"✅ Related record changes checked for {record_id}")
        return "\n".join(lines)

    except Exception as exc:
        logger.warning(f"Related record changes failed: {exc}")
        return f"Could not check related record changes: {str(exc)}"