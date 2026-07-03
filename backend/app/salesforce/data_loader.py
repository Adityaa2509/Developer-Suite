import csv
import io
import base64
import difflib
from typing import List, Dict, Any, Optional
from simple_salesforce import Salesforce
from app.core.logger import get_logger

logger = get_logger(__name__)

def friendly_error_message(errors: list) -> str:
    if not errors:
        return "Unknown DML error occurred."
    
    friendly_msgs = []
    for err in errors:
        status_code = err.get("statusCode", "")
        message = err.get("message", "")
        fields = err.get("fields", [])
        fields_str = f" for field(s): {', '.join(fields)}" if fields else ""

        if status_code == "DUPLICATES_DETECTED":
            friendly_msgs.append("Duplicate record detected. A record with matching details already exists in your Salesforce org.")
        elif status_code == "REQUIRED_FIELD_MISSING":
            friendly_msgs.append(f"Missing required field{fields_str}. Please ensure this column is mapped and populated in your CSV.")
        elif status_code == "FIELD_CUSTOM_VALIDATION_EXCEPTION":
            friendly_msgs.append(f"Validation Rule Failed: {message}")
        elif status_code == "INVALID_EMAIL_ADDRESS":
            friendly_msgs.append(f"Invalid email address format{fields_str}.")
        elif status_code == "STRING_TOO_LONG":
            friendly_msgs.append(f"Text is too long{fields_str}. {message}")
        elif status_code == "INVALID_OR_NULL_FOR_RESTRICTED_PICKLIST":
            friendly_msgs.append(f"Invalid choice{fields_str}. The value is not a valid option in the restricted picklist.")
        else:
            prefix = f"[{status_code}] " if status_code else ""
            friendly_msgs.append(f"{prefix}{message}")
            
    return "; ".join(friendly_msgs)

def get_sobject_fields(org_url: str, session_id: str, object_name: str) -> List[Dict[str, Any]]:
    """
    Connects to Salesforce and retrieves the metadata describe details for a given SObject.
    Returns field definitions including label, apiName, type, and required fields.
    """
    try:
        sf = Salesforce(instance_url=org_url, session_id=session_id)
        desc = getattr(sf, object_name).describe()
        fields_info = []
        for f in desc.get("fields", []):
            # A field is required for create if it is createable, not nillable,
            # not defaultOnCreate, and not autoNumber.
            is_required = (
                f.get("createable", False) and 
                not f.get("nillable", True) and 
                not f.get("defaultOnCreate", False) and
                f.get("type") != "id"
            )
            fields_info.append({
                "label": f.get("label"),
                "apiName": f.get("name"),
                "type": f.get("type"),
                "required": is_required,
                "updateable": f.get("updateable", True),
                "createable": f.get("createable", True)
            })
        return fields_info
    except Exception as e:
        logger.error(f"Error fetching fields for {object_name}: {e}")
        raise ValueError(f"Failed to fetch fields for Salesforce object '{object_name}': {e}")


def map_headers(headers: List[str], fields: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Fuzzy matches CSV headers to Salesforce field API names or labels.
    Uses Python's difflib to identify candidate matches.
    """
    mappings = []
    
    # Pre-process field names for matching
    field_names = [f["apiName"] for f in fields]
    field_labels = [f["label"] for f in fields]
    
    for header in headers:
        clean_header = header.strip().lower().replace(" ", "").replace("_", "").replace("-", "")
        best_match = None
        highest_score = 0.0
        
        # 1. Exact match check
        for field in fields:
            api_name = field["apiName"].lower()
            label = field["label"].lower()
            clean_api = api_name.replace("__c", "").replace("_", "")
            clean_label = label.replace(" ", "")
            
            if clean_header == clean_api or clean_header == clean_label:
                best_match = field["apiName"]
                highest_score = 1.0
                break
        
        # 2. Fuzzy match check if no exact match
        if highest_score < 1.0:
            for field in fields:
                # Compare similarity ratio on API Name and Label
                score_api = difflib.SequenceMatcher(None, clean_header, field["apiName"].lower().replace("__c", "")).ratio()
                score_label = difflib.SequenceMatcher(None, clean_header, field["label"].lower()).ratio()
                max_score = max(score_api, score_label)
                if max_score > highest_score and max_score > 0.6:  # Threshold of 60%
                    highest_score = max_score
                    best_match = field["apiName"]
                    
        mappings.append({
            "header": header,
            "selectedField": best_match or "",
            "confidence": round(highest_score * 100, 1)
        })
        
    return mappings


def parse_csv_data(csv_text: str) -> List[Dict[str, str]]:
    """
    Parses raw CSV string text into list of row dictionaries.
    """
    f = io.StringIO(csv_text.strip())
    reader = csv.DictReader(f)
    rows = []
    for row in reader:
        rows.append({k: (v or "").strip() for k, v in row.items() if k is not None})
    return rows


def parse_and_format_date(val: str, to_type: str) -> str:
    """
    Attempts to parse date/datetime values from CSV and format them into
    Salesforce-compliant ISO strings: YYYY-MM-DD or YYYY-MM-DDTHH:MM:SSZ.
    """
    if not val:
        return val
    
    val_clean = val.strip()
    if not val_clean:
        return val_clean
        
    from datetime import datetime
    
    # Common Date / DateTime formats
    formats = [
        "%Y-%m-%d %H:%M:%S",
        "%Y-%m-%dT%H:%M:%S",
        "%Y-%m-%dT%H:%M:%S.%fZ",
        "%Y-%m-%dT%H:%M:%SZ",
        "%m/%d/%Y %H:%M:%S",
        "%d/%m/%Y %H:%M:%S",
        "%m/%d/%Y %I:%M:%S %p",
        "%m/%d/%Y %I:%M %p",
        "%Y/%m/%d %H:%M:%S",
        "%m/%d/%Y %H:%M",
        "%d/%m/%Y %H:%M",
        "%Y/%m/%d %H:%M",
        "%m/%d/%y %H:%M",
        "%d/%m/%y %H:%M",
        "%Y/%m/%d %H:%M",
        "%Y-%m-%d",
        "%m/%d/%Y",
        "%d/%m/%Y",
        "%Y/%m/%d",
        "%d-%m-%Y",
        "%m-%d-%Y",
        "%m/%d/%y",
        "%d/%m/%y"
    ]
    
    parsed_dt = None
    for fmt in formats:
        try:
            parsed_dt = datetime.strptime(val_clean, fmt)
            break
        except ValueError:
            continue
            
    if parsed_dt is None:
        return val
        
    if to_type.lower() == 'date':
        return parsed_dt.strftime("%Y-%m-%d")
    elif to_type.lower() == 'datetime':
        return parsed_dt.strftime("%Y-%m-%dT%H:%M:%SZ")
        
    return val


def execute_sobject_collection_dml(
    org_url: str,
    session_id: str,
    object_name: str,
    operation: str,  # 'insert' | 'update' | 'delete'
    mappings: Dict[str, str],  # CSV Header -> Salesforce API Name
    rows: List[Dict[str, str]]
) -> Dict[str, Any]:
    """
    Executes composite DML collections on Salesforce.
    Batches records in chunks of 200 to satisfy Composite SObject Collections limits.
    """
    sf = Salesforce(instance_url=org_url, session_id=session_id)
    
    # Fetch field metadata for automated date/datetime parsing mapping
    field_type_map = {}
    try:
        fields = get_sobject_fields(org_url, session_id, object_name)
        field_type_map = {f["apiName"].lower(): f["type"] for f in fields}
    except Exception as e:
        logger.error(f"Error fetching fields for type mapping: {e}")

    # 1. Prepare record payloads
    records_payload = []
    
    for idx, row in enumerate(rows):
        rec = {}
        # For delete, we only care about the Id
        if operation == 'delete':
            # Check if there's an 'Id' field mapped, or try to get 'Id' header
            id_val = ""
            for header, field_api in mappings.items():
                if field_api == 'Id' or field_api.lower() == 'id':
                    id_val = row.get(header, "")
                    break
            if not id_val:
                # fallback: try header literally named Id or ID or id
                for h in row.keys():
                    if h.lower() == 'id':
                        id_val = row[h]
                        break
            if id_val:
                records_payload.append(id_val)
            continue
            
        # For insert / update
        rec["attributes"] = {"type": object_name}
        for header, field_api in mappings.items():
            if not field_api:  # Skip ignored fields
                continue
            val = row.get(header)
            if val is not None:
                # Automate date and datetime conversions
                f_type = field_type_map.get(field_api.lower(), "")
                if f_type in ("date", "datetime"):
                    val = parse_and_format_date(val, f_type)
                elif not f_type:
                    # Fallback: identify by API name keywords if field is not yet in describe results
                    api_lower = field_api.lower()
                    if "datetime" in api_lower or "time" in api_lower:
                        val = parse_and_format_date(val, "datetime")
                    elif "date" in api_lower:
                        val = parse_and_format_date(val, "date")
                rec[field_api] = val
        
        # Track original row index to map error logs
        rec["_rowIndex"] = idx + 2  # CSV rows are 1-indexed (header is row 1)
        records_payload.append(rec)

    # 2. Batch and Execute DML in chunks of 200
    chunk_size = 200
    success_count = 0
    failure_count = 0
    errors_summary = []
    
    logger.info(f"Executing {operation} on {object_name} for {len(records_payload)} records in chunks of {chunk_size}")

    if operation == 'delete':
        # Delete expects list of IDs
        for i in range(0, len(records_payload), chunk_size):
            chunk = records_payload[i:i + chunk_size]
            ids_str = ",".join(chunk)
            try:
                # Call DELETE composite endpoint: /services/data/vXX.X/composite/sobjects?ids=...&allOrNone=false
                res = sf.restful(f"composite/sobjects?ids={ids_str}&allOrNone=false", method="DELETE")
                for idx, r in enumerate(res):
                    if r.get("success", False):
                        success_count += 1
                    else:
                        failure_count += 1
                        errs = r.get("errors", [])
                        msg = friendly_error_message(errs)
                        errors_summary.append({
                            "row": i + idx + 2,
                            "id": chunk[idx],
                            "message": msg
                        })
            except Exception as e:
                logger.error(f"Error executing delete collection: {e}")
                for idx, record_id in enumerate(chunk):
                    failure_count += 1
                    errors_summary.append({
                        "row": i + idx + 2,
                        "id": record_id,
                        "message": str(e)
                    })
    else:
        # Insert / Update
        method = "POST" if operation == "insert" else "PATCH"
        
        for i in range(0, len(records_payload), chunk_size):
            chunk = records_payload[i:i + chunk_size]
            
            # Remove helper _rowIndex from actual REST payload
            api_payload = []
            row_indices = []
            for item in chunk:
                row_indices.append(item.get("_rowIndex"))
                cleaned_item = {k: v for k, v in item.items() if k != "_rowIndex"}
                api_payload.append(cleaned_item)
                
            body = {
                "allOrNone": False,
                "records": api_payload
            }
            
            try:
                res = sf.restful("composite/sobjects", method=method, json=body)
                for idx, r in enumerate(res):
                    orig_row = row_indices[idx]
                    if r.get("success", False):
                        success_count += 1
                    else:
                        failure_count += 1
                        errs = r.get("errors", [])
                        msg = friendly_error_message(errs)
                        errors_summary.append({
                            "row": orig_row,
                            "message": msg
                        })
            except Exception as e:
                logger.error(f"Error executing composite DML chunk: {e}")
                for idx, item in enumerate(chunk):
                    failure_count += 1
                    errors_summary.append({
                        "row": row_indices[idx],
                        "message": str(e)
                    })

    return {
        "success": True,
        "operation": operation,
        "totalRecords": len(rows),
        "successCount": success_count,
        "failureCount": failure_count,
        "errors": errors_summary
    }
