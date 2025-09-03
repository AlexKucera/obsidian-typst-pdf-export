/**
 * Page Setup Section for Export Configuration Modal
 * Handles page size, orientation with Typst flipped property, and text margin fields
 */

import { Setting } from 'obsidian';
import { ModalSection, ModalState, ValidationResult } from '../types';

export class PageSetupSection implements ModalSection {
	private container: HTMLElement | null = null;
	private marginInputs: Map<string, HTMLInputElement> = new Map();
	
	render(containerEl: HTMLElement, state: ModalState): void {
		this.container = containerEl.createDiv('export-section');
		this.container.createEl('h3', { text: 'Page Setup' });
		
		this.createPageSizeSettings(state);
		this.createOrientationSettings(state);
		this.createMarginSettings(state);
	}
	
	private createPageSizeSettings(state: ModalState): void {
		if (!this.container) return;
		
		new Setting(this.container)
			.setName('Page size')
			.setDesc('Standard page sizes for the PDF document')
			.addDropdown(dropdown => {
				dropdown
					.addOption('a4', 'A4 (210 × 297 mm)')
					.addOption('letter', 'Letter (8.5 × 11 in)')
					.addOption('legal', 'Legal (8.5 × 14 in)')
					.addOption('a3', 'A3 (297 × 420 mm)')
					.addOption('a5', 'A5 (148 × 210 mm)')
					.setValue(state.templateVariables.pageSize || 'a4')
					.onChange(value => {
						state.updateTemplateVariables({ pageSize: value });
					});
			});
	}
	
	private createOrientationSettings(state: ModalState): void {
		if (!this.container) return;
		
		new Setting(this.container)
			.setName('Page orientation')
			.setDesc('Portrait (tall) or landscape (wide) page layout')
			.addDropdown(dropdown => {
				dropdown
					.addOption('portrait', 'Portrait')
					.addOption('landscape', 'Landscape')
					.setValue(state.templateVariables.orientation || 'portrait')
					.onChange(value => {
						const isLandscape = value === 'landscape';
						state.updateTemplateVariables({ 
							orientation: value,
							flipped: isLandscape,
							// Auto-adjust width for single-page mode when flipped
							...(isLandscape && state.settings.format === 'single-page' 
								? { width: 'auto' } 
								: {})
						});
					});
			});
	}
	
	private createMarginSettings(state: ModalState): void {
		if (!this.container) return;
		
		const marginsContainer = this.container.createDiv('margins-container');
		marginsContainer.createEl('h4', { text: 'Text Margins' });
		marginsContainer.createEl('p', { 
			text: 'Enter margins in centimeters (e.g., "2.5", "1.8", "3.0")',
			cls: 'setting-item-description'
		});
		
		const marginDefaults = {
			top: '2.5',
			bottom: '2.0', 
			left: '2.5',
			right: '1.5'
		};
		
		// Create margin text inputs
		['top', 'bottom', 'left', 'right'].forEach(side => {
			new Setting(marginsContainer)
				.setName(`${side.charAt(0).toUpperCase() + side.slice(1)} margin`)
				.setDesc(`${side} text margin in centimeters`)
				.addText(text => {
					const input = text
						.setPlaceholder(marginDefaults[side as keyof typeof marginDefaults])
						.setValue(state.templateVariables[`margin${side.charAt(0).toUpperCase() + side.slice(1)}`] || marginDefaults[side as keyof typeof marginDefaults])
						.onChange(value => {
							const marginKey = `margin${side.charAt(0).toUpperCase() + side.slice(1)}`;
							state.updateTemplateVariables({ [marginKey]: value });
						});
					
					this.marginInputs.set(side, input.inputEl);
				});
		});
	}
	
	validate(): ValidationResult {
		const errors: string[] = [];
		const warnings: string[] = [];
		
		// Validate margin formats
		this.marginInputs.forEach((input, side) => {
			const value = input.value.trim();
			if (value) {
				// Check for valid margin format (number only, centimeters assumed)
				const marginRegex = /^\d*\.?\d+$/;
				if (!marginRegex.test(value)) {
					errors.push(`${side.charAt(0).toUpperCase() + side.slice(1)} margin must be a number in centimeters (e.g., "2.5")`);
				} else {
					const num = parseFloat(value);
					if (num <= 0) {
						errors.push(`${side.charAt(0).toUpperCase() + side.slice(1)} margin must be greater than 0`);
					}
				}
			}
		});
		
		return {
			isValid: errors.length === 0,
			errors,
			warnings
		};
	}
	
	getId(): string {
		return 'page-setup';
	}
}