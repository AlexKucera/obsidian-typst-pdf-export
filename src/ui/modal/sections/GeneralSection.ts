/**
 * General Section for Export Configuration Modal
 * Handles template selection, format options, and output settings
 */

import { Setting, App, normalizePath, DropdownComponent } from 'obsidian';
import * as path from 'path';
import { ModalSection, ModalState, ValidationResult } from '../modalTypes';
import { ExportFormat } from '../../../core/settings';
import { FolderSuggest } from '../../components/FolderSuggest';
import { SecurityUtils } from '../../../core/SecurityUtils';

export class GeneralSection implements ModalSection {
	private container: HTMLElement | null = null;
	private templateDropdown: DropdownComponent | null = null;
	private outputFolderInput: HTMLInputElement | null = null;
	private app: App;
	
	render(containerEl: HTMLElement, state: ModalState, app?: App): void {
		if (app) this.app = app;
		this.container = containerEl.createDiv('export-section');
		new Setting(this.container)
			.setName('General settings')
			.setHeading();
		
		this.createTemplateSelection(state);
		this.createFormatSelection(state);
		this.createOutputSettings(state);
	}
	
	private createTemplateSelection(state: ModalState): void {
		if (!this.container) return;
		
		new Setting(this.container)
			.setName('Typst template')
			.setDesc('Select template for document styling')
			.addDropdown(dropdown => {
				// Filter out universal-wrapper.pandoc.typ and populate with available templates
				const filteredTemplates = state.settings.availableTemplates
					.filter(template => template !== 'universal-wrapper.pandoc.typ');
				
				filteredTemplates.forEach(template => {
					dropdown.addOption(template, this.getTemplateDisplayName(template));
				});
				
				dropdown
					.setValue(state.settings.template || 'default.typ')
					.onChange(value => {
						state.updateSettings({ template: value });
					});
				
				this.templateDropdown = dropdown;
			});
	}
	
	private createFormatSelection(state: ModalState): void {
		if (!this.container) return;
		
		new Setting(this.container)
			.setName('PDF format')
			.setDesc('Choose document layout format')
			.addDropdown(dropdown => {
				dropdown
					.addOption(ExportFormat.Standard, 'Standard (multi-page PDF)')
					.addOption(ExportFormat.SinglePage, 'Single-page (continuous layout)')
					.setValue(state.settings.format || ExportFormat.Standard)
					.onChange(value => {
						state.updateSettings({ format: value as ExportFormat });
					});
			});
	}
	
	private createOutputSettings(state: ModalState): void {
		if (!this.container) return;
		
		new Setting(this.container)
			.setName('Output folder')
			.setDesc('Location for exported PDF files (relative to vault root)')
			.addText(text => {
				const input = text
					.setPlaceholder('PDF exports')
					.setValue(state.settings.outputFolder || 'exports')
					.onChange(value => {
						// Don't normalize absolute paths as normalizePath strips the leading slash
					const normalizedValue = path.isAbsolute(value) ? value : normalizePath(value);
						state.updateSettings({ outputFolder: normalizedValue });
					});
				this.outputFolderInput = input.inputEl;
				
				// Add folder autosuggest
				if (this.app) {
					new FolderSuggest(this.app, input.inputEl);
				}
			});
	}
	
	private getTemplateDisplayName(template: string): string {
		// Remove extension and capitalize
		const name = template.replace(/\.(typ|pandoc\.typ)$/, '');
		return name.charAt(0).toUpperCase() + name.slice(1).replace(/-/g, ' ');
	}
	
	validate(): ValidationResult {
		const errors: string[] = [];
		const warnings: string[] = [];
		
		// Validate output folder
		if (this.outputFolderInput) {
			const value = normalizePath(this.outputFolderInput.value.trim());
			if (!SecurityUtils.validateOutputPath(value)) {
				errors.push(SecurityUtils.getPathValidationError(value));
			}
		}
		
		// Check template selection
		if (!this.templateDropdown || !this.templateDropdown.getValue()) {
			errors.push('Template selection is required');
		}
		
		return {
			isValid: errors.length === 0,
			errors,
			warnings
		};
	}
	
	updateAvailableTemplates(templates: string[]): void {
	if (!this.templateDropdown) return;
	
	const currentValue = this.templateDropdown.getValue();
	
	// Filter out universal-wrapper.pandoc.typ and clear/repopulate dropdown
	const filteredTemplates = templates.filter(template => template !== 'universal-wrapper.pandoc.typ');
	
	this.templateDropdown?.selectEl.empty();
	filteredTemplates.forEach(template => {
		this.templateDropdown?.addOption(template, this.getTemplateDisplayName(template));
	});
	
	// Restore selection if still available
	if (filteredTemplates.includes(currentValue)) {
		this.templateDropdown?.setValue(currentValue);
	} else if (filteredTemplates.length > 0) {
		this.templateDropdown?.setValue(filteredTemplates[0]);
	}
}
	
	getId(): string {
		return 'general';
	}
}