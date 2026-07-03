import { LightningElement, track } from 'lwc';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import parseDocument from '@salesforce/apex/SalesforceAgentController.parseDocument';
import deploySchema from '@salesforce/apex/SalesforceAgentController.deploySchema';

export default class SchemaAgent extends LightningElement {
    @track showUpload = true;
    @track showPreview = false;
    @track showResult = false;
    @track isLoading = false;
    @track parsedObjects = [];
    @track resultMessage = '';
    @track resultSuccess = false;
    @track deployErrors = null;
    @track deployCreated = null;
    @track promptText = '';
    @track inputMode = 'file'; // 'file' or 'prompt'

    parsedSchema = null;

    fieldColumns = [
        { label: 'Field Label', fieldName: 'label' },
        { label: 'API Name', fieldName: 'apiName' },
        { label: 'Type', fieldName: 'type' },
        { label: 'Required', fieldName: 'required', type: 'boolean' },
        { label: 'Picklist Values', fieldName: 'picklistDisplay' }
    ];

    get step1Class() { return this.showUpload ? 'step-item step-active' : 'step-item step-done'; }
    get step2Class() { return this.showPreview ? 'step-item step-active' : (this.showResult ? 'step-item step-done' : 'step-item'); }
    get step3Class() { return this.showResult ? 'step-item step-active' : 'step-item'; }
    get resultBoxClass() { return this.resultSuccess ? 'result-box-success' : 'result-box-error'; }
    get resultEmoji() { return this.resultSuccess ? '🎉' : '⚠️'; }

    get fileModeClass() { return this.inputMode === 'file' ? 'toggle-btn active' : 'toggle-btn'; }
    get promptModeClass() { return this.inputMode === 'prompt' ? 'toggle-btn active' : 'toggle-btn'; }
    get isFileMode() { return this.inputMode === 'file'; }
    get isPromptMode() { return this.inputMode === 'prompt'; }

    setFileInputMode() { this.inputMode = 'file'; }
    setPromptInputMode() { this.inputMode = 'prompt'; }

    handlePromptChange(event) { this.promptText = event.target.value; }

    handlePromptSubmit() {
        if (!this.promptText.trim()) { this.showToast('Error', 'Please enter a prompt', 'error'); return; }
        this.isLoading = true;
        parseDocument({ base64Content: null, fileName: null, promptText: this.promptText })
            .then(schema => this._handleSchema(schema))
            .catch(e => this.showToast('Error', e.body?.message || e.message || 'Unknown error', 'error'))
            .finally(() => { this.isLoading = false; });
    }

    handleFileChange(event) {
        const file = event.target.files[0];
        if (!file) return;
        this.isLoading = true;
        const reader = new FileReader();
        reader.addEventListener('load', (loadEvent) => {
            const base64 = loadEvent.target.result.split(',')[1];
            parseDocument({ base64Content: base64, fileName: file.name, promptText: null })
                .then(schema => this._handleSchema(schema))
                .catch(e => this.showToast('Error', e.body?.message || e.message || 'Unknown error', 'error'))
                .finally(() => { this.isLoading = false; });
        });
        reader.addEventListener('error', () => { this.showToast('Error', 'Failed to read file', 'error'); this.isLoading = false; });
        reader.readAsDataURL(file);
    }

    _handleSchema(schema) {
        this.parsedSchema = schema;
        this.parsedObjects = (schema.objects || []).map(obj => ({
            ...obj,
            fieldCount: (obj.fields || []).length,
            hasValidations: obj.validationRules && obj.validationRules.length > 0,
            fields: (obj.fields || []).map(f => ({ ...f, picklistDisplay: f.picklistValues ? f.picklistValues.join(', ') : '' }))
        }));
        this.showUpload = false;
        this.showPreview = true;
    }

    handleDeploy() {
        this.isLoading = true;
        deploySchema({ schemaJson: JSON.stringify(this.parsedSchema) })
            .then(result => {
                this.showPreview = false;
                this.showResult = true;
                this.resultSuccess = result.success;
                this.resultMessage = result.message;
                this.deployErrors = result.errors && result.errors.length > 0 ? result.errors : null;
                this.deployCreated = result.created && result.created.length > 0 ? result.created : null;
            })
            .catch(e => this.showToast('Deploy Error', e.body?.message || e.message || 'Unknown error', 'error'))
            .finally(() => { this.isLoading = false; });
    }

    handleReset() {
        this.showUpload = true;
        this.showPreview = false;
        this.showResult = false;
        this.parsedObjects = [];
        this.parsedSchema = null;
        this.deployErrors = null;
        this.deployCreated = null;
        this.promptText = '';
        this.inputMode = 'file';
    }

    showToast(title, message, variant) {
        this.dispatchEvent(new ShowToastEvent({ title, message, variant }));
    }
}
