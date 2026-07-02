"""
validation_rules.py
───────────────────
Reads Validation Rules for a given Salesforce object.

Uses ValidationRule.FullName to identify
the target object and Metadata.errorConditionFormula
to retrieve the actual rule logic.
"""

from langchain.tools import tool

from app.salesforce.client import get_sf_client
from app.core.logger import get_logger

logger = get_logger(__name__)


@tool
def get_validation_rules_for_object(object_type: str) -> str:
    """
    Finds Validation Rules related to the supplied object.

    Returns:
    - Rule name
    - Description
    - Formula
    - Error message
    """

    try:
        sf = get_sf_client()

        result = sf.toolingexecute(
            "query/?q=SELECT+Id+FROM+ValidationRule"
        )

        relevant_rules = []

        for record in result.get("records", []):

            try:

                rule = sf.toolingexecute(
                    f"sobjects/ValidationRule/{record['Id']}"
                )

                full_name = rule.get("FullName", "")

                if "." not in full_name:
                    continue

                rule_object = full_name.split(".")[0]

                if rule_object != object_type:
                    continue

                metadata = rule.get("Metadata") or {}

                relevant_rules.append({
                    "name": rule.get(
                        "ValidationName",
                        "Unknown"
                    ),
                    "description": rule.get(
                        "Description",
                        ""
                    ),
                    "error_message": rule.get(
                        "ErrorMessage",
                        ""
                    ),
                    "formula": metadata.get(
                        "errorConditionFormula",
                        ""
                    ),
                    "active": rule.get(
                        "Active",
                        False
                    ),
                })

            except Exception:
                continue

        if not relevant_rules:
            return (
                f"No Validation Rules found "
                f"for {object_type}."
            )

        lines = [
            f"Validation Rules for {object_type}: "
            f"{len(relevant_rules)} found",
            "─" * 60,
        ]

        for rule in relevant_rules:

            lines.append("")
            lines.append(
                f"Rule: {rule['name']}"
            )

            lines.append(
                f"  Active      : "
                f"{rule['active']}"
            )

            lines.append(
                f"  Description : "
                f"{rule['description'] or 'No description'}"
            )

            lines.append(
                f"  Formula     : "
                f"{rule['formula']}"
            )

            lines.append(
                f"  Error Msg   : "
                f"{rule['error_message']}"
            )

        logger.info(
            f"✅ Validation rules fetched: "
            f"{len(relevant_rules)} for {object_type}"
        )

        return "\n".join(lines)

    except Exception as exc:

        logger.warning(
            f"Validation rule fetch failed "
            f"for {object_type}: {exc}"
        )

        return (
            f"Could not read validation rules "
            f"for {object_type}: {str(exc)}"
        )