from simple_salesforce import Salesforce
from app.core.logger import get_logger

logger = get_logger(__name__)

def deploy_schema_to_sf(org_url: str, session_id: str, schema: dict) -> dict:
    """
    Deploys custom objects and fields to Salesforce using the Tooling REST API.
    Handles mapping simplified schema JSON to formal Salesforce tooling payloads.
    """
    sf = Salesforce(instance_url=org_url, session_id=session_id)
    
    created_items = []
    errors = []
    
    objects = schema.get("objects", [])
    for obj_def in objects:
        label = obj_def.get("label")
        api_name = obj_def.get("apiName")
        desc = obj_def.get("description", "")
        
        if not api_name:
            continue
            
        # Ensure __c suffix
        if api_name.endswith("_c") and not api_name.endswith("__c"):
            api_name = api_name[:-2] + "__c"
        elif not api_name.endswith("__c"):
            api_name += "__c"
            
        # 1. Create Custom Object
        obj_payload = {
            "FullName": api_name,
            "Metadata": {
                "label": label,
                "pluralLabel": label + "s" if not label.endswith("s") else label,
                "deploymentStatus": "Deployed",
                "sharingModel": "ReadWrite",
                "nameField": {
                    "type": "AutoNumber",
                    "label": f"{label} Number",
                    "displayFormat": f"{label[:3].upper()}-{{00000}}"
                },
                "description": desc
            }
        }
        
        try:
            logger.info(f"Creating Custom Object {api_name} via Tooling API...")
            sf.restful("tooling/sobjects/CustomObject", method="POST", json=obj_payload)
            created_items.append(f"Custom Object: {api_name}")
        except Exception as e:
            err_str = str(e)
            if "already in use" in err_str or "duplicate" in err_str or "already exists" in err_str:
                logger.info(f"Custom Object {api_name} already exists. Skipping creation.")
                created_items.append(f"Custom Object: {api_name} (Existing)")
            else:
                logger.error(f"Error creating custom object {api_name}: {e}")
                errors.append(f"Object {api_name}: {e}")
                continue # skip fields if object creation failed completely
                
        # 2. Create Custom Fields
        fields = obj_def.get("fields", [])
        for f in fields:
            f_label = f.get("label")
            f_api_name = f.get("apiName")
            f_type = f.get("type", "Text")
            f_required = f.get("required", False)
            f_picklist = f.get("picklistValues", [])
            
            if not f_api_name:
                continue
                
            if not f_api_name.endswith("__c"):
                f_api_name += "__c"
                
            # Salesforce metadata type validation
            sf_type = f_type
            if sf_type == "Text":
                sf_type = "Text"
            elif sf_type == "Number":
                sf_type = "Number"
            elif sf_type == "Date":
                sf_type = "Date"
            elif sf_type == "Checkbox":
                sf_type = "Checkbox"
            elif sf_type == "Picklist":
                sf_type = "Picklist"
            elif sf_type == "Email":
                sf_type = "Email"
            elif sf_type == "Phone":
                sf_type = "Phone"
            
            field_metadata = {
                "label": f_label,
                "type": sf_type,
                "required": f_required
            }
            
            # Type specific configurations
            if sf_type == "Text":
                field_metadata["length"] = f.get("length", 255)
            elif sf_type == "Number":
                field_metadata["precision"] = 18
                field_metadata["scale"] = 0
            elif sf_type == "Checkbox":
                field_metadata["defaultValue"] = "false"
            elif sf_type == "Picklist":
                value_options = [{"fullName": val, "label": val, "default": idx == 0} for idx, val in enumerate(f_picklist)]
                field_metadata["valueSet"] = {
                    "valueSetDefinition": {
                        "sorted": False,
                        "valueOption": value_options
                    }
                }
                
            field_payload = {
                "FullName": f"{api_name}.{f_api_name}",
                "Metadata": field_metadata
            }
            
            try:
                logger.info(f"Creating Custom Field {api_name}.{f_api_name} via Tooling API...")
                sf.restful("tooling/sobjects/CustomField", method="POST", json=field_payload)
                created_items.append(f"Custom Field: {api_name}.{f_api_name}")
            except Exception as e:
                err_str = str(e)
                if "already in use" in err_str or "duplicate" in err_str or "already exists" in err_str:
                    logger.info(f"Field {api_name}.{f_api_name} already exists. Skipping.")
                else:
                    logger.error(f"Error creating custom field {f_api_name}: {e}")
                    errors.append(f"Field {f_api_name}: {e}")

    return {
        "success": len(errors) == 0,
        "message": "Metadata deployment complete." if len(errors) == 0 else f"Completed with errors.",
        "created": created_items,
        "errors": errors
    }
