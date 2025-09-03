/**
 * Typography Section for Export Configuration Modal
 * Handles font selection and size configuration
 */

import { Setting, App } from 'obsidian';
import { ModalSection, ModalState, ValidationResult } from '../types';

export class TypographySection implements ModalSection {
	private container: HTMLElement | null = null;
	private app: App | null = null;
	
	render(containerEl: HTMLElement, state: ModalState, app?: App): void {
		if (app) this.app = app;
		this.container = containerEl.createDiv('export-section');
		this.container.createEl('h3', { text: 'Typography' });
		
		this.createFontSettings(state);
		this.createFontSizeSettings(state);
	}
	
	private createFontSettings(state: ModalState): void {
		if (!this.container) return;
		
		// Body font dropdown
		new Setting(this.container)
			.setName('Body font')
			.setDesc('Primary font for document text')
			.addDropdown(async (dropdown) => {
				try {
					const fonts = await this.getAvailableFonts(state);
					fonts.forEach(font => {
						dropdown.addOption(font, font);
					});
					
					dropdown
						.setValue(state.templateVariables.bodyFont || 'Concourse OT')
						.onChange(value => {
							state.updateTemplateVariables({ bodyFont: value });
						});
				} catch (error) {
					console.error('Failed to load fonts:', error);
					// Fallback to hardcoded fonts
					this.addFallbackBodyFonts(dropdown, state);
				}
			});
		
		// Heading font dropdown
		new Setting(this.container)
			.setName('Heading font')
			.setDesc('Font for headings and titles')
			.addDropdown(async (dropdown) => {
				try {
					const fonts = await this.getAvailableFonts(state);
					fonts.forEach(font => {
						dropdown.addOption(font, font);
					});
					
					dropdown
						.setValue(state.templateVariables.headingFont || 'Concourse OT')
						.onChange(value => {
							state.updateTemplateVariables({ headingFont: value });
						});
				} catch (error) {
					console.error('Failed to load fonts:', error);
					// Fallback to hardcoded fonts
					this.addFallbackBodyFonts(dropdown, state);
				}
			});
		
		// Monospace font dropdown
		new Setting(this.container)
			.setName('Monospace font')
			.setDesc('Font for code blocks and inline code')
			.addDropdown(async (dropdown) => {
				try {
					const fonts = await this.getAvailableFonts(state);
					// Filter for common monospace fonts or show all
					fonts.forEach(font => {
						dropdown.addOption(font, font);
					});
					
					dropdown
						.setValue(state.templateVariables.monospaceFont || 'Source Code Pro')
						.onChange(value => {
							state.updateTemplateVariables({ monospaceFont: value });
						});
				} catch (error) {
					console.error('Failed to load fonts:', error);
					// Fallback to hardcoded monospace fonts
					this.addFallbackMonospaceFonts(dropdown, state);
				}
			});
	}
	
	private createFontSizeSettings(state: ModalState): void {
		if (!this.container) return;
		
		// Body font size
		new Setting(this.container)
			.setName('Body font size')
			.setDesc('Base font size for document text')
			.addDropdown(dropdown => {
				dropdown
					.addOption('9pt', '9pt - Small')
					.addOption('10pt', '10pt - Compact')
					.addOption('11pt', '11pt - Standard')
					.addOption('12pt', '12pt - Large')
					.addOption('14pt', '14pt - Extra Large')
					.setValue(state.templateVariables.bodyFontSize || '11pt')
					.onChange(value => {
						state.updateTemplateVariables({ bodyFontSize: value });
					});
			});
	}
	
	// Helper methods for fonts - similar to settings tab
	private async getAvailableFonts(state: ModalState): Promise<string[]> {
		try {
			// Access the plugin instance through the app
			// @ts-ignore - accessing private plugin manager
			const plugin = this.app?.plugins?.plugins?.['obsidian-typst-pdf-export'];
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
	
	private addFallbackBodyFonts(dropdown: any, state: ModalState): void {
		dropdown
			.addOption('Concourse OT', 'Concourse OT')
			.addOption('Times New Roman', 'Times New Roman')
			.addOption('Georgia', 'Georgia')
			.addOption('Arial', 'Arial')
			.addOption('Helvetica', 'Helvetica')
			.addOption('Calibri', 'Calibri')
			.addOption('Cambria', 'Cambria')
			.addOption('Palatino', 'Palatino')
			.addOption('Book Antiqua', 'Book Antiqua')
			.setValue(state.templateVariables.bodyFont || state.templateVariables.headingFont || 'Concourse OT')
			.onChange((value: string) => {
				if (dropdown.containerEl.closest('.setting-item')?.querySelector('.setting-item-name')?.textContent?.includes('Body')) {
					state.updateTemplateVariables({ bodyFont: value });
				} else {
					state.updateTemplateVariables({ headingFont: value });
				}
			});
	}
	
	private addFallbackMonospaceFonts(dropdown: any, state: ModalState): void {
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