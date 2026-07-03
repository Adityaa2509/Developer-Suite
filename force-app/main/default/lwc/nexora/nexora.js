import { LightningElement, track } from 'lwc';

export default class Nexora extends LightningElement {
    @track isBuilderMode = true;

    // ── Navigation ────────────────────────────────────────────────
    get builderTabClass() {
        return this.isBuilderMode ? 'mode-btn active' : 'mode-btn';
    }

    get debuggerTabClass() {
        return !this.isBuilderMode ? 'mode-btn active' : 'mode-btn';
    }

    showBuilder() { this.isBuilderMode = true; }
    showDebugger() { this.isBuilderMode = false; }
}
