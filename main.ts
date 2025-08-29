import { App, Notice, Plugin, PluginSettingTab, Setting } from 'obsidian';

/**
 * Obsidian Typst PDF Export Plugin
 * 
 * This plugin exports Obsidian notes to PDF using the Typst typesetting system.
 * It provides features for converting Obsidian markdown to Typst format and 
 * generating high-quality PDFs with customizable styling.
 */

/** Export mode options for different conversion approaches */
enum ExportMode {
	/** Typography-focused export optimizing for readability */
	Typography = 'typography',
	/** Style-preserving export maintaining original formatting */
	StylePreserving = 'style-preserving'
}

/** Export format options for output structure */
enum ExportFormat {
	/** Standard multi-page PDF format */
	Standard = 'standard',
	/** Single-page continuous PDF format */
	SinglePage = 'single-page'
}

/** Template interface for Typst template management */
interface Template {
	/** Display name of the template */
	name: string;
	/** File path to the template */
	filePath: string;
	/** Template variables and their types */
	variables: Record<string, {
		type: 'string' | 'number' | 'boolean';
		defaultValue: any;
		description?: string;
		required: boolean;
	}>;
	/** Template metadata */
	metadata: {
		author?: string;
		version?: string;
		description?: string;
		compatibility: string[];
	};
}

/** Configuration for individual export operations */
interface ExportConfig {
	/** Override default template */
	template?: string;
	/** Override default format */
	format?: ExportFormat;
	/** Override default mode */
	mode?: ExportMode;
	/** Override output folder */
	outputFolder?: string;
	/** Template variables for this export */
	templateVariables?: Record<string, any>;
}

interface obsidianTypstPDFExportSettings {
	/** Path to the Pandoc executable */
	pandocPath: string;
	/** Path to the Typst executable */
	typstPath: string;
	/** Default output folder for exported PDFs */
	outputFolder: string;
	
	/** Export defaults */
	exportDefaults: {
		/** Default template to use for exports */
		template: string;
		/** Default export format */
		format: ExportFormat;
		/** Default export mode */
		mode: ExportMode;
	};
	
	/** Typography settings */
	typography: {
		/** Font families for different text types */
		fonts: {
			body: string;
			heading: string;
			monospace: string;
		};
		/** Font sizes */
		fontSizes: {
			body: number;
			heading: number;
			small: number;
		};
	};
	
	/** Page setup configuration */
	pageSetup: {
		/** Page size (e.g., "a4", "letter", "custom") */
		size: string;
		/** Page orientation */
		orientation: "portrait" | "landscape";
		/** Page margins in points */
		margins: {
			top: number;
			right: number;
			bottom: number;
			left: number;
		};
	};
	
	/** Behavior flags */
	behavior: {
		/** Open PDF after export */
		openAfterExport: boolean;
		/** Preserve folder structure in output */
		preserveFolderStructure: boolean;
	};
}

const DEFAULT_SETTINGS: obsidianTypstPDFExportSettings = {
	pandocPath: '',
	typstPath: '',
	outputFolder: 'exports',
	
	exportDefaults: {
		template: 'default',
		format: ExportFormat.Standard,
		mode: ExportMode.Typography
	},
	
	typography: {
		fonts: {
			body: 'Times New Roman',
			heading: 'Arial',
			monospace: 'Courier New'
		},
		fontSizes: {
			body: 11,
			heading: 16,
			small: 9
		}
	},
	
	pageSetup: {
		size: 'a4',
		orientation: 'portrait',
		margins: {
			top: 72,
			right: 72,
			bottom: 72,
			left: 72
		}
	},
	
	behavior: {
		openAfterExport: true,
		preserveFolderStructure: true
	}
}

export default class obsidianTypstPDFExport extends Plugin {
	settings: obsidianTypstPDFExportSettings;

	async onload() {
		await this.loadSettings();

		// Add ribbon icon for quick export access
		this.addRibbonIcon('file-text', 'Export to PDF with Typst', () => {
			new Notice('Typst PDF Export: Coming soon!');
		});

		// Add basic export command
		this.addCommand({
			id: 'export-current-note',
			name: 'Export current note to Typst PDF',
			callback: () => {
				new Notice('Typst PDF Export functionality will be implemented in future versions.');
			}
		});

		// This adds a settings tab so the user can configure various aspects of the plugin
		this.addSettingTab(new TypstPDFExportSettingTab(this.app, this));
	}

	onunload() {

	}

	async loadSettings() {
		try {
			const loadedData = await this.loadData();
			
			if (!loadedData) {
				// No saved settings, use defaults
				this.settings = { ...DEFAULT_SETTINGS };
				return;
			}

			// Start with defaults and merge loaded data
			this.settings = { ...DEFAULT_SETTINGS };
			
			// Validate and merge loaded settings
			const validatedSettings = this.validateSettings(loadedData);
			this.settings = { ...this.settings, ...validatedSettings };
			
			// Migrate settings if needed
			this.settings = this.migrateSettings(this.settings);
			
		} catch (error) {
			console.error('Failed to load Typst PDF Export settings:', error);
			new Notice('Failed to load settings, using defaults');
			this.settings = { ...DEFAULT_SETTINGS };
		}
	}

	/**
	 * Validates loaded settings data and returns a clean settings object
	 */
	private validateSettings(data: any): Partial<obsidianTypstPDFExportSettings> {
		const validated: Partial<obsidianTypstPDFExportSettings> = {};

		// Validate string paths
		if (typeof data.pandocPath === 'string') {
			validated.pandocPath = data.pandocPath;
		}
		if (typeof data.typstPath === 'string') {
			validated.typstPath = data.typstPath;
		}
		if (typeof data.outputFolder === 'string') {
			validated.outputFolder = data.outputFolder;
		}

		// Validate export defaults
		if (data.exportDefaults && typeof data.exportDefaults === 'object') {
			const exportDefaults: Partial<obsidianTypstPDFExportSettings['exportDefaults']> = {};
			
			if (typeof data.exportDefaults.template === 'string') {
				exportDefaults.template = data.exportDefaults.template;
			}
			
			// Validate enum values
			if (Object.values(ExportFormat).includes(data.exportDefaults.format)) {
				exportDefaults.format = data.exportDefaults.format;
			}
			
			if (Object.values(ExportMode).includes(data.exportDefaults.mode)) {
				exportDefaults.mode = data.exportDefaults.mode;
			}
			
			if (Object.keys(exportDefaults).length > 0) {
				validated.exportDefaults = exportDefaults as any;
			}
		}

		// Validate typography settings
		if (data.typography && typeof data.typography === 'object') {
			const typography: Partial<obsidianTypstPDFExportSettings['typography']> = {};
			
			if (data.typography.fonts && typeof data.typography.fonts === 'object') {
				const fonts: Partial<obsidianTypstPDFExportSettings['typography']['fonts']> = {};
				['body', 'heading', 'monospace'].forEach(key => {
					if (typeof data.typography.fonts[key] === 'string') {
						(fonts as any)[key] = data.typography.fonts[key];
					}
				});
				if (Object.keys(fonts).length > 0) {
					typography.fonts = fonts as any;
				}
			}
			
			if (data.typography.fontSizes && typeof data.typography.fontSizes === 'object') {
				const fontSizes: Partial<obsidianTypstPDFExportSettings['typography']['fontSizes']> = {};
				['body', 'heading', 'small'].forEach(key => {
					if (typeof data.typography.fontSizes[key] === 'number' && data.typography.fontSizes[key] > 0) {
						(fontSizes as any)[key] = data.typography.fontSizes[key];
					}
				});
				if (Object.keys(fontSizes).length > 0) {
					typography.fontSizes = fontSizes as any;
				}
			}
			
			if (Object.keys(typography).length > 0) {
				validated.typography = typography as any;
			}
		}

		// Validate page setup
		if (data.pageSetup && typeof data.pageSetup === 'object') {
			const pageSetup: Partial<obsidianTypstPDFExportSettings['pageSetup']> = {};
			
			if (typeof data.pageSetup.size === 'string') {
				pageSetup.size = data.pageSetup.size;
			}
			
			if (['portrait', 'landscape'].includes(data.pageSetup.orientation)) {
				pageSetup.orientation = data.pageSetup.orientation;
			}
			
			if (data.pageSetup.margins && typeof data.pageSetup.margins === 'object') {
				const margins: Partial<obsidianTypstPDFExportSettings['pageSetup']['margins']> = {};
				['top', 'right', 'bottom', 'left'].forEach(key => {
					if (typeof data.pageSetup.margins[key] === 'number' && data.pageSetup.margins[key] >= 0) {
						(margins as any)[key] = data.pageSetup.margins[key];
					}
				});
				if (Object.keys(margins).length > 0) {
					pageSetup.margins = margins as any;
				}
			}
			
			if (Object.keys(pageSetup).length > 0) {
				validated.pageSetup = pageSetup as any;
			}
		}

		// Validate behavior flags
		if (data.behavior && typeof data.behavior === 'object') {
			const behavior: Partial<obsidianTypstPDFExportSettings['behavior']> = {};
			
			if (typeof data.behavior.openAfterExport === 'boolean') {
				behavior.openAfterExport = data.behavior.openAfterExport;
			}
			
			if (typeof data.behavior.preserveFolderStructure === 'boolean') {
				behavior.preserveFolderStructure = data.behavior.preserveFolderStructure;
			}
			
			if (Object.keys(behavior).length > 0) {
				validated.behavior = behavior as any;
			}
		}

		return validated;
	}

	/**
	 * Migrates settings from older versions to current format
	 */
	private migrateSettings(settings: obsidianTypstPDFExportSettings): obsidianTypstPDFExportSettings {
		// Future version migrations can be added here
		// For now, just ensure all required properties exist with defaults
		
		const migrated = { ...settings };
		
		// Ensure all nested objects exist
		if (!migrated.exportDefaults) {
			migrated.exportDefaults = DEFAULT_SETTINGS.exportDefaults;
		}
		
		if (!migrated.typography) {
			migrated.typography = DEFAULT_SETTINGS.typography;
		}
		
		if (!migrated.pageSetup) {
			migrated.pageSetup = DEFAULT_SETTINGS.pageSetup;
		}
		
		if (!migrated.behavior) {
			migrated.behavior = DEFAULT_SETTINGS.behavior;
		}

		return migrated;
	}

	async saveSettings() {
		try {
			// Validate settings before saving
			const validatedSettings = this.validateSettings(this.settings);
			const mergedSettings = { ...DEFAULT_SETTINGS, ...validatedSettings };
			
			// Update current settings with validated data
			this.settings = mergedSettings;
			
			// Save to disk
			await this.saveData(this.settings);
			
		} catch (error) {
			console.error('Failed to save Typst PDF Export settings:', error);
			new Notice('Failed to save settings');
			throw error;
		}
	}
}


class TypstPDFExportSettingTab extends PluginSettingTab {
	plugin: obsidianTypstPDFExport;

	constructor(app: App, plugin: obsidianTypstPDFExport) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const {containerEl} = this;

		containerEl.empty();

		containerEl.createEl('h2', {text: 'Typst PDF Export Settings'});

		// External Tools Section
		new Setting(containerEl)
			.setHeading();

		new Setting(containerEl)
			.setName('External Tools')
			.setDesc('Configure paths to external tools required for PDF export');

		new Setting(containerEl)
			.setName('Pandoc path')
			.setDesc('Path to the Pandoc executable (leave empty to use system PATH)')
			.addText(text => text
				.setPlaceholder('/usr/local/bin/pandoc')
				.setValue(this.plugin.settings.pandocPath)
				.onChange(async (value) => {
					this.plugin.settings.pandocPath = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Typst path')
			.setDesc('Path to the Typst executable (leave empty to use system PATH)')
			.addText(text => text
				.setPlaceholder('/usr/local/bin/typst')
				.setValue(this.plugin.settings.typstPath)
				.onChange(async (value) => {
					this.plugin.settings.typstPath = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Output folder')
			.setDesc('Default folder for exported PDF files (relative to vault root)')
			.addText(text => text
				.setPlaceholder('exports')
				.setValue(this.plugin.settings.outputFolder)
				.onChange(async (value) => {
					this.plugin.settings.outputFolder = value;
					await this.plugin.saveSettings();
				}));

		// Export Defaults Section
		new Setting(containerEl)
			.setHeading();

		new Setting(containerEl)
			.setName('Export Defaults')
			.setDesc('Default settings for PDF export operations');

		new Setting(containerEl)
			.setName('Default template')
			.setDesc('Template name to use for exports')
			.addText(text => text
				.setPlaceholder('default')
				.setValue(this.plugin.settings.exportDefaults.template)
				.onChange(async (value) => {
					this.plugin.settings.exportDefaults.template = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Export format')
			.setDesc('Default PDF format for exports')
			.addDropdown(dropdown => dropdown
				.addOption(ExportFormat.Standard, 'Standard multi-page')
				.addOption(ExportFormat.SinglePage, 'Single continuous page')
				.setValue(this.plugin.settings.exportDefaults.format)
				.onChange(async (value) => {
					this.plugin.settings.exportDefaults.format = value as ExportFormat;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Export mode')
			.setDesc('Processing approach for document conversion')
			.addDropdown(dropdown => dropdown
				.addOption(ExportMode.Typography, 'Typography-focused (optimized readability)')
				.addOption(ExportMode.StylePreserving, 'Style-preserving (maintain formatting)')
				.setValue(this.plugin.settings.exportDefaults.mode)
				.onChange(async (value) => {
					this.plugin.settings.exportDefaults.mode = value as ExportMode;
					await this.plugin.saveSettings();
				}));

		// Typography Section
		new Setting(containerEl)
			.setHeading();

		new Setting(containerEl)
			.setName('Typography')
			.setDesc('Font and text formatting settings');

		new Setting(containerEl)
			.setName('Body font')
			.setDesc('Font family for body text')
			.addText(text => text
				.setPlaceholder('Times New Roman')
				.setValue(this.plugin.settings.typography.fonts.body)
				.onChange(async (value) => {
					this.plugin.settings.typography.fonts.body = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Heading font')
			.setDesc('Font family for headings')
			.addText(text => text
				.setPlaceholder('Arial')
				.setValue(this.plugin.settings.typography.fonts.heading)
				.onChange(async (value) => {
					this.plugin.settings.typography.fonts.heading = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Monospace font')
			.setDesc('Font family for code blocks and inline code')
			.addText(text => text
				.setPlaceholder('Courier New')
				.setValue(this.plugin.settings.typography.fonts.monospace)
				.onChange(async (value) => {
					this.plugin.settings.typography.fonts.monospace = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Body font size')
			.setDesc('Font size for body text (in points)')
			.addSlider(slider => slider
				.setLimits(8, 24, 1)
				.setValue(this.plugin.settings.typography.fontSizes.body)
				.setDynamicTooltip()
				.onChange(async (value) => {
					this.plugin.settings.typography.fontSizes.body = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Heading font size')
			.setDesc('Font size for headings (in points)')
			.addSlider(slider => slider
				.setLimits(12, 36, 1)
				.setValue(this.plugin.settings.typography.fontSizes.heading)
				.setDynamicTooltip()
				.onChange(async (value) => {
					this.plugin.settings.typography.fontSizes.heading = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Small font size')
			.setDesc('Font size for small text like captions (in points)')
			.addSlider(slider => slider
				.setLimits(6, 16, 1)
				.setValue(this.plugin.settings.typography.fontSizes.small)
				.setDynamicTooltip()
				.onChange(async (value) => {
					this.plugin.settings.typography.fontSizes.small = value;
					await this.plugin.saveSettings();
				}));

		// Page Setup Section
		new Setting(containerEl)
			.setHeading();

		new Setting(containerEl)
			.setName('Page Setup')
			.setDesc('PDF page layout and formatting');

		new Setting(containerEl)
			.setName('Page size')
			.setDesc('Paper size for PDF output')
			.addDropdown(dropdown => dropdown
				.addOption('a4', 'A4')
				.addOption('letter', 'US Letter')
				.addOption('a3', 'A3')
				.addOption('a5', 'A5')
				.addOption('legal', 'US Legal')
				.setValue(this.plugin.settings.pageSetup.size)
				.onChange(async (value) => {
					this.plugin.settings.pageSetup.size = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Orientation')
			.setDesc('Page orientation')
			.addDropdown(dropdown => dropdown
				.addOption('portrait', 'Portrait')
				.addOption('landscape', 'Landscape')
				.setValue(this.plugin.settings.pageSetup.orientation)
				.onChange(async (value) => {
					this.plugin.settings.pageSetup.orientation = value as 'portrait' | 'landscape';
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Top margin')
			.setDesc('Top page margin (in points)')
			.addSlider(slider => slider
				.setLimits(18, 144, 6)
				.setValue(this.plugin.settings.pageSetup.margins.top)
				.setDynamicTooltip()
				.onChange(async (value) => {
					this.plugin.settings.pageSetup.margins.top = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Right margin')
			.setDesc('Right page margin (in points)')
			.addSlider(slider => slider
				.setLimits(18, 144, 6)
				.setValue(this.plugin.settings.pageSetup.margins.right)
				.setDynamicTooltip()
				.onChange(async (value) => {
					this.plugin.settings.pageSetup.margins.right = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Bottom margin')
			.setDesc('Bottom page margin (in points)')
			.addSlider(slider => slider
				.setLimits(18, 144, 6)
				.setValue(this.plugin.settings.pageSetup.margins.bottom)
				.setDynamicTooltip()
				.onChange(async (value) => {
					this.plugin.settings.pageSetup.margins.bottom = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Left margin')
			.setDesc('Left page margin (in points)')
			.addSlider(slider => slider
				.setLimits(18, 144, 6)
				.setValue(this.plugin.settings.pageSetup.margins.left)
				.setDynamicTooltip()
				.onChange(async (value) => {
					this.plugin.settings.pageSetup.margins.left = value;
					await this.plugin.saveSettings();
				}));

		// Behavior Section
		new Setting(containerEl)
			.setHeading();

		new Setting(containerEl)
			.setName('Behavior')
			.setDesc('Plugin behavior and automation settings');

		new Setting(containerEl)
			.setName('Open PDF after export')
			.setDesc('Automatically open the exported PDF file')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.behavior.openAfterExport)
				.onChange(async (value) => {
					this.plugin.settings.behavior.openAfterExport = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Preserve folder structure')
			.setDesc('Maintain the original folder structure in the output directory')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.behavior.preserveFolderStructure)
				.onChange(async (value) => {
					this.plugin.settings.behavior.preserveFolderStructure = value;
					await this.plugin.saveSettings();
				}));
	}
}
