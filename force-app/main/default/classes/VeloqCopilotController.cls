/**
 * @description Bridge between the veloqCopilot LWC and the FastAPI backend.
 *              Makes JSON HTTP callouts via Named Credential 'DevMind_API'.
 *              Centralizes error handling to parse raw html and error status codes cleanly.
 *
 * @author  Veloq Copilot
 * @version 1.0.1
 */
public with sharing class VeloqCopilotController {

    private static final String BASE_URL = 'callout:DevMind_API';
    private static final Integer TIMEOUT_MS = 120000;

    /**
     * @description Fetches user session ID from the SessionId Visualforce page to bypass LWC execution context limits.
     */
    private static String getSessionId() {
        if (Test.isRunningTest()) {
            return UserInfo.getSessionId();
        }
        PageReference vfPage = Page.SessionId;
        return vfPage.getContent().toString().trim();
    }

    /**
     * @description Retrieves the current Salesforce Org URL.
     */
    private static String getOrgUrl() {
        return URL.getOrgDomainUrl().toExternalForm();
    }

    /**
     * @description Centralized error handler that translates HTTP statuses and HTML payloads into friendly messages.
     */
    private static void handleResponseError(HttpResponse res, String context) {
        Integer statusCode = res.getStatusCode();
        String body = res.getBody();
        
        String friendlyMessage = context + ' error: ';
        
        if (statusCode == 502 || statusCode == 503) {
            friendlyMessage = 'Veloq backend is currently offline or unreachable. Please start your local FastAPI server and verify ngrok is running.';
        } else if (statusCode == 429) {
            friendlyMessage = 'Rate limit reached on backend LLM services. Please wait a few seconds and try again.';
        } else if (statusCode == 408 || statusCode == 504) {
            friendlyMessage = 'Request timed out. The server took too long to complete this operation.';
        } else {
            if (body != null && (body.trim().startsWith('<') || body.containsIgnoreCase('<!DOCTYPE') || body.containsIgnoreCase('<html'))) {
                friendlyMessage = 'Backend returned an HTML error page (HTTP ' + statusCode + '). The local FastAPI server might not be running or ngrok might be disconnected.';
            } else {
                friendlyMessage = 'HTTP ' + statusCode + ': ' + body;
            }
        }
        
        AuraHandledException ex = new AuraHandledException(friendlyMessage);
        ex.setMessage(friendlyMessage);
        throw ex;
    }

    /**
     * @description Lightweight server liveness check.
     */
    @AuraEnabled
    public static Boolean checkServerHealth() {
        try {
            HttpRequest req = new HttpRequest();
            req.setEndpoint(BASE_URL + '/api/health');
            req.setMethod('GET');
            req.setTimeout(5000);
            Http http = new Http();
            HttpResponse res = http.send(req);
            return (res.getStatusCode() == 200);
        } catch (Exception e) {
            return false;
        }
    }

    /**
     * @description Sends a conversational text prompt to the Copilot backend.
     */
    @AuraEnabled
    public static String sendCopilotMessage(String message, String recordId, String fileName, String fileBase64) {
        try {
            HttpRequest req = new HttpRequest();
            req.setEndpoint(BASE_URL + '/api/copilot/message');
            req.setMethod('POST');
            req.setHeader('Content-Type', 'application/json');
            req.setTimeout(TIMEOUT_MS);

            Map<String, Object> bodyMap = new Map<String, Object>{
                'message' => message,
                'session_id' => getSessionId(),
                'org_url' => getOrgUrl(),
                'running_user_id' => UserInfo.getUserId()
            };
            if (String.isNotBlank(recordId)) {
                bodyMap.put('record_id', recordId);
            }
            if (String.isNotBlank(fileName)) {
                bodyMap.put('file_name', fileName);
            }
            if (String.isNotBlank(fileBase64)) {
                bodyMap.put('file_content', fileBase64);
            }

            req.setBody(JSON.serialize(bodyMap));

            Http http = new Http();
            HttpResponse res = http.send(req);

            if (res.getStatusCode() == 200) {
                return res.getBody();
            } else {
                handleResponseError(res, 'Server');
                return null;
            }
        } catch (AuraHandledException e) {
            throw e;
        } catch (Exception e) {
            throw new AuraHandledException('Callout failed: ' + e.getMessage());
        }
    }

    /**
     * @description Polls the status of a background permissions agent job.
     *              Called by LWC every 3 seconds after receiving PERMISSIONS_LOADING.
     */
    @AuraEnabled
    public static String pollPermissionsStatus(String jobId) {
        try {
            HttpRequest req = new HttpRequest();
            req.setEndpoint(BASE_URL + '/api/permissions/status/' + jobId);
            req.setMethod('GET');
            req.setTimeout(10000);
            Http http = new Http();
            HttpResponse res = http.send(req);
            if (res.getStatusCode() == 200) {
                return res.getBody();
            } else {
                handleResponseError(res, 'Permissions poll');
                return null;
            }
        } catch (AuraHandledException e) {
            throw e;
        } catch (Exception e) {
            throw new AuraHandledException('Permissions poll failed: ' + e.getMessage());
        }
    }

    /**
     * @description Uploads base64 encoded CSV contents to retrieve fuzzy header mappings.
     */
    @AuraEnabled
    public static String getHeaderMappings(String base64File, String fileName, String objectName) {
        try {
            HttpRequest req = new HttpRequest();
            req.setEndpoint(BASE_URL + '/api/copilot/upload');
            req.setMethod('POST');
            req.setHeader('Content-Type', 'application/json');
            req.setTimeout(TIMEOUT_MS);

            Map<String, Object> bodyMap = new Map<String, Object>{
                'base64_file' => base64File,
                'file_name' => fileName,
                'object_name' => objectName,
                'session_id' => getSessionId(),
                'org_url' => getOrgUrl()
            };

            req.setBody(JSON.serialize(bodyMap));

            Http http = new Http();
            HttpResponse res = http.send(req);

            if (res.getStatusCode() == 200) {
                return res.getBody();
            } else {
                handleResponseError(res, 'Upload');
                return null;
            }
        } catch (AuraHandledException e) {
            throw e;
        } catch (Exception e) {
            throw new AuraHandledException('Callout failed: ' + e.getMessage());
        }
    }

    /**
     * @description Triggers the SObject Collections batch DML upload.
     */
    @AuraEnabled
    public static String executeDataImport(
        String mappingJson,
        String csvData,
        String objectName,
        String operation
    ) {
        try {
            HttpRequest req = new HttpRequest();
            req.setEndpoint(BASE_URL + '/api/copilot/execute-import');
            req.setMethod('POST');
            req.setHeader('Content-Type', 'application/json');
            req.setTimeout(TIMEOUT_MS);

            Map<String, Object> bodyMap = new Map<String, Object>{
                'mapping_json' => mappingJson,
                'csv_data' => csvData,
                'object_name' => objectName,
                'operation' => operation,
                'session_id' => getSessionId(),
                'org_url' => getOrgUrl()
            };

            req.setBody(JSON.serialize(bodyMap));

            Http http = new Http();
            HttpResponse res = http.send(req);

            if (res.getStatusCode() == 200) {
                return res.getBody();
            } else {
                handleResponseError(res, 'DML execution');
                return null;
            }
        } catch (AuraHandledException e) {
            throw e;
        } catch (Exception e) {
            throw new AuraHandledException('Callout failed: ' + e.getMessage());
        }
    }

    public class ObjectCheckResult {
        @AuraEnabled public Boolean exists;
        @AuraEnabled public List<String> existingFields;
        @AuraEnabled public List<String> existingRules;
    }

    @AuraEnabled
    public static ObjectCheckResult checkObjectExists(String objectApiName) {
        ObjectCheckResult res = new ObjectCheckResult();
        res.existingFields = new List<String>();
        res.existingRules = new List<String>();
        
        if (String.isBlank(objectApiName)) {
            res.exists = false;
            return res;
        }
        
        res.exists = Schema.getGlobalDescribe().containsKey(objectApiName.toLowerCase());
        
        if (res.exists) {
            // 1. Describe and get existing fields
            try {
                Schema.DescribeSObjectResult describe = Schema.getGlobalDescribe().get(objectApiName).getDescribe();
                for (String fieldName : describe.fields.getMap().keySet()) {
                    res.existingFields.add(fieldName.toLowerCase());
                }
            } catch (Exception e) {
                System.debug('Failed to describe sObject fields: ' + e.getMessage());
            }
            
            // 2. Query existing validation rules via Tooling API REST Callout
            try {
                String devName = objectApiName;
                if (devName.endsWith('__c')) {
                    devName = devName.substring(0, devName.length() - 3);
                }
                
                String query = 'SELECT ValidationName FROM ValidationRule WHERE EntityDefinition.DeveloperName = \'' + devName + '\'';
                HttpRequest req = new HttpRequest();
                req.setEndpoint(Url.getOrgDomainUrl().toExternalForm() + '/services/data/v59.0/tooling/query/?q=' + EncodingUtil.urlEncode(query, 'UTF-8'));
                req.setMethod('GET');
                req.setHeader('Authorization', 'Bearer ' + getSessionId());
                req.setHeader('Content-Type', 'application/json');
                
                Http http = new Http();
                HttpResponse httpRes = http.send(req);
                if (httpRes.getStatusCode() == 200) {
                    Map<String, Object> queryResult = (Map<String, Object>) JSON.deserializeUntyped(httpRes.getBody());
                    List<Object> records = (List<Object>) queryResult.get('records');
                    if (records != null) {
                        for (Object recRaw : records) {
                            Map<String, Object> rec = (Map<String, Object>) recRaw;
                            String ruleName = (String) rec.get('ValidationName');
                            if (String.isNotBlank(ruleName)) {
                                res.existingRules.add(ruleName.toLowerCase());
                            }
                        }
                    }
                }
            } catch (Exception e) {
                System.debug('Failed to query validation rules: ' + e.getMessage());
            }
        }
        
        return res;
    }

    @AuraEnabled
    public static String deployMetadataSchema(String schemaJson) {
        try {
            Map<String, Object> schema = (Map<String, Object>) JSON.deserializeUntyped(schemaJson);
            MetadataDeployService.DeployResult deployRes = MetadataDeployService.deploySchema(schema);
            return JSON.serialize(deployRes);
        } catch (Exception e) {
            throw new AuraHandledException('Deployment failed: ' + e.getMessage());
        }
    }

    @AuraEnabled
    public static String checkValidationFormula(String objectApiName, String formula, String fieldsJson) {
        try {
            HttpRequest req = new HttpRequest();
            req.setEndpoint('callout:DevMind_API/api/copilot/check-syntax');
            req.setMethod('POST');
            req.setHeader('Content-Type', 'application/json');
            
            Map<String, Object> body = new Map<String, Object>();
            body.put('object_name', objectApiName);
            body.put('formula', formula);
            body.put('fields_json', fieldsJson);
            req.setBody(JSON.serialize(body));
            
            Http http = new Http();
            HttpResponse res = http.send(req);
            if (res.getStatusCode() == 200) {
                return res.getBody();
            } else {
                throw new CalloutException('Status: ' + res.getStatus() + ', Body: ' + res.getBody());
            }
        } catch (Exception e) {
            throw new AuraHandledException('Callout failed: ' + e.getMessage());
        }
    }

    /**
     * @description Dynamically retrieves all custom objects and key standard objects for the search dropdown.
     */
    @AuraEnabled(cacheable=true)
    public static List<Map<String, String>> getTargetObjects() {
        List<Map<String, String>> results = new List<Map<String, String>>();
        Set<String> standardNames = new Set<String>{
            'lead', 'account', 'contact', 'opportunity', 'case', 'campaign', 'user', 'product2'
        };
        
        for (String name : Schema.getGlobalDescribe().keySet()) {
            Boolean isCustomObj = name.endsWith('__c');
            Boolean isStandardObj = standardNames.contains(name);
            
            if (isCustomObj || isStandardObj) {
                try {
                    Schema.DescribeSObjectResult d = Schema.getGlobalDescribe().get(name).getDescribe();
                    if (d.isCreateable() && d.isQueryable()) {
                        Map<String, String> objInfo = new Map<String, String>();
                        objInfo.put('label', d.getLabel());
                        objInfo.put('value', d.getName());
                        results.add(objInfo);
                    }
                } catch (Exception e) {
                    // skip objects that running user cannot access or describe
                }
            }
        }
        return results;
    }
}
