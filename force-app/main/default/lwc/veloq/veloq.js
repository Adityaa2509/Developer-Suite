import { LightningElement, track } from 'lwc';

export default class Veloq extends LightningElement {
    @track isBuilderMode = true;
    @track isDropdownOpen = false;

    // ── Navigation & Dropdown ─────────────────────────────────────
    get currentModeLabel() {
        return this.isBuilderMode ? '🛠️ Builder Mode' : '🕵️ Debugger Mode';
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
}
