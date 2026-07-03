public with sharing class SalesforceAgentController {

    @AuraEnabled
    public static String getFileBase64(String contentVersionId) {
        try {
            ContentVersion cv = [SELECT VersionData FROM ContentVersion WHERE Id = :contentVersionId LIMIT 1];
            return EncodingUtil.base64Encode(cv.VersionData);
        } catch (Exception e) {
            AuraHandledException ex = new AuraHandledException(e.getMessage());
            ex.setMessage(e.getMessage());
            throw ex;
        }
    }

    @AuraEnabled
    public static Map<String, Object> parseDocument(String base64Content, String fileName, String promptText) {
        try {
            return GeminiDocParserService.parseDocument(base64Content, fileName, promptText);
        } catch (Exception e) {
            AuraHandledException ex = new AuraHandledException(e.getMessage());
            ex.setMessage(e.getMessage());
            throw ex;
        }
    }

    @AuraEnabled
    public static MetadataDeployService.DeployResult deploySchema(String schemaJson) {
        try {
            Map<String, Object> schema = (Map<String, Object>) JSON.deserializeUntyped(schemaJson);
            return MetadataDeployService.deploySchema(schema);
        } catch (Exception e) {
            AuraHandledException ex = new AuraHandledException(e.getMessage());
            ex.setMessage(e.getMessage());
            throw ex;
        }
    }
}
