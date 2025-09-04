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
	AbstractInputSuggest
} from 'obsidian';

import { obsidianTypstPDFExportSettings, DEFAULT_SETTINGS, ExportFormat } from './src/core/settings';
import { FALLBACK_FONTS, PLUGIN_DIRS } from './src/core/constants';
import { DependencyChecker } from './src/core/DependencyChecker';
import { SecurityUtils } from './src/core/SecurityUtils';
import { ModalSettingsHelper } from './src/core/ModalSettingsHelper';
import { ExportErrorHandler } from './src/core/ExportErrorHandler';
import { TempDirectoryManager } from './src/core/TempDirectoryManager';
import { PandocTypstConverter } from './src/converters/PandocTypstConverter';
import { ExportConfigModal } from './src/ui/modal/ExportConfigModal';
import { ExportConfig, ExportConfigModalSettings } from './src/ui/modal/modalTypes';
import { TemplateManager } from './src/templates/TemplateManager';
import { FolderSuggest } from './src/ui/components/FolderSuggest';
import { SUPPORTED_PAPER_SIZES } from './src/utils/paperSizeMapper';
import * as path from 'path';
import * as fs from 'fs';

export class obsidianTypstPDFExport extends Plugin {
	settings: obsidianTypstPDFExportSettings;
	private converter: PandocTypstConverter;
	templateManager: TemplateManager;
	private currentExportController: AbortController | null = null;
	
	async onload() {
		await this.loadSettings();
		
		// Initialize components
		this.converter = new PandocTypstConverter(this);
		this.templateManager = new TemplateManager(this);
		
		// Register custom icon
		addIcon('typst-pdf-export', `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" xml:space="preserve" style="fill-rule:evenodd;clip-rule:evenodd;stroke-linejoin:round;stroke-miterlimit:2">
  <path d="m9.002 4.175 4.343-2.13V6l4.033-.304V8.13h-4.033c-.017.223-.001 8.368 0 9.432.001.65.889 1.217 1.551 1.217.775 0 3.102-1.217 3.102-1.217l.931 1.522s-2.741 1.774-4.033 2.129c-1.195.329-2.017.761-3.723 0-1.073-.478-2.144-1.582-2.171-2.738-.052-2.231 0-10.649 0-10.649L7.14 8.13l-.31-1.825L9.002 6z" style="fill:#828282"/>
</svg>
`);
		
		// Add ribbon icon using custom icon
		this.addRibbonIcon('typst-pdf-export', 'Export to PDF with Typst', (event: MouseEvent) => {
			this.handleRibbonClick(event);
		});
		
		// Register commands
		this.registerCommands();
		
		// Register event handlers
		this.registerEventHandlers();
		
		// Add settings tab
		this.addSettingTab(new ObsidianTypstPDFExportSettingTab(this.app, this));
		
		// Clean up any leftover temp directories from previous sessions
		this.cleanupStartupTempDirectories();
		
		// Check dependencies on startup (async, don't await)
		this.checkDependenciesAsync();
		
		// Cache available fonts (async, don't await)
		this.cacheAvailableFonts();
		
		console.log('Obsidian Typst PDF Export plugin loaded');
	}

	/**
	 * Cache available fonts from typst to a file for quick access
	 */
	private async cacheAvailableFonts(): Promise<void> {
	try {
		const { spawn } = require('child_process');
		
		const typstPath = this.settings.typstPath || 'typst';
		
		// Use spawn instead of exec for security - arguments passed separately
		const stdout = await new Promise<string>((resolve, reject) => {
			const typstProcess = spawn(typstPath, ['fonts'], { 
				stdio: ['pipe', 'pipe', 'pipe'],
				env: { 
					...process.env,
					PATH: `/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:${process.env.PATH || ''}`
				}
			});
			
			let output = '';
			let error = '';
			
			typstProcess.stdout?.on('data', (data: Buffer) => {
				output += data.toString();
			});
			
			typstProcess.stderr?.on('data', (data: Buffer) => {
				error += data.toString();
			});
			
			typstProcess.on('close', (code: number | null) => {
				if (code === 0) {
					resolve(output);
				} else {
					reject(new Error(`typst fonts command failed with code ${code}: ${error}`));
				}
			});
			
			typstProcess.on('error', (err: Error) => {
				reject(new Error(`Failed to spawn typst process: ${err.message}`));
			});
		});
		
		const fonts = stdout
			.split('\n')
			.map((line: string) => line.trim())
			.filter((line: string) => line.length > 0)
			.sort();
		
		// Write fonts to cache file in plugin data directory
		const cacheData = {
			fonts: fonts,
			timestamp: Date.now(),
			typstPath: typstPath
		};
		
		await this.app.vault.adapter.write('.obsidian/plugins/obsidian-typst-pdf-export/fonts-cache.json', 
			JSON.stringify(cacheData, null, 2));
		console.log('Cached', fonts.length, 'fonts from typst');
	} catch (error) {
		console.error('Failed to cache fonts from typst:', error);
		
		// Notify user of font caching failure (only if debug mode is enabled or if it's a critical error)
		if (this.settings.behavior.debugMode) {
			new Notice(`Font caching failed: ${error.message}. Using fallback fonts.`, 5000);
		} else {
			// For non-debug mode, show a more gentle notice
			new Notice('Font list may be incomplete. Check debug mode for details.', 3000);
		}
		
		// Create fallback cache file
		const fallbackFonts = FALLBACK_FONTS;
		
		const cacheData = {
			fonts: fallbackFonts,
			timestamp: Date.now(),
			typstPath: 'fallback',
			error: error.message
		};
		
		await this.app.vault.adapter.write('.obsidian/plugins/obsidian-typst-pdf-export/fonts-cache.json',
			JSON.stringify(cacheData, null, 2));
	}
}

	/**
	 * Get cached fonts list
	 */
	async getCachedFonts(): Promise<string[]> {
		try {
			const cacheContent = await this.app.vault.adapter.read('.obsidian/plugins/obsidian-typst-pdf-export/fonts-cache.json');
			const cacheData = JSON.parse(cacheContent);
			
			// Check if cache is older than 24 hours or typst path changed
			const isStale = Date.now() - cacheData.timestamp > 24 * 60 * 60 * 1000;
			const pathChanged = cacheData.typstPath !== (this.settings.typstPath || 'typst');
			
			if (isStale || pathChanged) {
				// Refresh cache in background
				this.cacheAvailableFonts();
			}
			
			return cacheData.fonts || [];
		} catch (error) {
			console.error('Failed to read fonts cache:', error);
			// Try to recreate cache
			await this.cacheAvailableFonts();
			
			// Return fallback fonts
			return [...FALLBACK_FONTS];
		}
	}
	
	private registerCommands(): void {
		// Export current note command
		this.addCommand({
			id: 'export-current-note',
			name: 'Export current note(s)',
			hotkeys: [{ modifiers: ['Mod', 'Shift'], key: 'e' }],
			editorCallback: (editor: Editor, view: MarkdownView) => {
				this.exportCurrentNote(view);
			}
		});
		
		// Export with configuration command
		this.addCommand({
			id: 'export-with-config',
			name: 'Export with configuration…',
			hotkeys: [{ modifiers: ['Mod', 'Shift', 'Alt'], key: 'e' }],
			editorCallback: (editor: Editor, view: MarkdownView) => {
				this.showExportModal(view);
			}
		});
		
		// Check dependencies command
		this.addCommand({
			id: 'check-dependencies',
			name: 'Check Pandoc and Typst dependencies',
			callback: () => {
				this.showDependencyStatus();
			}
		});
	}
	
	private registerEventHandlers(): void {
		// Add context menu item
		this.registerEvent(
			this.app.workspace.on('file-menu', (menu: Menu, file: TFile) => {
				if (file.extension === 'md') {
					menu.addItem((item) => {
						item
							.setTitle('Export to PDF (Typst)')
							.setIcon('file-output')
							.onClick(() => {
								this.exportFile(file);
							});
					});
				}
			})
		);
		
		// Add editor menu item
		this.registerEvent(
			this.app.workspace.on('editor-menu', (menu: Menu, editor: Editor, view: MarkdownView) => {
				menu.addItem((item) => {
					item
						.setTitle('Export to PDF (Typst)')
						.setIcon('file-output')
						.onClick(() => {
							this.exportCurrentNote(view);
						});
				});
			})
		);
		
		// Add multi-file menu item (for multiple selected files in file explorer)
		this.registerEvent(
			this.app.workspace.on('files-menu', (menu: Menu, files: TAbstractFile[]) => {
				// Filter for markdown files only
				const markdownFiles = files.filter(file => 
					file instanceof TFile && file.extension === 'md'
				) as TFile[];
				
				if (markdownFiles.length > 0) {
					menu.addItem((item) => {
						item
							.setTitle(`Export to PDF (Typst)`)
							.setIcon('file-output')
							.onClick(() => {
								this.exportFiles(markdownFiles);
							});
					});
					
					menu.addItem((item) => {
						item
							.setTitle(`Export with configuration...`)
							.setIcon('settings')
							.onClick(() => {
								this.showExportModalForFiles(markdownFiles);
							});
					});
				}
			})
		);
	}

	
	/**
	 * Handle ribbon icon click
	 */
	private handleRibbonClick(event: MouseEvent): void {
		const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
		
		if (!activeView || !activeView.file) {
			new Notice('Please open a markdown file to export');
			return;
		}
		
		// Create context menu for ribbon click
		const menu = new Menu();
		
		menu.addItem((item) =>
			item
				.setTitle('Export current note(s)')
				.setIcon('file-output')
				.onClick(() => {
					this.exportFile(activeView.file!);
				})
		);
		
		menu.addItem((item) =>
			item
				.setTitle('Export with configuration…')
				.setIcon('settings')
				.onClick(() => {
					this.showExportModal(activeView);
				})
		);
		
		menu.showAtMouseEvent(event);
	}
	
	/**
	 * Export the current note with default settings
	 */
	private async exportCurrentNote(view: MarkdownView): Promise<void> {
		const file = view.file;
		if (!file) {
			new Notice('No active file to export');
			return;
		}
		
		await this.exportFile(file);
	}
	
	/**
	 * Show the export configuration modal
	 */
	private async showExportModal(view: MarkdownView): Promise<void> {
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
			await this.exportFileWithConfig(file, config);
		},
		() => {
			this.cancelExport();
		}
	);
	
	modal.open();
}

	/**
	 * Show the export configuration modal for multiple files
	 */
	private async showExportModalForFiles(files: TFile[]): Promise<void> {
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
				await this.exportFilesWithConfig(files, config);
			},
			() => {
				this.cancelExport();
			}
		);
		
		modal.open();
	}
	
	/**
	 * Export a file with default configuration
	 */
	private async exportFile(file: TFile): Promise<void> {
		const config: ExportConfig = {
			template: this.settings.exportDefaults.template,
			format: this.settings.exportDefaults.format,
			outputFolder: this.settings.outputFolder,
			templateVariables: {
				// Page setup
				pageSize: this.settings.exportDefaults.pageSize,
				orientation: this.settings.exportDefaults.orientation,
				flipped: this.settings.exportDefaults.orientation === 'landscape',
				marginTop: this.settings.exportDefaults.marginTop,
				marginBottom: this.settings.exportDefaults.marginBottom,
				marginLeft: this.settings.exportDefaults.marginLeft,
				marginRight: this.settings.exportDefaults.marginRight,
				// Typography
				bodyFont: this.settings.exportDefaults.bodyFont,
				headingFont: this.settings.exportDefaults.headingFont,
				monospaceFont: this.settings.exportDefaults.monospaceFont,
				bodyFontSize: this.settings.exportDefaults.bodyFontSize
			},
			openAfterExport: this.settings.behavior.openAfterExport,
			preserveFolderStructure: this.settings.behavior.preserveFolderStructure
		};
		
		await this.exportFileWithConfig(file, config);
	}

	/**
	 * Export multiple files with default configuration
	 */
	private async exportFiles(files: TFile[]): Promise<void> {
		await this.processBatchExport(
			files,
			`Exporting ${files.length} files to PDF...`,
			(file: TFile) => this.exportFile(file)
		);
	}
	
	/**
	 * Export a file with specific configuration
	 */
	private async exportFileWithConfig(file: TFile, config: ExportConfig): Promise<void> {
		// Get plugin directory and vault base path
		const vaultPath = (this.app.vault.adapter as any).basePath;
		
		try {
			// Create abort controller for cancellation
			this.currentExportController = new AbortController();
			
			// Show progress notice
			const progressNotice = ExportErrorHandler.showProgressNotice('Exporting to PDF...');
			
			// Read file content
			const content = await this.app.vault.read(file);
			const pluginDir = path.join(vaultPath, '.obsidian', 'plugins', 'obsidian-typst-pdf-export');
			
			// Create temp directory manager and ensure temp directory exists
			const tempManager = TempDirectoryManager.create(vaultPath);
			const tempDir = tempManager.ensureTempDir('images');
			
			// Preprocess the markdown content using MarkdownPreprocessor
			const { MarkdownPreprocessor } = await import('./src/converters/MarkdownPreprocessor');
			const preprocessor = new MarkdownPreprocessor({
				vaultPath: vaultPath,
				options: {
					includeMetadata: true,
					preserveFrontmatter: false,
					baseUrl: undefined
				},
				wikilinkConfig: {
					format: 'md',
					extension: '.md'
				},
				noteTitle: file.basename
			});
			
			const processedResult = await preprocessor.process(content);
			
			if (processedResult.errors.length > 0) {
				console.warn('Preprocessing errors:', processedResult.errors);
			}
			if (processedResult.warnings.length > 0) {
				console.warn('Preprocessing warnings:', processedResult.warnings);
			}
			
			// Process PDF embeds if any were found
			if (processedResult.metadata.pdfEmbeds && processedResult.metadata.pdfEmbeds.length > 0) {
				console.log(`Export: Processing ${processedResult.metadata.pdfEmbeds.length} PDF embeds`);
				await this.processPdfEmbeds(processedResult, vaultPath, tempDir, file);
			}
			
			// Process image embeds if any were found
			if (processedResult.metadata.imageEmbeds && processedResult.metadata.imageEmbeds.length > 0) {
				console.log(`Export: Processing ${processedResult.metadata.imageEmbeds.length} image embeds`);
				await this.processImageEmbeds(processedResult, vaultPath, tempDir, file);
			}
			
			// Prepare output path
			const outputPath = await this.prepareOutputPath(file, config.outputFolder || this.settings.outputFolder);
			
			// Get full template path
			const templatePath = config.template ? 
				this.templateManager.getTemplatePath(config.template) : 
				this.templateManager.getTemplatePath('default.typ');
			
			// Convert to PDF using the preprocessed content
			const templateVariables = {
				...(config.templateVariables || {}),
				// Add format from config if specified (takes priority over settings default)
				...(config.format && { export_format: config.format })
			};
			
			const result = await this.converter.convertMarkdownToPDF(
				processedResult.content,  // Use preprocessed content instead of raw content
				outputPath,
				{
					template: templatePath,
					variables: templateVariables,
					pluginDir: pluginDir,
					vaultBasePath: vaultPath
				},
				(message: string, progress?: number) => {
					progressNotice.setMessage(`${message}${progress ? ` (${Math.round(progress)}%)` : ''}`);
				}
			);
			
			// Hide progress notice
			progressNotice.hide();
			
			if (result.success) {
				new Notice(`PDF exported successfully to ${result.outputPath}`);
				
				// Open PDF if configured
				if (this.settings.behavior.openAfterExport) {
					this.openPDF(result.outputPath!);
				}
			} else {
				new Notice(`Export failed: ${result.error}`);
			}
		} catch (error) {
			ExportErrorHandler.handleSingleExportError(error);
		} finally {
			this.currentExportController = null;
			
			// Clean up temporary directories
			try {
				const cleanupManager = TempDirectoryManager.create(vaultPath);
				cleanupManager.cleanupAllTempDirs();
			} catch (cleanupError) {
				console.warn('Export: Failed to clean up temporary directories:', cleanupError);
			}
		}
	}

	/**
	 * Export multiple files with specific configuration
	 */
	private async exportFilesWithConfig(files: TFile[], config: ExportConfig): Promise<void> {
		await this.processBatchExport(
			files,
			`Exporting ${files.length} files with custom configuration...`,
			(file: TFile) => this.exportFileWithConfig(file, config)
		);
	}

	/**
	 * Common batch processing logic for exporting multiple files
	 */
	private async processBatchExport(
		files: TFile[], 
		progressMessage: string, 
		exportFunction: (file: TFile) => Promise<void>
	): Promise<void> {
		if (files.length === 0) {
			new Notice('No files to export');
			return;
		}

		ExportErrorHandler.showProgressNotice(progressMessage);

		const { recordSuccess, recordError, getResult } = ExportErrorHandler.createBatchTracker();

		for (const file of files) {
			try {
				await exportFunction(file);
				recordSuccess();
			} catch (error) {
				recordError(file.name, error);
			}
		}

		// Show final result
		ExportErrorHandler.handleBatchResult(getResult());
	}
	
	/**
	 * Cancel the current export
	 */
	private cancelExport(): void {
		if (this.currentExportController) {
			this.currentExportController.abort();
			this.currentExportController = null;
			ExportErrorHandler.showCancellationNotice();
		}
	}

	
	/**
	 * Export an entire folder to PDF
	 */
	private async handleFolderExport(folder: TFolder): Promise<void> {
		// Get all markdown files in the folder
		const markdownFiles = folder.children.filter(
			(file) => file instanceof TFile && file.extension === 'md'
		) as TFile[];
		
		if (markdownFiles.length === 0) {
			new Notice('No markdown files found in this folder');
			return;
		}
		
		ExportErrorHandler.showProgressNotice(`Exporting ${markdownFiles.length} files from ${folder.name}...`);
		
		const { recordSuccess, recordError, getResult } = ExportErrorHandler.createBatchTracker();
		
		for (const file of markdownFiles) {
			try {
				await this.exportFile(file);
				recordSuccess();
			} catch (error) {
				recordError(file.name, error);
			}
		}
		
		ExportErrorHandler.handleBatchResult(getResult());
	}
	
	/**
	 * Show dependency status modal
	 */
	async showDependencyStatus(): Promise<void> {
		const dependencyResult = await DependencyChecker.checkAllDependencies(
			this.settings.pandocPath,
			this.settings.typstPath,
			this.settings.executablePaths?.imagemagickPath
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

	private async checkDependenciesAsync(): Promise<void> {
		// Check dependencies silently on startup
		try {
			const missingDeps = DependencyChecker.checkDependenciesSync(
				this.settings.pandocPath,
				this.settings.typstPath,
				this.settings.executablePaths?.imagemagickPath
			);
			
			// Only show notice if dependencies are missing
			if (missingDeps.length > 0) {
				new Notice(
					`Obsidian Typst PDF Export: Missing dependencies: ${missingDeps.join(', ')}. ` +
					`Run "Check Dependencies" command for details.`,
					8000
				);
			}
		} catch (error) {
			ExportErrorHandler.handleDependencyError('Dependencies', error, false);
		}
	}

	/**
	 * Process PDF embeds - convert PDF pages to images for inclusion
	 */
	/**
	 * Resolve PDF path using multiple strategies
	 * @param sanitizedPath The sanitized path from the embed
	 * @param vaultBasePath Base path of the vault
	 * @param currentFile Current file being processed (optional)
	 * @returns Full path to PDF file if found, null otherwise
	 */
	private async resolvePdfPath(sanitizedPath: string, vaultBasePath: string, currentFile?: TFile): Promise<string | null> {
		const pathModule = require('path');
		const fs = require('fs');
		
		// Decode the URL-encoded sanitized path back to normal characters
		const decodedPath = decodeURIComponent(sanitizedPath);
		
		// Try multiple path resolution strategies
		const possiblePaths = [
			// Strategy 1: Relative to vault root (standard Obsidian behavior)
			pathModule.resolve(vaultBasePath, decodedPath),
			// Strategy 2: Relative to current file's directory (for local attachments)
			currentFile ? pathModule.resolve(vaultBasePath, pathModule.dirname(currentFile.path), decodedPath) : null
		].filter(p => p !== null);
		
		// Try each possible path until we find one that exists
		for (const possiblePath of possiblePaths) {
			console.log(`Export: Checking path: ${possiblePath}`);
			try {
				await fs.promises.access(possiblePath);
				console.log(`Export: Found PDF at: ${possiblePath}`);
				return possiblePath;
			} catch {
				// File doesn't exist, continue to next path
			}
		}
		
		return null;
	}

	/**
	 * Generate Typst PDF embed syntax with optional preview image
	 * @param relativePdfPath Relative path to PDF from vault base
	 * @param baseName Base name of the PDF file
	 * @param relativeImagePath Optional relative path to preview image
	 * @param errorSuffix Optional error suffix for description
	 * @returns Formatted content for PDF embed
	 */
	/**
	 * Copy converted PDF image to vault temp directory and get relative paths
	 * @param imagePath Path to the converted image
	 * @param pdfPath Path to the original PDF
	 * @param baseName Base name of the PDF
	 * @param vaultBasePath Base path of the vault
	 * @returns Object with relative paths for image and PDF
	 */
	private async copyImageToVaultTemp(
		imagePath: string,
		pdfPath: string,
		baseName: string,
		vaultBasePath: string
	): Promise<{ relativeImagePath: string; relativePdfPath: string }> {
		const pathModule = require('path');
		const fs = require('fs');
		
		// Copy image to vault temp directory for access
		const vaultTempImagesDir = pathModule.join(vaultBasePath, '.obsidian', 'plugins', 'obsidian-typst-pdf-export', 'temp-images');
		await fs.promises.mkdir(vaultTempImagesDir, { recursive: true });
		
		const imageFileName = `${baseName}_preview.png`;
		const vaultImagePath = pathModule.join(vaultTempImagesDir, imageFileName);
		await fs.promises.copyFile(imagePath, vaultImagePath);
		
		// Get relative paths from vault base
		const relativeImagePath = pathModule.relative(vaultBasePath, vaultImagePath);
		const relativePdfPath = pathModule.relative(vaultBasePath, pdfPath);
		
		return { relativeImagePath, relativePdfPath };
	}

	private generatePdfEmbedContent(
		relativePdfPath: string,
		baseName: string,
		relativeImagePath?: string,
		errorSuffix?: string
	): string {
		const description = `${baseName}${errorSuffix ? ` ${errorSuffix}` : ''}`;
		const attachmentNote = `*PDF attached: ${description} - check your PDF reader's attachment panel*`;
		
		const content = [
			relativeImagePath ? `![${baseName} - Page 1](${relativeImagePath})` : null,
			relativeImagePath ? '' : null,
			'```{=typst}',
			`#pdf.embed("${relativePdfPath}", description: "${description}", mime-type: "application/pdf")`,
			'```',
			'',
			attachmentNote
		].filter(line => line !== null).join('\n');
		
		return content;
	}

	private async processPdfEmbeds(processedResult: any, vaultBasePath: string, tempDir: string, currentFile?: TFile): Promise<void> {
		const { PdfToImageConverter } = await import('./src/converters/PdfToImageConverter');
		const converter = PdfToImageConverter.getInstance(this);
		const pathModule = require('path');
		const fs = require('fs');
		
		console.log(`Export: Processing ${processedResult.metadata.pdfEmbeds.length} PDF embeds`);
		
		let updatedContent = processedResult.content;
		
		for (const pdfEmbed of processedResult.metadata.pdfEmbeds) {
			try {
				console.log(`Export: Processing PDF embed: ${pdfEmbed.originalPath}`);
				
				// Resolve PDF path using helper method
				const fullPdfPath = await this.resolvePdfPath(pdfEmbed.sanitizedPath, vaultBasePath, currentFile);
				
				if (!fullPdfPath) {
					console.warn(`Export: PDF file not found: ${decodeURIComponent(pdfEmbed.sanitizedPath)}`);
					// Replace marker with fallback message
					const fallbackOutput = `*⚠️ PDF not found: ${pdfEmbed.baseName}*`;
					updatedContent = updatedContent.replace(pdfEmbed.marker, fallbackOutput);
					continue;
				}
				
				// Convert PDF first page to image - pass options object as third parameter
				const result = await converter.convertFirstPageToImage(
					fullPdfPath,
					tempDir,
					{
						scale: 1.5,
						maxWidth: 800,
						maxHeight: 600,
						format: 'png'
					}
				);
				
				if (result.success && result.imagePath) {
					// Copy image to vault temp directory and get relative paths
					const { relativeImagePath, relativePdfPath } = await this.copyImageToVaultTemp(
						result.imagePath,
						fullPdfPath,
						pdfEmbed.baseName,
						vaultBasePath
					);
					
					// Create combined output with image and Typst pdf.embed using helper
					const combinedOutput = this.generatePdfEmbedContent(
						relativePdfPath,
						pdfEmbed.baseName,
						relativeImagePath
					);
					
					// Replace the placeholder with the combined output
					updatedContent = updatedContent.replace(pdfEmbed.marker, combinedOutput);
					
					console.log(`Export: Successfully processed PDF embed with pdf.embed: ${pdfEmbed.baseName}`);
				} else {
					console.warn(`Export: Failed to convert PDF to image: ${result.error}`);
					const relativePdfPath = pathModule.relative(vaultBasePath, fullPdfPath);
					// Even without preview image, still embed the PDF
					const fallbackOutput = this.generatePdfEmbedContent(relativePdfPath, pdfEmbed.baseName);
					updatedContent = updatedContent.replace(pdfEmbed.marker, fallbackOutput);
				}
			} catch (error) {
				ExportErrorHandler.handleProcessingError('PDF embed', pdfEmbed.originalPath, error);
				// Still try to embed the PDF even if there's a processing error
				const relativePdfPath = pathModule.relative(vaultBasePath, pdfEmbed.originalPath);
				const fallbackOutput = this.generatePdfEmbedContent(
					relativePdfPath, 
					pdfEmbed.baseName, 
					undefined, 
					'(error occurred)'
				);
				updatedContent = updatedContent.replace(pdfEmbed.marker, fallbackOutput);
			}
		}
		
		// Update the processed result with the new content
		processedResult.content = updatedContent;
	}
	
	/**
	 * Process image embeds - ensure images are accessible for Typst
	 */
	private async processImageEmbeds(processedResult: any, vaultBasePath: string, tempDir: string, currentFile?: TFile): Promise<void> {
		const pathModule = require('path');
		const fs = require('fs');
		
		console.log(`Export: Processing ${processedResult.metadata.imageEmbeds.length} image embeds`);
		
		let updatedContent = processedResult.content;
		
		for (const imageEmbed of processedResult.metadata.imageEmbeds) {
			try {
				console.log(`Export: Processing image embed: ${imageEmbed.originalPath}`);
				
				// Decode the URL-encoded sanitized path back to normal characters
				const decodedPath = decodeURIComponent(imageEmbed.sanitizedPath);
				
				// Try multiple path resolution strategies
				const possiblePaths = [
					// Strategy 1: Relative to vault root (standard Obsidian behavior)
					pathModule.resolve(vaultBasePath, decodedPath),
					// Strategy 2: Relative to current file's directory (for local attachments)
					currentFile ? pathModule.resolve(vaultBasePath, pathModule.dirname(currentFile.path), decodedPath) : null,
					// Strategy 3: Check in attachments folder (common pattern)
					pathModule.resolve(vaultBasePath, 'attachments', pathModule.basename(decodedPath))
				].filter(p => p !== null);
				
				let fullImagePath = null;
				
				// Try each possible path until we find one that exists
				for (const possiblePath of possiblePaths) {
					try {
						await fs.promises.access(possiblePath);
						fullImagePath = possiblePath;
						console.log(`Export: Found image at: ${fullImagePath}`);
						break;
					} catch {
						// File doesn't exist, continue to next path
					}
				}
				
				if (!fullImagePath) {
					console.warn(`Export: Image file not found: ${decodedPath}`);
					// Keep the original marker or replace with placeholder
					const fallbackOutput = `[⚠️ **Image not found:** ${imageEmbed.alt || imageEmbed.originalPath}]`;
					updatedContent = updatedContent.replace(imageEmbed.marker, fallbackOutput);
					continue;
				}
				
				// Get relative path from vault base for the image
				const relativeImagePath = pathModule.relative(vaultBasePath, fullImagePath);
				
				// Replace the marker with Markdown image syntax (Pandoc will convert to Typst)
				const markdownImage = imageEmbed.alt ? 
					`![${imageEmbed.alt}](${relativeImagePath})` :
					`![](${relativeImagePath})`;
				
				updatedContent = updatedContent.replace(imageEmbed.marker, markdownImage);
				
				console.log(`Export: Successfully processed image embed: ${imageEmbed.originalPath}`);
			} catch (error) {
				const { fallback } = ExportErrorHandler.handleProcessingError(
					'image embed',
					imageEmbed.originalPath,
					error,
					`[⚠️ **Image processing error:** ${imageEmbed.alt || imageEmbed.originalPath}]`
				);
				updatedContent = updatedContent.replace(imageEmbed.marker, fallback);
			}
		}
		
		// Update the processed result with the new content  
		processedResult.content = updatedContent;
	}
	
	/**
	 * Prepare the output path for a file
	 */
	private async prepareOutputPath(file: TFile, outputFolder: string): Promise<string> {
		// Validate output folder for security
		if (!SecurityUtils.validateOutputPath(outputFolder)) {
			throw new Error(`Invalid output folder path: ${outputFolder}. Path contains invalid characters or traversal attempts.`);
		}
		
		const vaultPath = (this.app.vault.adapter as any).basePath;
		const outputDir = path.join(vaultPath, outputFolder);
		
		// Create output directory if it doesn't exist
		try {
			await fs.promises.access(outputDir);
		} catch {
			// Directory doesn't exist, create it
			try {
				await fs.promises.mkdir(outputDir, { recursive: true });
			} catch (error) {
				throw new Error(`Failed to create output directory ${outputDir}: ${error.message}`);
			}
		}
		
		// Preserve folder structure if configured
		let relativePath = '';
		if (this.settings.behavior.preserveFolderStructure) {
			const folderPath = path.dirname(file.path);
			if (folderPath !== '.') {
				relativePath = folderPath;
				const fullOutputDir = path.join(outputDir, relativePath);
				try {
					await fs.promises.access(fullOutputDir);
				} catch {
					// Directory doesn't exist, create it
					try {
						await fs.promises.mkdir(fullOutputDir, { recursive: true });
					} catch (error) {
						throw new Error(`Failed to create nested output directory ${fullOutputDir}: ${error.message}`);
					}
				}
			}
		}
		
		// Generate output filename (just use the note name without timestamp)
		const baseName = file.basename;
		const outputFileName = `${baseName}.pdf`;
		
		return path.join(outputDir, relativePath, outputFileName);
	}
	
	/**
	 * Open a PDF file in the default viewer
	 */
	private openPDF(pdfPath: string): void {
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
	
	/**
	 * Clean up leftover temp directories from previous sessions
	 */
	private cleanupStartupTempDirectories(): void {
		try {
			const vaultPath = (this.app.vault.adapter as any).basePath;
			const cleanupManager = TempDirectoryManager.create(vaultPath);
			const result = cleanupManager.cleanupAllTempDirs();
			
			if (this.settings.behavior.debugMode) {
				console.log('Export: Startup cleanup completed', result);
			}
		} catch (error) {
			console.warn('Export: Startup temp directory cleanup failed (non-critical):', error);
			// Don't throw - this shouldn't prevent plugin from loading
		}
	}
	
	onunload() {
		// Cancel any ongoing exports
		if (this.currentExportController) {
			this.currentExportController.abort();
		}
		
		// Clean up temp directories on plugin unload
		try {
			const vaultPath = (this.app.vault.adapter as any).basePath;
			const cleanupManager = TempDirectoryManager.create(vaultPath);
			cleanupManager.cleanupAllTempDirs();
		} catch (error) {
			console.warn('Export: Failed to clean up temp directories during unload:', error);
		}
		
		console.log('Obsidian Typst PDF Export plugin unloaded');
	}
}

/**
 * Settings Tab
 */
class ObsidianTypstPDFExportSettingTab extends PluginSettingTab {
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
			.setName('ImageMagick convert path')
			.setDesc('Path to ImageMagick convert executable (leave empty to use system PATH)')
			.addText(text => text
				.setPlaceholder('convert')
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
						if (!SecurityUtils.validateOutputPath(value)) {
							new Notice(`Invalid output folder: ${SecurityUtils.getPathValidationError(value)}`);
							return;
						}
						this.plugin.settings.outputFolder = value;
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
		return await this.plugin.getCachedFonts();
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

// Default export for Obsidian
export default obsidianTypstPDFExport;