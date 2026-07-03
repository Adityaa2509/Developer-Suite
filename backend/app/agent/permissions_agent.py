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
    "sf_manage_record_sharing"
}

# ── Human-readable label map for confirmation cards ───────────────
WRITE_TOOL_LABELS = {
    "sf_assign_permission_set": "Assign Permission Set",
    "sf_revoke_permission_set": "Revoke Permission Set",
    "sf_update_object_permissions": "Update Object Permissions",
    "sf_update_field_security": "Update Field-Level Security",
    "sf_update_apex_class_access": "Update Apex Class Access",
    "sf_change_user_profile": "Change User Profile",
    "sf_manage_record_sharing": "Manage Record Sharing"
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


def _find_permsets_for_field(field_api_name: str, object_type: str) -> list:
    """
    Fast SOQL lookup: find permission sets (non-profile) that grant
    Edit access to the specified field, so the LLM doesn't need a discovery turn.
    Returns a list of PermissionSet DeveloperNames (max 5).
    """
    try:
        from app.salesforce.client import get_sf_client
        sf = get_sf_client()
        # FieldPermissions stores per-perm-set FLS; filter to Edit=true, non-profile perm sets
        soql = (
            f"SELECT Parent.Name, Parent.Label "
            f"FROM FieldPermissions "
            f"WHERE SObjectType = '{object_type}' "
            f"AND Field = '{object_type}.{field_api_name}' "
            f"AND PermissionsEdit = true "
            f"AND Parent.IsOwnedByProfile = false "
            f"LIMIT 5"
        )
        res = sf.query(soql)
        names = [r["Parent"]["Name"] for r in res.get("records", [])]
        logger.info(f"Pre-fetched perm sets granting edit on {object_type}.{field_api_name}: {names}")
        return names
    except Exception as e:
        logger.warning(f"_find_permsets_for_field failed (non-fatal): {e}")
        return []


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
    client = MCPClient()
    try:
        client.start()
        mcp_tools = client.list_tools()

        # Translate MCP tools → LangChain/OpenAI function call schema
        # Strip unsupported keys to avoid the schema warning flood
        openai_tools = []
        for tool in mcp_tools:
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

        llm = get_llm_with_fallbacks(tools=openai_tools)
        system_content = get_permissions_system_prompt()

        # ── Pre-fetch perm sets if message seems like a vague access grant ──
        access_grant_keywords = [
            "give", "grant", "add", "provide", "allow", "enable",
            "assign", "fix", "resolve", "update access"
        ]
        msg_lower = user_message.lower()
        perm_set_context = ""
        if any(kw in msg_lower for kw in access_grant_keywords):
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
            std_match = _re.search(std_obj_pattern, user_message)
            if std_match:
                object_name = std_match.group(1)
            else:
                # Fallback: any __c token that is NOT the same as the field
                custom_matches = _re.findall(r"\b([A-Za-z][A-Za-z0-9_]*__[cC])\b", user_message)
                object_name = next((m for m in custom_matches if m != field_name), None)

            if field_name and object_name:
                discovered = _find_permsets_for_field(field_name, object_name)
                if discovered:
                    perm_set_context = (
                        f"\n\n[System Pre-fetched Context] The following existing Permission Sets already "
                        f"grant Edit access to {object_name}.{field_name}: {', '.join(discovered)}. "
                        f"Use the first one ({discovered[0]}) unless the user specified a different one."
                    )

        user_message_with_reminder = (
            user_message +
            perm_set_context +
            "\n\nInstructions Reminder:\n"
            "- First classify this request into Path A, B, C, or D.\n"
            "- You MUST call sf_get_user_identity first to search for and obtain the actual userId from Salesforce. Do NOT guess, assume, or make up any record or user IDs.\n"
            "- If it is Path B (Diagnostic), you MUST return ONLY a valid JSON object — no markdown fences, no prose. "
            "The JSON must have exactly these top-level keys: 'verdict' (one of: allowed/denied/partial/error), "
            "'reply' (a short conversational explanation), 'rootCause' (technical reason), 'fix' (remediation step), "
            "and 'chain' (an ordered array of layer objects). "
            "Each chain layer object must have exactly: 'layer' (string label e.g. IDENTITY, OBJECT_PERMS, FLS, SYSTEM_OVERRIDE, OWD, ROLE_HIERARCHY), "
            "'status' (EXACTLY one of: PASS, BLOCK, WARN, SKIP — uppercase, no other values), "
            "and 'detail' (plain-text explanation). "
            "Ensure the JSON is well-formed: every opening { must have a matching }, every [ a matching ].\n"
            "- If it is Path C (Write/Modify) AND the user specified an exact permission set name, call sf_get_user_identity to resolve the userId "
            "then call sf_assign_permission_set (or the relevant write tool) with the resolved userId and permission set name. "
            "The system handles confirmation automatically.\n"
            "- If it is Path C (Write/Modify) AND the user did NOT specify a permission set name (e.g. 'give user X access to field Y'), "
            "you must first call sf_get_user_identity, then call sf_explain_access_grant (or sf_get_field_security) to discover "
            "which existing permission set(s) already grant the needed access. "
            "Pick the most appropriate one from the tool result and then call sf_assign_permission_set with that discovered name. "
            "Do NOT invent or guess a permission set name — only use names returned by tool results.\n"
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
                        logger.info(f"Intercepting write tool: {tool_name} — storing pending write and returning confirmation card.")
                        if session_id:
                            PENDING_WRITES[session_id] = {
                                "tool_name": tool_name,
                                "args": args
                            }
                        return _build_confirm_card(tool_name, args)

                    try:
                        mcp_res = client.call_tool(tool_name, args)
                        content_list = mcp_res.get("result", {}).get("content", [])
                        text_content = ""
                        for item in content_list:
                            if item.get("type") == "text":
                                text_content += item.get("text", "")

                        if not text_content:
                            text_content = json.dumps(mcp_res)
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
