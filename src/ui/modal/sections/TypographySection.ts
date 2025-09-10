/**
 * Typography Section for Export Configuration Modal
 * Handles font selection and size configuration
 */

import { Setting, App, DropdownComponent } from 'obsidian';
import { ModalSection, ModalState, ValidationResult } from '../modalTypes';

export class TypographySection implements ModalSection {
	private container: HTMLElement | null = null;
	private app: App | null = null;
	
	render(containerEl: HTMLElement, state: ModalState, app?: App): void {
		if (app) this.app = app;
		this.container = containerEl.createDiv('export-section');
		this.container.createEl('h3', { text: 'Typography' });
		
		// Create font settings asynchronously
		this.createFontSettings(state);
		this.createFontSizeSettings(state);
	}
	
	private async createFontSettings(state: ModalState): Promise<void> {
		if (!this.container) return;
		
		// Get available fonts from cache
		const availableFonts = await this.getAvailableFonts(state);
		
		// Body font dropdown
		new Setting(this.container)
			.setName('Body font')
			.setDesc('Primary font for document text')
			.addDropdown(dropdown => {
				const currentFont = state.templateVariables.bodyFont || 'Times New Roman';
				
				// Add all available fonts
				availableFonts.forEach(font => {
					dropdown.addOption(font, font);
				});
				
				// Add current font if it's not in the list
				if (!availableFonts.includes(currentFont)) {
					dropdown.addOption(currentFont, currentFont);
				}
				
				// Set current value and change handler
				dropdown
					.setValue(currentFont)
					.onChange(value => {
						state.updateTemplateVariables({ bodyFont: value });
					});
			});
		
		// Heading font dropdown  
		new Setting(this.container)
			.setName('Heading font')
			.setDesc('Font for headings and titles')
			.addDropdown(dropdown => {
				const currentFont = state.templateVariables.headingFont || 'Times New Roman';
				
				// Add all available fonts
				availableFonts.forEach(font => {
					dropdown.addOption(font, font);
				});
				
				// Add current font if it's not in the list
				if (!availableFonts.includes(currentFont)) {
					dropdown.addOption(currentFont, currentFont);
				}
				
				// Set current value and change handler
				dropdown
					.setValue(currentFont)
					.onChange(value => {
						state.updateTemplateVariables({ headingFont: value });
					});
			});
		
		// Monospace font dropdown
		new Setting(this.container)
			.setName('Monospace font')
			.setDesc('Font for code blocks and inline code')
			.addDropdown(dropdown => {
				const currentFont = state.templateVariables.monospaceFont || 'Courier New';
				
				// Add all available fonts
				availableFonts.forEach(font => {
					dropdown.addOption(font, font);
				});
				
				// Add current font if it's not in the list
				if (!availableFonts.includes(currentFont)) {
					dropdown.addOption(currentFont, currentFont);
				}
				
				// Set current value and change handler
				dropdown
					.setValue(currentFont)
					.onChange(value => {
						state.updateTemplateVariables({ monospaceFont: value });
					});
			});
	}
	
	private createFontSizeSettings(state: ModalState): void {
		if (!this.container) return;
		
		// Body font size
		new Setting(this.container)
			.setName('Body font size')
			.setDesc('Base font size for document text (in points)')
			.addSlider(slider => slider
				.setLimits(8, 16, 0.5)
				.setValue(state.templateVariables.bodyFontSize || 11)
				.setDynamicTooltip()
				.onChange(value => {
					state.updateTemplateVariables({ bodyFontSize: value });
				}));
	}
	
	// Helper methods for fonts - similar to settings tab
	private async getAvailableFonts(state: ModalState): Promise<string[]> {
		try {
			// Access the plugin instance through the app
			// @ts-ignore - accessing private plugin manager
			const plugin = this.app?.plugins?.plugins?.['typst-pdf-export'];
			if (plugin && plugin.getCachedFonts) {
				return await plugin.getCachedFonts();
			}
			
			// Fallback to hardcoded fonts if plugin not accessible
			return [
				'Times New Roman',
				'Arial', 
				'Helvetica',
				'Georgia',
				'Courier New',
				'Monaco',
				'SF Pro Text',
				'SF Mono',
				'Concourse OT',
				'UbuntuMono Nerd Font Mono',
				'Source Code Pro'
			];
		} catch (error) {
			console.error('Failed to get cached fonts:', error);
			// Return common fallback fonts
			return [
				'Times New Roman',
				'Arial', 
				'Helvetica',
				'Georgia',
				'Courier New',
				'Monaco',
				'SF Pro Text',
				'SF Mono',
				'Concourse OT',
				'UbuntuMono Nerd Font Mono',
				'Source Code Pro'
			];
		}
	}
	
	private addFallbackBodyFonts(dropdown: DropdownComponent, state: ModalState, fontType: 'body' | 'heading'): void {
		dropdown
			.addOption('Concourse OT', 'Concourse OT')
			.addOption('Times New Roman', 'Times New Roman')
			.addOption('Georgia', 'Georgia')
			.addOption('Arial', 'Arial')
			.addOption('Helvetica', 'Helvetica')
			.addOption('Calibri', 'Calibri')
			.addOption('Cambria', 'Cambria')
			.addOption('Palatino', 'Palatino')
			.addOption('Book Antiqua', 'Book Antiqua');
		
		// Set the appropriate value based on font type
		const currentValue = fontType === 'body' 
			? state.templateVariables.bodyFont 
			: state.templateVariables.headingFont;
		
		dropdown
			.setValue(currentValue || 'Concourse OT')
			.onChange((value: string) => {
				if (fontType === 'body') {
					state.updateTemplateVariables({ bodyFont: value });
				} else {
					state.updateTemplateVariables({ headingFont: value });
				}
			});
	}
	
	private addFallbackMonospaceFonts(dropdown: DropdownComponent, state: ModalState): void {
		dropdown
			.addOption('Source Code Pro', 'Source Code Pro')
			.addOption('Courier New', 'Courier New')
			.addOption('Monaco', 'Monaco')
			.addOption('Consolas', 'Consolas')
			.addOption('Menlo', 'Menlo')
			.addOption('DejaVu Sans Mono', 'DejaVu Sans Mono')
			.addOption('Liberation Mono', 'Liberation Mono')
			.addOption('Ubuntu Mono', 'Ubuntu Mono')
			.setValue(state.templateVariables.monospaceFont || 'Source Code Pro')
			.onChange((value: string) => {
				state.updateTemplateVariables({ monospaceFont: value });
			});
	}
	
	validate(): ValidationResult {
		const errors: string[] = [];
		const warnings: string[] = [];
		
		// No validation needed for dropdowns with predefined options
		
		return {
			isValid: errors.length === 0,
			errors,
			warnings
		};
	}
	
	getId(): string {
		return 'typography';
	}
}