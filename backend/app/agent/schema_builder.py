import base64
import json
import re
from typing import Optional
from langchain_core.messages import SystemMessage, HumanMessage
from app.core.llm import get_llm_with_fallbacks
from app.core.config import get_settings
from app.core.logger import get_logger

logger = get_logger(__name__)

STANDARD_OBJECTS = {
    'account', 'contact', 'lead', 'opportunity', 'case', 'campaign', 'user', 'product2',
    'asset', 'contract', 'order', 'solution', 'task', 'event', 'pricebook2', 'quote',
    'opportunitylineitem', 'accountteammember', 'collaborationgroup', 'contentversion',
    'document', 'idea', 'leadshare', 'note', 'partner', 'recordtype', 'site'
}

def generate_schema(
    prompt_text: Optional[str] = None,
    base64_content: Optional[str] = None,
    file_name: Optional[str] = None
) -> dict:
    """
    Parses conversational requirements (text prompt or uploaded file) into
    a structured custom object metadata schema representation using Gemini/Llama.
    """
    s = get_settings()
    
    system_prompt = """You are a Salesforce architect. Analyze the input and extract all custom objects/entities, their fields, and any validation rules.
Return ONLY a valid JSON object. Do not include markdown code fences (like ```json), explanations, or HTML.
Use this exact JSON format:
{
  "objects": [
    {
      "label": "Object Label",
      "apiName": "Object_API_Name__c",
      "description": "Object Description",
      "fields": [
        {
          "label": "Field Label",
          "apiName": "Field_API_Name__c",
          "type": "Text", // Text, Number, Date, Checkbox, Picklist, Email, Phone
          "length": 255, // only for Text/Number if relevant
          "required": false,
          "picklistValues": [] // array of strings if type is Picklist
        }
      ],
      "validationRules": [
        {
          "name": "Rule_Name",
          "errorMessage": "User friendly error message",
          "formula": "ISBLANK(Field_API_Name__c)"
        }
      ]
    }
  ]
}
"""

    messages = [SystemMessage(content=system_prompt)]
    
    use_multimodal = False
    if base64_content and file_name:
        try:
            is_text = False
            lower_name = file_name.lower()
            if any(lower_name.endswith(ext) for ext in [".txt", ".csv", ".json", ".md", ".xml", ".yaml", ".yml", ".html"]):
                is_text = True
            
            if is_text:
                decoded = base64.b64decode(base64_content).decode("utf-8", errors="ignore")
                user_msg = f"Requirements from file '{file_name}':\n\n{decoded}"
                messages.append(HumanMessage(content=user_msg))
            else:
                use_multimodal = True
                mime_type = "application/pdf"
                if lower_name.endswith(".png"):
                    mime_type = "image/png"
                elif lower_name.endswith(".jpg") or lower_name.endswith(".jpeg"):
                    mime_type = "image/jpeg"
                
                content_list = [
                    {"type": "text", "text": f"Please extract custom objects, fields, and validation rules from the requirements in this file: {file_name}"},
                    {
                        "type": "media",
                        "mime_type": mime_type,
                        "data": base64_content
                    }
                ]
                messages.append(HumanMessage(content=content_list))
        except Exception as e:
            logger.error(f"Error handling base64 file upload: {e}")
            messages.append(HumanMessage(content=f"Could not parse file '{file_name}' due to error: {e}"))
    else:
        messages.append(HumanMessage(content=f"Requirements:\n{prompt_text or ''}"))

    # Invoke LLM
    if use_multimodal:
        # Route directly to multimodal Gemini chain (Groq does not support PDF/image data blocks)
        from langchain_google_genai import ChatGoogleGenerativeAI
        gemini_primary = ChatGoogleGenerativeAI(
            model=s.GEMINI_MODEL_PRIMARY,
            google_api_key=s.GEMINI_API_KEY,
            temperature=0.1,
            convert_system_message_to_human=True,
        )
        
        fallbacks = []
        if s.GEMINI_API_KEY_FALLBACK:
            fallbacks.append(ChatGoogleGenerativeAI(
                model=s.GEMINI_MODEL_PRIMARY,
                google_api_key=s.GEMINI_API_KEY_FALLBACK,
                temperature=0.1,
                convert_system_message_to_human=True,
            ))
            
        fallbacks.append(ChatGoogleGenerativeAI(
            model=s.GEMINI_MODEL_FALLBACK,
            google_api_key=s.GEMINI_API_KEY,
            temperature=0.1,
            convert_system_message_to_human=True,
        ))
        
        if s.GEMINI_API_KEY_FALLBACK:
            fallbacks.append(ChatGoogleGenerativeAI(
                model=s.GEMINI_MODEL_FALLBACK,
                google_api_key=s.GEMINI_API_KEY_FALLBACK,
                temperature=0.1,
                convert_system_message_to_human=True,
            ))
            
        llm = gemini_primary.with_fallbacks(fallbacks)
    else:
        llm = get_llm_with_fallbacks()

    response = llm.invoke(messages)
    
    text = response.content
    logger.info(f"Schema Builder response raw content length: {len(text)}")
    
    # Extract JSON block
    match = re.search(r"({.*})", text, re.DOTALL)
    if match:
        json_str = match.group(1)
    else:
        json_str = text
        
    # Clean up markdown code blocks if any
    json_str = json_str.strip()
    if json_str.startswith("```"):
        json_str = re.sub(r"^```[a-zA-Z]*\n", "", json_str)
        json_str = re.sub(r"\n```$", "", json_str)
        
    try:
        schema = json.loads(json_str)
        return sanitize_schema_dict(schema)
    except Exception as e:
        logger.error(f"Failed to parse schema JSON. Error: {e}. Raw text: {text}")
        raise ValueError(f"Failed to parse LLM response as JSON schema: {e}")

def sanitize_api_name(name: str, is_object: bool = False) -> str:
    if not name:
        return ""
    name = re.sub(r'\s+', '_', name)
    name = re.sub(r'[^a-zA-Z0-9_]', '', name)
    name = re.sub(r'_+', '_', name)
    if is_object:
        is_std = name.lower() in STANDARD_OBJECTS
        if not is_std:
            if name.endswith("_c") and not name.endswith("__c"):
                name = name[:-2] + "__c"
            elif not name.endswith("__c"):
                name += "__c"
    else:
        standard_fields = {"id", "name", "createddate", "lastmodifieddate", "ownerid", "createdbyid", "lastmodifiedbyid"}
        if name.lower() not in standard_fields:
            if name.endswith("_c") and not name.endswith("__c"):
                name = name[:-2] + "__c"
            elif not name.endswith("__c"):
                name += "__c"
    return name

def sanitize_formula(formula: str) -> str:
    if not formula:
        return ""
    # Replace all case-insensitive _c with __c
    formula = re.sub(r'(?i)_c\b', '__c', formula)
    # Collapse 3 or more underscores
    formula = re.sub(r'_{3,}c\b', '__c', formula)
    return formula

def sanitize_schema_dict(schema: dict) -> dict:
    if not isinstance(schema, dict) or "objects" not in schema:
        return schema
    for obj in schema.get("objects", []):
        if "apiName" in obj:
            obj["apiName"] = sanitize_api_name(obj["apiName"], is_object=True)
        if "fields" in obj:
            for field in obj.get("fields", []):
                if "apiName" in field:
                    field["apiName"] = sanitize_api_name(field["apiName"], is_object=False)
        if "validationRules" in obj:
            for rule in obj.get("validationRules", []):
                if "formula" in rule:
                    rule["formula"] = sanitize_formula(rule["formula"])
    return schema
