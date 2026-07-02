"""
triggers.py — HULK
───────────────────
Returns full Apex trigger bodies with automated analysis.
Extracts: trigger events, fields being modified, DML ops, exception handling.
The LLM reads the full body to reason about what the trigger does.
"""

import re
from langchain.tools import tool
from app.salesforce.client import get_sf_client
from app.core.logger import get_logger
from urllib.parse import quote

logger = get_logger(__name__)


def _extract_trigger_events(body: str) -> str:
    """Extract trigger event declaration from body."""
    m = re.search(
        r'trigger\s+\w+\s+on\s+\w+\s*\(([^)]+)\)',
        body, re.IGNORECASE
    )
    return m.group(1).strip() if m else "Could not extract — check body"


def _extract_field_assignments(body: str) -> list[str]:
    """
    Finds explicit field assignments in Apex trigger body.
    Looks for patterns like: record.Field = value, sObj.Field__c = something
    Returns human-readable list of what the trigger sets.
    """
    assignments = []

    # Standard field assignment: var.Field = something
    for m in re.finditer(
        r'\b(\w+)\.([\w]+(?:__[crm])?)\s*=\s*([^;,\n\r]{1,60})',
        body
    ):
        obj_var = m.group(1)
        field   = m.group(2)
        value   = m.group(3).strip()

        # Filter out common non-field patterns
        if (
            field in ('class', 'length', 'size', 'add', 'put', 'get')
            or obj_var in ('System', 'Math', 'String', 'Integer', 'Date')
        ):
            continue

        assignments.append(f"{obj_var}.{field} = {value}")

    return list(dict.fromkeys(assignments))[:15]   # deduplicate, cap 15


def _extract_dml(body: str) -> list[str]:
    """Find DML operations in trigger body."""
    ops = []
    for op in ('insert', 'update', 'delete', 'upsert', 'undelete', 'merge'):
        if re.search(rf'(?<!\w){op}(?!\w)', body, re.IGNORECASE):
            ops.append(op.upper())
    return ops


def _extract_callouts(body: str) -> bool:
    """Detect if trigger makes callouts (HTTP requests)."""
    return bool(re.search(r'HttpRequest|Http\b|callout', body, re.IGNORECASE))


def _extract_exceptions(body: str) -> list[str]:
    """Find exception/addError patterns."""
    errors = []
    for m in re.finditer(r'addError\s*\(\s*([^)]+)\)', body, re.IGNORECASE):
        errors.append(m.group(1).strip()[:80])
    for m in re.finditer(r'throw\s+new\s+(\w+)\s*\(([^)]*)\)', body, re.IGNORECASE):
        errors.append(f"{m.group(1)}({m.group(2)[:40]})")
    return errors[:5]


@tool
def get_triggers_for_object(object_type: str) -> str:
    """
    Returns ALL active Apex triggers for the object with FULL body.
    Includes automated analysis: trigger events, field assignments,
    DML operations, exception handling, and callouts.
    Read the full body — the LLM can reason about Apex code directly.
    """
    try:
        sf = get_sf_client()

        soql = f"""
            SELECT Id,
                   Name,
                   Body,
                   Status,
                   ApiVersion,
                   TableEnumOrId
            FROM ApexTrigger
            WHERE TableEnumOrId = '{object_type}'
            AND Status = 'Active'
        """

        result = sf.toolingexecute(
            f"query/?q={quote(soql)}"
        )


        if result["totalSize"] == 0:
            return f"No active Apex triggers found for {object_type}."

        lines = [
            f"Active Apex Triggers for {object_type}: {result['totalSize']} found",
            "─" * 70,
        ]

        for r in result["records"]:
            name = r["Name"]
            body = r.get("Body") or ""

            lines.append(f"\n{'='*50}")
            lines.append(f"TRIGGER: {name}")
            lines.append(f"{'='*50}")
            lines.append(f"Events        : {_extract_trigger_events(body)}")
            lines.append(f"API Version   : {r.get('ApiVersion', 'N/A')}")
            lines.append(f"Body Length   : {len(body)} characters")

            # Field assignments analysis
            assignments = _extract_field_assignments(body)
            if assignments:
                lines.append("")
                lines.append("FIELD ASSIGNMENTS FOUND (what this trigger modifies):")
                for a in assignments:
                    lines.append(f"  → {a}")
            else:
                lines.append("FIELD ASSIGNMENTS: None detected in body")

            # DML and callouts
            dmls = _extract_dml(body)
            if dmls:
                lines.append(f"DML OPERATIONS: {', '.join(dmls)}")

            has_callout = _extract_callouts(body)
            if has_callout:
                lines.append("⚠️  CALLOUTS: This trigger makes HTTP requests to external systems")

            # Exception/error patterns
            exceptions = _extract_exceptions(body)
            if exceptions:
                lines.append("ERROR PATTERNS found in trigger:")
                for e in exceptions:
                    lines.append(f"  → {e}")

            # Full body
            lines.append("")
            lines.append("FULL TRIGGER BODY:")
            lines.append("```apex")
            lines.append(body)   # Full body — no truncation
            lines.append("```")
            lines.append("")

        logger.info(f"✅ Triggers fetched: {result['totalSize']} for {object_type}")
        return "\n".join(lines)

    except Exception as exc:
        logger.warning(f"Trigger fetch failed for {object_type}: {exc}")
        return f"Could not fetch triggers for {object_type}: {str(exc)}"

    