import json
import re
import uuid
from typing import Dict, Any, List, Optional
from langchain_core.messages import SystemMessage, HumanMessage, AIMessage, ToolMessage
from app.core.llm import get_llm_with_fallbacks
from app.salesforce.mcp_client import MCPClient
from app.core.logger import get_logger
from app.agent.permissions_jobs import PERMISSIONS_JOBS

logger = get_logger(__name__)


def _extract_text(content) -> str:
    """Safely extract a plain string from an LLM response content field.
    Handles both str and list-of-blocks (e.g. [{"type": "text", "text": "..."}, ...]).
    """
    if isinstance(content, str):
        return content.strip()
    if isinstance(content, list):
        parts = []
        for block in content:
            if isinstance(block, dict):
                parts.append(block.get("text", ""))
            elif isinstance(block, str):
                parts.append(block)
        return "".join(parts).strip()
    return str(content).strip()

# ── In-memory pending write store keyed by session_id ─────────────
PENDING_WRITES: Dict[str, Dict[str, Any]] = {}

# ── Tools that mutate Salesforce data — require user confirmation ──
WRITE_TOOLS = {
    "sf_assign_permission_set",
    "sf_revoke_permission_set",
    "sf_update_object_permissions",
    "sf_update_field_security",
    "sf_update_apex_class_access",
    "sf_change_user_profile",
    "sf_manage_record_sharing",
    "create_and_assign_permission_set"
}

# ── Human-readable label map for confirmation cards ───────────────
WRITE_TOOL_LABELS = {
    "sf_assign_permission_set": "Assign Permission Set",
    "sf_revoke_permission_set": "Revoke Permission Set",
    "sf_update_object_permissions": "Update Object Permissions",
    "sf_update_field_security": "Update Field-Level Security",
    "sf_update_apex_class_access": "Update Apex Class Access",
    "sf_change_user_profile": "Change User Profile",
    "sf_manage_record_sharing": "Manage Record Sharing",
    "create_and_assign_permission_set": "Create & Assign Permission Set"
}

SYSTEM_PROMPT = None


def get_permissions_system_prompt() -> str:
    global SYSTEM_PROMPT
    if SYSTEM_PROMPT is not None:
        return SYSTEM_PROMPT

    import os
    base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    prompt_path = os.path.join(base_dir, "prompt.js")

    if os.path.exists(prompt_path):
        try:
            with open(prompt_path, "r", encoding="utf-8") as f:
                content = f.read()
                match = re.search(r"SYSTEM_PROMPT\s*=\s*`([\s\S]*?)`", content)
                if match:
                    SYSTEM_PROMPT = match.group(1).strip()
                    return SYSTEM_PROMPT
        except Exception as e:
            logger.error(f"Failed to read prompt.js: {e}")

    return "You are SFGuard — an expert Salesforce IAM Analyst embedded in a Chrome extension."


def _build_confirm_card(tool_name: str, args: Dict[str, Any], context: str = "") -> Dict[str, Any]:
    """Build a PERMISSIONS_CONFIRM response card for a pending write operation."""
    label = WRITE_TOOL_LABELS.get(tool_name, tool_name)
    param_lines = "\n".join([f"  • {k}: {v}" for k, v in args.items()])
    message = (
        f"⚠️ **Confirmation Required — {label}**\n\n"
        f"I'm about to perform the following Salesforce change:\n\n"
        f"**Action:** {label}\n"
        f"**Parameters:**\n{param_lines}\n\n"
        f"{context}\n\n"
        "Reply **YES** to confirm or **NO** to cancel this operation."
    )
    return {
        "action": "PERMISSIONS_CONFIRM",
        "message": message,
        "pendingTool": tool_name,
        "pendingArgs": args
    }


def _analyze_and_find_minimal_permset(
    object_type: str,
    field_api_name: Optional[str] = None,
    required_access: str = "edit"
) -> Optional[Dict[str, Any]]:
    """
    Finds all non-profile permission sets in the org that grant the requested access.
    Queries their system permissions, object permission counts, and field permission counts.
    Returns a dictionary containing:
      - 'candidates': list of candidate details
      - 'recommended': the recommended candidate with minimal extra permissions
      - 'proposal': a string description of why the recommended candidate was chosen and its complications.
      - 'create_proposal': if no permission sets exist, contains naming and parameter details for creating a new one.
    """
    try:
        from app.salesforce.client import get_sf_client
        sf = get_sf_client()
        
        perm_field = "PermissionsEdit" if required_access == "edit" else "PermissionsRead"
        if field_api_name:
            soql = (
                f"SELECT ParentId, Parent.Name, Parent.Label "
                f"FROM FieldPermissions "
                f"WHERE SObjectType = '{object_type}' "
                f"AND Field = '{object_type}.{field_api_name}' "
                f"AND {perm_field} = true "
                f"AND Parent.IsOwnedByProfile = false"
            )
        else:
            soql = (
                f"SELECT ParentId, Parent.Name, Parent.Label "
                f"FROM ObjectPermissions "
                f"WHERE SObjectType = '{object_type}' "
                f"AND {perm_field} = true "
                f"AND Parent.IsOwnedByProfile = false"
            )
            
        res = sf.query(soql)
        records = res.get("records", [])
        
        if not records:
            suffix = "Edit" if required_access == "edit" else "Read"
            ps_name = f"PS_{object_type}_{field_api_name}_{suffix}" if field_api_name else f"PS_{object_type}_{suffix}"
            ps_label = f"PS {object_type} {field_api_name} {suffix}" if field_api_name else f"PS {object_type} {suffix}"
            
            ps_name = re.sub(r'[^a-zA-Z0-9_]', '', ps_name)
            ps_name = re.sub(r'_{2,}', '_', ps_name)
            if ps_name.endswith('_'):
                ps_name = ps_name[:-1]
                
            return {
                "candidates": [],
                "recommended": None,
                "create_proposal": {
                    "permissionSetName": ps_name,
                    "permissionSetLabel": ps_label,
                    "objectType": object_type,
                    "fieldName": field_api_name,
                    "accessType": required_access
                }
            }
            
        candidates = []
        for r in records:
            ps_id = r["ParentId"]
            ps_name = r["Parent"]["Name"]
            ps_label = r["Parent"]["Label"]
            
            sys_query = sf.query(
                f"SELECT PermissionsViewAllData, PermissionsModifyAllData, PermissionsApiEnabled, "
                f"PermissionsManageUsers, PermissionsAuthorApex, PermissionsCustomizeApplication "
                f"FROM PermissionSet WHERE Id = '{ps_id}'"
            )
            sys_rec = sys_query.get("records", [{}])[0] if sys_query.get("records") else {}
            
            obj_cond = f"AND SObjectType != '{object_type}'" if not field_api_name else ""
            obj_query = sf.query(f"SELECT COUNT(Id) cnt FROM ObjectPermissions WHERE ParentId = '{ps_id}' {obj_cond}")
            obj_count = obj_query.get("records", [{"cnt": 0}])[0].get("cnt", 0)
            
            fld_cond = f"AND Field != '{object_type}.{field_api_name}'" if field_api_name else ""
            fld_query = sf.query(
                f"SELECT COUNT(Id) cnt FROM FieldPermissions "
                f"WHERE ParentId = '{ps_id}' {fld_cond}"
            )
            fld_count = fld_query.get("records", [{"cnt": 0}])[0].get("cnt", 0)
            
            high_risk_flags = []
            for flag in ["PermissionsViewAllData", "PermissionsModifyAllData", "PermissionsManageUsers", "PermissionsAuthorApex", "PermissionsCustomizeApplication"]:
                if sys_rec.get(flag):
                    high_risk_flags.append(flag.replace("Permissions", ""))
                    
            weight = len(high_risk_flags) * 1000 + obj_count * 10 + fld_count
            
            candidates.append({
                "id": ps_id,
                "name": ps_name,
                "label": ps_label,
                "obj_count": obj_count,
                "fld_count": fld_count,
                "high_risk_flags": high_risk_flags,
                "weight": weight
            })
            
        candidates.sort(key=lambda x: x["weight"])
        rec = candidates[0]
        
        extra_lines = []
        if rec["high_risk_flags"]:
            extra_lines.append(f"⚠️ High-risk system overrides: {', '.join(rec['high_risk_flags'])}")
        if rec["obj_count"] > 0:
            extra_lines.append(f"Object CRUD access on {rec['obj_count']} other object(s)")
        if rec["fld_count"] > 0:
            extra_lines.append(f"FLS access on {rec['fld_count']} other field(s)")
            
        extra_text = "None (Minimal / clean assignment)" if not extra_lines else "; ".join(extra_lines)
        
        proposal = (
            f"Recommended Permission Set: **{rec['name']}** (Label: {rec['label']})\n"
            f"  • Extra Permissions Granted: {extra_text}\n"
        )
        if len(candidates) > 1:
            other_names = ", ".join([c["name"] for c in candidates[1:3]])
            proposal += f"  • Other options evaluated (with higher risk / more extra permissions): {other_names}\n"
            
        return {
            "candidates": candidates,
            "recommended": rec,
            "proposal": proposal,
            "create_proposal": None
        }
    except Exception as e:
        logger.warning(f"Error in _analyze_and_find_minimal_permset: {e}")
        return None


def _get_permset_risk_summary(ps_name: str) -> str:
    """
    Queries details of a permission set to describe its system overrides and counts of object/field grants.
    """
    try:
        from app.salesforce.client import get_sf_client
        sf = get_sf_client()
        
        ps_query = sf.query(f"SELECT Id, Label, Description, PermissionsViewAllData, PermissionsModifyAllData, PermissionsApiEnabled, PermissionsManageUsers, PermissionsAuthorApex, PermissionsCustomizeApplication FROM PermissionSet WHERE Name = '{ps_name}' LIMIT 1")
        if not ps_query.get("records"):
            return ""
        ps = ps_query["records"][0]
        ps_id = ps["Id"]
        
        sys_flags = []
        for flag in ["PermissionsViewAllData", "PermissionsModifyAllData", "PermissionsManageUsers", "PermissionsAuthorApex", "PermissionsCustomizeApplication"]:
            if ps.get(flag):
                sys_flags.append(flag.replace("Permissions", ""))
                
        obj_query = sf.query(f"SELECT COUNT(Id) cnt FROM ObjectPermissions WHERE ParentId = '{ps_id}'")
        obj_count = obj_query.get("records", [{"cnt": 0}])[0].get("cnt", 0)
        
        fld_query = sf.query(f"SELECT COUNT(Id) cnt FROM FieldPermissions WHERE ParentId = '{ps_id}'")
        fld_count = fld_query.get("records", [{"cnt": 0}])[0].get("cnt", 0)
        
        lines = []
        if sys_flags:
            lines.append(f"⚠️ **High-Risk System Flags:** {', '.join(sys_flags)}")
        if obj_count > 0:
            lines.append(f"• Grants CRUD permissions on **{obj_count}** object(s)")
        if fld_count > 0:
            lines.append(f"• Grants FLS permissions on **{fld_count}** field(s)")
            
        if not lines:
            return "💡 This permission set is clean and carries no extra permissions."
            
        risk_desc = "\n".join(lines)
        return (
            f"ℹ️ **Extra Permissions / Risk footprint for '{ps_name}':**\n"
            f"{risk_desc}\n\n"
            f"*(Note: Assure you understand the scope of access this permission set provides before approving.)*"
        )
    except Exception as e:
        logger.warning(f"Failed to get risk summary for {ps_name}: {e}")
        return ""


def _get_create_permset_summary(args: Dict[str, Any]) -> str:
    ps_name = args.get("permissionSetName")
    ps_label = args.get("permissionSetLabel")
    obj = args.get("objectType")
    fld = args.get("fieldName")
    access = args.get("accessType", "edit")
    
    target = f"{obj}.{fld}" if fld else obj
    return (
        f"💡 **No existing permission set was found that grants the required access.**\n\n"
        f"I will **CREATE** a new, minimal permission set with the following specifications:\n"
        f"  • **API Name:** `{ps_name}`\n"
        f"  • **Label:** `{ps_label}`\n"
        f"  • **Permissions:** Grant **{access.upper()}** on `{target}`\n"
        f"  • **Extra Access:** None (completely isolated and minimal)\n\n"
        f"Once created, I will assign it to the target user."
    )


def _enrich_tool_output(tool_name: str, tool_output_str: str) -> str:
    if tool_name not in ("sf_explain_access_grant", "sf_get_field_security", "sf_get_object_permissions"):
        return tool_output_str
        
    try:
        data = json.loads(tool_output_str)
        if not isinstance(data, dict):
            return tool_output_str
            
        object_type = data.get("objectType")
        field_name = data.get("fieldName")
        user_id = data.get("userId")
        
        if not object_type:
            return tool_output_str
            
        edit_analysis = _analyze_and_find_minimal_permset(object_type, field_name, required_access="edit")
        read_analysis = _analyze_and_find_minimal_permset(object_type, field_name, required_access="read")
        
        analysis_report = "\n\n=== SFGuard IAM Analysis: Minimal Permission Sets & Risk ==="
        
        if edit_analysis:
            if edit_analysis.get("recommended"):
                analysis_report += (
                    f"\nTo grant EDIT access to {object_type}{'.' + field_name if field_name else ''}:\n"
                    f"{edit_analysis['proposal']}"
                )
            elif edit_analysis.get("create_proposal"):
                prop = edit_analysis["create_proposal"]
                analysis_report += (
                    f"\nTo grant EDIT access to {object_type}{'.' + field_name if field_name else ''}:\n"
                    f"  No existing permission set found.\n"
                    f"  👉 RECOMMENDATION: Create a new custom permission set. Call tool:\n"
                    f"  `create_and_assign_permission_set(userId='{user_id}', permissionSetName='{prop['permissionSetName']}', permissionSetLabel='{prop['permissionSetLabel']}', objectType='{prop['objectType']}', fieldName='{prop['fieldName'] or ''}', accessType='edit')`"
                )
                
        if read_analysis:
            if read_analysis.get("recommended"):
                analysis_report += (
                    f"\nTo grant READ access to {object_type}{'.' + field_name if field_name else ''}:\n"
                    f"{read_analysis['proposal']}"
                )
            elif read_analysis.get("create_proposal") and not edit_analysis.get("create_proposal"):
                prop = read_analysis["create_proposal"]
                analysis_report += (
                    f"\nTo grant READ access to {object_type}{'.' + field_name if field_name else ''}:\n"
                    f"  No existing permission set found.\n"
                    f"  👉 RECOMMENDATION: Create a new custom permission set. Call tool:\n"
                    f"  `create_and_assign_permission_set(userId='{user_id}', permissionSetName='{prop['permissionSetName']}', permissionSetLabel='{prop['permissionSetLabel']}', objectType='{prop['objectType']}', fieldName='{prop['fieldName'] or ''}', accessType='read')`"
                )
                
        data["sfguard_remediation_analysis"] = analysis_report
        return json.dumps(data)
    except Exception as e:
        logger.warning(f"Failed to enrich tool output for {tool_name}: {e}")
        return tool_output_str


def run_permissions_agent(
    user_message: str,
    running_user_id: Optional[str] = None,
    session_id: Optional[str] = None
) -> Dict[str, Any]:
    """
    Run the permissions ReAct agent.
    - Intercepts write-tool calls and returns a confirmation card instead of executing.
    - Stores the pending write in PENDING_WRITES[session_id] for later execution.
    """
    # Check if the user is asking to perform a write/modify action
    access_grant_keywords = [
        "give", "grant", "add", "provide", "allow", "enable",
        "assign", "fix", "resolve", "update access", "create", "assign"
    ]
    msg_lower = user_message.lower()
    is_write_intent = any(kw in msg_lower for kw in access_grant_keywords)

    client = MCPClient()
    try:
        client.start()
        mcp_tools = client.list_tools()

        # Translate MCP tools → LangChain/OpenAI function call schema
        # Strip unsupported keys to avoid the schema warning flood
        openai_tools = []
        for tool in mcp_tools:
            tool_name = tool["name"]
            # Exclude write tools if user intent is not write/modify
            if not is_write_intent and tool_name in WRITE_TOOLS:
                continue

            schema = tool.get("inputSchema", {})
            clean_schema = {
                "type": schema.get("type", "object"),
                "properties": schema.get("properties", {}),
                "required": schema.get("required", [])
            }
            openai_tools.append({
                "type": "function",
                "function": {
                    "name": tool["name"],
                    "description": tool["description"],
                    "parameters": clean_schema
                }
            })

        # Append custom pseudo-tool definition only if it's a write intent
        if is_write_intent:
            openai_tools.append({
                "type": "function",
                "function": {
                    "name": "create_and_assign_permission_set",
                    "description": "Create a new custom minimal permission set with proper naming conventions, grant the requested field or object level access, and assign it to the user. Use ONLY when no existing permission set grants the needed access.",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "userId": {
                                "type": "string",
                                "description": "The 18-character Salesforce User ID to assign the permission set to"
                            },
                            "permissionSetName": {
                                "type": "string",
                                "description": "DeveloperName for the permission set following naming convention: PS_<ObjectName>_<FieldName>_Edit or PS_<ObjectName>_Edit"
                            },
                            "permissionSetLabel": {
                                "type": "string",
                                "description": "User-friendly Label for the permission set following naming convention: PS <ObjectName> <FieldName> Edit or PS <ObjectName> Edit"
                            },
                            "objectType": {
                                "type": "string",
                                "description": "Salesforce Object API Name (e.g. Account, Custom_Object__c)"
                            },
                            "fieldName": {
                                "type": "string",
                                "description": "Salesforce Field API Name (e.g. SLAExpirationDate__c). Omit or leave empty for object-level permission sets."
                            },
                            "accessType": {
                                "type": "string",
                                "enum": ["read", "edit"],
                                "description": "The level of access to grant (read or edit)"
                            }
                        },
                        "required": ["userId", "permissionSetName", "permissionSetLabel", "objectType", "accessType"]
                    }
                }
            })

        llm = get_llm_with_fallbacks(tools=openai_tools)
        system_content = get_permissions_system_prompt()

        # ── Pre-fetch perm sets if message seems like a vague access grant ──
        access_grant_keywords_prefetch = [
            "give", "grant", "add", "provide", "allow", "enable",
            "assign", "fix", "resolve", "update access"
        ]
        perm_set_context = ""
        if any(kw in msg_lower for kw in access_grant_keywords_prefetch):
            import re as _re

            # Pass 1: find the field (any __c token)
            field_match = _re.search(
                r"\b([A-Za-z][A-Za-z0-9_]*__[cC])\b", user_message
            )
            field_name = field_match.group(1) if field_match else None

            # Pass 2: standard object (tried first so it's never confused with __c field)
            STANDARD_OBJECTS = (
                "Account", "Contact", "Opportunity", "Lead",
                "Case", "Campaign", "User", "Task", "Event", "Product2"
            )
            std_obj_pattern = r"\b(" + "|".join(STANDARD_OBJECTS) + r")\b"
            matches = _re.findall(std_obj_pattern, user_message, flags=_re.IGNORECASE)
            
            if matches:
                # Map case back to standard casing
                matched_names = []
                for m in matches:
                    matched_names.append(next(obj for obj in STANDARD_OBJECTS if obj.lower() == m.lower()))
                # If "User" is matched but there are other standard objects (like Account), prefer the other one
                non_user = [m for m in matched_names if m.lower() != "user"]
                object_name = non_user[0] if non_user else matched_names[0]
            else:
                # Fallback: any __c token that is NOT the same as the field
                custom_matches = _re.findall(r"\b([A-Za-z][A-Za-z0-9_]*__[cC])\b", user_message)
                object_name = next((m for m in custom_matches if m != field_name), None)

            if object_name:
                access_type = "edit" if "edit" in msg_lower or "write" in msg_lower or "modify" in msg_lower else "read"
                analysis = _analyze_and_find_minimal_permset(object_name, field_name, required_access=access_type)
                if analysis:
                    if analysis.get("recommended"):
                        perm_set_context = (
                            f"\n\n[System Pre-fetched Context] I evaluated the permission sets in your org for {object_name}{'.' + field_name if field_name else ''} ({access_type}):\n"
                            f"{analysis['proposal']}"
                            f"Use this recommended permission set via sf_assign_permission_set unless specified otherwise."
                        )
                    elif analysis.get("create_proposal"):
                        prop = analysis["create_proposal"]
                        perm_set_context = (
                            f"\n\n[System Pre-fetched Context] No existing permission set was found that grants {access_type} to {object_name}{'.' + field_name if field_name else ''}.\n"
                            f"You MUST call create_and_assign_permission_set to create a new minimal permission set:\n"
                            f"  permissionSetName: {prop['permissionSetName']}\n"
                            f"  permissionSetLabel: {prop['permissionSetLabel']}\n"
                            f"  objectType: {prop['objectType']}\n"
                            f"  fieldName: {prop['fieldName'] or ''}\n"
                            f"  accessType: {prop['accessType']}"
                        )

        user_message_with_reminder = (
            user_message +
            perm_set_context +
            "\n\nInstructions Reminder:\n"
            "- First classify this request into Path A, B, C, or D.\n"
            "- You MUST call sf_get_user_identity first to search for and obtain the actual userId from Salesforce. Do NOT guess, assume, or make up any record or user IDs.\n"
            "- If it is Path B (Diagnostic), you MUST ALWAYS verify the user's actual permissions first using sf_explain_access_grant or sf_get_field_security. Do NOT assume a user lacks permissions just because their question asks why they cannot access a field/object.\n"
            "- If it is Path B (Diagnostic), you MUST return ONLY a valid JSON object — no markdown fences, no prose. "
            "The JSON must have exactly these top-level keys: 'verdict' (one of: allowed/denied/partial/error), "
            "'reply' (a short conversational explanation), 'rootCause' (technical reason), 'fix' (remediation step), "
            "and 'chain' (an ordered array of layer objects). "
            "Each chain layer object must have exactly: 'layer' (string label e.g. IDENTITY, OBJECT_PERMS, FLS, SYSTEM_OVERRIDE, OWD, ROLE_HIERARCHY), "
            "'status' (EXACTLY one of: PASS, BLOCK, WARN, SKIP — uppercase, no other values), "
            "and 'detail' (plain-text explanation). "
            "Ensure the JSON is well-formed: every opening { must have a matching }, every [ a matching ].\n"
            "- If it is Path C (Write/Modify) AND the user specified an exact permission set name, call sf_get_user_identity to resolve the userId "
            "then call sf_assign_permission_set with the resolved userId and permission set name. "
            "The system handles confirmation automatically.\n"
            "- If it is Path C (Write/Modify) AND the user did NOT specify a permission set name (e.g. 'give user X access to field Y'), "
            "you must first call sf_get_user_identity, then look at the [System Pre-fetched Context] (or tools) to discover which existing permission set(s) grant access. "
            "If an existing permission set is recommended, call sf_assign_permission_set with that name. "
            "If no existing permission set is found or recommended, you MUST call create_and_assign_permission_set to create a new minimal permission set "
            "with DeveloperName='PS_<ObjectName>_<FieldName>_Edit' and Label='PS <ObjectName> <FieldName> Edit' (or similar based on target access).\n"
            "- If it is Path D (Bulk Audit), output a Markdown pipe table with | separators.\n"
            "- Copy every ID, permission state, and DeveloperName exactly from tool results — never invent values."
        )

        messages = [
            SystemMessage(content=system_content),
            HumanMessage(content=user_message_with_reminder)
        ]

        max_turns = 12
        final_content = ""

        for turn in range(max_turns):
            logger.info(f"Permissions Agent ReAct turn {turn + 1}...")
            response = llm.invoke(messages)

            if hasattr(response, "tool_calls") and response.tool_calls:
                messages.append(response)

                intercepted = False
                for tc in response.tool_calls:
                    tool_name = tc.get("name")
                    args = tc.get("args", {})
                    call_id = tc.get("id")

                    logger.info(f"Permissions Agent calling tool: {tool_name} with parameters: {args}")

                    # ── WRITE-TOOL INTERCEPT ───────────────────────────────
                    if tool_name in WRITE_TOOLS:
                        # Check for placeholder userId or arguments
                        has_placeholder = False
                        placeholder_reason = ""
                        
                        user_id_val = args.get("userId")
                        if user_id_val:
                            if not re.match(r"^[a-zA-Z0-9]{15}([a-zA-Z0-9]{3})?$", str(user_id_val)):
                                has_placeholder = True
                                placeholder_reason = f"Error: The userId '{user_id_val}' is not a valid 15-character or 18-character Salesforce ID. You must resolve the correct user ID using sf_get_user_identity first, then pass the actual ID."

                        for k, v in args.items():
                            if isinstance(v, str) and ("placeholder" in v.lower() or "resolved_user_id" in v.lower() or "unresolved" in v.lower()):
                                has_placeholder = True
                                placeholder_reason = f"Error: The parameter '{k}' has a placeholder value '{v}'. You must resolve and replace all placeholders with actual values before calling this tool."

                        if has_placeholder:
                            logger.info(f"Write tool {tool_name} contains placeholder: {placeholder_reason}")
                            messages.append(ToolMessage(content=placeholder_reason, tool_call_id=call_id))
                            continue

                        logger.info(f"Intercepting write tool: {tool_name} — storing pending write and returning confirmation card.")
                        if session_id:
                            PENDING_WRITES[session_id] = {
                                "tool_name": tool_name,
                                "args": args
                            }
                        
                        context = ""
                        if tool_name == "sf_assign_permission_set":
                            ps_name = args.get("permissionSetName")
                            context = _get_permset_risk_summary(ps_name)
                        elif tool_name == "create_and_assign_permission_set":
                            context = _get_create_permset_summary(args)
                            
                        return _build_confirm_card(tool_name, args, context)

                    try:
                        mcp_res = client.call_tool(tool_name, args)
                        content_list = mcp_res.get("result", {}).get("content", [])
                        text_content = ""
                        for item in content_list:
                            if item.get("type") == "text":
                                text_content += item.get("text", "")

                        if not text_content:
                            text_content = json.dumps(mcp_res)
                            
                        # Enrich output to provide minimal permsets / creation details
                        text_content = _enrich_tool_output(tool_name, text_content)
                    except Exception as e:
                        logger.error(f"Error calling tool {tool_name}: {e}")
                        text_content = json.dumps({"error": str(e), "status": "WARN"})

                    messages.append(ToolMessage(content=text_content, tool_call_id=call_id))
            else:
                final_content = _extract_text(response.content)
                break
        else:
            final_content = json.dumps({
                "verdict": "error",
                "reply": "Agent execution turn limit reached.",
                "rootCause": "ReAct loop reached turn ceiling",
                "fix": "N/A",
                "chain": []
            })

        return parse_agent_verdict(final_content)

    finally:
        client.stop()


def execute_pending_write(session_id: str) -> Dict[str, Any]:
    """
    Execute a previously intercepted write tool call after user approval.
    Looks up PENDING_WRITES[session_id], executes the stored tool, and clears the entry.
    """
    pending = PENDING_WRITES.pop(session_id, None)
    if not pending:
        return {
            "action": "CHAT",
            "message": "No pending operation found for this session. Please re-submit your request."
        }

    tool_name = pending["tool_name"]
    args = pending["args"]
    label = WRITE_TOOL_LABELS.get(tool_name, tool_name)

    logger.info(f"Executing approved write tool: {tool_name} with args: {args}")

    # ── CUSTOM REMEDIATION: Create and assign permission set ───────────
    if tool_name == "create_and_assign_permission_set":
        try:
            from app.salesforce.client import get_sf_client
            sf = get_sf_client()
            
            user_id = args["userId"]
            ps_name = args["permissionSetName"]
            ps_label = args["permissionSetLabel"]
            target_object = args.get("objectType")
            target_field = args.get("fieldName")
            required_access = args.get("accessType", "edit")
            
            logger.info(f"Creating custom permission set: {ps_name} for user: {user_id}")
            
            # 1. Create or retrieve PermissionSet
            exist_query = sf.query(f"SELECT Id FROM PermissionSet WHERE Name = '{ps_name}' LIMIT 1")
            exist_records = exist_query.get("records", [])
            if exist_records:
                ps_id = exist_records[0]["Id"]
                logger.info(f"Permission set {ps_name} already exists with Id {ps_id}. Reusing.")
            else:
                desc = f"Auto-created by Veloq Copilot to grant {required_access} access to {target_object}"
                if target_field:
                    desc += f".{target_field}"
                ps_res = sf.PermissionSet.create({
                    "Name": ps_name,
                    "Label": ps_label,
                    "Description": desc
                })
                ps_id = ps_res["id"]
                logger.info(f"Created PermissionSet {ps_name} with Id {ps_id}")
                
            # 2. Grant Object Permissions
            obj_exist = sf.query(f"SELECT Id FROM ObjectPermissions WHERE ParentId = '{ps_id}' AND SObjectType = '{target_object}' LIMIT 1")
            obj_exist_recs = obj_exist.get("records", [])
            
            obj_perms = {
                "ParentId": ps_id,
                "SObjectType": target_object,
                "PermissionsRead": True,
                "PermissionsEdit": required_access == "edit"
            }
            
            if obj_exist_recs:
                obj_perm_id = obj_exist_recs[0]["Id"]
                sf.ObjectPermissions.update(obj_perm_id, {
                    "PermissionsRead": True,
                    "PermissionsEdit": required_access == "edit"
                })
            else:
                sf.ObjectPermissions.create(obj_perms)
                
            # 3. Grant Field Permissions (FLS) if target field specified
            if target_field:
                fld_api = f"{target_object}.{target_field}"
                fld_exist = sf.query(f"SELECT Id FROM FieldPermissions WHERE ParentId = '{ps_id}' AND SObjectType = '{target_object}' AND Field = '{fld_api}' LIMIT 1")
                fld_exist_recs = fld_exist.get("records", [])
                
                fld_perms = {
                    "ParentId": ps_id,
                    "SObjectType": target_object,
                    "Field": fld_api,
                    "PermissionsRead": True,
                    "PermissionsEdit": required_access == "edit"
                }
                
                if fld_exist_recs:
                    fld_perm_id = fld_exist_recs[0]["Id"]
                    sf.FieldPermissions.update(fld_perm_id, {
                        "PermissionsRead": True,
                        "PermissionsEdit": required_access == "edit"
                    })
                else:
                    sf.FieldPermissions.create(fld_perms)
                    
            # 4. Assign Permission Set to User
            assign_exist = sf.query(f"SELECT Id FROM PermissionSetAssignment WHERE PermissionSetId = '{ps_id}' AND AssigneeId = '{user_id}' LIMIT 1")
            assign_exist_recs = assign_exist.get("records", [])
            if assign_exist_recs:
                logger.info(f"Permission set {ps_name} is already assigned to user {user_id}")
            else:
                sf.PermissionSetAssignment.create({
                    "PermissionSetId": ps_id,
                    "AssigneeId": user_id
                })
                logger.info(f"Assigned PermissionSet {ps_name} to user {user_id}")
                
            return {
                "action": "CHAT",
                "message": f"✅ **{label} completed successfully.**\n\nCreated permission set **{ps_name}** with **{required_access.upper()}** access on **{target_object}{'.' + target_field if target_field else ''}** and assigned it to the user."
            }
        except Exception as e:
            logger.error(f"Error in custom create & assign permset: {e}")
            return {
                "action": "CHAT",
                "message": f"❌ **{label} failed:** {str(e)}"
            }

    # ── STANDARD MCP WRITE TOOL CALL ───────────────────────────────────
    client = MCPClient()
    try:
        client.start()
        mcp_res = client.call_tool(tool_name, args)
        content_list = mcp_res.get("result", {}).get("content", [])
        text_content = ""
        for item in content_list:
            if item.get("type") == "text":
                text_content += item.get("text", "")

        if not text_content:
            text_content = json.dumps(mcp_res)

        logger.info(f"Write tool {tool_name} executed successfully.")
        return {
            "action": "CHAT",
            "message": f"✅ **{label} completed successfully.**\n\n{text_content}"
        }
    except Exception as e:
        logger.error(f"Error executing approved write {tool_name}: {e}")
        return {
            "action": "CHAT",
            "message": f"❌ **{label} failed:** {str(e)}"
        }
    finally:
        client.stop()


# ── Status normalisation map ─────────────────────────────────────────
_STATUS_MAP = {
    "success": "PASS", "passed": "PASS", "resolved": "PASS", "allowed": "PASS",
    "ok": "PASS", "granted": "PASS", "enabled": "PASS", "active": "PASS",
    "failed": "BLOCK", "denied": "BLOCK", "blocked": "BLOCK", "error": "BLOCK",
    "restricted": "BLOCK", "hidden": "BLOCK", "no_access": "BLOCK",
    "warning": "WARN", "partial": "WARN", "degraded": "WARN",
    "skipped": "SKIP", "not_checked": "SKIP", "n/a": "SKIP", "na": "SKIP",
}


def _normalise_chain(chain: list) -> list:
    """Normalise all chain layer status values to PASS/BLOCK/WARN/SKIP."""
    out = []
    for step in chain:
        raw = str(step.get("status", "")).strip().lower()
        step["status"] = _STATUS_MAP.get(raw, raw.upper() if raw else "SKIP")
        out.append(step)
    return out


def _try_repair_json(text: str) -> dict | None:
    """Attempt progressively aggressive JSON repair strategies."""
    # Strategy 1 — strip markdown fences
    cleaned = text.strip()
    for pattern in (r"^```[a-zA-Z0-9]*\n", r"\n```$", r"^```", r"```$"):
        cleaned = re.sub(pattern, "", cleaned).strip()

    # Strategy 2 — extract first {...} block
    brace_match = re.search(r"(\{[\s\S]*\})", cleaned)
    if brace_match:
        candidate = brace_match.group(1)
        try:
            return json.loads(candidate)
        except json.JSONDecodeError:
            pass
        # Strategy 3 — fix trailing commas before } or ]
        candidate = re.sub(r",\s*([}\]])", r"\1", candidate)
        # Strategy 4 — close any unclosed array/object brackets
        opens = candidate.count("{") - candidate.count("}")
        close_braces = "}" * opens if opens > 0 else ""
        opens_arr = candidate.count("[") - candidate.count("]")
        close_arr = "]" * opens_arr if opens_arr > 0 else ""
        candidate = candidate + close_arr + close_braces
        try:
            return json.loads(candidate)
        except json.JSONDecodeError:
            pass

    return None


def parse_agent_verdict(content: str) -> Dict[str, Any]:
    # ── 1. Quick check: is it a pipe-table audit report? ──────────────
    if "|" in content and ("User" in content or "Username" in content or "Role" in content):
        return {
            "action": "PERMISSIONS_AUDIT",
            "message": content
        }

    # ── 2. Attempt to parse / repair JSON ─────────────────────────────
    data = _try_repair_json(content)
    if data and isinstance(data, dict) and "verdict" in data:
        # Normalise chain status values so the LWC iconMap matches
        if "chain" in data and isinstance(data["chain"], list):
            data["chain"] = _normalise_chain(data["chain"])
        return {
            "action": "PERMISSIONS_DIAGNOSTIC",
            "cardData": data
        }

    # ── 3. Plain chat fallback ─────────────────────────────────────────
    return {
        "action": "CHAT",
        "message": content
    }


def run_permissions_background(
    job_id: str,
    user_message: str,
    running_user_id: Optional[str],
    session_id: Optional[str]
) -> None:
    """
    Runs the permissions agent in a FastAPI BackgroundTask.
    Stores the result in PERMISSIONS_JOBS[job_id] when done.
    """
    PERMISSIONS_JOBS[job_id] = {"status": "running", "result": None}
    logger.info(f"[PermJob {job_id}] Starting background permissions agent...")
    try:
        result = run_permissions_agent(user_message, running_user_id, session_id)
        PERMISSIONS_JOBS[job_id] = {"status": "complete", "result": result}
        logger.info(f"[PermJob {job_id}] Completed: action={result.get('action')}")
    except Exception as e:
        logger.error(f"[PermJob {job_id}] Failed: {e}")
        PERMISSIONS_JOBS[job_id] = {
            "status": "failed",
            "result": {
                "action": "CHAT",
                "message": f"Permissions agent encountered an error: {str(e)}"
            }
        }
