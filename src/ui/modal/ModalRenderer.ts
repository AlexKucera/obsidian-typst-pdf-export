/**
 * Modal Rendering Logic
 * Handles all DOM creation and styling for the ExportConfigModal
 */

import { App } from 'obsidian';
import { ModalState } from './state/ModalState';
import { ModalSection } from './modalTypes';

export interface ModalRendererCallbacks {
	onReset: () => void;
	onCancel: () => void;
	onSubmit: () => void;
}

export class ModalRenderer {
	private state: ModalState;
	private sections: Map<string, ModalSection>;
	private callbacks: ModalRendererCallbacks;
	private app?: App;
	
	// UI elements managed by this renderer
	private contentContainer!: HTMLElement;
	private formContainer!: HTMLElement;
	private progressContainer!: HTMLElement;
	private progressBar!: HTMLElement;
	private progressText!: HTMLElement;
	private submitButton!: HTMLButtonElement;
	private cancelButton!: HTMLButtonElement;
	private resetButton!: HTMLButtonElement;
	
	constructor(
		state: ModalState,
		sections: Map<string, ModalSection>,
		callbacks: ModalRendererCallbacks,
		app?: App
	) {
		this.state = state;
		this.sections = sections;
		this.callbacks = callbacks;
		this.app = app;
	}
	
	/**
	 * Initialize the renderer with the modal's content container
	 */
	initialize(contentContainer: HTMLElement): void {
		this.contentContainer = contentContainer;
		this.setupInitialLayout();
		this.addModalStyles();
	}
	
	/**
	 * Set up the initial modal layout structure
	 */
	private setupInitialLayout(): void {
		// Create main form container
		this.formContainer = this.contentContainer.createDiv('export-config-form');
		
		// Create header
		this.createHeader();
		
		// Render sections
		this.renderSections();
		
		// Create progress container (initially hidden)
		this.createProgressContainer();
		
		// Create action buttons
		this.createActionButtons();
	}
	
	/**
	 * Create the modal header with title and note information
	 */
	private createHeader(): void {
		const header = this.contentContainer.createDiv('export-config-header');
		header.createEl('h2', { text: 'Export to PDF' });
		
		if (this.state.settings.noteTitle) {
			const isMultiFile = this.state.settings.files && this.state.settings.files.length > 1;
			const displayText = isMultiFile 
				? `Exporting ${this.state.settings.files!.length} files`
				: `Exporting: ${this.state.settings.noteTitle}`;
				
			header.createEl('p', { 
				text: displayText,
				cls: 'export-note-title'
			});
		}
	}
	
	/**
	 * Render all configuration sections
	 */
	private renderSections(): void {
		// Clear existing content
		this.formContainer.empty();
		
		// Render each section
		this.sections.forEach(section => {
			section.render(this.formContainer, this.state, this.app);
		});
	}
	
	/**
	 * Create the progress container with progress bar and text
	 */
	private createProgressContainer(): void {
		this.progressContainer = this.contentContainer.createDiv('export-progress-container');
		this.progressContainer.addClass('export-hidden');
		
		// Progress text
		this.progressText = this.progressContainer.createEl('div', {
			cls: 'export-progress-text',
			text: 'Preparing export...'
		});
		
		// Progress bar container
		const progressBarContainer = this.progressContainer.createDiv('export-progress-bar-container');
		this.progressBar = progressBarContainer.createDiv('export-progress-bar');
		
		// Progress percentage
		const _progressPercent = this.progressContainer.createEl('div', {
			cls: 'export-progress-percent',
			text: '0%'
		});
	}
	
	/**
	 * Create action buttons (Reset, Cancel, Export)
	 */
	private createActionButtons(): void {
		const buttonContainer = this.contentContainer.createDiv('export-config-buttons');
		
		// Reset button (left side)
		this.resetButton = buttonContainer.createEl('button', {
			text: 'Reset to Defaults',
			cls: 'mod-muted'
		});
		this.resetButton.addEventListener('click', () => this.callbacks.onReset());
		
		// Right side buttons container
		const rightButtons = buttonContainer.createDiv('right-buttons');
		
		// Cancel button
		this.cancelButton = rightButtons.createEl('button', {
			text: 'Cancel',
			cls: 'mod-cancel'
		});
		this.cancelButton.addEventListener('click', () => this.callbacks.onCancel());
		
		// Export button
		this.submitButton = rightButtons.createEl('button', {
			text: 'Export',
			cls: 'mod-cta'
		});
		this.submitButton.addEventListener('click', () => this.callbacks.onSubmit());
	}
	
	/**
	 * Show progress with message and percentage
	 */
	showProgress(message: string, percent: number): void {
		this.progressContainer.addClass('export-progress-visible');
		this.formContainer.addClass('export-form-hidden');
		
		this.progressText.textContent = message;
		
		if (percent >= 0) {
			this.progressBar.style.setProperty('--progress-width', `${percent}%`);
			const percentEl = this.progressContainer.querySelector('.export-progress-percent');
			if (percentEl) {
				percentEl.textContent = `${Math.round(percent)}%`;
			}
		}
		
		// Update state
		this.state.setProgress(percent, message);
	}
	
	/**
	 * Update progress - public interface for modal to use
	 */
	updateProgress(message: string, percent: number): void {
		this.showProgress(message, percent);
	}
	
	/**
	 * Re-render sections when state changes
	 */
	refreshSections(): void {
		this.renderSections();
	}
	
	/**
	 * Set button states during export
	 */
	setExportingState(isExporting: boolean): void {
		if (isExporting) {
			this.submitButton.disabled = true;
			this.resetButton.disabled = true;
			this.cancelButton.textContent = 'Close';
		} else {
			this.submitButton.disabled = false;
			this.resetButton.disabled = false;
			this.cancelButton.textContent = 'Cancel';
		}
	}
	
	/**
	 * Show validation errors in the form
	 */
	showValidationErrors(errors: string[]): void {
		// Remove any existing error containers
		const existingErrors = this.formContainer.querySelector('.validation-errors');
		if (existingErrors) {
			existingErrors.remove();
		}
		
		const errorContainer = this.formContainer.createDiv('validation-errors');
		errorContainer.createEl('h4', { text: 'Validation Errors', cls: 'error-title' });
		
		const errorList = errorContainer.createEl('ul');
		errors.forEach(error => {
			errorList.createEl('li', { text: error });
		});
		
		// Remove after 5 seconds
		setTimeout(() => errorContainer.remove(), 5000);
	}
	
	/**
	 * Show validation warnings in the form
	 */
	showValidationWarnings(warnings: string[]): void {
		// Remove any existing warning containers
		const existingWarnings = this.formContainer.querySelector('.validation-warnings');
		if (existingWarnings) {
			existingWarnings.remove();
		}
		
		const warningContainer = this.formContainer.createDiv('validation-warnings');
		warningContainer.createEl('h4', { text: 'Warnings', cls: 'warning-title' });
		
		const warningList = warningContainer.createEl('ul');
		warnings.forEach(warning => {
			warningList.createEl('li', { text: warning });
		});
		
		// Remove after 5 seconds
		setTimeout(() => warningContainer.remove(), 5000);
	}
	
	/**
	 * Add custom CSS styles for the modal
	 */
	private addModalStyles(): void {
		// Add custom styles for the modal
		const style = document.createElement('style');
		style.textContent = `
			.export-config-modal {
				width: 90vw;
				max-width: 520px;
				height: 80vh;
				max-height: 600px;
			}
			
			.export-config-container {
				display: flex;
				flex-direction: column;
				height: 100%;
			}
			
			.export-config-header {
				padding: 16px 24px 8px 24px;
				border-bottom: 1px solid var(--background-modifier-border);
				flex-shrink: 0;
			}
			
			.export-config-header h2 {
				margin: 0 0 8px 0;
				font-size: 18px;
				font-weight: 600;
			}
			
			.export-note-title {
				margin: 0;
				font-size: 14px;
				color: var(--text-muted);
				opacity: 0.8;
			}
			
			.export-config-form {
				flex: 1;
				overflow-y: auto;
				padding: 16px 24px;
			}
			
			.export-config-section {
				margin-bottom: 24px;
			}
			
			.export-config-section:last-child {
				margin-bottom: 0;
			}
			
			.export-config-section-title {
				font-weight: 600;
				margin-bottom: 12px;
				padding-bottom: 4px;
				border-bottom: 1px solid var(--background-modifier-border-hover);
			}
			
			.export-config-buttons {
				padding: 16px 24px;
				border-top: 1px solid var(--background-modifier-border);
				display: flex;
				justify-content: space-between;
				align-items: center;
				flex-shrink: 0;
			}
			
			.export-config-buttons .right-buttons {
				display: flex;
				gap: 8px;
			}
			
			/* Progress styles */
			.export-progress-container {
				padding: 24px;
				text-align: center;
			}
			
			.export-progress-container.export-hidden {
				display: none;
			}
			
			.export-progress-container.export-progress-visible {
				display: block;
			}
			
			.export-form-hidden {
				display: none !important;
			}
			
			.export-progress-text {
				margin-bottom: 16px;
				font-size: 14px;
				color: var(--text-muted);
			}
			
			.export-progress-bar-container {
				width: 100%;
				height: 8px;
				background-color: var(--background-modifier-border);
				border-radius: 4px;
				margin-bottom: 8px;
				overflow: hidden;
			}
			
			.export-progress-bar {
				height: 100%;
				background-color: var(--interactive-accent);
				border-radius: 4px;
				width: var(--progress-width, 0%);
				transition: width 0.3s ease;
			}
			
			.export-progress-percent {
				font-size: 12px;
				color: var(--text-muted);
			}
			
			/* Form field styles */
			.export-setting-item {
				margin-bottom: 16px;
			}
			
			.export-setting-item-info {
				margin-bottom: 6px;
			}
			
			.export-setting-item-name {
				font-weight: 500;
				margin-bottom: 2px;
			}
			
			.export-setting-item-description {
				font-size: 12px;
				color: var(--text-muted);
			}
			
			.export-setting-item-control {
				display: flex;
				align-items: center;
			}
			
			.export-setting-item-control input,
			.export-setting-item-control select {
				flex: 1;
			}
			
			/* Folder suggest styles */
			.export-folder-suggest-container {
				position: relative;
			}
			
			.export-folder-suggest-input {
				width: 100%;
				padding: 6px 8px;
				border: 1px solid var(--background-modifier-border);
				border-radius: 4px;
				background: var(--background-primary);
				color: var(--text-normal);
			}
			
			.export-folder-suggest-input:focus {
				border-color: var(--interactive-accent);
				outline: none;
			}
			
			/* Validation styles */
			.validation-errors, .validation-warnings {
				background: var(--background-modifier-error);
				padding: 15px;
				border-radius: 5px;
				margin-bottom: 20px;
			}
			
			.validation-warnings {
				background: var(--background-modifier-warning);
			}
			
			.error-title {
				color: var(--text-error);
				margin: 0 0 10px 0;
			}
			
			.warning-title {
				color: var(--text-warning);
				margin: 0 0 10px 0;
			}
			
			.validation-errors ul, .validation-warnings ul {
				margin: 0;
				padding-left: 20px;
			}
			
			.export-validation-error {
				color: var(--text-error);
				font-size: 12px;
				margin-top: 4px;
			}
			
			.export-validation-warning {
				color: var(--text-warning);
				font-size: 12px;
				margin-top: 4px;
			}
			
			/* Template variable styles */
			.export-template-variables {
				margin-top: 12px;
			}
			
			.export-template-variable {
				margin-bottom: 8px;
				padding: 8px;
				background: var(--background-secondary);
				border-radius: 4px;
				font-size: 12px;
			}
			
			.export-template-variable-name {
				font-weight: 500;
				margin-bottom: 2px;
			}
			
			.export-template-variable-description {
				color: var(--text-muted);
				font-style: italic;
			}
		`;
		
		if (!document.head.querySelector('style[data-export-config-modal]')) {
			style.setAttribute('data-export-config-modal', 'true');
			document.head.appendChild(style);
		}
	}
}