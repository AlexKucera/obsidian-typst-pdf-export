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
		this.container.createEl('h3', { text: 'Export Behavior' });
		
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