"""
assignment_rules.py — HULK
───────────────────────────
Assignment Rules for Case and Lead.
Returns: active/inactive status with big WARNING, routing targets,
and specific fix instructions if INACTIVE.
"""

from langchain.tools import tool
from app.salesforce.client import get_sf_client
from app.core.logger import get_logger

logger = get_logger(__name__)

SUPPORTED_OBJECTS = {"Case", "Lead"}


@tool
def get_assignment_rules_for_object(object_type: str) -> str:
    """
    Returns all Assignment Rules for Case or Lead with full details.
    IMPORTANT: Assignment Rules can ONLY set OwnerId (and Case team members).
    They CANNOT change Status, Priority, or any other field.
    Use this for "record not assigned to correct user/queue" anomalies ONLY.
    """
    if object_type not in SUPPORTED_OBJECTS:
        return (
            f"Assignment Rules only exist for Case and Lead. "
            f"'{object_type}' does not have assignment rules."
        )

    try:
        sf = get_sf_client()

        # Get assignment rules
        rules_result = sf.query(f"""
            SELECT Id, Name, Active
            FROM AssignmentRule
            WHERE SobjectType = '{object_type}'
            ORDER BY Name
        """)

        if rules_result["totalSize"] == 0:
            return (
                f"No Assignment Rules found for {object_type}. "
                f"Records are assigned to the record creator's default queue/owner."
            )

        active_rules   = [r for r in rules_result["records"] if r.get("Active")]
        inactive_rules = [r for r in rules_result["records"] if not r.get("Active")]

        lines = [
            f"Assignment Rules for {object_type}: {rules_result['totalSize']} total",
            "─" * 70,
            f"  ACTIVE   : {len(active_rules)} rule(s)",
            f"  INACTIVE : {len(inactive_rules)} rule(s)",
            "",
        ]

        if not active_rules:
            lines.append("🚨 CRITICAL: NO ACTIVE ASSIGNMENT RULES FOUND")
            lines.append(
                "This means {object_type} records are NOT being auto-assigned. "
                "Records will be assigned to the creating user or the org default."
            )
            lines.append(
                f"FIX: Go to Setup → Assignment Rules → {object_type} → "
                f"activate the appropriate rule."
            )
            lines.append("")

        # Show each rule with details
        for rule in rules_result["records"]:
            status_icon = "✅ ACTIVE  " if rule.get("Active") else "❌ INACTIVE"
            lines.append(f"{status_icon} | Rule: {rule['Name']}")

            if not rule.get("Active"):
                lines.append(
                    f"    ⚠️  THIS RULE IS INACTIVE — records are NOT being assigned by this rule"
                )
                lines.append(
                    f"    FIX: Setup → Assignment Rules → {object_type} → "
                    f"click '{rule['Name']}' → set as Active"
                )

            # Try to get rule criteria via REST
            rule_id = rule["Id"]
            try:
                # Get rule entries — criteria and routing
                entries = sf.query(f"""
                    SELECT Id, SortOrder, Template.Name, UserOrGroupId
                    FROM AssignmentRuleEntry
                    WHERE RuleId = '{rule_id}'
                    ORDER BY SortOrder
                """)

                if entries["totalSize"] > 0:
                    lines.append(f"    Rule Entries: {entries['totalSize']} criteria found")
                    for entry in entries["records"][:5]:
                        target = entry.get("UserOrGroupId", "unknown")
                        # Resolve the target to a name
                        try:
                            user = sf.query(f"SELECT Name FROM User WHERE Id = '{target}'")
                            if user["totalSize"] > 0:
                                target_name = user["records"][0]["Name"]
                            else:
                                group = sf.query(f"SELECT Name, Type FROM Group WHERE Id = '{target}'")
                                target_name = f"{group['records'][0]['Type']}: {group['records'][0]['Name']}" if group["totalSize"] > 0 else target
                        except Exception:
                            target_name = target

                        lines.append(
                            f"    → Sort {entry.get('SortOrder', '?')}: "
                            f"Routes to: {target_name}"
                        )
            except Exception as e:
                # AssignmentRuleEntry might not be directly queryable — that's OK
                lines.append(f"    (Rule criteria: check Setup UI — {str(e)[:50]})")

            lines.append("")

        # Add context for investigation
        lines.append("─" * 70)
        lines.append("INVESTIGATION GUIDANCE:")
        lines.append(
            "• If anomaly is 'record not assigned correctly' → check INACTIVE rules above"
        )
        lines.append(
            "• If all rules are ACTIVE → check if record met the rule's criteria conditions"
        )
        lines.append(
            "• Assignment Rules fire on INSERT by default, and UPDATE only if"
            " 'Assign using active assignment rule' checkbox is checked"
        )
        lines.append(
            "• REMEMBER: Assignment Rules CAN ONLY set OwnerId — "
            "they cannot change Status or any other field"
        )

        logger.info(f"✅ Assignment rules: {rules_result['totalSize']} for {object_type}")
        return "\n".join(lines)

    except Exception as exc:
        logger.warning(f"Assignment rule fetch failed: {exc}")
        return f"Could not read assignment rules for {object_type}: {str(exc)}"