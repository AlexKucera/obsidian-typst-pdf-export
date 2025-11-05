/**
 * Behavior Section for Export Configuration Modal
 * Handles export behavior options like opening after export and preserving folder structure
 */

import { Setting } from 'obsidian';
import { ModalSection, ModalState, ValidationResult } from '../modalTypes';

export class BehaviorSection implements ModalSection {
	private container: HTMLElement | null = null;
	
	render(containerEl: HTMLElement, state: ModalState): void {
		this.container = containerEl.createDiv('export-section');
		new Setting(this.container)
			.setName('Export behavior')
			.setHeading();
		
		this.createBehaviorToggles(state);
	}
	
	private createBehaviorToggles(state: ModalState): void {
		if (!this.container) return;
		
		// Open after export toggle
		new Setting(this.container)
			.setName('Open after export')
			.setDesc('Automatically open the PDF file after successful export')
			.addToggle(toggle => {
				toggle
					.setValue(state.settings.openAfterExport || false)
					.onChange(value => {
						state.updateSettings({ openAfterExport: value });
					});
			});
		
		// Preserve folder structure toggle
		new Setting(this.container)
			.setName('Preserve folder structure')
			.setDesc('Maintain the original folder structure when exporting multiple files')
			.addToggle(toggle => {
				toggle
					.setValue(state.settings.preserveFolderStructure || false)
					.onChange(value => {
						state.updateSettings({ preserveFolderStructure: value });
					});
			});

		// Embed PDF files toggle
		new Setting(this.container)
			.setName('Embed PDF files')
			.setDesc('Include PDF files as attachments in the exported PDF (in addition to preview images)')
			.addToggle(toggle => {
				toggle
					.setValue(state.settings.embedPdfFiles !== false)
					.onChange(value => {
						state.updateSettings({ embedPdfFiles: value });
					});
			});

		// Embed all files toggle
		new Setting(this.container)
			.setName('Embed all file types as attachments')
			.setDesc('Embed all referenced file types (office documents, archives, etc.) as PDF attachments')
			.addToggle(toggle => {
				toggle
					.setValue(state.settings.embedAllFiles !== false)
					.onChange(value => {
						state.updateSettings({ embedAllFiles: value });
					});
			});

		// Print frontmatter toggle
		new Setting(this.container)
			.setName('Print frontmatter')
			.setDesc('Display frontmatter as formatted text at the beginning of the document')
			.addToggle(toggle => {
				toggle
					.setValue(state.settings.printFrontmatter || false)
					.onChange(value => {
						state.updateSettings({ printFrontmatter: value });
					});
			});
	}
	
	validate(): ValidationResult {
		const errors: string[] = [];
		const warnings: string[] = [];
		
		// No validation needed for simple boolean toggles
		
		return {
			isValid: errors.length === 0,
			errors,
			warnings
		};
	}
	
	getId(): string {
		return 'behavior';
	}
}