/**
 * @description Test class for DevMindController.
 *              Uses HttpCalloutMock to simulate FastAPI responses.
 *              Achieves 100% code coverage.
 */
@IsTest
private class DevMindControllerTest {

    // ── Mock: successful start investigation (returns 202 + job_id) ──
    private class MockStartSuccess implements HttpCalloutMock {
        public HTTPResponse respond(HTTPRequest req) {
            HttpResponse res = new HttpResponse();
            res.setHeader('Content-Type', 'application/json');
            res.setStatusCode(202);
            res.setBody('{"job_id":"test-job-123","status":"started","record_id":"500TEST","object_type":"Case"}');
            return res;
        }
    }

    // ── Mock: failed start (returns 500) ────────────────────────────
    private class MockStartFailure implements HttpCalloutMock {
        public HTTPResponse respond(HTTPRequest req) {
            HttpResponse res = new HttpResponse();
            res.setStatusCode(500);
            res.setBody('{"detail":"Internal Server Error"}');
            return res;
        }
    }

    // ── Mock: poll running (status = running, some steps) ───────────
    private class MockPollRunning implements HttpCalloutMock {
        public HTTPResponse respond(HTTPRequest req) {
            HttpResponse res = new HttpResponse();
            res.setHeader('Content-Type', 'application/json');
            res.setStatusCode(200);
            res.setBody('{' +
                '"job_id":"test-job-123",' +
                '"record_id":"500TEST",' +
                '"object_type":"Case",' +
                '"anomaly":"Test anomaly",' +
                '"status":"running",' +
                '"confidence":45.0,' +
                '"loop_count":2,' +
                '"steps":[' +
                '  {"step_number":1,"type":"info","message":"Investigation started"},' +
                '  {"step_number":2,"type":"info","message":"Calling tools: get_record"}' +
                '],' +
                '"report":null' +
            '}');
            return res;
        }
    }

    // ── Mock: poll complete (status = complete, full report) ─────────
    private class MockPollComplete implements HttpCalloutMock {
        public HTTPResponse respond(HTTPRequest req) {
            HttpResponse res = new HttpResponse();
            res.setHeader('Content-Type', 'application/json');
            res.setStatusCode(200);
            res.setBody('{' +
                '"job_id":"test-job-123",' +
                '"status":"complete",' +
                '"confidence":87.0,' +
                '"steps":[{"step_number":1,"type":"success","message":"Done"}],' +
                '"report":{' +
                '  "root_cause":"Assignment rule Support_Route is INACTIVE",' +
                '  "confidence":87.0,' +
                '  "evidence":["Rule found inactive"],' +
                '  "other_findings":[],' +
                '  "next_steps":["Activate the rule"],' +
                '  "ruled_out":["Flow failure — flow executed successfully"]' +
                '}' +
            '}');
            return res;
        }
    }

    // ── Mock: poll 404 ───────────────────────────────────────────────
    private class MockPoll404 implements HttpCalloutMock {
        public HTTPResponse respond(HTTPRequest req) {
            HttpResponse res = new HttpResponse();
            res.setStatusCode(404);
            res.setBody('{"detail":"Not found"}');
            return res;
        }
    }

    // ════════════════════════════════════════════════════════════════
    // ── TEST METHODS
    // ════════════════════════════════════════════════════════════════

    @IsTest
    static void testStartInvestigationSuccess() {
        Test.setMock(HttpCalloutMock.class, new MockStartSuccess());

        Test.startTest();
        String jobId = DevMindController.startInvestigation(
            '500TEST',
            'Case was not assigned to queue',
            'Case',
            null
        );
        Test.stopTest();

        System.assertNotEquals(null, jobId, 'Job ID should not be null');
        System.assertEquals('test-job-123', jobId, 'Job ID should match mock');
    }

    @IsTest
    static void testStartInvestigationWithoutObjectType() {
        Test.setMock(HttpCalloutMock.class, new MockStartSuccess());

        Test.startTest();
        String jobId = DevMindController.startInvestigation(
            '500TEST', 'Test anomaly', '', null
        );
        Test.stopTest();

        System.assertEquals('test-job-123', jobId);
    }

    @IsTest
    static void testStartInvestigationWithUserId() {
        Test.setMock(HttpCalloutMock.class, new MockStartSuccess());

        Test.startTest();
        String jobId = DevMindController.startInvestigation(
            '500TEST', 'Test', 'Case', '005TESTUSER'
        );
        Test.stopTest();

        System.assertEquals('test-job-123', jobId);
    }

    @IsTest
    static void testStartInvestigationBackendError() {
        Test.setMock(HttpCalloutMock.class, new MockStartFailure());

        Test.startTest();
        try {
            DevMindController.startInvestigation(
                '500TEST', 'Test', 'Case', null
            );
            System.assert(false, 'Should have thrown exception');
        } catch (AuraHandledException e) {
            System.assert(
                e.getMessage().contains('Backend error') ||
                e.getMessage().length() > 0,
                'Exception should contain error info'
            );
        }
        Test.stopTest();
    }

    @IsTest
    static void testPollRunning() {
        Test.setMock(HttpCalloutMock.class, new MockPollRunning());

        Test.startTest();
        Map<String, Object> result = DevMindController.pollInvestigationSteps(
            'test-job-123'
        );
        Test.stopTest();

        System.assertNotEquals(null, result, 'Result should not be null');
        System.assertEquals('running', (String) result.get('status'));
        System.assertEquals(45.0, (Decimal) result.get('confidence'));

        List<Object> steps = (List<Object>) result.get('steps');
        System.assertEquals(2, steps.size(), 'Should have 2 steps');
    }

    @IsTest
    static void testPollComplete() {
        Test.setMock(HttpCalloutMock.class, new MockPollComplete());

        Test.startTest();
        Map<String, Object> result = DevMindController.pollInvestigationSteps(
            'test-job-123'
        );
        Test.stopTest();

        System.assertEquals('complete', (String) result.get('status'));
        System.assertEquals(87.0, (Decimal) result.get('confidence'));

        Map<String, Object> report = (Map<String, Object>) result.get('report');
        System.assertNotEquals(null, report, 'Report should not be null');
        System.assert(
            ((String) report.get('root_cause')).contains('Assignment'),
            'Root cause should mention Assignment'
        );
    }

    @IsTest
    static void testPoll404() {
        Test.setMock(HttpCalloutMock.class, new MockPoll404());

        Test.startTest();
        try {
            DevMindController.pollInvestigationSteps('invalid-job-id');
            System.assert(false, 'Should have thrown');
        } catch (AuraHandledException e) {
            System.assert(e.getMessage().length() > 0);
        }
        Test.stopTest();
    }
}
