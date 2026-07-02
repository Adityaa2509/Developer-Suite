import { LightningElement, track } from 'lwc';
import startInvestigation     from '@salesforce/apex/DevMindController.startInvestigation';
import pollInvestigationSteps from '@salesforce/apex/DevMindController.pollInvestigationSteps';
import saveFeedback           from '@salesforce/apex/DevMindController.saveFeedback';

const POLL_MS = 3000;
const ICONS   = { info: '→', success: '✓', error: '✗', warning: '⚠' };


function friendlyError(raw) {
    if (!raw) return 'Something went wrong. Please try again.';
    if (raw.includes('Named Credential') || raw.includes('endpoint'))
        return 'Cannot reach the investigation backend. Check that the Named Credential is configured and the backend is running.';
    if (raw.includes('INVALID_SESSION') || raw.includes('expired'))
        return 'Session expired. Please refresh the page and try again.';
    if (raw.includes('timeout') || raw.includes('Timeout'))
        return 'Investigation timed out. Try using a more specific anomaly description.';
    if (raw.includes('404') || raw.includes('not found'))
        return 'Investigation job not found. It may have been cleared. Please start a new investigation.';
    if (raw.includes('job_id'))
        return 'Backend returned an unexpected response. Check the Render deployment.';
    if (raw.length > 120)
        return 'An unexpected error occurred. Verify the Record ID is valid and the backend is deployed.';
    return raw;
}

export default class DevMindInvestigate extends LightningElement {

    @track recordId    = '';
    @track anomaly     = '';
    @track isLoading   = false;
    @track isComplete  = false;
    @track hasError    = false;
    @track _rawError   = '';
    @track steps       = [];
    @track confidence  = 0;
    @track rootCause   = '';
    @track evidenceItems  = [];
    @track nextStepItems  = [];
    @track ruledOutItems  = [];
    @track reportConfidence = 0;
    @track totalTokens = 0;
    @track totalCostUsd = 0.0;
    @track hasVoted = false;
    @track showDownvoteForm = false;
    @track feedbackNotes = '';
    @track submitSuccess = false;

    _jobId    = null;
    _poll     = null;
    _counter  = 0;
    _lastCount = 0;

    // ── Computed ──────────────────────────────────────────────────
    get hasSteps()    { return this.steps.length > 0; }
    get hasReport()   { return this.isComplete && !!this.rootCause; }
    get friendlyError() { return friendlyError(this._rawError); }
    get hasUsage()      { return this.totalTokens > 0; }
    get formattedCost() {
        return this.totalCostUsd.toLocaleString('en-US', {
            style: 'currency',
            currency: 'USD',
            minimumFractionDigits: 4,
            maximumFractionDigits: 6
        });
    }

    get inputPanelClass() {
        return this.hasSteps ? 'dm-input-panel dm-input-panel--compact' : 'dm-input-panel';
    }

    get statusLabel() {
        if (this.isComplete) return 'Complete';
        if (this.hasError)   return 'Failed';
        if (this.isLoading)  return 'Investigating';
        return 'Ready';
    }

    get statusDotClass() {
        if (this.isComplete) return 'dm-status-dot dm-status-dot--done';
        if (this.hasError)   return 'dm-status-dot dm-status-dot--err';
        if (this.isLoading)  return 'dm-status-dot dm-status-dot--live';
        return 'dm-status-dot';
    }

    get confidenceBarStyle() { return `width:${Math.min(this.confidence, 100)}%`; }
    get confidenceLabel()    { return `${Math.round(this.confidence)}%`; }

    get confidenceBadgeClass() {
        const c = this.confidence;
        if (c >= 80) return 'dm-conf-badge dm-conf-badge--hi';
        if (c >= 50) return 'dm-conf-badge dm-conf-badge--mid';
        return 'dm-conf-badge dm-conf-badge--lo';
    }

    get reportBadgeClass() {
        const c = this.reportConfidence;
        if (c >= 80) return 'dm-rca-badge dm-rca-badge--hi';
        if (c >= 50) return 'dm-rca-badge dm-rca-badge--mid';
        return 'dm-rca-badge dm-rca-badge--lo';
    }

    // ── Handlers ──────────────────────────────────────────────────
    handleRecordId(e) { this.recordId = e.target.value.trim(); }
    handleAnomaly(e)  { this.anomaly  = e.target.value; }

    handleRetry() {
        this.hasError = false;
        this._rawError = '';
    }

    handleUpvote() {
        this.hasVoted = true;
        this._sendFeedbackToServer('upvote', '');
    }

    handleDownvote() {
        this.showDownvoteForm = true;
    }

    handleFeedbackNotesChange(e) {
        this.feedbackNotes = e.target.value;
    }

    handleCancelFeedback() {
        this.showDownvoteForm = false;
        this.feedbackNotes = '';
    }

    async submitDownvoteFeedback() {
        if (!this.feedbackNotes.trim()) return;
        this.showDownvoteForm = false;
        this.hasVoted = true;
        this.submitSuccess = true;
        await this._sendFeedbackToServer('downvote', this.feedbackNotes);
    }

    async _sendFeedbackToServer(rating, notes) {
        if (!this._jobId) return;
        try {
            await saveFeedback({ jobId: this._jobId, rating, notes });
        } catch (e) {
            console.error('Failed to save feedback on server:', e);
        }
    }


    async handleInvestigate() {
        if (this.isLoading || !this.recordId.trim() || this.anomaly.trim().length < 5) return;
        this._reset();
        this.isLoading = true;

        try {
            const jobId = await startInvestigation({
                recordId: this.recordId, anomaly: this.anomaly,
                objectType: '', runningUserId: '',
            });
            this._jobId = jobId;
            this._addStep('info', `Started — Job ${jobId.substring(0, 8)}...`);
            this._poll = setInterval(() => this._fetchSteps(), POLL_MS);
        } catch (e) {
            this._fail(e?.body?.message || e?.message || '');
        }
    }

    async _fetchSteps() {
        if (!this._jobId) return;
        try {
            const r = await pollInvestigationSteps({ jobId: this._jobId });
            this._process(r);
        } catch (e) {
            this._stopPoll();
            this._fail(e?.body?.message || e?.message || '');
        }
    }

    _process(r) {
        if (!r) return;
        const steps = r.steps || [];
        if (steps.length > this._lastCount) {
            steps.slice(this._lastCount).forEach(s => this._addStep(s.type || 'info', s.message || ''));
            this._lastCount = steps.length;
        }
        if (r.confidence != null) this.confidence = Number(r.confidence) || 0;
        if (r.total_tokens != null) this.totalTokens = Number(r.total_tokens) || 0;
        if (r.total_cost_usd != null) this.totalCostUsd = Number(r.total_cost_usd) || 0;
        if (r.feedback_rating) {
            this.hasVoted = true;
            if (r.feedback_notes) {
                this.submitSuccess = true;
            }
        }

        if (r.status === 'complete') {
            this._stopPoll();
            this.isLoading = false;
            this.isComplete = true;
            this._renderReport(r.report);
        } else if (r.status === 'failed') {
            this._stopPoll();
            this._fail((r.report || {}).error || 'Investigation failed.');
        }
    }

    _renderReport(report) {
        if (!report) { this.rootCause = 'Investigation complete — see feed for details.'; return; }
        this.rootCause        = report.root_cause || 'Root cause undetermined.';
        this.reportConfidence = Number(report.confidence) || 0;
        this.evidenceItems    = (report.evidence     || []).map((t, i) => ({ id: `ev${i}`, text: t }));
        this.nextStepItems    = (report.next_steps   || []).map((t, i) => ({ id: `ns${i}`, text: t, index: i + 1 }));
        this.ruledOutItems    = (report.ruled_out    || []).map((t, i) => ({ id: `ro${i}`, text: t }));
    }

    _addStep(type, text) {
        this.steps = [...this.steps, {
            id: ++this._counter, type, text,
            icon: ICONS[type] || '→',
            cssClass: `dm-step dm-step--${type}`,
        }];
        // Scroll feed
        requestAnimationFrame(() => {
            const feed = this.refs?.feed || this.template.querySelector('.dm-feed');
            if (feed) feed.scrollTop = feed.scrollHeight;
        });
    }

    _stopPoll()   { if (this._poll) { clearInterval(this._poll); this._poll = null; } }
    _fail(msg)    { this._rawError = msg; this.hasError = true; this.isLoading = false; }

    _reset() {
        this._stopPoll();
        this.steps = []; this.confidence = 0; this.isComplete = false;
        this.isLoading = false; this.hasError = false; this._rawError = '';
        this.rootCause = ''; this.evidenceItems = [];
        this.nextStepItems = []; this.ruledOutItems = [];
        this.reportConfidence = 0; this._jobId = null;
        this._counter = 0; this._lastCount = 0;
        this.totalTokens = 0; this.totalCostUsd = 0.0;
        this.hasVoted = false;
        this.showDownvoteForm = false;
        this.feedbackNotes = '';
        this.submitSuccess = false;
    }

    disconnectedCallback() { this._stopPoll(); }
}