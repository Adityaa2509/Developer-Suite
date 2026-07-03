public with sharing class GeminiDocParserService {

    private static final String GEMINI_ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';

    public static Map<String, Object> parseDocument(String base64Content, String fileName, String promptText) {
        String apiKey = getApiKey();

        String systemPrompt = 'You are a Salesforce architect. Analyze the input and extract all data entities, their fields, and any business rules or validations mentioned. ' +
            'Return ONLY a raw valid JSON object, no markdown, no code blocks, no explanation. Use this exact format:\n' +
            '{"objects":[{"label":"ObjectLabel","apiName":"ObjectLabel__c","description":"...","fields":[' +
            '{"label":"FieldLabel","apiName":"FieldLabel__c","type":"Text","length":255,"required":false,"picklistValues":[]}],' +
            '"validationRules":[{"name":"RuleName","errorMessage":"Error message","formula":"ISBLANK(Field__c)"}]}]}';

        List<Object> parts = new List<Object>{ new Map<String, Object>{ 'text' => systemPrompt } };

        if (String.isNotBlank(base64Content) && String.isNotBlank(fileName)) {
            String mimeType = getMimeType(fileName);
            parts.add(new Map<String, Object>{
                'inline_data' => new Map<String, Object>{
                    'mime_type' => mimeType,
                    'data' => base64Content
                }
            });
        } else if (String.isNotBlank(promptText)) {
            parts.add(new Map<String, Object>{ 'text' => 'Requirements:\n' + promptText });
        } else {
            AuraHandledException ex = new AuraHandledException('Please provide a file or a prompt.');
            ex.setMessage('Please provide a file or a prompt.');
            throw ex;
        }

        Map<String, Object> requestBody = new Map<String, Object>{
            'contents' => new List<Object>{
                new Map<String, Object>{ 'parts' => parts }
            },
            'generationConfig' => new Map<String, Object>{
                'temperature' => 0.1
            }
        };

        HttpRequest req = new HttpRequest();
        req.setEndpoint(GEMINI_ENDPOINT + '?key=' + apiKey);
        req.setMethod('POST');
        req.setHeader('Content-Type', 'application/json');
        req.setBody(JSON.serialize(requestBody));
        req.setTimeout(120000);

        HttpResponse res = new Http().send(req);
        if (res.getStatusCode() != 200) {
            String cleanMsg = 'Error ' + res.getStatusCode();
            try {
                Map<String, Object> errBody = (Map<String, Object>) JSON.deserializeUntyped(res.getBody());
                Map<String, Object> errDetails = (Map<String, Object>) errBody.get('error');
                if (errDetails != null && errDetails.containsKey('message')) {
                    cleanMsg = (String) errDetails.get('message');
                } else {
                    cleanMsg = res.getBody();
                }
            } catch (Exception parseEx) {
                cleanMsg = res.getBody();
            }
            AuraHandledException ex = new AuraHandledException('Gemini API Error: ' + cleanMsg);
            ex.setMessage(('Gemini API Error: ' + cleanMsg).left(500));
            throw ex;
        }

        Map<String, Object> geminiResponse = (Map<String, Object>) JSON.deserializeUntyped(res.getBody());
        List<Object> candidates = (List<Object>) geminiResponse.get('candidates');
        if (candidates == null || candidates.isEmpty()) {
            AuraHandledException ex = new AuraHandledException('Gemini returned no candidates.');
            ex.setMessage('Gemini returned no candidates.');
            throw ex;
        }

        Map<String, Object> firstCandidate = (Map<String, Object>) candidates[0];
        Map<String, Object> content = (Map<String, Object>) firstCandidate.get('content');
        List<Object> responseParts = (List<Object>) content.get('parts');
        String jsonText = (String) ((Map<String, Object>) responseParts[0]).get('text');

        jsonText = jsonText.trim();
        Integer fenceStart = jsonText.indexOf('```');
        if (fenceStart >= 0) {
            Integer jsonStart = jsonText.indexOf('{', fenceStart);
            Integer jsonEnd = jsonText.lastIndexOf('}');
            if (jsonStart >= 0 && jsonEnd > jsonStart) jsonText = jsonText.substring(jsonStart, jsonEnd + 1);
        } else {
            Integer jsonStart = jsonText.indexOf('{');
            Integer jsonEnd = jsonText.lastIndexOf('}');
            if (jsonStart >= 0 && jsonEnd > jsonStart) jsonText = jsonText.substring(jsonStart, jsonEnd + 1);
        }

        try {
            return (Map<String, Object>) JSON.deserializeUntyped(jsonText);
        } catch (Exception e) {
            AuraHandledException ex = new AuraHandledException('Failed to parse Gemini response: ' + jsonText);
            ex.setMessage('Failed to parse Gemini response: ' + jsonText);
            throw ex;
        }
    }

    private static String getApiKey() {
        List<Gemini_Settings__mdt> settings = [SELECT API_Key__c FROM Gemini_Settings__mdt WHERE DeveloperName = 'Default' LIMIT 1];
        if (settings.isEmpty()) {
            AuraHandledException ex = new AuraHandledException('Gemini API key not configured in Gemini_Settings__mdt');
            ex.setMessage('Gemini API key not configured in Gemini_Settings__mdt');
            throw ex;
        }
        return settings[0].API_Key__c;
    }

    private static String getMimeType(String fileName) {
        String ext = fileName.substringAfterLast('.').toLowerCase();
        if (ext == 'pdf') return 'application/pdf';
        if (ext == 'docx') return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
        if (ext == 'txt') return 'text/plain';
        return 'application/octet-stream';
    }
}
