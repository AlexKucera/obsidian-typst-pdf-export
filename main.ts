/**
 * Obsidian Typst PDF Export Plugin
 * Refactored main plugin class
 */

import {
	App,
	addIcon,
	Plugin,
	PluginSettingTab,
	Setting,
	TFile,
	TFolder,
	TAbstractFile,
	Notice,
	Menu,
	MarkdownView,
	Editor,
	AbstractInputSuggest,
	normalizePath
} from 'obsidian';

import { obsidianTypstPDFExportSettings, DEFAULT_SETTINGS, ExportFormat } from './src/core/settings';
import { FALLBACK_FONTS, PLUGIN_DIRS } from './src/core/constants';
import { DependencyChecker } from './src/core/DependencyChecker';
import { SecurityUtils } from './src/core/SecurityUtils';
import { ModalSettingsHelper } from './src/core/ModalSettingsHelper';
import { ExportErrorHandler } from './src/core/ExportErrorHandler';
import { TempDirectoryManager } from './src/core/TempDirectoryManager';
import { PandocTypstConverter } from './src/converters/PandocTypstConverter';
import { MarkdownPreprocessor } from './src/converters/MarkdownPreprocessor';
import { ExportConfigModal } from './src/ui/modal/ExportConfigModal';
import { ExportConfig, ExportConfigModalSettings } from './src/ui/modal/modalTypes';
import { TemplateManager } from './src/templates/TemplateManager';
import { EmbeddedTemplateManager } from './src/templates/embeddedTemplates';
import { FolderSuggest } from './src/ui/components/FolderSuggest';
import { SUPPORTED_PAPER_SIZES } from './src/utils/paperSizeMapper';
import { PluginLifecycle } from './src/plugin/PluginLifecycle';
import { CommandRegistry } from './src/plugin/CommandRegistry';
import { EventHandlers } from './src/plugin/EventHandlers';
import { ExportOrchestrator } from './src/plugin/ExportOrchestrator';
import { FontManager } from './src/plugin/FontManager';
import { PathResolver } from './src/plugin/PathResolver';
import { ObsidianTypstPDFExportSettingTab } from './src/plugin/SettingsTab';
import { EmbedProcessor } from './src/plugin/EmbedProcessor';
import * as path from 'path';
import * as fs from 'fs';

export class obsidianTypstPDFExport extends Plugin {
	settings: obsidianTypstPDFExportSettings;
	converter: PandocTypstConverter;
	templateManager: TemplateManager;
	embeddedTemplateManager: EmbeddedTemplateManager;
	currentExportController: AbortController | null = null;
	private lifecycle: PluginLifecycle;
	private commandRegistry: CommandRegistry;
	private eventHandlers: EventHandlers;
	private exportOrchestrator: ExportOrchestrator;
	fontManager: FontManager;
	pathResolver: PathResolver;
	embedProcessor: EmbedProcessor;

	// Type predicate to filter for markdown TFiles
	isMarkdownFile(file: TAbstractFile): file is TFile {
		return file instanceof TFile && file.extension === 'md';
	}
	
	async onload() {
		// Initialize lifecycle manager
		this.lifecycle = new PluginLifecycle(this);
		
		// Initialize font manager first (needed by PluginLifecycle)
		this.fontManager = new FontManager(this);
		
		// Initialize path resolver
		this.pathResolver = new PathResolver(this);
		
		// Initialize core plugin functionality
		await this.lifecycle.initialize();
		
		// Initialize command registry
		this.commandRegistry = new CommandRegistry(this);
		
		// Initialize event handlers
		this.eventHandlers = new EventHandlers(this);
		
		// Initialize export orchestrator
		this.exportOrchestrator = new ExportOrchestrator(this);
		
		// Initialize embed processor
		this.embedProcessor = new EmbedProcessor(this);
		
		// Register custom icon
		addIcon('typst-pdf-export', `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" xml:space="preserve" style="fill-rule:evenodd;clip-rule:evenodd;stroke-linejoin:round;stroke-miterlimit:2">
  <path d="m9.002 4.175 4.343-2.13V6l4.033-.304V8.13h-4.033c-.017.223-.001 8.368 0 9.432.001.65.889 1.217 1.551 1.217.775 0 3.102-1.217 3.102-1.217l.931 1.522s-2.741 1.774-4.033 2.129c-1.195.329-2.017.761-3.723 0-1.073-.478-2.144-1.582-2.171-2.738-.052-2.231 0-10.649 0-10.649L7.14 8.13l-.31-1.825L9.002 6z" style="fill:#828282"/>
</svg>
`);
		
		// Add ribbon icon using custom icon
		this.addRibbonIcon('typst-pdf-export', 'Export to PDF with Typst', (event: MouseEvent) => {
			this.eventHandlers.handleRibbonClick(event);
		});
		
		// Register commands
		this.commandRegistry.registerCommands();
		
		// Register event handlers
		this.eventHandlers.registerEventHandlers();
		
		// Add settings tab
		this.addSettingTab(new ObsidianTypstPDFExportSettingTab(this.app, this));
	}



	
	/**
	 * Export the current note with default settings
	 */
	async exportCurrentNote(view: MarkdownView): Promise<void> {
		const file = view.file;
		if (!file) {
			new Notice('No active file to export');
			return;
		}
		
		await this.exportOrchestrator.exportFile(file);
	}
	
	/**
	 * Show the export configuration modal
	 */
	async showExportModal(view: MarkdownView): Promise<void> {
	const file = view.file;
	if (!file) {
		new Notice('No active file to export');
		return;
	}
	
	// Get available templates first
	const availableTemplates = await this.templateManager.getAvailableTemplates();
	
	// Prepare modal settings using helper
	const modalSettings = ModalSettingsHelper.prepareForSingleFile(
		file, 
		availableTemplates, 
		this.settings
	);
	
	// Show modal - ModalState will handle localStorage hierarchy automatically
	const modal = new ExportConfigModal(
		this.app,
		this,
		modalSettings,
		async (config: ExportConfig) => {
			await this.exportOrchestrator.exportFileWithConfig(file, config);
		},
		() => {
			this.exportOrchestrator.cancelExport();
		}
	);
	
	modal.open();
}

	/**
	 * Show the export configuration modal for multiple files
	 */
	async showExportModalForFiles(files: TFile[]): Promise<void> {
		if (files.length === 0) {
			new Notice('No files to export');
			return;
		}

		// Get available templates first
		const availableTemplates = await this.templateManager.getAvailableTemplates();
		
		// Prepare modal settings using helper
		const modalSettings = ModalSettingsHelper.prepareForMultiFile(
			files, 
			availableTemplates, 
			this.settings
		);
		
		// Show modal - ModalState will handle localStorage hierarchy automatically
		const modal = new ExportConfigModal(
			this.app,
			this,
			modalSettings,
			async (config: ExportConfig) => {
				await this.exportOrchestrator.exportFilesWithConfig(files, config);
			},
			() => {
				this.exportOrchestrator.cancelExport();
			}
		);
		
		modal.open();
	}
	
	/**
	 * Export a file with default configuration (delegated to ExportOrchestrator)
	 */
	async exportFile(file: TFile): Promise<void> {
		return this.exportOrchestrator.exportFile(file);
	}

	/**
	 * Export multiple files with default configuration (delegated to ExportOrchestrator)  
	 */
	async exportFiles(files: TFile[]): Promise<void> {
		return this.exportOrchestrator.exportFiles(files);
	}
	
	/**
	 * Cache available fonts (delegated to FontManager)
	 */
	async cacheAvailableFonts(): Promise<void> {
		return this.fontManager.cacheAvailableFonts();
	}
	
	/**
	 * Get cached fonts list (delegated to FontManager)
	 */
	async getCachedFonts(): Promise<string[]> {
		return this.fontManager.getCachedFonts();
	}
	
	/**
	 * Resolve an executable path (delegated to PathResolver)
	 */
	resolveExecutablePath(userPath: string | undefined, defaultName: string): string {
		return this.pathResolver.resolveExecutablePath(userPath, defaultName);
	}
	
	/**
	 * Prepare the output path for a file (delegated to PathResolver)
	 */
	async prepareOutputPath(file: TFile, outputFolder: string): Promise<string> {
		return this.pathResolver.prepareOutputPath(file, outputFolder);
	}
	
	
	/**
	 * Show dependency status modal
	 */
	async showDependencyStatus(): Promise<void> {
		const dependencyResult = await DependencyChecker.checkAllDependencies(
			this.settings.pandocPath,
			this.settings.typstPath,
			this.settings.executablePaths?.imagemagickPath,
			this.settings.executablePaths?.additionalPaths || []
		);
		
		const formatVersion = (dep: any) => dep.isAvailable ? (dep.version || 'Available') : 'Not found';
		
		const message = `Dependency Status:
Pandoc: ${formatVersion(dependencyResult.pandoc)}
Typst: ${formatVersion(dependencyResult.typst)}
ImageMagick: ${formatVersion(dependencyResult.imagemagick)}

${dependencyResult.allAvailable 
	? 'All dependencies found!' 
	: `Missing dependencies: ${dependencyResult.missingDependencies.join(', ')}. Please install them and check the paths in settings.`}`;
		
		new Notice(message, 12000); // Show for 12 seconds (longer due to more content)
	}

	async checkDependenciesAsync(): Promise<void> {
		// Check dependencies silently on startup
		try {
			const missingDeps = DependencyChecker.checkDependenciesSync(
				this.settings.pandocPath,
				this.settings.typstPath,
				this.settings.executablePaths?.imagemagickPath,
				this.settings.executablePaths?.additionalPaths || []
			);
			
			// Only show notice if dependencies are missing
			if (missingDeps.length > 0) {
				new Notice(
					`Typst PDF Export: Missing dependencies: ${missingDeps.join(', ')}. ` +
					`Run "Check Dependencies" command for details.`,
					8000
				);
			}
		} catch (error) {
			ExportErrorHandler.handleDependencyError('Dependencies', error, false);
		}
	}

	/**
	 * Process PDF embeds (delegated to EmbedProcessor)
	 */
	async processPdfEmbeds(processedResult: any, vaultBasePath: string, tempDir: string, currentFile?: TFile, embedPdfFiles: boolean = true): Promise<void> {
		return this.embedProcessor.processPdfEmbeds(processedResult, vaultBasePath, tempDir, currentFile, embedPdfFiles);
	}
	
	/**
	 * Process image embeds (delegated to EmbedProcessor)
	 */
	async processImageEmbeds(processedResult: any, vaultBasePath: string, tempDir: string, currentFile?: TFile): Promise<void> {
		return this.embedProcessor.processImageEmbeds(processedResult, vaultBasePath, tempDir, currentFile);
	}
	
	/**
	 * Process file embeds (delegated to EmbedProcessor)
	 */
	async processFileEmbeds(processedResult: any, vaultBasePath: string, tempDir: string, currentFile?: TFile, embedAllFiles: boolean = true): Promise<void> {
		return this.embedProcessor.processFileEmbeds(processedResult, vaultBasePath, tempDir, currentFile, embedAllFiles);
	}
	
	
	/**
	 * Open a PDF file in the default viewer
	 */
	openPDF(pdfPath: string): void {
		const { shell } = require('electron');
		shell.openPath(pdfPath);
	}
	
	async loadSettings() {
		try {
			const data = await this.loadData();
			this.settings = Object.assign({}, DEFAULT_SETTINGS, data);
		} catch (error) {
			console.warn('Failed to load plugin settings, using defaults:', error);
			this.settings = Object.assign({}, DEFAULT_SETTINGS);
			// Don't show notice for this - it's normal on first load
		}
	}
	
	async saveSettings() {
		try {
			await this.saveData(this.settings);
		} catch (error) {
			console.error('Failed to save plugin settings:', error);
			new Notice(`Failed to save settings: ${error.message}`, 4000);
			throw error; // Re-throw to let callers handle appropriately
		}
	}
	
	
	onunload() {
		// Use lifecycle manager for cleanup
		this.lifecycle.cleanup();
	}
}


// Default export for Obsidian
export default obsidianTypstPDFExport;