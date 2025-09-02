/**
 * Typography Section for Export Configuration Modal
 * Handles font selection and size configuration
 */

import { Setting } from 'obsidian';
import { ModalSection, ModalState, ValidationResult } from '../types';

export class TypographySection implements ModalSection {
	private container: HTMLElement | null = null;
	private fontInputs: Map<string, HTMLInputElement> = new Map();
	private sizeSliders: Map<string, any> = new Map();
	
	render(containerEl: HTMLElement, state: ModalState): void {
		this.container = containerEl.createDiv('export-section');
		this.container.createEl('h3', { text: 'Typography' });
		
		this.createFontSettings(state);
		this.createFontSizeSettings(state);
	}
	
	private createFontSettings(state: ModalState): void {
		if (!this.container) return;
		
		// Body font
		const bodyFontSetting = new Setting(this.container)
			.setName('Body font')
			.setDesc('Primary font for document text')
			.addText(text => {
				const input = text
					.setPlaceholder('Concourse OT')
					.setValue(state.typography.fontFamily)
					.onChange(value => {
						state.updateTypography({ fontFamily: value });
					});
				this.fontInputs.set('body', input.inputEl);
				return text;
			});
		
		// Heading font (future enhancement)
		// For now, we'll use the same font for all text types
		// but this can be expanded later
		
		// Monospace font (future enhancement)
		// Similar to heading font, can be expanded later
	}
	
	private createFontSizeSettings(state: ModalState): void {
		if (!this.container) return;
		
		const sizesContainer = this.container.createDiv('font-sizes');
		sizesContainer.createEl('h4', { text: 'Text Formatting' });
		
		// Font size
		new Setting(sizesContainer)
			.setName('Font size')
			.setDesc('Base font size for document text')
			.addDropdown(dropdown => {
				dropdown
					.addOptions({
						'9pt': '9pt - Small',
						'10pt': '10pt - Compact',
						'11pt': '11pt - Standard',
						'12pt': '12pt - Large',
						'14pt': '14pt - Extra Large'
					})
					.setValue(state.typography.fontSize)
					.onChange(value => {
						state.updateTypography({ fontSize: value });
					});
			});
		
		// Line height
		new Setting(sizesContainer)
			.setName('Line height')
			.setDesc('Spacing between lines of text')
			.addDropdown(dropdown => {
				dropdown
					.addOptions({
						'1.0': 'Single',
						'1.15': 'Slightly Loose',
						'1.5': 'One and a Half',
						'1.8': 'Relaxed',
						'2.0': 'Double'
					})
					.setValue(state.typography.lineHeight)
					.onChange(value => {
						state.updateTypography({ lineHeight: value });
					});
			});
	}
	
	validate(): ValidationResult {
		const errors: string[] = [];
		const warnings: string[] = [];
		
		// Check if fonts are likely available
		this.fontInputs.forEach((input, type) => {
			const value = input.value.trim();
			if (value && this.isUncommonFont(value)) {
				warnings.push(`Font "${value}" may not be available on the system. The template will use fallback fonts if needed.`);
			}
		});
		
		return {
			isValid: errors.length === 0,
			errors,
			warnings
		};
	}
	
	private isUncommonFont(fontName: string): boolean {
		// List of commonly available fonts
		const commonFonts = [
			'arial', 'helvetica', 'times new roman', 'georgia', 
			'verdana', 'tahoma', 'trebuchet ms', 'palatino',
			'courier', 'courier new', 'monaco', 'consolas',
			'sf pro', 'roboto', 'open sans', 'lato',
			'concourse ot', 'ubuntu', 'source code pro'
		];
		
		const normalized = fontName.toLowerCase().trim();
		return !commonFonts.some(font => normalized.includes(font));
	}
	
	getId(): string {
		return 'typography';
	}
}