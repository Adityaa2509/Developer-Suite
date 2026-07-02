import { LightningElement, track } from 'lwc';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';

export default class Veloq extends LightningElement {
    @track isBuilderMode = true;
    @track promptInput = '';
    @track fileName = '';
    @track isDragOver = false;
    @track isDeploying = false;
    @track isDropdownOpen = false;
    @track chatMessages = [
        { id: 1, text: "Hello! I am Veloq's Schema Copilot. Drag & drop a schema file or type a prompt to build custom Salesforce components.", sender: 'ai', cssClass: 'chat-msg chat-msg--ai' }
    ];
    @track draftFields = [];

    // ── Navigation & Dropdown ─────────────────────────────────────
    get currentModeLabel() {
        return this.isBuilderMode ? '🛠️ Builder Mode' : '🕵️ Debugger Mode';
    }

    get dropperAreaClass() {
        return this.isDragOver ? 'dropper-area active' : 'dropper-area';
    }

    toggleDropdown() {
        this.isDropdownOpen = !this.isDropdownOpen;
    }

    selectBuilderMode() {
        this.isBuilderMode = true;
        this.isDropdownOpen = false;
    }

    selectDebuggerMode() {
        this.isBuilderMode = false;
        this.isDropdownOpen = false;
    }

    // ── Drag and Drop ─────────────────────────────────────────────
    handleDragOver(e) {
        e.preventDefault();
        this.isDragOver = true;
    }

    handleDragLeave() {
        this.isDragOver = false;
    }

    handleDrop(e) {
        e.preventDefault();
        this.isDragOver = false;
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            this.fileName = files[0].name;
            this._mockAddFieldsFromFile();
        }
    }

    handleRemoveFile() {
        this.fileName = '';
        this.draftFields = [];
        this._addAiMessage("Cleared active schema files.");
    }

    // ── Chat Input ────────────────────────────────────────────────
    handlePromptInput(e) {
        this.promptInput = e.target.value;
    }

    handleKeyPress(e) {
        if (e.key === 'Enter') {
            this.handleSendPrompt();
        }
    }

    handleSendPrompt() {
        const text = this.promptInput.trim();
        if (!text) return;

        // Add user message
        this.chatMessages = [...this.chatMessages, {
            id: Date.now(),
            text: text,
            sender: 'user',
            cssClass: 'chat-msg chat-msg--user'
        }];
        this.promptInput = '';

        // Trigger AI reply and mock field generation after brief delay
        setTimeout(() => {
            this._mockAddFieldsFromPrompt(text);
        }, 1000);
    }

    handleDeleteField(e) {
        const fieldId = e.target.dataset.id;
        this.draftFields = this.draftFields.filter(f => f.id !== fieldId);
    }

    handleDeploySchema() {
        this.isDeploying = true;
        setTimeout(() => {
            this.isDeploying = false;
            this.draftFields = [];
            this.fileName = '';
            
            // Show Success Toast
            this.dispatchEvent(
                new ShowToastEvent({
                    title: 'Deployment Complete',
                    message: 'Successfully created custom objects and fields in this Salesforce Org!',
                    variant: 'success'
                })
            );
            
            this.chatMessages = [...this.chatMessages, {
                id: Date.now(),
                text: "🚀 Deployment finished! Check your Object Manager to verify the new components.",
                sender: 'ai',
                cssClass: 'chat-msg chat-msg--ai'
            }];
        }, 3000);
    }

    // ── Private Helper Mocks ──────────────────────────────────────
    _addAiMessage(text) {
        this.chatMessages = [...this.chatMessages, {
            id: Date.now(),
            text: text,
            sender: 'ai',
            cssClass: 'chat-msg chat-msg--ai'
        }];
        
        // Scroll chat to bottom
        setTimeout(() => {
            const chatDiv = this.template.querySelector('.chat-history');
            if (chatDiv) chatDiv.scrollTop = chatDiv.scrollHeight;
        }, 100);
    }

    _mockAddFieldsFromFile() {
        this._addAiMessage(`Successfully parsed "${this.fileName}". Generating draft schema...`);
        setTimeout(() => {
            this.draftFields = [
                { id: '1', label: 'Project Name', apiName: 'Project_Name__c', dataType: 'Text (80)', status: 'Draft' },
                { id: '2', label: 'Start Date', apiName: 'Start_Date__c', dataType: 'Date', status: 'Draft' },
                { id: '3', label: 'Due Date', apiName: 'Due_Date__c', dataType: 'Date', status: 'Draft' },
                { id: '4', label: 'Priority', apiName: 'Priority__c', dataType: 'Picklist (High, Medium, Low)', status: 'Draft' }
            ];
            this._addAiMessage("Created 4 custom field drafts. Review them in the table and click Deploy to proceed.");
        }, 1500);
    }

    _mockAddFieldsFromPrompt(prompt) {
        const lower = prompt.toLowerCase();
        this._addAiMessage("Processing your instructions...");

        setTimeout(() => {
            if (lower.includes('project') || lower.includes('date')) {
                this.draftFields = [
                    { id: 'p1', label: 'Project Manager', apiName: 'Project_Manager__c', dataType: 'Lookup(User)', status: 'Draft' },
                    { id: 'p2', label: 'Budget', apiName: 'Budget__c', dataType: 'Currency (16, 2)', status: 'Draft' },
                    { id: 'p3', label: 'Due Date Check', apiName: 'Due_Date_Check', dataType: 'Validation Rule', status: 'Draft' }
                ];
                this._addAiMessage("Drafted Project fields and 1 validation rule. Click Deploy to publish.");
            } else {
                this.draftFields = [
                    { id: 'g1', label: 'AI Custom Text', apiName: 'AI_Custom_Text__c', dataType: 'Text Area (Long)', status: 'Draft' },
                    { id: 'g2', label: 'Is Verified', apiName: 'Is_Verified__c', dataType: 'Checkbox', status: 'Draft' }
                ];
                this._addAiMessage("Drafted custom fields based on your prompt. Click Deploy to publish.");
            }
        }, 1200);
    }
}
