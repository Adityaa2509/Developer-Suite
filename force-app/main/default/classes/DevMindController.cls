/**
 * @description Bridge between devMindInvestigate LWC and FastAPI backend.
 *              Makes HTTP callouts via Named Credential 'DevMind_API'.
 *
 * Endpoints hit:
 *   POST {namedCred}/api/investigate      → starts investigation
 *   GET  {namedCred}/api/investigate/{id} → polls for progress
 *
 * @author  DevMind Investigate
 * @version 2.0.0
 */
public with sharing class DevMindController {

    private static final String BASE_URL = 'callout:DevMind_API';
    private static final Integer TIMEOUT_MS = 60000;
    private static final Integer POLL_TIMEOUT_MS   = 60000; 

    // ── Start Investigation ────────────────────────────────────────────
    /**
     * @description Starts a new investigation via FastAPI POST /api/investigate.
     *              Returns the job_id string immediately — investigation runs async.
     * @param recordId       Salesforce record ID to investigate
     * @param anomaly        Plain English description of what went wrong
     * @param objectType     Object API name (empty string to auto-detect)
     * @param runningUserId  ID of the user who experienced the issue (optional)
     * @return               job_id string from FastAPI
     */
    @AuraEnabled
    public static String startInvestigation(
        String recordId,
        String anomaly,
        String objectType,
        String runningUserId
    ) {
        try {
            HttpRequest req = new HttpRequest();
            req.setEndpoint(BASE_URL + '/api/investigate');
            req.setMethod('POST');
            req.setHeader('Content-Type', 'application/json');
            req.setTimeout(POLL_TIMEOUT_MS);

            Map<String, Object> bodyMap = new Map<String, Object>{
                'record_id' => recordId,
                'anomaly'   => anomaly
            };
            if (String.isNotBlank(objectType)) {
                bodyMap.put('object_type', objectType);
            }
            if (String.isNotBlank(runningUserId)) {
                bodyMap.put('running_user_id', runningUserId);
            }
            req.setBody(JSON.serialize(bodyMap));

            Http http = new Http();
            HttpResponse res = http.send(req);

            if (res.getStatusCode() == 202) {
                Map<String, Object> parsed =
                    (Map<String, Object>) JSON.deserializeUntyped(res.getBody());
                String jobId = (String) parsed.get('job_id');
                if (String.isBlank(jobId)) {
                    throw new AuraHandledException(
                        'Backend returned 202 but no job_id in response.'
                    );
                }
                return jobId;
            } else {
                throw new AuraHandledException(
                    'Backend error: HTTP ' + res.getStatusCode()
                    + ' — ' + res.getBody()
                );
            }

        } catch (AuraHandledException e) {
            throw e;
        } catch (Exception e) {
            throw new AuraHandledException(
                'Could not reach DevMind backend: ' + e.getMessage()
                + '. Check Named Credential and Remote Site Setting.'
            );
        }
    }

    // ── Poll Investigation Steps ───────────────────────────────────────
    /**
     * @description Polls FastAPI GET /api/investigate/{jobId} for progress.
     *              Called by LWC every 3 seconds after investigation starts.
     * @param jobId  The job_id returned by startInvestigation
     * @return       Map with: status, steps, confidence, report
     */
    @AuraEnabled
    public static Map<String, Object> pollInvestigationSteps(String jobId) {
        try {
            HttpRequest req = new HttpRequest();
            req.setEndpoint(BASE_URL + '/api/investigate/' + jobId);
            req.setMethod('GET');
            req.setTimeout(30000);

            Http http = new Http();
            HttpResponse res = http.send(req);

            if (res.getStatusCode() == 200) {
                return (Map<String, Object>) JSON.deserializeUntyped(res.getBody());
            } else if (res.getStatusCode() == 404) {
                throw new AuraHandledException(
                    'Investigation ' + jobId + ' not found.'
                );
            } else {
                throw new AuraHandledException(
                    'Poll error: HTTP ' + res.getStatusCode()
                );
            }

        } catch (AuraHandledException e) {
            throw e;
        } catch (Exception e) {
            throw new AuraHandledException(
                'Could not poll investigation: ' + e.getMessage()
            );
        }
    }

    // ── Save Investigation Feedback ──────────────────────────────────
    /**
     * @description Sends user feedback (upvote/downvote/notes) to FastAPI.
     * @param jobId  The job_id of the investigation
     * @param rating "upvote" or "downvote"
     * @param notes  Optional description or correction
     * @return       Map of the response payload
     */
    @AuraEnabled
    public static Map<String, Object> saveFeedback(String jobId, String rating, String notes) {
        try {
            HttpRequest req = new HttpRequest();
            req.setEndpoint(BASE_URL + '/api/investigate/' + jobId + '/feedback');
            req.setMethod('POST');
            req.setHeader('Content-Type', 'application/json');
            req.setTimeout(30000);

            Map<String, Object> bodyMap = new Map<String, Object>{
                'rating' => rating,
                'notes'  => notes
            };
            req.setBody(JSON.serialize(bodyMap));

            Http http = new Http();
            HttpResponse res = http.send(req);

            if (res.getStatusCode() == 200) {
                return (Map<String, Object>) JSON.deserializeUntyped(res.getBody());
            } else {
                throw new AuraHandledException(
                    'Feedback save error: HTTP ' + res.getStatusCode() + ' — ' + res.getBody()
                );
            }

        } catch (AuraHandledException e) {
            throw e;
        } catch (Exception e) {
            throw new AuraHandledException(
                'Could not save feedback: ' + e.getMessage()
            );
        }
    }
}
