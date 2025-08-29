import { App, Notice, Plugin, PluginSettingTab, Setting } from 'obsidian';

/**
 * Obsidian Typst PDF Export Plugin
 * 
 * This plugin exports Obsidian notes to PDF using the Typst typesetting system.
 * It provides features for converting Obsidian markdown to Typst format and 
 * generating high-quality PDFs with customizable styling.
 */

interface obsidianTypstPDFExportSettings {
	// Placeholder for future settings
}

const DEFAULT_SETTINGS: obsidianTypstPDFExportSettings = {
	// Default values will be added as settings are implemented
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
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
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
		
		containerEl.createEl('p', {
			text: 'Settings for the Typst PDF Export plugin will be added in future versions.'
		});
	}
}
