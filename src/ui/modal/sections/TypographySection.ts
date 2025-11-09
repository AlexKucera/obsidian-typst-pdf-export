/**
 * Typography Section for Export Configuration Modal
 * Handles font selection and size configuration
 */

import { Setting, App } from 'obsidian';
import { ModalSection, ModalState, ValidationResult } from '../modalTypes';

export class TypographySection implements ModalSection {
	private container: HTMLElement | null = null;
	private app: App | null = null;
	
	render(containerEl: HTMLElement, state: ModalState, app?: App): void {
		if (app) this.app = app;
		this.container = containerEl.createDiv('export-section');
		new Setting(this.container)
			.setName('Typography')
			.setHeading();

		// Create font settings asynchronously with explicit error handling
		// Font size settings are created after font dropdowns to preserve logical ordering
		this.createFontSettings(state).catch(error => {
			console.error('Failed to create font settings:', error);
			// Font settings will fall back to default fonts if this fails
		});
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
				const currentFont = String(state.templateVariables.bodyFont || 'Times New Roman');

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
				const currentFont = String(state.templateVariables.headingFont || 'Times New Roman');

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
				const currentFont = String(state.templateVariables.monospaceFont || 'Courier New');

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

		// Create font size settings after font dropdowns for logical ordering
		this.createFontSizeSettings(state);
	}

	private createFontSizeSettings(state: ModalState): void {
		if (!this.container) return;
		
		// Body font size
		new Setting(this.container)
			.setName('Body font size')
			.setDesc('Base font size for document text (in points)')
			.addSlider(slider => slider
				.setLimits(8, 16, 0.5)
				.setValue(Number(state.templateVariables.bodyFontSize || 11))
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