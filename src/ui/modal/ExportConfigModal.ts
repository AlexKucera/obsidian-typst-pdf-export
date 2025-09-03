/**
 * Export Configuration Modal
 * Refactored modular version that uses section components
 */

import { Modal, App, Notice } from 'obsidian';
import { obsidianTypstPDFExport } from '../../../main';
import { ExportConfig, ExportConfigModalSettings, ModalSection } from './modalTypes';
import { ModalState } from './state/ModalState';
import { GeneralSection } from './sections/GeneralSection';
import { TypographySection } from './sections/TypographySection';
import { PageSetupSection } from './sections/PageSetupSection';
import { BehaviorSection } from './sections/BehaviorSection';
import { TemplateManager } from '../../templates/TemplateManager';

export class ExportConfigModal extends Modal {
	plugin: obsidianTypstPDFExport;
	private state: ModalState;
	private sections: Map<string, ModalSection> = new Map();
	private onSubmit: (config: ExportConfig) => void;
	private onCancel?: () => void;
	
	// UI elements
	private contentContainer: HTMLElement;
	private formContainer: HTMLElement;
	private progressContainer: HTMLElement;
	private progressBar: HTMLElement;
	private progressText: HTMLElement;
	private submitButton: HTMLButtonElement;
	private cancelButton: HTMLButtonElement;
	private resetButton: HTMLButtonElement;
	
	constructor(
		app: App,
		plugin: obsidianTypstPDFExport,
		settings: Partial<ExportConfigModalSettings>,
		onSubmit: (config: ExportConfig) => void,
		onCancel?: () => void
	) {
		super(app);
		this.plugin = plugin;
		this.onSubmit = onSubmit;
		this.onCancel = onCancel;
		
		// Initialize state
		this.state = new ModalState(settings);
		
		// Register sections
		this.registerSections();
		
		// Listen for state changes
		this.state.onChange(() => this.handleStateChange());
	}
	
	private registerSections(): void {
		// Register all modal sections
		const sections = [
			new GeneralSection(),
			new PageSetupSection(),
			new TypographySection(),
			new BehaviorSection()
		];
		
		sections.forEach(section => {
			this.sections.set(section.getId(), section);
		});
	}
	
	onOpen(): void {
		const { contentEl } = this;
		contentEl.addClass('export-config-modal');
		
		// Add styles
		this.addModalStyles();
		
		// Create main container
		this.contentContainer = contentEl.createDiv('export-config-container');
		
		// Create header
		this.createHeader();
		
		// Create form container
		this.formContainer = this.contentContainer.createDiv('export-config-form');
		
		// Render sections
		this.renderSections();
		
		// Create progress container (initially hidden)
		this.createProgressContainer();
		
		// Create action buttons
		this.createActionButtons();
		
		// Load available templates
		this.loadAvailableTemplates();
	}
	
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
	
	private renderSections(): void {
		// Clear existing content
		this.formContainer.empty();
		
		// Render each section
		this.sections.forEach(section => {
			section.render(this.formContainer, this.state, this.app);
		});
	}
	
	private createProgressContainer(): void {
		this.progressContainer = this.contentContainer.createDiv('export-progress-container');
		this.progressContainer.style.display = 'none';
		
		// Progress text
		this.progressText = this.progressContainer.createEl('div', {
			cls: 'export-progress-text',
			text: 'Preparing export...'
		});
		
		// Progress bar container
		const progressBarContainer = this.progressContainer.createDiv('export-progress-bar-container');
		this.progressBar = progressBarContainer.createDiv('export-progress-bar');
		
		// Progress percentage
		const progressPercent = this.progressContainer.createEl('div', {
			cls: 'export-progress-percent',
			text: '0%'
		});
	}
	
	private createActionButtons(): void {
		const buttonContainer = this.contentContainer.createDiv('export-config-buttons');
		
		// Reset button (left side)
		this.resetButton = buttonContainer.createEl('button', {
			text: 'Reset to Defaults',
			cls: 'mod-muted'
		});
		this.resetButton.addEventListener('click', () => this.handleReset());
		
		// Right side buttons container
		const rightButtons = buttonContainer.createDiv('right-buttons');
		
		// Cancel button
		this.cancelButton = rightButtons.createEl('button', {
			text: 'Cancel',
			cls: 'mod-cancel'
		});
		this.cancelButton.addEventListener('click', () => this.handleCancel());
		
		// Export button
		this.submitButton = rightButtons.createEl('button', {
			text: 'Export',
			cls: 'mod-cta'
		});
		this.submitButton.addEventListener('click', () => this.handleSubmit());
	}
	
	private async loadAvailableTemplates(): Promise<void> {
		try {
			const templateManager = new TemplateManager(this.plugin);
			const templates = await templateManager.getAvailableTemplates();
			
			this.state.updateSettings({
				availableTemplates: templates
			});
			
			// Update the general section's template dropdown
			const generalSection = this.sections.get('general') as GeneralSection;
			if (generalSection && generalSection.updateAvailableTemplates) {
				generalSection.updateAvailableTemplates(templates);
			}
		} catch (error) {
			console.error('Failed to load templates:', error);
			new Notice('Failed to load available templates');
		}
	}
	
	private handleStateChange(): void {
		// State change handler for any UI updates needed
		// This is called whenever the state is updated
	}
	
	private handleReset(): void {
		// Create plugin defaults object from settings tab values
		const pluginDefaults = {
			template: this.plugin.settings.exportDefaults.template,
			format: this.plugin.settings.exportDefaults.format,
			outputFolder: this.plugin.settings.outputFolder,
			openAfterExport: this.plugin.settings.behavior.openAfterExport,
			preserveFolderStructure: this.plugin.settings.behavior.preserveFolderStructure,
			pageSize: this.plugin.settings.pageSetup.size,
			orientation: this.plugin.settings.pageSetup.orientation,
			marginTop: this.plugin.settings.pageSetup.margins.top.toString(),
			marginBottom: this.plugin.settings.pageSetup.margins.bottom.toString(),
			marginLeft: this.plugin.settings.pageSetup.margins.left.toString(),
			marginRight: this.plugin.settings.pageSetup.margins.right.toString(),
			bodyFont: this.plugin.settings.typography.fonts.body,
			headingFont: this.plugin.settings.typography.fonts.heading,
			monospaceFont: this.plugin.settings.typography.fonts.monospace,
			bodyFontSize: this.plugin.settings.typography.fontSizes.body
		};
		
		// Reset state to plugin defaults
		this.state.reset(pluginDefaults);
		
		// Re-render sections to update UI
		this.renderSections();
		
		// Reload templates to update the dropdown
		this.loadAvailableTemplates();
		
		new Notice('Settings reset to defaults');
	}
	
	private async handleSubmit(): Promise<void> {
		// Validate all sections
		const validationResults = this.validateAllSections();
		
		if (!validationResults.isValid) {
			this.showValidationErrors(validationResults.errors);
			return;
		}
		
		// Show any warnings
		if (validationResults.warnings.length > 0) {
			this.showValidationWarnings(validationResults.warnings);
		}
		
		// Build export configuration
		const config = this.state.buildExportConfig();
		
		// Show progress
		this.showProgress('Starting export...', 0);
		
		// Disable buttons
		this.submitButton.disabled = true;
		this.resetButton.disabled = true;
		this.cancelButton.textContent = 'Close';
		
		try {
			// Call the submit handler
			await this.onSubmit(config);
			
			// Show success
			this.showProgress('Export completed successfully!', 100);
			
			// Auto-close after delay
			setTimeout(() => this.close(), 2000);
		} catch (error) {
			console.error('Export failed:', error);
			this.showProgress(`Export failed: ${error.message}`, -1);
			this.submitButton.disabled = false;
			this.resetButton.disabled = false;
		}
	}
	
	private handleCancel(): void {
		if (this.state.settings.isExporting && this.state.settings.canCancel) {
			// Cancel ongoing export
			if (this.onCancel) {
				this.onCancel();
			}
			this.showProgress('Export cancelled', -1);
		} else {
			// Close modal
			this.close();
		}
	}
	
	private validateAllSections(): { isValid: boolean; errors: string[]; warnings: string[] } {
		const errors: string[] = [];
		const warnings: string[] = [];
		
		this.sections.forEach(section => {
			if (section.validate) {
				const result = section.validate();
				errors.push(...result.errors);
				if (result.warnings) {
					warnings.push(...result.warnings);
				}
			}
		});
		
		return {
			isValid: errors.length === 0,
			errors,
			warnings
		};
	}
	
	private showValidationErrors(errors: string[]): void {
		const errorContainer = this.formContainer.createDiv('validation-errors');
		errorContainer.createEl('h4', { text: 'Validation Errors', cls: 'error-title' });
		
		const errorList = errorContainer.createEl('ul');
		errors.forEach(error => {
			errorList.createEl('li', { text: error });
		});
		
		// Remove after 5 seconds
		setTimeout(() => errorContainer.remove(), 5000);
	}
	
	private showValidationWarnings(warnings: string[]): void {
		warnings.forEach(warning => {
			new Notice(`Warning: ${warning}`, 3000);
		});
	}
	
	private showProgress(message: string, percent: number): void {
		this.progressContainer.style.display = 'block';
		this.formContainer.style.display = 'none';
		
		this.progressText.textContent = message;
		
		if (percent >= 0) {
			this.progressBar.style.width = `${percent}%`;
			const percentEl = this.progressContainer.querySelector('.export-progress-percent');
			if (percentEl) {
				percentEl.textContent = `${Math.round(percent)}%`;
			}
		}
		
		// Update state
		this.state.setProgress(percent, message);
	}
	
	updateProgress(message: string, percent: number): void {
		this.showProgress(message, percent);
	}
	
	private getOutputFilename(): string {
		const noteName = this.state.settings.noteTitle || 'document';
		return `${noteName}.pdf`;
	}
	
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
				padding: 20px;
				border-bottom: 1px solid var(--background-modifier-border);
			}
			
			.export-config-header h2 {
				margin: 0;
			}
			
			.export-note-title {
				margin: 10px 0 0 0;
				color: var(--text-muted);
				font-size: 0.9em;
			}
			
			.export-config-form {
				flex: 1;
				overflow-y: auto;
				padding: 20px;
			}
			
			.export-section {
				margin-bottom: 30px;
			}
			
			.export-section h3 {
				margin-bottom: 15px;
				font-size: 1.1em;
				font-weight: 600;
			}
			
			.export-section h4 {
				margin: 15px 0 10px 0;
				font-size: 0.95em;
				font-weight: 500;
				color: var(--text-muted);
			}
			
			.export-progress-container {
				padding: 40px;
				text-align: center;
			}
			
			.export-progress-text {
				margin-bottom: 20px;
				font-size: 1.1em;
			}
			
			.export-progress-bar-container {
				width: 100%;
				height: 20px;
				background: var(--background-secondary);
				border-radius: 10px;
				overflow: hidden;
			}
			
			.export-progress-bar {
				height: 100%;
				background: var(--interactive-accent);
				transition: width 0.3s ease;
			}
			
			.export-progress-percent {
				margin-top: 10px;
				color: var(--text-muted);
			}
			
			.export-config-buttons {
				padding: 20px;
				border-top: 1px solid var(--background-modifier-border);
				display: flex;
				justify-content: space-between;
				align-items: center;
			}
			
			.export-config-buttons .right-buttons {
				display: flex;
				gap: 10px;
			}
			
			.validation-errors {
				background: var(--background-modifier-error);
				padding: 15px;
				border-radius: 5px;
				margin-bottom: 20px;
			}
			
			.error-title {
				color: var(--text-error);
				margin: 0 0 10px 0;
			}
			
			.validation-errors ul {
				margin: 0;
				padding-left: 20px;
			}
			
			.margins-container {
				background: var(--background-secondary-alt);
				padding: 15px;
				border-radius: 5px;
				margin-top: 15px;
			}
		`;
		document.head.appendChild(style);
	}
	
	onClose(): void {
		// Clean up state listeners
		this.state.onChange(() => {}); // Remove listener
		
		// Clear sections
		this.sections.clear();
		
		// Remove added styles
		const style = document.querySelector('style');
		if (style && style.textContent?.includes('export-config-modal')) {
			style.remove();
		}
		
		const { contentEl } = this;
		contentEl.empty();
	}
}