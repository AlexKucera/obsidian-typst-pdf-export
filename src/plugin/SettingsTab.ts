/**
 * Settings Tab
 * Handles the plugin settings UI interface
 */

import {
	App,
	PluginSettingTab,
	Setting,
	Notice,
	normalizePath
} from 'obsidian';
import type { obsidianTypstPDFExport } from '../../main';
import { ExportFormat } from '../core/settings';
import { SecurityUtils } from '../core/SecurityUtils';
import { FolderSuggest } from '../ui/components/FolderSuggest';
import { SUPPORTED_PAPER_SIZES } from '../utils/paperSizeMapper';

export class ObsidianTypstPDFExportSettingTab extends PluginSettingTab {
	plugin: obsidianTypstPDFExport;
	
	constructor(app: App, plugin: obsidianTypstPDFExport) {
		super(app, plugin);
		this.plugin = plugin;
	}
	
	display(): void {
		const { containerEl } = this;
		containerEl.empty();
		
		containerEl.createEl('h2', { text: 'Typst PDF Export Settings' });
		
		// Executable paths section
		this.createExecutablePathsSection(containerEl);
		
		// Export defaults section
		this.createExportDefaultsSection(containerEl);
		
		// Typography defaults section
		this.createTypographyDefaultsSection(containerEl);
		
		// Page setup section
		this.createPageSetupSection(containerEl);
		
		// Behavior section
		this.createBehaviorSection(containerEl);
	}
	
	private createExecutablePathsSection(containerEl: HTMLElement): void {
		containerEl.createEl('h3', { text: 'Executable Paths' });
		
		// Add dependency check button
		new Setting(containerEl)
			.setName('Dependencies')
			.setDesc('Check the status of external dependencies')
			.addButton(button => button
				.setButtonText('Check Dependencies')
				.setCta()
				.onClick(async () => {
					await this.plugin.showDependencyStatus();
				}));
		
		new Setting(containerEl)
			.setName('Pandoc path')
			.setDesc('Path to pandoc executable (leave empty to use system PATH)')
			.addText(text => text
				.setPlaceholder('pandoc')
				.setValue(this.plugin.settings.pandocPath)
				.onChange(async (value) => {
					if (!SecurityUtils.validateExecutablePath(value)) {
						new Notice(`Invalid Pandoc path: ${SecurityUtils.getExecutablePathValidationError(value)}`);
						return;
					}
					this.plugin.settings.pandocPath = value;
					await this.plugin.saveSettings();
				}));
		
		new Setting(containerEl)
			.setName('Typst path')
			.setDesc('Path to typst executable (leave empty to use system PATH)')
			.addText(text => text
				.setPlaceholder('typst')
				.setValue(this.plugin.settings.typstPath)
				.onChange(async (value) => {
					if (!SecurityUtils.validateExecutablePath(value)) {
						new Notice(`Invalid Typst path: ${SecurityUtils.getExecutablePathValidationError(value)}`);
						return;
					}
					this.plugin.settings.typstPath = value;
					await this.plugin.saveSettings();
				}));
		
		new Setting(containerEl)
			.setName('ImageMagick path')
			.setDesc('Path to ImageMagick executable (leave empty to use system PATH)')
			.addText(text => text
				.setPlaceholder('magick')
				.setValue(this.plugin.settings.executablePaths.imagemagickPath)
				.onChange(async (value) => {
					if (!SecurityUtils.validateExecutablePath(value)) {
						new Notice(`Invalid ImageMagick path: ${SecurityUtils.getExecutablePathValidationError(value)}`);
						return;
					}
					this.plugin.settings.executablePaths.imagemagickPath = value;
					await this.plugin.saveSettings();
				}));
		
		new Setting(containerEl)
			.setName('Additional system paths')
			.setDesc('Additional paths to search for executables (comma-separated)')
			.addText(text => text
				.setPlaceholder('/opt/homebrew/bin, /usr/local/bin')
				.setValue(this.plugin.settings.executablePaths.additionalPaths.join(', '))
				.onChange(async (value) => {
					const paths = value
						.split(',')
						.map(p => p.trim())
						.filter(p => p.length > 0);
					
					// Validate each path
					for (const pathItem of paths) {
						if (!SecurityUtils.validateExecutablePath(pathItem)) {
							new Notice(`Invalid system path: ${SecurityUtils.getExecutablePathValidationError(pathItem)}`);
							return;
						}
					}
					
					this.plugin.settings.executablePaths.additionalPaths = paths;
					await this.plugin.saveSettings();
				}));
	}
	
	private createExportDefaultsSection(containerEl: HTMLElement): void {
		containerEl.createEl('h3', { text: 'Export Defaults' });
		
		new Setting(containerEl)
			.setName('Default template')
			.setDesc('Default Typst template for exports')
			.addDropdown(async (dropdown) => {
				try {
					const templates = await this.plugin.templateManager.getAvailableTemplates();
					// Filter out universal-wrapper.pandoc.typ as requested
					const filteredTemplates = templates.filter(template => 
						template !== 'universal-wrapper.pandoc.typ'
					);
					
					filteredTemplates.forEach(template => {
						dropdown.addOption(template, template);
					});
					
					dropdown
						.setValue(this.plugin.settings.exportDefaults.template)
						.onChange(async (value) => {
							this.plugin.settings.exportDefaults.template = value;
							await this.plugin.saveSettings();
						});
				} catch (error) {
					console.error('Failed to load templates:', error);
					// Fallback to text input
					dropdown.addOption('default.typ', 'default.typ');
					dropdown.setValue(this.plugin.settings.exportDefaults.template);
				}
			});
		
		new Setting(containerEl)
			.setName('Default format')
			.setDesc('Default PDF format')
			.addDropdown(dropdown => dropdown
				.addOption(ExportFormat.Standard, 'Standard (multi-page)')
				.addOption(ExportFormat.SinglePage, 'Single-page (continuous)')
				.setValue(this.plugin.settings.exportDefaults.format)
				.onChange(async (value) => {
					this.plugin.settings.exportDefaults.format = value as ExportFormat;
					await this.plugin.saveSettings();
				}));
		
		new Setting(containerEl)
			.setName('Output folder')
			.setDesc('Default folder for exported PDFs (relative to vault root)')
			.addText(text => {
				text
					.setPlaceholder('exports')
					.setValue(this.plugin.settings.outputFolder)
					.onChange(async (value) => {
						const normalizedValue = normalizePath(value);
						if (!SecurityUtils.validateOutputPath(normalizedValue)) {
							new Notice(`Invalid output folder: ${SecurityUtils.getPathValidationError(normalizedValue)}`);
							return;
						}
						this.plugin.settings.outputFolder = normalizedValue;
						await this.plugin.saveSettings();
					});

				new FolderSuggest(this.app, text.inputEl);
			});
	}
	
	/**
	 * Helper method to create a font dropdown setting
	 */
	private createFontDropdown(
		containerEl: HTMLElement,
		name: string,
		desc: string,
		getCurrentValue: () => string,
		setNewValue: (value: string) => void
	): void {
		new Setting(containerEl)
			.setName(name)
			.setDesc(desc)
			.addDropdown(async (dropdown) => {
				try {
					const fonts = await this.getAvailableFonts();
					fonts.forEach(font => {
						dropdown.addOption(font, font);
					});
					
					dropdown
						.setValue(getCurrentValue())
						.onChange(async (value) => {
							setNewValue(value);
							await this.plugin.saveSettings();
						});
				} catch (error) {
					console.error('Failed to load fonts:', error);
					dropdown.addOption(getCurrentValue(), getCurrentValue());
				}
			});
	}

	private createTypographyDefaultsSection(containerEl: HTMLElement): void {
	containerEl.createEl('h3', { text: 'Typography Defaults' });
	
	// Use helper method for all three font dropdowns
	this.createFontDropdown(
		containerEl,
		'Body font',
		'Default font for body text',
		() => this.plugin.settings.typography.fonts.body,
		(value) => { this.plugin.settings.typography.fonts.body = value; }
	);
	
	this.createFontDropdown(
		containerEl,
		'Heading font',
		'Default font for headings',
		() => this.plugin.settings.typography.fonts.heading,
		(value) => { this.plugin.settings.typography.fonts.heading = value; }
	);
	
	this.createFontDropdown(
		containerEl,
		'Monospace font',
		'Default font for code and monospace text',
		() => this.plugin.settings.typography.fonts.monospace,
		(value) => { this.plugin.settings.typography.fonts.monospace = value; }
	);
	
	new Setting(containerEl)
		.setName('Body font size')
		.setDesc('Default font size for body text (in points)')
		.addSlider(slider => slider
			.setLimits(8, 16, 0.5)
			.setValue(this.plugin.settings.typography.fontSizes.body)
			.setDynamicTooltip()
			.onChange(async (value) => {
				this.plugin.settings.typography.fontSizes.body = value;
				await this.plugin.saveSettings();
			}));
}
	
	/**
	 * Helper method to create a margin input setting
	 */
	private createMarginInput(
		containerEl: HTMLElement,
		name: string,
		placeholder: string,
		getCurrentValue: () => number,
		setNewValue: (value: number) => void,
		defaultValue: number
	): void {
		new Setting(containerEl)
			.setName(name)
			.setDesc(`${name.toLowerCase()} in centimeters`)
			.addText(text => text
				.setPlaceholder(placeholder)
				.setValue(this.formatSingleMarginForDisplay(getCurrentValue()))
				.onChange(async (value) => {
					setNewValue(this.parseMarginValue(value, defaultValue));
					await this.plugin.saveSettings();
				}));
	}

	private createPageSetupSection(containerEl: HTMLElement): void {
	containerEl.createEl('h3', { text: 'Page Setup' });
	
	new Setting(containerEl)
		.setName('Page size')
		.setDesc('Paper size for PDF output')
		.addDropdown(dropdown => {
			// Add all supported paper sizes
			SUPPORTED_PAPER_SIZES.forEach(paperSize => {
				dropdown.addOption(paperSize.key, paperSize.displayName);
			});
			
			return dropdown
				.setValue(this.plugin.settings.pageSetup.size)
				.onChange(async (value) => {
					this.plugin.settings.pageSetup.size = value;
					await this.plugin.saveSettings();
				});
		});
	
	new Setting(containerEl)
		.setName('Page orientation')
		.setDesc('Page orientation')
		.addDropdown(dropdown => dropdown
			.addOption('portrait', 'Portrait')
			.addOption('landscape', 'Landscape')
			.setValue(this.plugin.settings.pageSetup.orientation)
			.onChange(async (value) => {
				this.plugin.settings.pageSetup.orientation = value as 'portrait' | 'landscape';
				await this.plugin.saveSettings();
			}));
	
	// Test with helper method for top margin only
	this.createMarginInput(
		containerEl,
		'Top margin',
		'2.5',
		() => this.plugin.settings.pageSetup.margins.top,
		(value) => { this.plugin.settings.pageSetup.margins.top = value; },
		2.5
	);

	this.createMarginInput(
		containerEl,
		'Bottom margin',
		'2.0',
		() => this.plugin.settings.pageSetup.margins.bottom,
		(value) => { this.plugin.settings.pageSetup.margins.bottom = value; },
		2.0
	);

	this.createMarginInput(
		containerEl,
		'Left margin',
		'2.5',
		() => this.plugin.settings.pageSetup.margins.left,
		(value) => { this.plugin.settings.pageSetup.margins.left = value; },
		2.5
	);

	this.createMarginInput(
		containerEl,
		'Right margin',
		'1.5',
		() => this.plugin.settings.pageSetup.margins.right,
		(value) => { this.plugin.settings.pageSetup.margins.right = value; },
		1.5
	);
}
	
	private createBehaviorSection(containerEl: HTMLElement): void {
	containerEl.createEl('h3', { text: 'Behavior' });
	
	new Setting(containerEl)
		.setName('Open after export')
		.setDesc('Automatically open PDF after successful export')
		.addToggle(toggle => toggle
			.setValue(this.plugin.settings.behavior.openAfterExport)
			.onChange(async (value) => {
				this.plugin.settings.behavior.openAfterExport = value;
				await this.plugin.saveSettings();
			}));
	
	new Setting(containerEl)
		.setName('Preserve folder structure')
		.setDesc('Maintain vault folder structure in output directory')
		.addToggle(toggle => toggle
			.setValue(this.plugin.settings.behavior.preserveFolderStructure)
			.onChange(async (value) => {
				this.plugin.settings.behavior.preserveFolderStructure = value;
				await this.plugin.saveSettings();
			}));
	
	new Setting(containerEl)
		.setName('Embed PDF files')
		.setDesc('Include PDF files as attachments in the exported PDF (in addition to preview images)')
		.addToggle(toggle => toggle
			.setValue(this.plugin.settings.behavior.embedPdfFiles)
			.onChange(async (value) => {
				this.plugin.settings.behavior.embedPdfFiles = value;
				await this.plugin.saveSettings();
			}));
	
	new Setting(containerEl)
		.setName('Embed all file types')
		.setDesc('Include all referenced file types (office documents, archives, etc.) as PDF attachments')
		.addToggle(toggle => toggle
			.setValue(this.plugin.settings.behavior.embedAllFiles)
			.onChange(async (value) => {
				this.plugin.settings.behavior.embedAllFiles = value;
				await this.plugin.saveSettings();
			}));
	
	new Setting(containerEl)
		.setName('Print frontmatter')
		.setDesc('Display frontmatter as formatted text at the beginning of documents')
		.addToggle(toggle => toggle
			.setValue(this.plugin.settings.behavior.printFrontmatter)
			.onChange(async (value) => {
				this.plugin.settings.behavior.printFrontmatter = value;
				await this.plugin.saveSettings();
			}));
	
	new Setting(containerEl)
		.setName('Debug mode')
		.setDesc('Enable verbose logging for troubleshooting')
		.addToggle(toggle => toggle
			.setValue(this.plugin.settings.behavior.debugMode)
			.onChange(async (value) => {
				this.plugin.settings.behavior.debugMode = value;
				await this.plugin.saveSettings();
			}));
}
	
	// Helper methods for fonts
	private async getAvailableFonts(): Promise<string[]> {
		return await this.plugin.fontManager.getCachedFonts();
	}
	
	// Helper methods for margin conversion
	private formatSingleMarginForDisplay(marginCm: number): string {
		// No conversion needed - directly return centimeters
		return marginCm.toFixed(2);
	}
	
	private parseMarginValue(value: string, defaultCm: number): number {
		const cm = parseFloat(value.trim());
		return isNaN(cm) ? defaultCm : cm; // No conversion needed - directly use centimeters
	}
}