from langchain.tools import tool

from app.salesforce.client import get_sf_client
from app.tools.metadata_parsers import (
    parse_filters,
    parse_record_updates,
    parse_action_calls,
    parse_record_creates,
    parse_record_deletes,
    parse_record_lookups,
    parse_decisions,
    parse_apex_actions,
    parse_formulas,
    parse_scheduled_paths,
    parse_start_conditions,
    parse_subflows,
    build_field_impact_map,
    calculate_flow_risk,
)


@tool
def get_flow_details(flow_name: str) -> str:
    """
    Returns full flow behaviour.
    """

    sf = get_sf_client()

    result = sf.toolingexecute(
        "query/?q=SELECT+Id+FROM+Flow"
    )

    for record in result.get("records", []):

        flow = sf.toolingexecute(
            f"sobjects/Flow/{record['Id']}"
        )

        if flow.get("FullName") != flow_name:
            continue

        metadata = flow.get("Metadata") or {}

        start = metadata.get("start") or {}

        lines = [
            f"Flow: {flow_name}",
            "=" * 60,
            f"Status: {flow.get('Status')}",
            f"Object: {start.get('object')}",
            f"Trigger: {start.get('triggerType')}",
            f"Record Trigger: {start.get('recordTriggerType')}",
        ]

        criteria = parse_filters(
            start.get("filters", [])
        )

        if criteria:
            lines.append("")
            lines.append("Entry Criteria:")

            for item in criteria:
                lines.append(f"  - {item}")

        updates = parse_record_updates(
            metadata.get("recordUpdates", [])
        )

        if updates:
            lines.append("")
            lines.append("Record Updates:")

            for item in updates:
                lines.append(f"  - {item}")

        decisions = parse_decisions(
        metadata.get("decisions", [])
)

        if decisions:
            lines.append("")
            lines.append("Decisions:")

            for item in decisions:
                lines.append(f"  - {item}")       

        impact_map = build_field_impact_map(
    metadata.get("recordUpdates", [])
)

        if impact_map:
            lines.append("")
            lines.append("Field Impact Map:")

            for field, values in impact_map.items():

                vals = ", ".join(
                    str(v)
                    for v in values
                )

                lines.append(
                    f"  - {field} -> {vals}"
                )         

        actions = parse_action_calls(
            metadata.get("actionCalls", [])
        )
        
        if actions:
            lines.append("")
            lines.append("Actions:")

            for item in actions:
                lines.append(f"  - {item}")

        creates = parse_record_creates(
    metadata.get("recordCreates", [])
)

        startConditions = parse_start_conditions(
            metadata.get("startConditions", [])
        )
        
        if startConditions:
            lines.append("")
            lines.append("start Conditions:")

            for item in startConditions:
                lines.append(f"  - {item}")

        creates = parse_record_creates(
    metadata.get("recordCreates", [])
)


        if creates:
            lines.append("")
            lines.append("Record Creates:")

            for item in creates:
                lines.append(f"  - {item}")    

        deletes = parse_record_deletes(
    metadata.get("recordDeletes", [])
)

        if deletes:
            lines.append("")
            lines.append("Record Deletes:")

            for item in deletes:
                lines.append(f"  - {item}")   


        lookups = parse_record_lookups(
    metadata.get("recordLookups", [])
)

        if lookups:
            lines.append("")
            lines.append("Record Lookups:")

            for item in lookups:
                lines.append(f"  - {item}")     


        apex_actions = parse_apex_actions(
    metadata.get("apexPluginCalls", [])
) + parse_apex_actions(
    metadata.get("actionCalls", [])
)

        if apex_actions:
            lines.append("")
            lines.append("Apex Actions:")

            for item in apex_actions:
                lines.append(f"  - {item}")      


        subflows = parse_subflows(
    metadata.get("subflows", [])
)

        if subflows:
            lines.append("")
            lines.append("Subflows:")

            for item in subflows:
                lines.append(f"  - {item}")     



        scheduled = parse_scheduled_paths(
    (metadata.get("start") or {}).get(
        "scheduledPaths",
        []
    )
)

        if scheduled:
            lines.append("")
            lines.append("Scheduled Paths:")

            for item in scheduled:
                lines.append(f"  - {item}")           

        formulas = parse_formulas(
    metadata.get("formulas", [])
)

        if formulas:
            lines.append("")
            lines.append("Formulas:")

            for item in formulas:
                lines.append(f"  - {item}")     

        risk = calculate_flow_risk(metadata)

        lines.append("")
        lines.append("Flow Risk Assessment:")
        lines.append(f"  - Risk Level: {risk}")                          

        return "\n".join(lines)
    


    return f"Flow not found: {flow_name}"