/**
 * Export Configuration Modal
 * Refactored modular version that uses section components
 */

import { Modal, App } from 'obsidian';
import { ExportErrorHandler } from '../../core/ExportErrorHandler';
import { obsidianTypstPDFExport } from '../../../main';
import { ExportConfig, ExportConfigModalSettings, ModalSection } from './modalTypes';
import { ModalState } from './state/ModalState';
import { GeneralSection } from './sections/GeneralSection';
import { TypographySection } from './sections/TypographySection';
import { PageSetupSection } from './sections/PageSetupSection';
import { BehaviorSection } from './sections/BehaviorSection';
import { TemplateManager } from '../../templates/TemplateManager';
import { ModalRenderer, ModalRendererCallbacks } from './ModalRenderer';
import { ModalValidator } from './ModalValidator';

export class ExportConfigModal extends Modal {
	plugin: obsidianTypstPDFExport;
	private state: ModalState;
	private sections: Map<string, ModalSection> = new Map();
	private onSubmit: (config: ExportConfig) => void | Promise<void>;
	private onCancel?: () => void;
	private renderer: ModalRenderer;
	private validator: ModalValidator;
	
	constructor(
		app: App,
		plugin: obsidianTypstPDFExport,
		settings: Partial<ExportConfigModalSettings>,
		onSubmit: (config: ExportConfig) => void | Promise<void>,
		onCancel?: () => void
	) {
		super(app);
		this.plugin = plugin;
		this.onSubmit = onSubmit;
		this.onCancel = onCancel;
		
		// Initialize state
		this.state = new ModalState(settings, app);
		
		// Register sections
		this.registerSections();
		
		// Initialize renderer with callbacks
		const callbacks: ModalRendererCallbacks = {
			onReset: () => this.handleReset(),
			onCancel: () => this.handleCancel(),
			onSubmit: () => this.handleSubmit()
		};
		this.renderer = new ModalRenderer(this.state, this.sections, callbacks, this.app);
		
		// Initialize validator
		this.validator = new ModalValidator();
		
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
		
		// Create main container
		const contentContainer = contentEl.createDiv('export-config-container');
		
		// Initialize renderer with content container
		this.renderer.initialize(contentContainer);

		// Load available templates
		void this.loadAvailableTemplates();
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
			ExportErrorHandler.showTemplateError(error);
		}
	}
	
	private handleStateChange(): void {
		// Refresh sections when state changes
		this.renderer.refreshSections();
	}
	
	private handleReset(): void {
		// Reset state to plugin defaults using the full settings object
		this.state.reset(this.plugin.settings);
		
		// Re-render sections to update UI
		this.renderer.refreshSections();

		// Reload templates to update the dropdown
		void this.loadAvailableTemplates();

		ExportErrorHandler.showSettingsReset();
	}
	
	private async handleSubmit(): Promise<void> {
		// Validate all sections
		const validationResults = this.validator.validateAllSections(Array.from(this.sections.values()));
		
		if (!validationResults.isValid) {
			this.renderer.showValidationErrors(validationResults.errors);
			return;
		}
		
		// Show any warnings
		if (validationResults.warnings && validationResults.warnings.length > 0) {
			this.renderer.showValidationWarnings(validationResults.warnings);
		}
		
		// Build export configuration
		const config = this.state.buildExportConfig();
		
		// Show progress
		this.renderer.showProgress('Starting export...', 0);
		
		// Set buttons to exporting state
		this.renderer.setExportingState(true);
		
		try {
			// Call the submit handler
			await this.onSubmit(config);
			
			// Show success
			this.renderer.showProgress('Export completed successfully!', 100);
			
			// Auto-close after delay
			setTimeout(() => this.close(), 2000);
		} catch (error) {
			console.error('Export failed:', error);
			this.renderer.showProgress(`Export failed: ${error.message}`, -1);
			this.renderer.setExportingState(false);
		}
	}
	
	private handleCancel(): void {
		if (this.state.settings.isExporting && this.state.settings.canCancel) {
			// Cancel ongoing export
			if (this.onCancel) {
				this.onCancel();
			}
			this.renderer.showProgress('Export cancelled', -1);
		} else {
			// Close modal
			this.close();
		}
	}
	
	
	
	updateProgress(message: string, percent: number): void {
		this.renderer.updateProgress(message, percent);
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