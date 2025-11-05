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
	onSubmit: () => void | Promise<void>;
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
		this.progressContainer.createEl('div', {
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
			text: 'Reset to defaults',
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
		this.submitButton.addEventListener('click', () => void this.callbacks.onSubmit());
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
		errorContainer.createEl('h4', { text: 'Validation errors', cls: 'error-title' });
		
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
}