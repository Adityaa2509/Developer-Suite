# app/tools/metadata_parsers.py

def extract_value(value_obj: dict):
    if not value_obj:
        return None

    for key in (
        "stringValue",
        "booleanValue",
        "numberValue",
        "dateValue",
        "dateTimeValue",
        "elementReference",
        "formulaExpression",
    ):
        value = value_obj.get(key)
        if value is not None:
            return value

    return None


def parse_filters(filters: list) -> list[str]:
    results = []

    for f in filters or []:
        value = extract_value(f.get("value", {}))

        results.append(
            f"{f.get('field')} {f.get('operator')} {value}"
        )

    return results


def parse_record_updates(record_updates: list) -> list[str]:
    updates = []

    for update in record_updates or []:

        label = update.get("label") or update.get("name")

        for assignment in update.get(
            "inputAssignments", []
        ):
            value = extract_value(
                assignment.get("value", {})
            )

            updates.append(
                f"{label}: "
                f"{assignment.get('field')} = {value}"
            )

    return updates


def parse_action_calls(action_calls: list) -> list[str]:
    actions = []

    for action in action_calls or []:

        actions.append(
            f"{action.get('actionType')} "
            f"({action.get('label')})"
        )

    return actions


def parse_record_creates(items: list) -> list[str]:
    results = []

    for item in items or []:
        results.append(
            item.get("label") or item.get("name")
        )

    return results


def parse_record_deletes(items: list) -> list[str]:
    results = []

    for item in items or []:
        results.append(
            item.get("label") or item.get("name")
        )

    return results


def parse_record_lookups(items: list) -> list[str]:
    results = []

    for item in items or []:
        results.append(
            item.get("label") or item.get("name")
        )

    return results


def parse_decisions(decisions: list) -> list[str]:
    """
    Parse Flow Decision elements.

    Shows:
      Decision Name
      Outcome Name
      Conditions
    """

    results = []

    for decision in decisions or []:

        decision_name = (
            decision.get("label")
            or decision.get("name")
            or "Unnamed Decision"
        )

        results.append(
            f"Decision: {decision_name}"
        )

        for rule in decision.get("rules", []):

            outcome_name = (
                rule.get("label")
                or rule.get("name")
                or "Outcome"
            )

            results.append(
                f"  Outcome: {outcome_name}"
            )

            for condition in rule.get(
                "conditions",
                []
            ):

                value = extract_value(
                    condition.get("value", {})
                )

                results.append(
                    f"    {condition.get('leftValueReference')} "
                    f"{condition.get('operator')} "
                    f"{value}"
                )

    return results

def parse_start_conditions(start: dict) -> list[str]:
    """
    Parse Flow entry criteria.
    """

    results = []

    if not start:
        return results

    obj = start.get("object")

    if obj:
        results.append(
            f"Object: {obj}"
        )

    trigger = start.get(
        "triggerType"
    )

    if trigger:
        results.append(
            f"Trigger: {trigger}"
        )

    for condition in start.get(
        "filters",
        []
    ):

        value = extract_value(
            condition.get("value", {})
        )

        results.append(
            f"{condition.get('field')} "
            f"{condition.get('operator')} "
            f"{value}"
        )

    return results

def parse_scheduled_paths(
    scheduled_paths: list
) -> list[str]:

    results = []

    for path in scheduled_paths or []:

        results.append(
            f"{path.get('label') or path.get('name')}"
        )

        results.append(
            f"Offset: "
            f"{path.get('offsetNumber')} "
            f"{path.get('offsetUnit')}"
        )

        results.append(
            f"Time Source: "
            f"{path.get('timeSource')}"
        )

    return results

def parse_formulas(formulas: list) -> list[str]:

    results = []

    for formula in formulas or []:

        results.append(
            f"{formula.get('name')}: "
            f"{formula.get('expression')}"
        )

    return results

def parse_subflows(
    subflows: list
) -> list[str]:

    results = []

    for flow in subflows or []:

        results.append(
            flow.get("flowName")
            or flow.get("name")
            or "Unknown Subflow"
        )

    return results

def parse_apex_actions(
    action_calls: list
) -> list[str]:

    results = []

    for action in action_calls or []:

        if (
            action.get("actionType", "")
            .lower()
            != "apex"
        ):
            continue

        results.append(
            f"{action.get('label')} "
            f"-> "
            f"{action.get('actionName')}"
        )

    return results

def build_field_impact_map(
    record_updates: list
) -> dict:

    impacts = {}

    for update in record_updates or []:

        for assignment in update.get(
            "inputAssignments",
            []
        ):

            field = assignment.get(
                "field"
            )

            value = extract_value(
                assignment.get(
                    "value",
                    {}
                )
            )

            if not field:
                continue

            impacts.setdefault(
                field,
                []
            ).append(value)

    return impacts

def calculate_flow_risk(
    flow_metadata: dict
) -> str:

    score = 0

    score += len(
        flow_metadata.get(
            "recordUpdates",
            []
        )
    ) * 3

    score += len(
        flow_metadata.get(
            "actionCalls",
            []
        )
    ) * 2

    score += len(
        flow_metadata.get(
            "recordCreates",
            []
        )
    ) * 2

    score += len(
        flow_metadata.get(
            "subflows",
            []
        )
    ) * 3

    if score >= 15:
        return "HIGH"

    if score >= 7:
        return "MEDIUM"

    return "LOW"