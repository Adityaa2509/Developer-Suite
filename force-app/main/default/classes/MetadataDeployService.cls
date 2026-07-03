public with sharing class MetadataDeployService {

    public class DeployResult {
        @AuraEnabled public Boolean success;
        @AuraEnabled public String message;
        @AuraEnabled public List<String> created;
        @AuraEnabled public List<String> alreadyPresent;
        @AuraEnabled public List<String> errors;
    }

    private static final String BASE_URL = URL.getOrgDomainUrl().toExternalForm();
    private static final String METADATA_ENDPOINT = BASE_URL + '/services/Soap/m/59.0';

    private static String getSessionId() {
        PageReference vfPage = Page.SessionId;
        String body = Test.isRunningTest() ? UserInfo.getSessionId() : vfPage.getContent().toString();
        return body.trim();
    }

    public static DeployResult deploySchema(Map<String, Object> schemaMap) {
        DeployResult result = new DeployResult();
        result.created = new List<String>();
        result.alreadyPresent = new List<String>();
        result.errors = new List<String>();

        List<Object> objects = (List<Object>) schemaMap.get('objects');
        if (objects == null || objects.isEmpty()) {
            result.success = false;
            result.message = 'No objects found in schema';
            return result;
        }

        String sessionId = getSessionId();

        for (Object objRaw : objects) {
            Map<String, Object> obj = (Map<String, Object>) objRaw;
            String objApiName = (String) obj.get('apiName');
            Boolean isStandardObj = false;
            if (String.isNotBlank(objApiName)) {
                objApiName = objApiName.replaceAll('[^a-zA-Z0-9_]', '');
                Schema.SObjectType sObjType = Schema.getGlobalDescribe().get(objApiName);
                if (sObjType != null) {
                    isStandardObj = !sObjType.getDescribe().isCustom();
                }
                
                if (!isStandardObj) {
                    if (objApiName.endsWith('_c') && !objApiName.endsWith('__c')) {
                        objApiName = objApiName.substring(0, objApiName.length() - 2) + '__c';
                    } else if (!objApiName.endsWith('__c')) {
                        objApiName += '__c';
                    }
                }
            }
            String objLabel = (String) obj.get('label');
            String description = (String) obj.get('description');

            if (isStandardObj) {
                result.alreadyPresent.add('Object: ' + objApiName);
            } else {
                String objError = createCustomObject(sessionId, objApiName, objLabel, description);
                if (objError != null) {
                    Boolean isExisting = objError.containsIgnoreCase('already in use')
                        || objError.containsIgnoreCase('already exists')
                        || objError.containsIgnoreCase('duplicate')
                        || objError.containsIgnoreCase('in use');
                    if (isExisting) {
                        result.alreadyPresent.add('Object: ' + objApiName);
                    } else {
                        result.errors.add('Object ' + objApiName + ': ' + objError);
                        continue;
                    }
                } else {
                    result.created.add('Object: ' + objApiName);
                }
            }

            List<Object> fields = (List<Object>) obj.get('fields');
            if (fields != null) {
                for (Object fieldRaw : fields) {
                    Map<String, Object> field = (Map<String, Object>) fieldRaw;
                    String fieldError = createCustomField(sessionId, objApiName, field);
                    if (fieldError != null) {
                        Boolean isExisting = fieldError.containsIgnoreCase('already in use') 
                            || fieldError.containsIgnoreCase('already exists') 
                            || fieldError.containsIgnoreCase('duplicate')
                            || fieldError.containsIgnoreCase('already a field named');
                        if (isExisting) {
                            result.alreadyPresent.add('Field: ' + objApiName + '.' + field.get('apiName'));
                        } else {
                            result.errors.add('Field ' + field.get('apiName') + ': ' + fieldError);
                        }
                    } else {
                        result.created.add('Field: ' + objApiName + '.' + field.get('apiName'));
                    }
                }
            }

            List<Object> validations = (List<Object>) obj.get('validationRules');
            if (validations != null) {
                for (Object valRaw : validations) {
                    Map<String, Object> val = (Map<String, Object>) valRaw;
                    String valError = createValidationRule(sessionId, objApiName, val);
                    if (valError != null) {
                        Boolean isExisting = valError.containsIgnoreCase('already in use') 
                            || valError.containsIgnoreCase('already exists') 
                            || valError.containsIgnoreCase('duplicate')
                            || valError.containsIgnoreCase('already a validation rule named');
                        if (isExisting) {
                            result.alreadyPresent.add('Validation: ' + val.get('name'));
                        } else {
                            result.errors.add('Validation ' + val.get('name') + ': ' + valError);
                        }
                    } else {
                        result.created.add('Validation: ' + val.get('name'));
                    }
                }
            }
        }

        result.success = result.errors.isEmpty();
        result.message = result.success
            ? 'Successfully processed components'
            : 'Completed with ' + result.errors.size() + ' error(s)';
        return result;
    }

    private static String createCustomObject(String sessionId, String apiName, String label, String description) {
        String metadata =
            '<met:metadata xsi:type="met:CustomObject">' +
                '<met:fullName>' + apiName + '</met:fullName>' +
                '<met:label>' + escapeXml(label) + '</met:label>' +
                '<met:pluralLabel>' + escapeXml(label) + 's</met:pluralLabel>' +
                '<met:nameField><met:label>Name</met:label><met:type>Text</met:type></met:nameField>' +
                '<met:deploymentStatus>Deployed</met:deploymentStatus>' +
                '<met:sharingModel>ReadWrite</met:sharingModel>' +
                (description != null ? '<met:description>' + escapeXml(description) + '</met:description>' : '') +
            '</met:metadata>';
        return callMetadataSoap(sessionId, metadata);
    }

    private static String createCustomField(String sessionId, String objApiName, Map<String, Object> field) {
        String fieldType = (String) field.get('type');
        String ft = fieldType.toLowerCase().trim();
        
        String fieldApiName = (String) field.get('apiName');
        if (String.isNotBlank(fieldApiName)) {
            fieldApiName = fieldApiName.replaceAll('[^a-zA-Z0-9_]', '');
            if (!fieldApiName.endsWith('__c')) {
                fieldApiName += '__c';
            }
        }
        
        String fullName = objApiName + '.' + fieldApiName;
        String label = escapeXml((String) field.get('label'));
        Boolean required = field.get('required') == true;
        String extra = '';

        if (ft.startsWith('lookup(') || ft == 'lookup' || ft.startsWith('master')) {
            String refObj = 'Account';
            if (ft.contains('(')) refObj = fieldType.substringBetween('(', ')');
            fieldType = 'Lookup';
            extra = '<met:referenceTo>' + refObj + '</met:referenceTo>' +
                    '<met:relationshipName>' + fieldApiName.removeEnd('__c') + '</met:relationshipName>';
            required = false;
        } else if (ft.startsWith('formula')) {
            if (ft.contains('number') || ft.contains('currency') || ft.contains('percent')) {
                fieldType = 'Number'; extra = '<met:precision>18</met:precision><met:scale>2</met:scale>';
            } else if (ft.contains('date') && ft.contains('time')) { fieldType = 'DateTime';
            } else if (ft.contains('date')) { fieldType = 'Date';
            } else { fieldType = 'Number'; extra = '<met:precision>18</met:precision><met:scale>2</met:scale>'; }
            required = false;
        } else if (ft == 'text') {
            Integer len = field.get('length') != null ? Integer.valueOf(String.valueOf(field.get('length'))) : 255;
            extra = '<met:length>' + len + '</met:length>';
        } else if (ft == 'number') { extra = '<met:precision>18</met:precision><met:scale>2</met:scale>';
        } else if (ft == 'currency') { extra = '<met:precision>18</met:precision><met:scale>2</met:scale>';
        } else if (ft == 'percent') { fieldType = 'Percent'; extra = '<met:precision>18</met:precision><met:scale>2</met:scale>';
        } else if (ft == 'checkbox') {
            String defVal = field.get('defaultValue') == true || String.valueOf(field.get('defaultValue')) == 'true' ? 'true' : 'false';
            extra = '<met:defaultValue>' + defVal + '</met:defaultValue>'; required = false;
        } else if (ft == 'longtextarea' || ft == 'textarea' || ft == 'long text area') {
            fieldType = 'LongTextArea'; extra = '<met:length>32768</met:length><met:visibleLines>5</met:visibleLines>';
        } else if (ft == 'richtextarea' || ft == 'richtext' || ft == 'rich text' || ft == 'html') {
            fieldType = 'Html'; extra = '<met:length>32768</met:length><met:visibleLines>5</met:visibleLines>';
        } else if (ft == 'picklist') { extra = buildPicklistXml(field);
        } else if (ft == 'multiselectpicklist' || ft == 'multiselect picklist' || ft == 'multi-select picklist') {
            fieldType = 'MultiselectPicklist'; extra = '<met:visibleLines>4</met:visibleLines>' + buildPicklistXml(field);
        } else if (ft == 'date') { fieldType = 'Date';
        } else if (ft == 'datetime' || ft == 'date/time') { fieldType = 'DateTime';
        } else if (ft == 'email') { fieldType = 'Email';
        } else if (ft == 'phone') { fieldType = 'Phone';
        } else if (ft == 'url') { fieldType = 'Url';
        } else if (ft == 'autonumber' || ft == 'auto number') {
            fieldType = 'AutoNumber'; extra = '<met:displayFormat>AN-{0000}</met:displayFormat><met:startingNumber>1</met:startingNumber>'; required = false;
        } else { fieldType = 'Text'; extra = '<met:length>255</met:length>'; }

        String metadata =
            '<met:metadata xsi:type="met:CustomField">' +
                '<met:fullName>' + fullName + '</met:fullName>' +
                '<met:label>' + label + '</met:label>' +
                '<met:type>' + fieldType + '</met:type>' +
                (required ? '<met:required>true</met:required>' : '') +
                extra +
            '</met:metadata>';
        return callMetadataSoap(sessionId, metadata);
    }

    private static String buildPicklistXml(Map<String, Object> field) {
        List<Object> vals = (List<Object>) field.get('picklistValues');
        String pickXml = '';
        if (vals != null) {
            for (Object v : vals) {
                pickXml += '<met:value><met:fullName>' + escapeXml(String.valueOf(v)) + '</met:fullName><met:default>false</met:default></met:value>';
            }
        }
        if (String.isBlank(pickXml)) pickXml = '<met:value><met:fullName>Other</met:fullName><met:default>false</met:default></met:value>';
        return '<met:valueSet><met:valueSetDefinition><met:sorted>false</met:sorted>' + pickXml + '</met:valueSetDefinition></met:valueSet>';
    }

    private static String createValidationRule(String sessionId, String objApiName, Map<String, Object> val) {
        String valName = (String) val.get('name');
        if (String.isNotBlank(valName)) {
            valName = valName.replaceAll('[^a-zA-Z0-9]', '_');
            valName = valName.replaceAll('_+', '_');
            valName = valName.removeStart('_').removeEnd('_');
            if (String.isBlank(valName)) {
                valName = 'Rule_' + DateTime.now().getTime();
            } else if (!Pattern.matches('^[a-zA-Z].*$', valName)) {
                valName = 'Rule_' + valName;
            }
        } else {
            valName = 'Rule_' + DateTime.now().getTime();
        }

        String formula = (String) val.get('formula');
        if (String.isNotBlank(formula)) {
            formula = formula.replaceAll('(?i)_c\\b', '__c');
            formula = formula.replaceAll('_{3,}c\\b', '__c');
        }

        String metadata =
            '<met:metadata xsi:type="met:ValidationRule">' +
                '<met:fullName>' + objApiName + '.' + valName + '</met:fullName>' +
                '<met:active>true</met:active>' +
                '<met:errorConditionFormula>' + escapeXml(formula) + '</met:errorConditionFormula>' +
                '<met:errorMessage>' + escapeXml((String) val.get('errorMessage')) + '</met:errorMessage>' +
            '</met:metadata>';
        return callMetadataSoap(sessionId, metadata);
    }

    private static String callMetadataSoap(String sessionId, String metadataXml) {
        String soapBody =
            '<?xml version="1.0" encoding="UTF-8"?>' +
            '<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" ' +
                'xmlns:met="http://soap.sforce.com/2006/04/metadata" ' +
                'xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">' +
                '<soapenv:Header>' +
                    '<met:CallOptions><met:client>MetadataDeploy</met:client></met:CallOptions>' +
                    '<met:SessionHeader><met:sessionId>' + sessionId + '</met:sessionId></met:SessionHeader>' +
                '</soapenv:Header>' +
                '<soapenv:Body>' +
                    '<met:createMetadata>' + metadataXml + '</met:createMetadata>' +
                '</soapenv:Body>' +
            '</soapenv:Envelope>';

        HttpRequest req = new HttpRequest();
        req.setEndpoint(METADATA_ENDPOINT);
        req.setMethod('POST');
        req.setHeader('Content-Type', 'text/xml');
        req.setHeader('SOAPAction', '""');
        req.setBody(soapBody);
        req.setTimeout(30000);

        HttpResponse res = new Http().send(req);
        String body = res.getBody();
        if (body.contains('<success>true</success>')) return null;

        String errMsg = extractXmlValue(body, 'message');
        if (String.isBlank(errMsg)) errMsg = extractXmlValue(body, 'faultstring');
        if (String.isBlank(errMsg)) errMsg = body.left(300);
        return errMsg;
    }

    private static String extractXmlValue(String xml, String tag) {
        Integer startIdx = xml.indexOf('<' + tag + '>');
        Integer endIdx = xml.indexOf('</' + tag + '>');
        if (startIdx >= 0 && endIdx > startIdx) return xml.substring(startIdx + tag.length() + 2, endIdx);
        return null;
    }

    private static String escapeXml(String val) {
        if (val == null) return '';
        return val.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;').replace('"', '&quot;').replace('\'', '&apos;');
    }
}
