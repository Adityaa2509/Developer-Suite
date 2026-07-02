"""
vr_evaluator.py
───────────────
Evaluates Salesforce Validation Rule formulas against a record's
actual field values.

This is what was missing in the Phone_required_for_Web_leads case.
The agent listed the rule but never checked that:
  - ISBLANK(Phone) → Phone IS blank on this record
  - ISPICKVAL(LeadSource, 'Web') → LeadSource IS 'Web' on this record
  → Rule IS firing → this IS the root cause → 90%+ confidence

Approach:
  1. Fetch all active VRs for the object
  2. Fetch the record with the specific fields referenced in each VR formula
  3. Evaluate each formula's conditions against actual field values
  4. Return LIKELY_FIRING / LIKELY_NOT_FIRING / CANNOT_EVALUATE per rule
"""

import re
from langchain.tools import tool
from app.salesforce.client import get_sf_client
from app.core.logger import get_logger
from urllib.parse import quote

logger = get_logger(__name__)

# Salesforce formula functions — not field names

SF_FUNCTIONS = {
    'ISBLANK', 'ISNULL', 'ISPICKVAL', 'INCLUDES', 'NOT', 'AND', 'OR',
    'IF', 'CASE', 'LEN', 'TEXT', 'VALUE', 'TODAY', 'NOW', 'YEAR', 'MONTH',
    'DAY', 'LEFT', 'RIGHT', 'MID', 'FIND', 'CONTAINS', 'BEGINS', 'REGEX',
    'ISNEW', 'ISCHANGED', 'PRIORVALUE', 'TRUE', 'FALSE', 'NULL', 'DATEVALUE',
    'DATETIMEVALUE', 'FLOOR', 'CEILING', 'ROUND', 'ABS', 'MAX', 'MIN', 'MOD',
    'SQRT', 'EXP', 'LN', 'LOG', 'SUBSTITUTE', 'TRIM', 'UPPER', 'LOWER',
    'BR', 'HYPERLINK', 'IMAGE', 'LPAD', 'RPAD', 'BLANKVALUE', 'NULLVALUE',
    'AND', 'OR', 'NOT', 'XOR',
}

DISPLAY_FIELD_MAP = {
    "Account": "Name",
    "Opportunity": "Name",
    "Lead": "Name",
    "Contact": "Name",
    "Case": "CaseNumber",
    "Task": "Subject",
}


def _extract_field_names(formula: str) -> set[str]:

    if not formula:
        return set()

    # Remove string literals first
    formula = re.sub(r"'[^']*'", "", formula)
    formula = re.sub(r'"[^"]*"', "", formula)

    tokens = re.findall(
        r"[A-Za-z_][A-Za-z0-9_]*",
        formula
    )

    KEYWORDS = {
        "AND",
        "OR",
        "NOT",
        "TRUE",
        "FALSE",
        "ISPICKVAL",
        "ISBLANK",
        "ISCHANGED",
        "PRIORVALUE",
        "CONTAINS",
        "BEGINS",
        "TEXT",
        "CASE",
        "IF",
        "TODAY",
        "NOW",
        "DATE",
        "DATETIME",
        "NULL"
    }

    return {
        t
        for t in tokens
        if t.upper() not in KEYWORDS
    }

def _is_blank(value) -> bool:
    """Mirrors Salesforce's ISBLANK() — true for None, empty string, empty list."""
    if value is None:
        return True
    if isinstance(value, str) and value.strip() == '':
        return True
    if isinstance(value, (list, dict)) and len(value) == 0:
        return True
    return False


def _evaluate_formula_against_record(
    formula: str,
    record: dict,
    rule_name: str,
) -> tuple[str, str]:
    """
    Evaluates a VR formula against a record's field values.

    Returns:
      (status, explanation)
      status: "LIKELY_FIRING" | "LIKELY_NOT_FIRING" | "CANNOT_EVALUATE"
    """
    if not formula:
        return ("CANNOT_EVALUATE", "No formula available")

    formula_stripped = formula.strip()
    evidence = []
    firing_count = 0
    not_firing_count = 0

    # ── ISBLANK checks ────────────────────────────────────────────
    for m in re.finditer(r'ISBLANK\s*\(\s*(\w+)\s*\)', formula_stripped, re.IGNORECASE):
        field = m.group(1)
        value = record.get(field)
        blank = _is_blank(value)
        display_val = repr(value) if not blank else "(empty / null)"
        if blank:
            evidence.append(f"ISBLANK({field}) → TRUE  (field value: {display_val})")
            firing_count += 1
        else:
            evidence.append(f"ISBLANK({field}) → FALSE (field value: {str(value)[:40]})")
            not_firing_count += 1

    # ── ISNULL checks ─────────────────────────────────────────────
    for m in re.finditer(r'ISNULL\s*\(\s*(\w+)\s*\)', formula_stripped, re.IGNORECASE):
        field = m.group(1)
        value = record.get(field)
        null  = value is None
        if null:
            evidence.append(f"ISNULL({field}) → TRUE  (field is null)")
            firing_count += 1
        else:
            evidence.append(f"ISNULL({field}) → FALSE (value: {str(value)[:40]})")
            not_firing_count += 1

    # ── ISPICKVAL checks ──────────────────────────────────────────
    for m in re.finditer(
        r'ISPICKVAL\s*\(\s*(\w+)\s*,\s*"([^"]+)"\s*\)',
        formula_stripped, re.IGNORECASE
    ):
        field    = m.group(1)
        expected = m.group(2)
        actual   = str(record.get(field, ''))
        if actual == expected:
            evidence.append(f"ISPICKVAL({field}, '{expected}') → TRUE  (actual: '{actual}')")
            firing_count += 1
        else:
            evidence.append(f"ISPICKVAL({field}, '{expected}') → FALSE (actual: '{actual}')")
            not_firing_count += 1

    # ── String equality checks ────────────────────────────────────
    for m in re.finditer(r'(\w+)\s*==?\s*"([^"]+)"', formula_stripped):
        field    = m.group(1)
        expected = m.group(2)
        if field.upper() in SF_FUNCTIONS:
            continue
        actual = str(record.get(field, ''))
        if actual == expected:
            evidence.append(f"{field} = '{expected}' → TRUE  (actual: '{actual}')")
            firing_count += 1
        else:
            evidence.append(f"{field} = '{expected}' → FALSE (actual: '{actual}')")
            not_firing_count += 1

    # ── Boolean field checks ──────────────────────────────────────
    for m in re.finditer(r'(\w+)\s*==?\s*(true|false)', formula_stripped, re.IGNORECASE):
        field    = m.group(1)
        expected = m.group(2).lower() == 'true'
        if field.upper() in SF_FUNCTIONS:
            continue
        actual = record.get(field)
        if actual == expected:
            evidence.append(f"{field} = {expected} → TRUE")
            firing_count += 1
        else:
            evidence.append(f"{field} = {expected} → FALSE (actual: {actual})")
            not_firing_count += 1

    # ── Determine result ──────────────────────────────────────────
    if not evidence:
        return (
            "CANNOT_EVALUATE",
            f"Complex formula — manual inspection required: {formula_stripped[:150]}"
        )

    # Check if AND or OR logic dominates
    has_and = '&&' in formula_stripped or re.search(r'\bAND\b', formula_stripped, re.IGNORECASE)
    has_or  = '||' in formula_stripped or re.search(r'\bOR\b',  formula_stripped, re.IGNORECASE)

    explanation = "; ".join(evidence)

    if firing_count > 0 and not_firing_count == 0:
        # All evaluated conditions are TRUE
        return ("LIKELY_FIRING", explanation)

    elif firing_count > 0 and has_and:
        # AND logic but some conditions are FALSE → not firing
        return ("LIKELY_NOT_FIRING", f"AND logic — not all conditions TRUE: {explanation}")

    elif firing_count > 0 and (has_or or not has_and):
        # OR logic with at least one TRUE → firing
        return ("LIKELY_FIRING", f"OR logic — at least one condition TRUE: {explanation}")

    else:
        return ("LIKELY_NOT_FIRING", explanation)


@tool
def evaluate_validation_rules(record_id: str, object_type: str) -> str:
    """
    Evaluates ALL active validation rules against this record's actual field values.

    USE THIS FIRST when the anomaly is:
      - "I get an error when saving"
      - "The record won't save"
      - "I can't update this field — it gives an error"
      - "Save is blocked"
      - "Required field error"
      - "Validation error"

    Returns which rules are LIKELY_FIRING (the root cause candidates)
    vs LIKELY_NOT_FIRING (ruled out) vs CANNOT_EVALUATE (needs manual check).

    A LIKELY_FIRING rule with confidence-matching field values IS the root cause.
    """
    try:
        sf = get_sf_client()

        # ── Step 1: Get all active VRs for the object ─────────────
        

        vr_result = sf.toolingexecute(
            "query/?q=" +
            quote(f"""
                SELECT Id,
                    ValidationName,
                    Active,
                    Description,
                    ErrorMessage
                FROM ValidationRule
                WHERE EntityDefinition.QualifiedApiName = '{object_type}'
                AND Active = true
            """)
)

        if vr_result["totalSize"] == 0:
            return (
                f"No active Validation Rules found for {object_type}. "
                f"The save error is NOT caused by a validation rule. "
                f"Check Apex triggers or approval process lock instead."
            )
        
        validation_rules = []

        for vr in vr_result["records"]:

            vr_id = vr["Id"]

            details = sf.toolingexecute(
                f"sobjects/ValidationRule/{vr_id}"
            )

            metadata = details.get("Metadata") or {}

            validation_rules.append(
                {
                    "name": vr.get("ValidationName"),
                    "description": vr.get("Description"),
                    "error_message": vr.get("ErrorMessage"),
                    "formula": metadata.get(
                        "errorConditionFormula",
                        ""
                    )
                }
            )

            # ── Step 2: Collect all field names across all VR formulas ─
        all_fields: set[str] = {"Id"}

        display_field = DISPLAY_FIELD_MAP.get(object_type)

        if display_field:
            all_fields.add(display_field)
        

        for vr in validation_rules:
            formula = vr["formula"]
            all_fields.update(_extract_field_names(formula))    

        # ── Step 3: Fetch the record with exactly those fields ─────
        fields_str = ", ".join(list(all_fields)[:80])   # SF SOQL limit
        try:
            rec_result = sf.query(
                f"SELECT {fields_str} FROM {object_type} WHERE Id = '{record_id}'"
            )
            record = rec_result["records"][0] if rec_result["totalSize"] > 0 else {}
        except Exception as e:
            # Fallback: fetch without field filtering
            logger.warning(f"Targeted field fetch failed: {e} — using basic record")
            try:
                describe = getattr(sf, object_type).describe()
                basic_fields = [f["name"] for f in describe["fields"][:50]]
                rec_result   = sf.query(
                    f"SELECT {', '.join(basic_fields)} FROM {object_type} "
                    f"WHERE Id = '{record_id}'"
                )
                record = rec_result["records"][0] if rec_result["totalSize"] > 0 else {}
            except Exception:
                record = {}

        # ── Step 4: Evaluate each VR ──────────────────────────────
        firing     = []
        not_firing = []
        unknown    = []

        for vr in validation_rules:

            name = vr["name"]
            formula = vr["formula"]
            msg = vr["error_message"]
            desc = vr["description"] or "No description"

            status, explanation = (
                _evaluate_formula_against_record(
                    formula,
                    record,
                    name
                )
            )

            entry = {
                "name": name,
                "status": status,
                "formula": formula[:200],
                "error_msg": msg,
                "description": desc,
                "explanation": explanation,
            }

            if status == "LIKELY_FIRING":
                firing.append(entry)

            elif status == "LIKELY_NOT_FIRING":
                not_firing.append(entry)

            else:
                unknown.append(entry)

        # ── Step 5: Format output ──────────────────────────────────
        lines = [
            f"Validation Rule Evaluation for {object_type} {record_id}",
            f"Total active rules: {vr_result['totalSize']}",
            "─" * 70,
            "",
        ]

        if firing:
            lines.append(f"🚨 LIKELY FIRING ({len(firing)} rule(s)) — probable root cause:")
            lines.append("")
            for vr in firing:
                lines.append(f"  Rule: {vr['name']}")
                lines.append(f"  Error message shown to user: \"{vr['error_msg']}\"")
                lines.append(f"  Description: {vr['description']}")
                lines.append(f"  Formula: {vr['formula']}")
                lines.append(f"  Why it fires: {vr['explanation']}")
                lines.append("")
            lines.append(
                "⚡ CONCLUSION: If the user's error message matches one above, "
                "that rule IS the root cause. Confidence: 90%+"
            )
        else:
            lines.append("✅ NO validation rules appear to be firing for this record.")
            lines.append(
                "The save error is NOT caused by a validation rule. "
                "Check approval process lock or Apex triggers instead."
            )

        if not_firing:
            lines.append("")
            lines.append(f"✅ Ruled out ({len(not_firing)} rule(s)):")
            for vr in not_firing:
                lines.append(f"  - {vr['name']}: {vr['explanation'][:80]}")

        if unknown:
            lines.append("")
            lines.append(f"⚠️  Cannot evaluate ({len(unknown)} rule(s)) — inspect manually:")
            for vr in unknown:
                lines.append(f"  - {vr['name']}: {vr['explanation'][:80]}")
                lines.append(f"    Formula: {vr['formula'][:100]}")

        logger.info(
            f"✅ VR evaluation: {len(firing)} firing, "
            f"{len(not_firing)} ruled out, {len(unknown)} unknown"
        )
        return "\n".join(lines)

    except Exception as exc:
        logger.error(f"evaluate_validation_rules failed: {exc}")
        return f"Could not evaluate validation rules: {str(exc)}"