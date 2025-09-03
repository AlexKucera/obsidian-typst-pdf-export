/**
 * Layout Section for Export Configuration Modal
 * Handles page setup, orientation, and margins
 */

import { Setting } from 'obsidian';
import { ModalSection, ModalState, ValidationResult } from '../modalTypes';
import { SUPPORTED_PAPER_SIZES } from '../../../utils/paperSizeMapper';

export class LayoutSection implements ModalSection {
	private container: HTMLElement | null = null;
	private marginInputs: Map<string, number> = new Map();
	
	render(containerEl: HTMLElement, state: ModalState): void {
		this.container = containerEl.createDiv('export-section');
		this.container.createEl('h3', { text: 'Page Layout' });
		
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
				// Add all supported paper sizes
				SUPPORTED_PAPER_SIZES.forEach(paperSize => {
					dropdown.addOption(paperSize.key, paperSize.displayName);
				});
				
				dropdown
					.setValue('a4') // Default to A4
					.onChange(value => {
						state.updateTemplateVariables({ pageSize: value });
					});
			});
	}
	
	private createOrientationSettings(state: ModalState): void {
		if (!this.container) return;
		
		new Setting(this.container)
			.setName('Orientation')
			.setDesc('Page orientation for the document')
			.addDropdown(dropdown => {
				dropdown
					.addOption('portrait', 'Portrait')
					.addOption('landscape', 'Landscape')
					.setValue('portrait')
					.onChange(value => {
						state.updateTemplateVariables({ orientation: value });
					});
			});
	}
	
	private createMarginSettings(state: ModalState): void {
		if (!this.container) return;
		
		const marginsContainer = this.container.createDiv('margins-container');
		marginsContainer.createEl('h4', { text: 'Margins' });
		
		const marginDefaults = {
			top: 72,
			bottom: 57,
			left: 72,
			right: 43
		};
		
		// Create margin sliders
		['top', 'bottom', 'left', 'right'].forEach(side => {
			new Setting(marginsContainer)
				.setName(side.charAt(0).toUpperCase() + side.slice(1))
				.setDesc(`${side} margin in points`)
				.addSlider(slider => {
					slider
						.setLimits(36, 144, 6) // 0.5" to 2" in 6pt increments
						.setValue(marginDefaults[side as keyof typeof marginDefaults])
						.setDynamicTooltip()
						.onChange(value => {
							this.marginInputs.set(side, value);
							this.updateMargins(state);
						});
					
					// Set initial value
					this.marginInputs.set(side, marginDefaults[side as keyof typeof marginDefaults]);
				});
		});
		
		// Add preset buttons
		const presetContainer = marginsContainer.createDiv('margin-presets');
		presetContainer.createEl('span', { text: 'Presets: ' });
		
		const presets = [
			{ name: 'Narrow', values: { top: 36, bottom: 36, left: 36, right: 36 } },
			{ name: 'Normal', values: { top: 72, bottom: 72, left: 72, right: 72 } },
			{ name: 'Wide', values: { top: 108, bottom: 108, left: 108, right: 108 } }
		];
		
		presets.forEach(preset => {
			const button = presetContainer.createEl('button', { 
				text: preset.name,
				cls: 'margin-preset-button'
			});
			button.addEventListener('click', () => {
				Object.entries(preset.values).forEach(([side, value]) => {
					this.marginInputs.set(side, value);
				});
				this.updateMargins(state);
				// Would need to update slider UI here in real implementation
				state.notifyChange(); // Trigger UI refresh
			});
		});
	}
	
	private updateMargins(state: ModalState): void {
		const margins = {
			top: this.marginInputs.get('top') || 72,
			bottom: this.marginInputs.get('bottom') || 72,
			left: this.marginInputs.get('left') || 72,
			right: this.marginInputs.get('right') || 72
		};
		
		// Convert points to Typst measurements
		const typstMargins = {
			marginTop: `${margins.top}pt`,
			marginBottom: `${margins.bottom}pt`,
			marginLeft: `${margins.left}pt`,
			marginRight: `${margins.right}pt`
		};
		
		state.updateTemplateVariables(typstMargins);
	}
	
	validate(): ValidationResult {
		const errors: string[] = [];
		const warnings: string[] = [];
		
		// Check for extremely small margins
		this.marginInputs.forEach((value, side) => {
			if (value < 36) {
				warnings.push(`${side} margin is very small and may cause content to be cut off`);
			}
		});
		
		return {
			isValid: errors.length === 0,
			errors,
			warnings
		};
	}
	
	getId(): string {
		return 'layout';
	}
}