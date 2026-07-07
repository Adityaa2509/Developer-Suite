import { LightningElement, track, api } from 'lwc';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import sendCopilotMessage from '@salesforce/apex/VeloqCopilotController.sendCopilotMessage';
import checkServerHealth from '@salesforce/apex/VeloqCopilotController.checkServerHealth';
import getHeaderMappings from '@salesforce/apex/VeloqCopilotController.getHeaderMappings';
import executeDataImport from '@salesforce/apex/VeloqCopilotController.executeDataImport';
import deployMetadataSchema from '@salesforce/apex/VeloqCopilotController.deployMetadataSchema';
import checkObjectExists from '@salesforce/apex/VeloqCopilotController.checkObjectExists';
import checkValidationFormula from '@salesforce/apex/VeloqCopilotController.checkValidationFormula';
import getTargetObjects from '@salesforce/apex/VeloqCopilotController.getTargetObjects';
import pollInvestigationSteps from '@salesforce/apex/DevMindController.pollInvestigationSteps';
import saveFeedback from '@salesforce/apex/DevMindController.saveFeedback';
import pollPermissionsStatus from '@salesforce/apex/VeloqCopilotController.pollPermissionsStatus';

const POLL_INTERVAL = 3000;

const STANDARD_OBJECTS = new Set([
    'account', 'contact', 'lead', 'opportunity', 'case', 'campaign', 'user', 'product2',
    'asset', 'contract', 'order', 'solution', 'task', 'event', 'pricebook2', 'quote',
    'opportunitylineitem', 'accountteammember', 'collaborationgroup', 'contentversion',
    'document', 'idea', 'leadshare', 'note', 'partner', 'recordtype', 'site'
]);

function isStandardObject(name) {
    if (!name) return false;
    return STANDARD_OBJECTS.has(name.toLowerCase());
}

export default class VeloqCopilot extends LightningElement {
    @api recordId; // auto-injected if on a record page

    @track messages = [
        {
            id: 'welcome',
            sender: 'bot',
            isBot: true,
            text: 'Hello! I am your Veloq Copilot. I can help you debug record errors, create custom metadata schemas, or upload CSV files. What would you like to do?',
            isCard: false,
            bubbleClass: 'message-bubble-row bot'
        }
    ];

    @track inputVal = '';
    @track isLoading = false;
    @track fileBase64 = '';
    @track fileName = '';

    // Server connection monitoring
    @track statusText = 'Checking...';
    @track statusClass = 'status-dot reconnecting';
    _healthTimer = null;

    // Searchable Object Dropdown properties
    @track showObjectSelector = false;
    @track showFileModeSelector = false;
    @track objectSearchKey = '';
    @track selectedObject = '';
    @track commonObjects = [
        { label: 'Lead', value: 'Lead' },
        { label: 'Account', value: 'Account' },
        { label: 'Contact', value: 'Contact' },
        { label: 'Opportunity', value: 'Opportunity' },
        { label: 'Case', value: 'Case' },
        { label: 'Campaign', value: 'Campaign' },
        { label: 'User', value: 'User' },
        { label: 'Product', value: 'Product2' }
    ];

    // Cache of active investigations
    _activePollInterval = null;
    _activeJobId = null;

    connectedCallback() {
        getTargetObjects()
            .then(data => {
                if (data && data.length > 0) {
                    this.commonObjects = data;
                }
            })
            .catch(e => {
                console.error('Failed to load dynamic Salesforce objects', e);
            });

        // Run initial server check
        this.pingHealth();

        // Start passive connection checking (very low resources, every 30 seconds)
        this._healthTimer = setInterval(() => {
            this.pingHealth();
        }, 30000);
    }

    disconnectedCallback() {
        if (this._healthTimer) {
            clearInterval(this._healthTimer);
        }
        if (this._activePollInterval) {
            clearInterval(this._activePollInterval);
        }
    }

    pingHealth() {
        checkServerHealth()
            .then(isOnline => {
                if (isOnline) {
                    this.statusText = 'Active';
                    this.statusClass = 'status-dot online';
                } else {
                    this.statusText = 'Inactive';
                    this.statusClass = 'status-dot offline';
                }
            })
            .catch(() => {
                this.statusText = 'Inactive';
                this.statusClass = 'status-dot offline';
            });
    }

    get filteredObjects() {
        if (!this.objectSearchKey) {
            return this.commonObjects;
        }
        const key = this.objectSearchKey.toLowerCase();
        const filtered = this.commonObjects.filter(obj =>
            obj.label.toLowerCase().includes(key) || obj.value.toLowerCase().includes(key)
        );
        // If search key doesn't exactly match any common object, add it as a custom option
        const exactMatch = this.commonObjects.some(obj => obj.value.toLowerCase() === key);
        if (!exactMatch && key.trim().length > 0) {
            filtered.push({ label: `Custom Object: "${this.objectSearchKey}"`, value: this.objectSearchKey });
        }
        return filtered;
    }

    get showDropdown() {
        return this.showObjectSelector && this.filteredObjects.length > 0;
    }

    // Input handlers
    handleInputChange(event) {
        this.inputVal = event.target.value;
    }

    handleInputKeyPress(event) {
        if (event.key === 'Enter') {
            this.handleSend();
        }
    }

    triggerFileSelect() {
        const fileInput = this.template.querySelector('.hidden-file-input');
        if (fileInput) {
            fileInput.click();
        }
    }

    closeObjectSelector() {
        this.showObjectSelector = false;
    }

    get formattedMessages() {
        return this.messages.map(msg => {
            return {
                ...msg,
                formattedText: this.formatMarkdown(msg.text)
            };
        });
    }

    formatMarkdown(text) {
        if (!text) return '';
        let html = text;
        
        // 1. Escape HTML
        html = html
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
            
        // 2. Bold: **text** -> <strong>text</strong>
        html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
        
        // 3. Bullets
        html = html.split('\n').map(line => {
            let trimmed = line.trim();
            if (trimmed.startsWith('•') || trimmed.startsWith('*') || trimmed.startsWith('-')) {
                let content = trimmed.substring(1).trim();
                return `&bull; ${content}`;
            }
            return line;
        }).join('\n');
        
        // 4. Inline code
        html = html.replace(/`([^`]+)`/g, '<code style="background: rgba(14, 165, 233, 0.15); color: #0ea5e9; padding: 2px 6px; border-radius: 4px; font-family: monospace; font-size: 13px; font-weight: bold;">$1</code>');
        
        // 5. Line breaks
        html = html.replace(/\n/g, '<br/>');
        
        // 6. Styled Alerts (⚠️, 💡, ℹ️)
        html = html.split('<br/>').map(line => {
            let trimmed = line.trim();
            if (trimmed.startsWith('⚠️')) {
                return `<div style="background: rgba(239, 68, 68, 0.08); border-left: 3px solid #ef4444; padding: 8px 12px; margin: 8px 0; border-radius: 4px; font-size: 13px; color: #f87171;">${trimmed}</div>`;
            }
            if (trimmed.startsWith('💡')) {
                return `<div style="background: rgba(14, 165, 233, 0.08); border-left: 3px solid #0ea5e9; padding: 8px 12px; margin: 8px 0; border-radius: 4px; font-size: 13px; color: #38bdf8;">${trimmed}</div>`;
            }
            if (trimmed.startsWith('ℹ️')) {
                return `<div style="background: rgba(168, 85, 247, 0.08); border-left: 3px solid #a855f7; padding: 8px 12px; margin: 8px 0; border-radius: 4px; font-size: 13px; color: #c084fc;">${trimmed}</div>`;
            }
            return line;
        }).join('<br/>');
        
        return html;
    }

    // Conversational send
    handleSend() {
        const text = this.inputVal.trim();
        if (!text && !this.fileBase64) return;

        this.inputVal = '';

        // Append user bubble
        const userMsgId = 'msg_' + Date.now();
        this.messages = [
            ...this.messages,
            { id: userMsgId, sender: 'user', isBot: false, text: text || `Uploaded file: ${this.fileName}`, isCard: false, bubbleClass: 'message-bubble-row user' }
        ];

        this.isLoading = true;
        this.scrollToBottom();

        // Call FastAPI Copilot Router
        sendCopilotMessage({
            message: text,
            recordId: this.recordId,
            fileName: null,
            fileBase64: null
        })
            .then(resultStr => {
                const result = JSON.parse(resultStr);
                this.statusText = 'Active';
                this.statusClass = 'status-dot online';
                this.handleRouterResponse(result);
            })
            .catch(e => {
                this.appendBotMessage('Sorry, I encountered an error communicating with the backend: ' + (e.body?.message || e.message));
                this.statusText = 'Inactive';
                this.statusClass = 'status-dot offline';
                this.isLoading = false;
            });
    }

    // Handle responses from Python FastAPI Router
    handleRouterResponse(res) {
        this.isLoading = false;

        if (res.action === 'CHAT') {
            this.appendBotMessage(res.message);
        }

        else if (res.action === 'PERMISSIONS_DIAGNOSTIC') {
            const data = res.cardData || {};
            const iconMap = {
                'PASS': '✅',
                'BLOCK': '❌',
                'WARN': '⚠️',
                'SKIP': '➖',
                'SUPPRESSED': '🔒'
            };
            const classMap = {
                'PASS': 'status-icon text-success',
                'BLOCK': 'status-icon text-danger',
                'SUPPRESSED': 'status-icon text-danger',
                'WARN': 'status-icon text-warning',
                'SKIP': 'status-icon text-muted'
            };
            
            const processedChain = (data.chain || []).map(step => {
                const status = (step.status || '').toUpperCase();
                return {
                    layer: step.layer,
                    status: step.status,
                    detail: step.detail,
                    icon: iconMap[status] || '❓',
                    statusClass: classMap[status] || 'status-icon'
                };
            });

            this.messages = [
                ...this.messages,
                {
                    id: 'perm_diag_' + Date.now(),
                    sender: 'bot',
                    isBot: true,
                    text: data.reply || 'Permissions Diagnostic Completed',
                    isCard: true,
                    isPermissionsDiagnostic: true,
                    cardType: 'permissionsDiagnostic',
                    bubbleClass: 'message-bubble-row bot',
                    cardData: {
                        verdict: (data.verdict || 'unknown').toUpperCase(),
                        reply: data.reply,
                        rootCause: data.rootCause,
                        fix: data.fix,
                        chain: processedChain
                    }
                }
            ];
            this.scrollToBottom();
        }

        else if (res.action === 'PERMISSIONS_AUDIT') {
            const tableData = this.parseMarkdownTable(res.message);
            this.messages = [
                ...this.messages,
                {
                    id: 'perm_audit_' + Date.now(),
                    sender: 'bot',
                    isBot: true,
                    text: 'Security Audit Report Generated',
                    isCard: true,
                    isPermissionsAudit: true,
                    cardType: 'permissionsAudit',
                    bubbleClass: 'message-bubble-row bot',
                    cardData: tableData
                }
            ];
            this.scrollToBottom();
        }

        else if (res.action === 'DEBUG') {
            // Initiate Sherlock async polling
            const botMsgId = 'debug_' + Date.now();
            this.messages = [
                ...this.messages,
                {
                    id: botMsgId,
                    sender: 'bot',
                    isBot: true,
                    text: res.message || 'Starting investigation...',
                    isCard: true,
                    isInvestigationReport: true,
                    cardType: 'investigationReport',
                    bubbleClass: 'message-bubble-row bot',
                    cardData: {
                        status: 'running',
                        steps: [{ step_number: 1, type: 'info', message: 'Connecting to Sherlock investigation engine...' }],
                        confidence: 0,
                        rootCause: '',
                        evidenceItems: [],
                        nextStepItems: [],
                        ruledOutItems: [],
                        feedbackAllowed: false
                    }
                }
            ];

            this._activeJobId = res.job_id;
            this.startInvestigationPolling(botMsgId);
        }

        else if (res.action === 'CREATE') {
            // Sanitize AI schema names (objects and fields)
            const sanitizedSchema = JSON.parse(JSON.stringify(res.schema));
            if (sanitizedSchema && sanitizedSchema.objects) {
                sanitizedSchema.objects.forEach(obj => {
                    if (obj.apiName) {
                        let name = obj.apiName.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_]/g, '');
                        if (!isStandardObject(name)) {
                            if (name.endsWith('_c') && !name.endsWith('__c')) {
                                name = name.slice(0, -2) + '__c';
                            } else if (!name.endsWith('__c')) {
                                name += '__c';
                            }
                        }
                        obj.apiName = name;
                    }
                    if (obj.fields) {
                        obj.fields.forEach(f => {
                            if (f.apiName) {
                                let name = f.apiName.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_]/g, '');
                                if (name.endsWith('_c') && !name.endsWith('__c')) {
                                    name = name.slice(0, -2) + '__c';
                                } else if (!name.endsWith('__c')) {
                                    name += '__c';
                                }
                                f.apiName = name;
                            }
                        });
                    }
                    if (obj.validationRules) {
                        obj.validationRules.forEach(rule => {
                            if (rule.formula) {
                                let formula = rule.formula.replace(/_c\b/gi, '__c');
                                formula = formula.replace(/_{3,}c\b/gi, '__c');
                                rule.formula = formula;
                            }
                        });
                    }
                });
            }

            this.injectSchemaReviewCard(res.message, sanitizedSchema);
        }

        else if (res.action === 'PERMISSIONS_LOADING') {
            // Background job started — show spinner message and begin polling
            const botMsgId = 'perm_loading_' + Date.now();
            this.messages = [
                ...this.messages,
                {
                    id: botMsgId,
                    sender: 'bot',
                    isBot: true,
                    text: res.message || '🔍 Analysing Salesforce permissions…',
                    isCard: false,
                    bubbleClass: 'message-bubble-row bot',
                    isConfirmation: false
                }
            ];
            this._activePermJobId = res.job_id;
            this._activePermMsgId = botMsgId;
            this.startPermissionsPolling(botMsgId, res.job_id);
        }

        else if (res.action === 'PERMISSIONS_CONFIRM') {
            // Path C: Write-tool intercepted — show Approve/Cancel gate buttons
            this.messages = [
                ...this.messages,
                {
                    id: 'perm_confirm_' + Date.now(),
                    sender: 'bot',
                    isBot: true,
                    text: res.message,
                    isCard: false,
                    bubbleClass: 'message-bubble-row bot',
                    isConfirmation: true,
                    confirmVal: 'YES'
                }
            ];
        }

        this.scrollToBottom();
    }

    injectSchemaReviewCard(text, sanitizedSchema) {
        this.messages = [
            ...this.messages,
            {
                id: 'schema_' + Date.now(),
                sender: 'bot',
                isBot: true,
                text: text,
                isCard: true,
                isSchemaReview: true,
                cardType: 'schemaReview',
                bubbleClass: 'message-bubble-row bot',
                cardData: {
                    schema: sanitizedSchema,
                    schemaString: JSON.stringify(sanitizedSchema),
                    objects: (sanitizedSchema.objects || []).map(obj => ({
                        ...obj,
                        fieldCount: (obj.fields || []).length,
                        hasValidations: obj.validationRules && obj.validationRules.length > 0,
                        fields: (obj.fields || []).map(f => {
                            const t = f.type || 'Text';
                            return {
                                ...f,
                                isText: t === 'Text',
                                isNumber: t === 'Number',
                                isDate: t === 'Date',
                                isCheckbox: t === 'Checkbox',
                                isPicklist: t === 'Picklist',
                                isEmail: t === 'Email',
                                isPhone: t === 'Phone',
                                isDefaultTrue: f.defaultValue === 'true' || f.defaultValue === true,
                                isDefaultFalse: f.defaultValue !== 'true' && f.defaultValue !== true,
                                picklistValuesList: f.picklistValues || [],
                                picklistDisplay: f.picklistValues ? f.picklistValues.join(', ') : ''
                            };
                        })
                    })),
                    isDeployed: false,
                    deploying: false,
                    resultMessage: '',
                    success: false,
                    deployClass: '',
                    emoji: '',
                    created: [],
                    alreadyPresent: [],
                    deployErrors: []
                }
            }
        ];
        this.scrollToBottom();
    }

    // Sherlock Asynchronous Polling loop
    startInvestigationPolling(messageId) {
        if (this._activePollInterval) {
            clearInterval(this._activePollInterval);
        }

        this._activePollInterval = setInterval(() => {
            pollInvestigationSteps({ jobId: this._activeJobId })
                .then(state => {
                    this.updateDebugCard(messageId, state);
                    if (state.status === 'complete' || state.status === 'failed') {
                        clearInterval(this._activePollInterval);
                        this._activePollInterval = null;
                    }
                })
                .catch(e => {
                    clearInterval(this._activePollInterval);
                    this._activePollInterval = null;
                    this.showToast('Polling Error', 'Failed to retrieve investigation progress', 'error');
                });
        }, POLL_INTERVAL);
    }

    // Permissions Agent Asynchronous Polling loop
    startPermissionsPolling(loadingMsgId, jobId) {
        if (this._activePermPollInterval) {
            clearInterval(this._activePermPollInterval);
        }

        this._activePermPollInterval = setInterval(() => {
            pollPermissionsStatus({ jobId: jobId })
                .then(rawStr => {
                    const job = typeof rawStr === 'string' ? JSON.parse(rawStr) : rawStr;
                    if (job.status === 'complete' || job.status === 'failed') {
                        clearInterval(this._activePermPollInterval);
                        this._activePermPollInterval = null;
                        // Remove the loading spinner bubble
                        this.messages = this.messages.filter(m => m.id !== loadingMsgId);
                        this.isLoading = false;
                        // Route the result through the normal response handler
                        if (job.result) {
                            this.handleRouterResponse(job.result);
                        } else {
                            this.appendBotMessage('⚠️ Permissions analysis returned no result.');
                        }
                    }
                })
                .catch(e => {
                    clearInterval(this._activePermPollInterval);
                    this._activePermPollInterval = null;
                    this.isLoading = false;
                    this.messages = this.messages.filter(m => m.id !== loadingMsgId);
                    this.appendBotMessage('❌ Error polling permissions status: ' + (e.body?.message || e.message));
                });
        }, POLL_INTERVAL);
    }

    updateDebugCard(messageId, state) {
        this.messages = this.messages.map(msg => {
            if (msg.id === messageId) {
                // Parse report data if available
                let evidence = [];
                let nextSteps = [];
                let ruledOut = [];
                let rootCause = '';

                if (state.report) {
                    try {
                        const rep = typeof state.report === 'string' ? JSON.parse(state.report) : state.report;
                        rootCause = rep.root_cause || '';
                        evidence = rep.evidence || [];
                        nextSteps = rep.recommended_fixes || [];
                        ruledOut = rep.ruled_out_hypotheses || [];
                    } catch (ex) {
                        rootCause = state.report;
                    }
                }

                return {
                    ...msg,
                    cardData: {
                        status: state.status,
                        steps: state.steps || [],
                        confidence: state.confidence || 0,
                        rootCause: rootCause,
                        evidenceItems: evidence,
                        nextStepItems: nextSteps,
                        ruledOutItems: ruledOut,
                        feedbackAllowed: state.status === 'complete',
                        jobId: this._activeJobId,
                        hasVoted: msg.cardData?.hasVoted || false
                    }
                };
            }
            return msg;
        });
        this.scrollToBottom();
    }

    // Feedback for Sherlock
    handleThumbsUp(event) {
        const jobId = event.currentTarget.dataset.jobid;
        const msgId = event.currentTarget.dataset.msgid;
        saveFeedback({ jobId, rating: 'upvote', notes: 'Upvoted via unified copilot' })
            .then(() => {
                this.markVoted(msgId);
                this.showToast('Success', 'Thank you for your feedback!', 'success');
            })
            .catch(e => this.showToast('Error', e.body?.message || e.message, 'error'));
    }

    handleThumbsDown(event) {
        const msgId = event.currentTarget.dataset.msgid;
        this.messages = this.messages.map(msg => {
            if (msg.id === msgId) {
                return { ...msg, cardData: { ...msg.cardData, showCorrectionInput: true } };
            }
            return msg;
        });
    }

    handleCorrectionSubmit(event) {
        const jobId = event.currentTarget.dataset.jobid;
        const msgId = event.currentTarget.dataset.msgid;
        const inputElem = this.template.querySelector(`[data-inputid="${msgId}"]`);
        const notes = inputElem ? inputElem.value : '';

        saveFeedback({ jobId, rating: 'downvote', notes })
            .then(() => {
                this.markVoted(msgId);
                this.showToast('Feedback Received', 'Correction logged in vector database', 'success');
            })
            .catch(e => this.showToast('Error', e.body?.message || e.message, 'error'));
    }

    markVoted(msgId) {
        this.messages = this.messages.map(msg => {
            if (msg.id === msgId) {
                return {
                    ...msg,
                    cardData: {
                        ...msg.cardData,
                        hasVoted: true,
                        showCorrectionInput: false
                    }
                };
            }
            return msg;
        });
    }

    // Dynamic Schema Editor Handlers
    handleSchemaObjectChange(event) {
        const msgId = event.currentTarget.dataset.msgid;
        const objName = event.currentTarget.dataset.objname;
        const prop = event.currentTarget.dataset.prop;
        let val = event.currentTarget.value.trim();

        if (prop === 'apiName') {
            val = val.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_]/g, '');
            if (val && !isStandardObject(val)) {
                if (val.endsWith('_c') && !val.endsWith('__c')) {
                    val = val.slice(0, -2) + '__c';
                } else if (!val.endsWith('__c')) {
                    val = val + '__c';
                }
            }
        }

        this.messages = this.messages.map(msg => {
            if (msg.id === msgId) {
                const schema = JSON.parse(JSON.stringify(msg.cardData.schema));
                const obj = schema.objects.find(o => o.apiName === objName);
                if (obj) {
                    obj[prop] = val;
                }

                const updatedObjects = (schema.objects || []).map(o => ({
                    ...o,
                    fieldCount: (o.fields || []).length,
                    hasValidations: o.validationRules && o.validationRules.length > 0,
                    fields: (o.fields || []).map(f => {
                        const t = f.type || 'Text';
                        return {
                            ...f,
                            isText: t === 'Text',
                            isNumber: t === 'Number',
                            isDate: t === 'Date',
                            isCheckbox: t === 'Checkbox',
                            isPicklist: t === 'Picklist',
                            isEmail: t === 'Email',
                            isPhone: t === 'Phone',
                            isDefaultTrue: f.defaultValue === 'true' || f.defaultValue === true,
                            isDefaultFalse: f.defaultValue !== 'true' && f.defaultValue !== true,
                            picklistValuesList: f.picklistValues || [],
                            picklistDisplay: f.picklistValues ? f.picklistValues.join(', ') : ''
                        };
                    })
                }));

                return {
                    ...msg,
                    cardData: {
                        ...msg.cardData,
                        schema: schema,
                        schemaString: JSON.stringify(schema),
                        objects: updatedObjects
                    }
                };
            }
            return msg;
        });
    }

    handleRemoveValidationRule(event) {
        const msgId = event.currentTarget.dataset.msgid;
        const objName = event.currentTarget.dataset.objname;
        const ruleName = event.currentTarget.dataset.rulename;

        this.messages = this.messages.map(msg => {
            if (msg.id === msgId) {
                const schema = JSON.parse(JSON.stringify(msg.cardData.schema));
                const obj = schema.objects.find(o => o.apiName === objName);
                if (obj) {
                    obj.validationRules = (obj.validationRules || []).filter(r => r.name !== ruleName);
                }

                const updatedObjects = (schema.objects || []).map(o => ({
                    ...o,
                    fieldCount: (o.fields || []).length,
                    hasValidations: o.validationRules && o.validationRules.length > 0,
                    fields: (o.fields || []).map(f => {
                        const t = f.type || 'Text';
                        return {
                            ...f,
                            isText: t === 'Text',
                            isNumber: t === 'Number',
                            isDate: t === 'Date',
                            isCheckbox: t === 'Checkbox',
                            isPicklist: t === 'Picklist',
                            isEmail: t === 'Email',
                            isPhone: t === 'Phone',
                            isDefaultTrue: f.defaultValue === 'true' || f.defaultValue === true,
                            isDefaultFalse: f.defaultValue !== 'true' && f.defaultValue !== true,
                            picklistValuesList: f.picklistValues || [],
                            picklistDisplay: f.picklistValues ? f.picklistValues.join(', ') : ''
                        };
                    })
                }));

                return {
                    ...msg,
                    cardData: {
                        ...msg.cardData,
                        schema: schema,
                        schemaString: JSON.stringify(schema),
                        objects: updatedObjects
                    }
                };
            }
            return msg;
        });
    }

    handleSchemaFieldChange(event) {
        const msgId = event.currentTarget.dataset.msgid;
        const objName = event.currentTarget.dataset.objname;
        const fieldName = event.currentTarget.dataset.fieldname;
        const prop = event.currentTarget.dataset.prop;
        const val = event.currentTarget.type === 'checkbox' ? event.currentTarget.checked : event.currentTarget.value;

        let processedVal = val;
        if (prop === 'apiName' && typeof val === 'string') {
            processedVal = val.trim().replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_]/g, '');
            if (processedVal) {
                if (processedVal.endsWith('_c') && !processedVal.endsWith('__c')) {
                    processedVal = processedVal.slice(0, -2) + '__c';
                } else if (!processedVal.endsWith('__c')) {
                    processedVal += '__c';
                }
            }
        }

        this.messages = this.messages.map(msg => {
            if (msg.id === msgId) {
                const schema = JSON.parse(JSON.stringify(msg.cardData.schema));
                const obj = schema.objects.find(o => o.apiName === objName);
                if (obj) {
                    const field = obj.fields.find(f => f.apiName === fieldName);
                    if (field) {
                        if (prop === 'length') {
                            field.length = parseInt(processedVal, 10) || 255;
                        } else {
                            field[prop] = processedVal;
                        }
                    }
                }

                const updatedObjects = (schema.objects || []).map(o => ({
                    ...o,
                    fieldCount: (o.fields || []).length,
                    hasValidations: o.validationRules && o.validationRules.length > 0,
                    fields: (o.fields || []).map(f => {
                        const t = f.type || 'Text';
                        return {
                            ...f,
                            isText: t === 'Text',
                            isNumber: t === 'Number',
                            isDate: t === 'Date',
                            isCheckbox: t === 'Checkbox',
                            isPicklist: t === 'Picklist',
                            isEmail: t === 'Email',
                            isPhone: t === 'Phone',
                            isDefaultTrue: f.defaultValue === 'true' || f.defaultValue === true,
                            isDefaultFalse: f.defaultValue !== 'true' && f.defaultValue !== true,
                            picklistValuesList: f.picklistValues || [],
                            picklistDisplay: f.picklistValues ? f.picklistValues.join(', ') : ''
                        };
                    })
                }));

                return {
                    ...msg,
                    cardData: {
                        ...msg.cardData,
                        schema: schema,
                        schemaString: JSON.stringify(schema),
                        objects: updatedObjects
                    }
                };
            }
            return msg;
        });
    }

    handleAddCustomField(event) {
        const msgId = event.currentTarget.dataset.msgid;
        const objName = event.currentTarget.dataset.objname;
        const newFieldName = 'Custom_Field_' + Math.floor(Math.random() * 1000000) + '__c';

        this.messages = this.messages.map(msg => {
            if (msg.id === msgId) {
                const schema = JSON.parse(JSON.stringify(msg.cardData.schema));
                const obj = schema.objects.find(o => o.apiName === objName);
                if (obj) {
                    if (!obj.fields) obj.fields = [];
                    obj.fields.push({
                        label: 'New Custom Field',
                        apiName: newFieldName,
                        type: 'Text',
                        required: false,
                        length: 255,
                        picklistValues: []
                    });
                }

                const updatedObjects = (schema.objects || []).map(o => ({
                    ...o,
                    fieldCount: (o.fields || []).length,
                    hasValidations: o.validationRules && o.validationRules.length > 0,
                    fields: (o.fields || []).map(f => {
                        const t = f.type || 'Text';
                        return {
                            ...f,
                            isText: t === 'Text',
                            isNumber: t === 'Number',
                            isDate: t === 'Date',
                            isCheckbox: t === 'Checkbox',
                            isPicklist: t === 'Picklist',
                            isEmail: t === 'Email',
                            isPhone: t === 'Phone',
                            isDefaultTrue: f.defaultValue === 'true' || f.defaultValue === true,
                            isDefaultFalse: f.defaultValue !== 'true' && f.defaultValue !== true,
                            picklistValuesList: f.picklistValues || [],
                            picklistDisplay: f.picklistValues ? f.picklistValues.join(', ') : ''
                        };
                    })
                }));

                return {
                    ...msg,
                    cardData: {
                        ...msg.cardData,
                        schema: schema,
                        schemaString: JSON.stringify(schema),
                        objects: updatedObjects
                    }
                };
            }
            return msg;
        });
    }

    handleRemoveCustomField(event) {
        const msgId = event.currentTarget.dataset.msgid;
        const objName = event.currentTarget.dataset.objname;
        const fieldName = event.currentTarget.dataset.fieldname;

        this.messages = this.messages.map(msg => {
            if (msg.id === msgId) {
                const schema = JSON.parse(JSON.stringify(msg.cardData.schema));
                const obj = schema.objects.find(o => o.apiName === objName);
                if (obj) {
                    obj.fields = (obj.fields || []).filter(f => f.apiName !== fieldName);
                }

                const updatedObjects = (schema.objects || []).map(o => ({
                    ...o,
                    fieldCount: (o.fields || []).length,
                    hasValidations: o.validationRules && o.validationRules.length > 0,
                    fields: (o.fields || []).map(f => {
                        const t = f.type || 'Text';
                        return {
                            ...f,
                            isText: t === 'Text',
                            isNumber: t === 'Number',
                            isDate: t === 'Date',
                            isCheckbox: t === 'Checkbox',
                            isPicklist: t === 'Picklist',
                            isEmail: t === 'Email',
                            isPhone: t === 'Phone',
                            isDefaultTrue: f.defaultValue === 'true' || f.defaultValue === true,
                            isDefaultFalse: f.defaultValue !== 'true' && f.defaultValue !== true,
                            picklistValuesList: f.picklistValues || [],
                            picklistDisplay: f.picklistValues ? f.picklistValues.join(', ') : ''
                        };
                    })
                }));

                return {
                    ...msg,
                    cardData: {
                        ...msg.cardData,
                        schema: schema,
                        schemaString: JSON.stringify(schema),
                        objects: updatedObjects
                    }
                };
            }
            return msg;
        });
    }

    handleAddValidationRule(event) {
        const msgId = event.currentTarget.dataset.msgid;
        const objName = event.currentTarget.dataset.objname;
        const newRuleName = 'Validation_Rule_' + Math.floor(Math.random() * 1000000);

        this.messages = this.messages.map(msg => {
            if (msg.id === msgId) {
                const schema = JSON.parse(JSON.stringify(msg.cardData.schema));
                const obj = schema.objects.find(o => o.apiName === objName);
                if (obj) {
                    if (!obj.validationRules) obj.validationRules = [];
                    obj.validationRules.push({
                        name: newRuleName,
                        formula: '',
                        errorMessage: 'Validation error description goes here.',
                        syntaxStatus: ''
                    });
                }

                const updatedObjects = (schema.objects || []).map(o => ({
                    ...o,
                    fieldCount: (o.fields || []).length,
                    hasValidations: o.validationRules && o.validationRules.length > 0,
                    fields: (o.fields || []).map(f => {
                        const t = f.type || 'Text';
                        return {
                            ...f,
                            isText: t === 'Text',
                            isNumber: t === 'Number',
                            isDate: t === 'Date',
                            isCheckbox: t === 'Checkbox',
                            isPicklist: t === 'Picklist',
                            isEmail: t === 'Email',
                            isPhone: t === 'Phone',
                            isDefaultTrue: f.defaultValue === 'true' || f.defaultValue === true,
                            isDefaultFalse: f.defaultValue !== 'true' && f.defaultValue !== true,
                            picklistValuesList: f.picklistValues || [],
                            picklistDisplay: f.picklistValues ? f.picklistValues.join(', ') : ''
                        };
                    })
                }));

                return {
                    ...msg,
                    cardData: {
                        ...msg.cardData,
                        schema: schema,
                        schemaString: JSON.stringify(schema),
                        objects: updatedObjects
                    }
                };
            }
            return msg;
        });
    }

    handleSchemaRuleChange(event) {
        const msgId = event.currentTarget.dataset.msgid;
        const objName = event.currentTarget.dataset.objname;
        const ruleName = event.currentTarget.dataset.rulename;
        const prop = event.currentTarget.dataset.prop;
        let val = event.currentTarget.value;

        if (prop === 'name') {
            val = val.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_]/g, '');
        }

        this.messages = this.messages.map(msg => {
            if (msg.id === msgId) {
                const schema = JSON.parse(JSON.stringify(msg.cardData.schema));
                const obj = schema.objects.find(o => o.apiName === objName);
                if (obj) {
                    const rule = (obj.validationRules || []).find(r => r.name === ruleName);
                    if (rule) {
                        rule[prop] = val;
                        if (prop === 'formula') {
                            rule.syntaxStatus = '';
                        }
                    }
                }

                const updatedObjects = (schema.objects || []).map(o => ({
                    ...o,
                    fieldCount: (o.fields || []).length,
                    hasValidations: o.validationRules && o.validationRules.length > 0,
                    fields: (o.fields || []).map(f => {
                        const t = f.type || 'Text';
                        return {
                            ...f,
                            isText: t === 'Text',
                            isNumber: t === 'Number',
                            isDate: t === 'Date',
                            isCheckbox: t === 'Checkbox',
                            isPicklist: t === 'Picklist',
                            isEmail: t === 'Email',
                            isPhone: t === 'Phone',
                            isDefaultTrue: f.defaultValue === 'true' || f.defaultValue === true,
                            isDefaultFalse: f.defaultValue !== 'true' && f.defaultValue !== true,
                            picklistValuesList: f.picklistValues || [],
                            picklistDisplay: f.picklistValues ? f.picklistValues.join(', ') : ''
                        };
                    })
                }));

                return {
                    ...msg,
                    cardData: {
                        ...msg.cardData,
                        schema: schema,
                        schemaString: JSON.stringify(schema),
                        objects: updatedObjects
                    }
                };
            }
            return msg;
        });
    }

    handleCheckFormulaSyntax(event) {
        const msgId = event.currentTarget.dataset.msgid;
        const objName = event.currentTarget.dataset.objname;
        const ruleName = event.currentTarget.dataset.rulename;

        const cardMsg = this.messages.find(msg => msg.id === msgId);
        if (!cardMsg) return;

        const schema = cardMsg.cardData.schema;
        const obj = schema.objects.find(o => o.apiName === objName);
        if (!obj) return;

        const rule = (obj.validationRules || []).find(r => r.name === ruleName);
        if (!rule || !rule.formula) {
            this.updateRuleSyntaxStatus(msgId, objName, ruleName, '❌ Error: Formula is empty.');
            return;
        }

        this.updateRuleSyntaxStatus(msgId, objName, ruleName, '⏳ Checking syntax...');

        checkValidationFormula({
            objectApiName: objName,
            formula: rule.formula,
            fieldsJson: JSON.stringify(obj.fields || [])
        })
            .then(resStr => {
                const res = JSON.parse(resStr);
                if (res.isValid) {
                    this.updateRuleSyntaxStatus(msgId, objName, ruleName, '✅ Syntax is valid.');
                } else {
                    this.updateRuleSyntaxStatus(msgId, objName, ruleName, `❌ Syntax Error: ${res.errorMessage}`);
                }
            })
            .catch(e => {
                this.updateRuleSyntaxStatus(msgId, objName, ruleName, `❌ Callout Error: ${e.body?.message || e.message}`);
            });
    }

    updateRuleSyntaxStatus(msgId, objName, ruleName, statusText) {
        this.messages = this.messages.map(msg => {
            if (msg.id === msgId) {
                const schema = JSON.parse(JSON.stringify(msg.cardData.schema));
                const obj = schema.objects.find(o => o.apiName === objName);
                if (obj) {
                    const rule = (obj.validationRules || []).find(r => r.name === ruleName);
                    if (rule) {
                        rule.syntaxStatus = statusText;
                    }
                }

                const updatedObjects = (schema.objects || []).map(o => ({
                    ...o,
                    fieldCount: (o.fields || []).length,
                    hasValidations: o.validationRules && o.validationRules.length > 0,
                    fields: (o.fields || []).map(f => {
                        const t = f.type || 'Text';
                        return {
                            ...f,
                            isText: t === 'Text',
                            isNumber: t === 'Number',
                            isDate: t === 'Date',
                            isCheckbox: t === 'Checkbox',
                            isPicklist: t === 'Picklist',
                            isEmail: t === 'Email',
                            isPhone: t === 'Phone',
                            isDefaultTrue: f.defaultValue === 'true' || f.defaultValue === true,
                            isDefaultFalse: f.defaultValue !== 'true' && f.defaultValue !== true,
                            picklistValuesList: f.picklistValues || [],
                            picklistDisplay: f.picklistValues ? f.picklistValues.join(', ') : ''
                        };
                    })
                }));

                return {
                    ...msg,
                    cardData: {
                        ...msg.cardData,
                        schema: schema,
                        schemaString: JSON.stringify(schema),
                        objects: updatedObjects
                    }
                };
            }
            return msg;
        });
    }

    handleRemovePicklistValue(event) {
        const msgId = event.currentTarget.dataset.msgid;
        const objName = event.currentTarget.dataset.objname;
        const fieldName = event.currentTarget.dataset.fieldname;
        const valToRemove = event.currentTarget.dataset.val;

        this.messages = this.messages.map(msg => {
            if (msg.id === msgId) {
                const schema = JSON.parse(JSON.stringify(msg.cardData.schema));
                const obj = schema.objects.find(o => o.apiName === objName);
                if (obj) {
                    const field = obj.fields.find(f => f.apiName === fieldName);
                    if (field) {
                        field.picklistValues = (field.picklistValues || []).filter(v => v !== valToRemove);
                    }
                }

                const updatedObjects = (schema.objects || []).map(o => ({
                    ...o,
                    fields: (o.fields || []).map(f => {
                        const t = f.type || 'Text';
                        return {
                            ...f,
                            isText: t === 'Text',
                            isNumber: t === 'Number',
                            isDate: t === 'Date',
                            isCheckbox: t === 'Checkbox',
                            isPicklist: t === 'Picklist',
                            isEmail: t === 'Email',
                            isPhone: t === 'Phone',
                            isDefaultTrue: f.defaultValue === 'true' || f.defaultValue === true,
                            isDefaultFalse: f.defaultValue !== 'true' && f.defaultValue !== true,
                            picklistValuesList: f.picklistValues || [],
                            picklistDisplay: f.picklistValues ? f.picklistValues.join(', ') : ''
                        };
                    })
                }));

                return {
                    ...msg,
                    cardData: {
                        ...msg.cardData,
                        schema: schema,
                        schemaString: JSON.stringify(schema),
                        objects: updatedObjects
                    }
                };
            }
            return msg;
        });
    }

    handleAddPicklistValue(event) {
        const msgId = event.currentTarget.dataset.msgid;
        const objName = event.currentTarget.dataset.objname;
        const fieldName = event.currentTarget.dataset.fieldname;

        const inputElem = this.template.querySelector(`[data-inputfield="${fieldName}"]`);
        const valToAdd = inputElem ? inputElem.value.trim() : '';
        if (!valToAdd) return;

        inputElem.value = '';

        this.messages = this.messages.map(msg => {
            if (msg.id === msgId) {
                const schema = JSON.parse(JSON.stringify(msg.cardData.schema));
                const obj = schema.objects.find(o => o.apiName === objName);
                if (obj) {
                    const field = obj.fields.find(f => f.apiName === fieldName);
                    if (field) {
                        if (!field.picklistValues) {
                            field.picklistValues = [];
                        }
                        if (!field.picklistValues.includes(valToAdd)) {
                            field.picklistValues.push(valToAdd);
                        }
                    }
                }

                const updatedObjects = (schema.objects || []).map(o => ({
                    ...o,
                    fields: (o.fields || []).map(f => {
                        const t = f.type || 'Text';
                        return {
                            ...f,
                            isText: t === 'Text',
                            isNumber: t === 'Number',
                            isDate: t === 'Date',
                            isCheckbox: t === 'Checkbox',
                            isPicklist: t === 'Picklist',
                            isEmail: t === 'Email',
                            isPhone: t === 'Phone',
                            isDefaultTrue: f.defaultValue === 'true' || f.defaultValue === true,
                            isDefaultFalse: f.defaultValue !== 'true' && f.defaultValue !== true,
                            picklistValuesList: f.picklistValues || [],
                            picklistDisplay: f.picklistValues ? f.picklistValues.join(', ') : ''
                        };
                    })
                }));

                return {
                    ...msg,
                    cardData: {
                        ...msg.cardData,
                        schema: schema,
                        schemaString: JSON.stringify(schema),
                        objects: updatedObjects
                    }
                };
            }
            return msg;
        });
    }

    handlePicklistInputKeyPress(event) {
        if (event.key === 'Enter') {
            const fieldName = event.currentTarget.dataset.inputfield;
            const addBtn = this.template.querySelector(`[data-fieldname="${fieldName}"][class="btn-add-pill"]`);
            if (addBtn) {
                addBtn.click();
            }
        }
    }

    // Deploy Custom Metadata (Creator card action)
    handleDeploySchemaClick(event) {
        const msgId = event.currentTarget.dataset.msgid;
        const schemaStr = event.currentTarget.dataset.schema;
        this.executeDeploySchema(msgId, schemaStr);
    }

    executeDeploySchema(msgId, schemaStr) {
        this.setSchemaCardState(msgId, { deploying: true });

        deployMetadataSchema({ schemaJson: schemaStr })
            .then(resStr => {
                const res = JSON.parse(resStr);
                this.setSchemaCardState(msgId, {
                    deploying: false,
                    isDeployed: true,
                    success: res.success,
                    resultMessage: res.message,
                    deployClass: res.success ? 'result-box-success' : 'result-box-error',
                    emoji: res.success ? '🎉' : '⚠️',
                    created: res.created || [],
                    alreadyPresent: res.alreadyPresent || [],
                    deployErrors: res.errors || []
                });
            })
            .catch(e => {
                this.setSchemaCardState(msgId, {
                    deploying: false,
                    isDeployed: true,
                    success: false,
                    resultMessage: e.body?.message || e.message,
                    deployClass: 'result-box-error',
                    emoji: '⚠️',
                    deployErrors: []
                });
                this.statusText = 'Inactive';
                this.statusClass = 'status-dot offline';
            });
    }

    injectConflictCard(schemaCardMsgId, objectLabel, objectApiName, schema) {
        const conflictCardId = 'conflict_' + Date.now();
        this.messages = [
            ...this.messages,
            {
                id: conflictCardId,
                sender: 'bot',
                isBot: true,
                text: `I've detected that the Custom Object "${objectLabel} (${objectApiName})" already exists in your Salesforce org.`,
                isCard: true,
                isConflictResolver: true,
                cardType: 'conflictResolver',
                bubbleClass: 'message-bubble-row bot',
                cardData: {
                    msgId: conflictCardId,
                    schemaCardMsgId: schemaCardMsgId,
                    objectLabel: objectLabel,
                    objectApiName: objectApiName,
                    schemaString: JSON.stringify(schema),
                    isDeployed: false,
                    deploying: false,
                    resultMessage: '',
                    success: false,
                    deployClass: '',
                    emoji: '',
                    deployErrors: []
                }
            }
        ];
        this.scrollToBottom();
    }

    handleConflictRename(event) {
        const inputEl = this.template.querySelector('.object-rename-input');
        if (inputEl) {
            inputEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
            inputEl.focus();
        } else {
            this.appendBotMessage('Please scroll up to the proposed Salesforce Schema card and edit the Object API Name input, then try deploying again.');
        }
    }

    handleConflictAppendBoth(event) {
        const msgId = event.currentTarget.dataset.msgid;
        const schemaStr = event.currentTarget.dataset.schema;
        this.executeDeploySchema(msgId, schemaStr);
    }

    handleConflictAppendFields(event) {
        const msgId = event.currentTarget.dataset.msgid;
        const schemaStr = event.currentTarget.dataset.schema;
        let schema;
        try {
            schema = JSON.parse(schemaStr);
        } catch (e) {
            return;
        }
        if (schema.objects) {
            schema.objects.forEach(obj => {
                delete obj.validationRules;
            });
        }
        this.executeDeploySchema(msgId, JSON.stringify(schema));
    }

    handleConflictAppendRules(event) {
        const msgId = event.currentTarget.dataset.msgid;
        const schemaStr = event.currentTarget.dataset.schema;
        let schema;
        try {
            schema = JSON.parse(schemaStr);
        } catch (e) {
            return;
        }
        if (schema.objects) {
            schema.objects.forEach(obj => {
                delete obj.fields;
            });
        }
        this.executeDeploySchema(msgId, JSON.stringify(schema));
    }

    setSchemaCardState(msgId, stateUpdates) {
        this.messages = this.messages.map(msg => {
            if (msg.id === msgId) {
                return {
                    ...msg,
                    cardData: {
                        ...msg.cardData,
                        ...stateUpdates
                    }
                };
            }
            return msg;
        });
    }

    // CSV File Import Flow
    handleFileChange(event) {
        const file = event.target.files[0];
        if (!file) return;
        event.target.value = '';

        this.fileName = file.name;

        const reader = new FileReader();
        reader.onload = () => {
            this.fileBase64 = reader.result.split(',')[1];
            // Open modal to choose between record import and schema creation
            this.showFileModeSelector = true;
        };
        reader.readAsDataURL(file);
    }

    handleFileImportMode() {
        this.showFileModeSelector = false;
        this.showObjectSelector = true;
        this.objectSearchKey = '';
        this.selectedObject = '';
    }

    handleFileSchemaMode() {
        this.showFileModeSelector = false;
        this.isLoading = true;

        // Append a virtual user bubble to show action
        const userMsgId = 'msg_' + Date.now();
        this.messages = [
            ...this.messages,
            {
                id: userMsgId,
                sender: 'user',
                isBot: false,
                text: `Create custom schema from uploaded file "${this.fileName}"`,
                isCard: false,
                bubbleClass: 'message-bubble-row user'
            }
        ];

        this.scrollToBottom();

        // Call FastAPI copilot message with file contents
        sendCopilotMessage({
            message: `Extract and create a custom Salesforce object schema from the headers and data in the attached file: "${this.fileName}".`,
            recordId: null,
            fileName: this.fileName,
            fileBase64: this.fileBase64
        })
            .then(resultStr => {
                const result = JSON.parse(resultStr);
                this.statusText = 'Active';
                this.statusClass = 'status-dot online';
                this.handleRouterResponse(result);
            })
            .catch(e => {
                this.appendBotMessage('Sorry, I encountered an error creating custom metadata schema: ' + (e.body?.message || e.message));
                this.statusText = 'Inactive';
                this.statusClass = 'status-dot offline';
                this.isLoading = false;
            })
            .finally(() => {
                this.fileBase64 = '';
                this.fileName = '';
            });
    }

    cancelFileModeSelection() {
        this.showFileModeSelector = false;
        this.fileBase64 = '';
        this.fileName = '';
    }

    handleObjectSearchInput(event) {
        this.objectSearchKey = event.target.value;
    }

    handleSelectObject(event) {
        this.selectedObject = event.currentTarget.dataset.value;
        this.objectSearchKey = this.selectedObject;
        this.showObjectSelector = false;

        // Fetch mappings from backend
        this.isLoading = true;
        getHeaderMappings({
            base64File: this.fileBase64,
            fileName: this.fileName,
            objectName: this.selectedObject
        })
            .then(resStr => {
                const res = JSON.parse(resStr);
                this.statusText = 'Active';
                this.statusClass = 'status-dot online';
                this.injectFieldMappingCard(res);
            })
            .catch(e => {
                this.appendBotMessage('Failed to parse file header mappings: ' + (e.body?.message || e.message));
                this.statusText = 'Inactive';
                this.statusClass = 'status-dot offline';
            })
            .finally(() => {
                this.isLoading = false;
                this.fileBase64 = '';
                this.fileName = '';
            });
    }

    injectFieldMappingCard(res) {
        const cardId = 'map_' + Date.now();

        // Match mapped fields
        const mappedHeaders = (res.headers || []).map((h, index) => {
            // Find which option to select by default
            const alignedFields = (res.fields || []).map(f => {
                const isSelected = f.apiName === h.selectedField;
                return {
                    label: `${f.label} (${f.apiName})`,
                    value: f.apiName,
                    isSelected: isSelected
                };
            });

            return {
                id: 'h_' + index,
                name: h.header,
                selectedField: h.selectedField,
                confidence: h.confidence,
                availableFields: alignedFields
            };
        });

        this.messages = [
            ...this.messages,
            {
                id: cardId,
                sender: 'bot',
                isBot: true,
                text: `I've analyzed your file headers for Salesforce Object "${res.fileName || this.selectedObject}". Please confirm field alignments:`,
                isCard: true,
                isFieldMapper: true,
                cardType: 'fieldMapper',
                bubbleClass: 'message-bubble-row bot',
                cardData: {
                    objectName: this.selectedObject,
                    csvData: res.csvData,
                    headers: mappedHeaders,
                    availableFields: (res.fields || []).map(f => ({
                        label: `${f.label} (${f.apiName})`,
                        value: f.apiName
                    })),
                    importing: false
                }
            }
        ];
        this.scrollToBottom();
    }

    handleFieldMappingChange(event) {
        const headerName = event.currentTarget.dataset.header;
        const val = event.target.value;
        const msgId = event.currentTarget.dataset.msgid;

        this.messages = this.messages.map(msg => {
            if (msg.id === msgId) {
                const updatedHeaders = msg.cardData.headers.map(h => {
                    if (h.name === headerName) {
                        return { ...h, selectedField: val };
                    }
                    return h;
                });
                return { ...msg, cardData: { ...msg.cardData, headers: updatedHeaders } };
            }
            return msg;
        });
    }

    handleExecuteImport(event) {
        const msgId = event.currentTarget.dataset.msgid;
        const objectName = event.currentTarget.dataset.objname;
        const csvData = event.currentTarget.dataset.csvdata;
        const operation = event.currentTarget.dataset.operation || 'insert';

        // Extract mapping array and convert to mapping json dictionary: Header -> ApiName
        const msg = this.messages.find(m => m.id === msgId);
        if (!msg) return;

        const mappings = {};
        msg.cardData.headers.forEach(h => {
            if (h.selectedField) {
                mappings[h.name] = h.selectedField;
            }
        });

        // Update card loading state
        this.messages = this.messages.map(m => {
            if (m.id === msgId) {
                return { ...m, cardData: { ...m.cardData, importing: true } };
            }
            return m;
        });

        executeDataImport({
            mappingJson: JSON.stringify(mappings),
            csvData: csvData,
            objectName: objectName,
            operation: operation
        })
            .then(resStr => {
                const res = JSON.parse(resStr);
                this.statusText = 'Active';
                this.statusClass = 'status-dot online';
                this.injectImportReportCard(res);
            })
            .catch(e => {
                this.appendBotMessage('Data Import failed: ' + (e.body?.message || e.message));
                this.statusText = 'Inactive';
                this.statusClass = 'status-dot offline';
            })
            .finally(() => {
                // Remove mapping card loading
                this.messages = this.messages.map(m => {
                    if (m.id === msgId) {
                        return { ...m, cardData: { ...m.cardData, importing: false } };
                    }
                    return m;
                });
            });
    }

    injectImportReportCard(res) {
        this.messages = [
            ...this.messages,
            {
                id: 'report_' + Date.now(),
                sender: 'bot',
                isBot: true,
                text: 'Import complete! Here are the execution results:',
                isCard: true,
                isImportReport: true,
                cardType: 'importReport',
                bubbleClass: 'message-bubble-row bot',
                cardData: {
                    operation: res.operation,
                    totalRecords: res.totalRecords,
                    successCount: res.successCount,
                    failureCount: res.failureCount,
                    errors: res.errors || [],
                    hasErrors: res.failureCount > 0,
                    success: res.failureCount === 0
                }
            }
        ];
        this.scrollToBottom();
    }

    appendBotMessage(text) {
        const textLower = text ? text.toLowerCase() : '';
        const isConfirmation = textLower && (
            textLower.includes('reply yes to confirm') || 
            textLower.includes('yes_confirm') ||
            textLower.includes('confirm or no to cancel') ||
            textLower.includes('shall i apply') ||
            textLower.includes('do you want to proceed') ||
            textLower.includes('reply yes')
        );
        const confirmVal = textLower.includes('yes_confirm') ? 'YES_CONFIRM' : 'YES';
        
        this.messages = [
            ...this.messages,
            { 
                id: 'msg_' + Date.now(), 
                sender: 'bot', 
                isBot: true, 
                text, 
                isCard: false, 
                bubbleClass: 'message-bubble-row bot',
                isConfirmation: isConfirmation,
                confirmVal: confirmVal
            }
        ];
        this.scrollToBottom();
    }

    parseMarkdownTable(markdown) {
        if (!markdown) return { hasTable: false };
        try {
            const lines = markdown.split('\n');
            const hasPipes = lines.some(line => line.trim().startsWith('|') || line.includes(' | '));
            
            if (hasPipes) {
                const tableLines = lines.filter(line => line.trim().includes('|'));
                if (tableLines.length < 2) {
                    return { hasTable: false, note: markdown };
                }
                const headers = tableLines[0]
                    .split('|')
                    .map(cell => cell.trim())
                    .filter(Boolean);
                    
                const rows = [];
                let rowCounter = 0;
                const startIndex = tableLines[1].includes('---') ? 2 : 1;
                for (let i = startIndex; i < tableLines.length; i++) {
                    const cells = tableLines[i]
                        .split('|')
                        .map(cell => cell.trim())
                        .filter(Boolean);
                    if (cells.length > 0) {
                        rows.push({
                            id: 'row_' + rowCounter++,
                            cells: cells
                        });
                    }
                }
                const note = lines.filter(line => !line.trim().includes('|') && line.trim().length > 0).join('\n');
                return { hasTable: true, headers, rows, note };
            } else {
                // Parse as tab-separated or space-aligned (multiple spaces)
                const tableLines = lines.filter(line => line.includes('\t') || line.match(/\s{2,}/));
                if (tableLines.length < 2) {
                    return { hasTable: false, note: markdown };
                }
                
                const splitPattern = /\t|\s{2,}/;
                const headers = tableLines[0].split(splitPattern).map(cell => cell.trim()).filter(cell => cell && cell !== '📊 Salesforce Security Audit Report');
                
                const rows = [];
                let rowCounter = 0;
                for (let i = 1; i < tableLines.length; i++) {
                    const cells = tableLines[i].split(splitPattern).map(cell => cell.trim()).filter(Boolean);
                    if (cells.length > 0 && cells.length >= Math.min(2, headers.length)) {
                        rows.push({
                            id: 'row_' + rowCounter++,
                            cells: cells
                        });
                    }
                }
                const note = lines.filter(line => !tableLines.includes(line) && line.trim().length > 0).join('\n');
                return { hasTable: rows.length > 0, headers, rows, note };
            }
        } catch (e) {
            console.error('Error parsing table:', e);
            return { hasTable: false, note: markdown };
        }
    }

    handleConfirmClick(event) {
        const val = event.currentTarget.dataset.val;
        const msgText = val === 'NO' ? 'Cancel' : 'Approve';
        
        // Hide the confirmation buttons
        this.messages = this.messages.map(msg => ({
            ...msg,
            isConfirmation: false
        }));
        
        // Append user response message
        this.messages = [
            ...this.messages,
            { id: 'user_' + Date.now(), sender: 'user', isBot: false, text: msgText, bubbleClass: 'message-bubble-row user' }
        ];
        
        this.isLoading = true;
        this.scrollToBottom();
        
        sendCopilotMessage({
            message: val,
            sessionId: this.sessionId,
            orgUrl: this.orgUrl,
            recordId: this.recordId,
            runningUserId: null,
            fileContent: null,
            fileName: null
        })
        .then(result => {
            this.handleRouterResponse(result);
        })
        .catch(error => {
            this.isLoading = false;
            this.appendBotMessage('Sorry, I encountered an error executing confirmation: ' + (error.body?.message || error.message));
        });
    }

    scrollToBottom() {
        setTimeout(() => {
            const feed = this.template.querySelector('.copilot-feed');
            if (feed) {
                feed.scrollTop = feed.scrollHeight;
            }
        }, 100);
    }

    showToast(title, message, variant) {
        this.dispatchEvent(new ShowToastEvent({ title, message, variant }));
    }
}
