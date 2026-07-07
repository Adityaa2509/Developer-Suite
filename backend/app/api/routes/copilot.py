import json
import uuid
import base64
import io
import csv
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, BackgroundTasks, HTTPException
from pydantic import BaseModel
from langchain_core.messages import SystemMessage, HumanMessage
from app.core.llm import get_llm_with_fallbacks
from app.core.logger import get_logger
from app.agent.schema_builder import generate_schema
from app.salesforce.metadata_deployer import deploy_schema_to_sf
from app.salesforce.data_loader import (
    get_sobject_fields,
    map_headers,
    parse_csv_data,
    execute_sobject_collection_dml
)
from app.agent.runner import run_investigation_background
from app.tools.record import detect_object_type
from app.agent.permissions_agent import (
    run_permissions_agent,
    run_permissions_background,
    execute_pending_write,
    PENDING_WRITES
)

router = APIRouter()
logger = get_logger(__name__)

# ── REQUEST MODELS ────────────────────────────────────────────────
class CopilotMessageRequest(BaseModel):
    message: str
    session_id: str
    org_url: str
    record_id: Optional[str] = None
    running_user_id: Optional[str] = None
    file_name: Optional[str] = None
    file_content: Optional[str] = None

class UploadRequest(BaseModel):
    base64_file: str
    file_name: str
    object_name: str
    session_id: str
    org_url: str

class ExecuteImportRequest(BaseModel):
    mapping_json: str
    csv_data: str
    object_name: str
    operation: str
    session_id: str
    org_url: str

class DeployMetadataRequest(BaseModel):
    schema_json: str
    session_id: str
    org_url: str


# ── ROUTE ENDPOINTS ───────────────────────────────────────────────

@router.post("/message")
async def handle_copilot_message(
    req: CopilotMessageRequest,
    background_tasks: BackgroundTasks
):
    """
    Main conversational copilot endpoint.
    Uses LLM to route intent and delegates tasks dynamically.
    """
    message = req.message
    session_id = req.session_id
    logger.info(f"Received Copilot message: '{message[:60]}...'")

    # ── Confirmation intercept: handle YES / NO for pending write ops ──
    msg_stripped = message.strip().upper()
    if msg_stripped in ("YES", "YES_CONFIRM", "CONFIRM", "APPROVE") and session_id in PENDING_WRITES:
        logger.info(f"User approved pending write for session {session_id}")
        return execute_pending_write(session_id)
    elif msg_stripped in ("NO", "CANCEL", "REJECT") and session_id in PENDING_WRITES:
        PENDING_WRITES.pop(session_id, None)
        logger.info(f"User cancelled pending write for session {session_id}")
        return {"action": "CHAT", "message": "❌ Operation cancelled. No changes were made to your Salesforce org."}
    
    # 1. Classify User Intent using the LLM chain
    system_prompt = """Analyze the user's message and categorize their intent into one of the following:
1. DEBUG: The user is reporting an error, requesting an investigation of a record or an anomaly. (e.g. "why does record 001xx fail", "debug case 500xx", "investigate error")
2. CREATE: The user is asking to build/create a new object, schema, table, fields, validation rules, or asking to parse a document description into Salesforce metadata structures.
3. PERMISSIONS: The user is asking about permissions, access diagnostics (e.g. "why can't user X see field Y"), security audits, bulk reporting (e.g. "who has access to Account"), or requesting to modify/grant permissions (e.g. "assign permission set X to John").
4. CHAT: General greeting, chat, question about Salesforce, or any other query.

Return ONLY a single word from: DEBUG, CREATE, PERMISSIONS, CHAT. No formatting, no extra words."""

    llm = get_llm_with_fallbacks()
    messages = [
        SystemMessage(content=system_prompt),
        HumanMessage(content=message)
    ]
    
    try:
        response = llm.invoke(messages)
        intent = response.content.strip().upper()
        intent = intent.replace("`", "").replace("JSON", "").strip()
    except Exception as e:
        logger.error(f"Failed to classify intent: {e}")
        intent = "CHAT"
        
    logger.info(f"Classified Copilot intent: {intent}")

    # 2. Handle Intent Routing
    if "DEBUG" in intent:
        # Sherlock Debugger flow
        target_rec_id = req.record_id
        if not target_rec_id:
            # Match standard 15/18 char Salesforce IDs in the message
            import re
            id_match = re.search(r"\b[a-zA-Z0-9]{15}(?:[a-zA-Z0-9]{3})?\b", message)
            if id_match:
                target_rec_id = id_match.group(0)
                
        if not target_rec_id:
            return {
                "action": "CHAT",
                "message": "I detected you want to run a record investigation, but I couldn't find a valid Salesforce Record ID in your message. Please provide a Record ID (e.g. 500xx...)."
            }
            
        try:
            object_type = detect_object_type(target_rec_id)
        except Exception as e:
            object_type = "Case"
            
        job_id = str(uuid.uuid4())
        
        background_tasks.add_task(
            run_investigation_background,
            job_id=job_id,
            record_id=target_rec_id,
            object_type=object_type,
            anomaly=message,
            running_user_id=req.running_user_id
        )
        
        return {
            "action": "DEBUG",
            "job_id": job_id,
            "record_id": target_rec_id,
            "object_type": object_type,
            "message": f"Starting an asynchronous investigation on {object_type} record {target_rec_id}..."
        }
        
    elif "CREATE" in intent:
        # Creator flow (JSON Schema Builder)
        try:
            schema = generate_schema(
                prompt_text=message,
                base64_content=req.file_content,
                file_name=req.file_name
            )
            return {
                "action": "CREATE",
                "schema": schema,
                "message": "I've drafted a Salesforce schema definition based on your requirements. Please review it below before deploying."
            }
        except Exception as e:
            logger.error(f"Error generating schema: {e}")
            err_msg = str(e)
            user_hint = ""
            if "RESOURCE_EXHAUSTED" in err_msg or "429" in err_msg:
                user_hint = (
                    "\n\n💡 **Tip:** It looks like Gemini's free tier rate limit was exceeded. "
                    "Since Groq Llama 3.3 is currently 100% active and healthy, you can avoid this by "
                    "copy-pasting the text requirements directly into the chat, or uploading them "
                    "as a plain text file (.txt, .csv, .json, .yaml, etc.) instead of a PDF/image."
                )
            return {
                "action": "CHAT",
                "message": f"I tried to construct a schema from your requirements but ran into an error: {e}{user_hint}"
            }
            
    elif "PERMISSIONS" in intent:
        # Run as a background task — returns immediately with a job_id
        # LWC polls GET /api/permissions/status/{job_id} until complete
        job_id = str(uuid.uuid4())
        background_tasks.add_task(
            run_permissions_background,
            job_id=job_id,
            user_message=message,
            running_user_id=req.running_user_id,
            session_id=session_id
        )
        return {
            "action": "PERMISSIONS_LOADING",
            "job_id": job_id,
            "message": "🔍 Analysing Salesforce permissions..."
        }
            
    else:
        # Conversational Chat fallback
        chat_system = "You are Veloq/Nexora Copilot, a high-tech AI DevOps companion for Salesforce administrators and developers. Keep your response helpful, expert-focused, and concise."
        chat_messages = [
            SystemMessage(content=chat_system),
            HumanMessage(content=message)
        ]
        try:
            chat_response = llm.invoke(chat_messages)
            return {
                "action": "CHAT",
                "message": chat_response.content
            }
        except Exception as e:
            return {
                "action": "CHAT",
                "message": f"I had trouble answering your query: {e}"
            }


@router.post("/upload")
async def handle_csv_upload(req: UploadRequest):
    """
    Parses CSV, retrieves object fields, and fuzzy maps headers to fields.
    Accepts JSON body with base64 encoded file content.
    """
    object_name = req.object_name
    logger.info(f"Processing CSV upload for object: {object_name}")
    try:
        content_bytes = base64.b64decode(req.base64_file)
        csv_text = content_bytes.decode("utf-8", errors="ignore")
        
        f = io.StringIO(csv_text.strip())
        reader = csv.reader(f)
        headers = next(reader, [])
        
        if not headers:
            raise HTTPException(status_code=400, detail="CSV file appears to be empty or missing headers.")
            
        fields_info = get_sobject_fields(req.org_url, req.session_id, object_name)
        mappings = map_headers(headers, fields_info)
        
        return {
            "success": True,
            "headers": mappings,
            "fields": fields_info,
            "csvData": csv_text,
            "fileName": req.file_name
        }
    except Exception as e:
        logger.error(f"Error uploading CSV: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/execute-import")
async def execute_import(req: ExecuteImportRequest):
    """
    Performs batch updates/inserts into Salesforce via Composite SObject Collections REST endpoint.
    """
    logger.info(f"Executing composite import of {req.object_name} ({req.operation})...")
    try:
        mappings = json.loads(req.mapping_json)
        rows = parse_csv_data(req.csv_data)
        
        result = execute_sobject_collection_dml(
            org_url=req.org_url,
            session_id=req.session_id,
            object_name=req.object_name,
            operation=req.operation.lower(),
            mappings=mappings,
            rows=rows
        )
        return result
    except Exception as e:
        logger.error(f"Error executing import: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/deploy-metadata")
async def deploy_metadata(req: DeployMetadataRequest):
    """
    Deploys custom objects and fields directly from the backend to Salesforce using Tooling API.
    """
    logger.info("Deploying custom metadata schema...")
    try:
        schema = json.loads(req.schema_json)
        result = deploy_schema_to_sf(req.org_url, req.session_id, schema)
        return result
    except Exception as e:
        logger.error(f"Error deploying metadata: {e}")
        raise HTTPException(status_code=500, detail=str(e))


class CheckSyntaxRequest(BaseModel):
    object_name: str
    formula: str
    fields_json: str


@router.post("/check-syntax")
async def check_syntax(req: CheckSyntaxRequest):
    """
    Checks the syntax of a Salesforce validation rule formula using LLM validation.
    """
    import re
    logger.info(f"Checking formula syntax for object {req.object_name}: {req.formula}")
    try:
        fields = json.loads(req.fields_json)
        fields_str = "\n".join([f"- Name: {f.get('apiName')}, Type: {f.get('type')}" for f in fields])
        
        system_prompt = """You are a Salesforce validation formula syntax validator.
Given the following context of a Salesforce Custom Object:
Object API Name: {object_name}
Proposed Fields:
{fields_str}

Please analyze if the following formula has any syntax errors, misspelled fields, type mismatches (e.g. comparing Text to a Number), incorrect Salesforce function usage, or unbalanced parentheses.

Formula: {formula}

Respond STRICTLY in JSON format with two keys:
- "isValid": a boolean (true if the syntax is valid, false if there is any error)
- "errorMessage": a string (detailed explanation of the syntax error if isValid is false, or empty string if isValid is true)

JSON Response format:
{{
  "isValid": true,
  "errorMessage": ""
}}"""
        
        formatted_system = system_prompt.format(
            object_name=req.object_name,
            fields_str=fields_str,
            formula=req.formula
        )
        
        llm = get_llm_with_fallbacks()
        messages = [
            SystemMessage(content=formatted_system),
            HumanMessage(content=f"Verify this formula: {req.formula}")
        ]
        
        res = llm.invoke(messages)
        res_text = res.content.strip()
        
        if res_text.startswith("```"):
            res_text = re.sub(r"^```[a-zA-Z]*\n", "", res_text)
            res_text = re.sub(r"\n```$", "", res_text)
            
        result = json.loads(res_text.strip())
        return result
    except Exception as e:
        logger.error(f"Error checking validation formula syntax: {e}")
        return {
            "isValid": False,
            "errorMessage": f"Backend syntax validator encountered an error: {str(e)}"
        }
