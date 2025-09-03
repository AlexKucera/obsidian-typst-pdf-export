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
	Notice,
	Menu,
	MarkdownView,
	Editor,
	AbstractInputSuggest
} from 'obsidian';

import { obsidianTypstPDFExportSettings, DEFAULT_SETTINGS, ExportFormat } from './src/core/settings';
import { PandocTypstConverter } from './src/converters/PandocTypstConverter';
import { ExportConfigModal } from './src/modal/ExportConfigModal';
import { ExportConfig, ExportConfigModalSettings } from './src/modal/types';
import { TemplateManager } from './src/templates/TemplateManager';
import { FolderSuggest } from './src/components/FolderSuggest';
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
			const { exec } = require('child_process');
			const { promisify } = require('util');
			const execAsync = promisify(exec);
			
			const typstPath = this.settings.typstPath || 'typst';
			const { stdout } = await execAsync(`${typstPath} fonts`);
			
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
			// Create fallback cache file
			const fallbackFonts = [
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
	
	private registerCommands(): void {
		// Export current note command
		this.addCommand({
			id: 'export-current-note',
			name: 'Export current note to PDF',
			hotkeys: [{ modifiers: ['Mod', 'Shift'], key: 'e' }],
			editorCallback: (editor: Editor, view: MarkdownView) => {
				this.exportCurrentNote(view);
			}
		});
		
		// Export with configuration command
		this.addCommand({
			id: 'export-with-config',
			name: 'Export to PDF with configuration',
			hotkeys: [{ modifiers: ['Mod', 'Shift', 'Alt'], key: 'e' }],
			editorCallback: (editor: Editor, view: MarkdownView) => {
				this.showExportModal(view);
			}
		});
		
		// Export folder to PDF command
		this.addCommand({
			id: 'export-folder-to-pdf',
			name: 'Export folder to PDF',
			checkCallback: (checking: boolean) => {
				const activeFile = this.app.workspace.getActiveFile();
				const canRun = activeFile && activeFile.parent;
				
				if (canRun && !checking && activeFile.parent) {
					this.handleFolderExport(activeFile.parent);
				}
				
				return !!canRun;
			}
		});
		
		// Batch export command
		this.addCommand({
			id: 'batch-export',
			name: 'Batch export notes to PDF',
			callback: () => {
				this.batchExportNotes();
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
				.setTitle('Export current note')
				.setIcon('file-output')
				.onClick(() => {
					this.exportFile(activeView.file!);
				})
		);
		
		menu.addItem((item) =>
			item
				.setTitle('Export with configuration...')
				.setIcon('settings')
				.onClick(() => {
					this.showExportModal(activeView);
				})
		);
		
		menu.addSeparator();
		
		menu.addItem((item) =>
			item
				.setTitle('Batch export...')
				.setIcon('folder-output')
				.onClick(() => {
					this.batchExportNotes();
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
	
	// Prepare modal settings with hierarchy: plugin defaults as base
	const modalSettings: Partial<ExportConfigModalSettings> = {
		notePath: file.path,
		noteTitle: file.basename,
		// Plugin defaults from settings tab
		template: this.settings.exportDefaults.template,
		format: this.settings.exportDefaults.format,
		outputFolder: this.settings.outputFolder,
		openAfterExport: this.settings.behavior.openAfterExport,
		preserveFolderStructure: this.settings.behavior.preserveFolderStructure,
		availableTemplates: availableTemplates,
		// Template variables from plugin defaults
		templateVariables: {
			pageSize: this.settings.exportDefaults.pageSize,
			orientation: this.settings.exportDefaults.orientation,
			flipped: this.settings.exportDefaults.orientation === 'landscape',
			marginTop: this.settings.exportDefaults.marginTop,
			marginBottom: this.settings.exportDefaults.marginBottom,
			marginLeft: this.settings.exportDefaults.marginLeft,
			marginRight: this.settings.exportDefaults.marginRight,
			bodyFont: this.settings.exportDefaults.bodyFont,
			headingFont: this.settings.exportDefaults.headingFont,
			monospaceFont: this.settings.exportDefaults.monospaceFont,
			bodyFontSize: this.settings.exportDefaults.bodyFontSize,
			// Auto-adjust width for single-page landscape mode
			...(this.settings.exportDefaults.orientation === 'landscape' && this.settings.exportDefaults.format === 'single-page' 
				? { width: 'auto' } 
				: {})
		}
	};
	
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
	 * Export a file with specific configuration
	 */
	private async exportFileWithConfig(file: TFile, config: ExportConfig): Promise<void> {
		// Get plugin directory and vault base path
		const vaultPath = (this.app.vault.adapter as any).basePath;
		
		try {
			// Create abort controller for cancellation
			this.currentExportController = new AbortController();
			
			// Show progress notice
			const progressNotice = new Notice('Exporting to PDF...', 0);
			
			// Read file content
			const content = await this.app.vault.read(file);
			const pluginDir = path.join(vaultPath, '.obsidian', 'plugins', 'obsidian-typst-pdf-export');
			
			// Create temp directory for processing - use plugin's temp directory
			const tempDir = path.join(pluginDir, 'temp-images');
			
			// Ensure temp directory exists
			const fs = require('fs');
			if (!fs.existsSync(tempDir)) {
				fs.mkdirSync(tempDir, { recursive: true });
			}
			
			// Preprocess the markdown content using MarkdownPreprocessor
			const { MarkdownPreprocessor } = await import('./src/MarkdownPreprocessor');
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
			const outputPath = this.prepareOutputPath(file, config.outputFolder || this.settings.outputFolder);
			
			// Get full template path
			const templatePath = config.template ? 
				this.templateManager.getTemplatePath(config.template) : 
				this.templateManager.getTemplatePath('default.typ');
			
			// Convert to PDF using the preprocessed content
			const result = await this.converter.convertMarkdownToPDF(
				processedResult.content,  // Use preprocessed content instead of raw content
				outputPath,
				{
					template: templatePath,
					variables: config.templateVariables || {},
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
			console.error('Export error:', error);
			new Notice(`Export failed: ${error.message}`);
		} finally {
			this.currentExportController = null;
			
			// Clean up temporary directories
			try {
				const pathModule = require('path');
				const fs = require('fs');
				
				// Clean up temp-images directory
				const vaultTempImagesDir = pathModule.join(vaultPath, '.obsidian', 'plugins', 'obsidian-typst-pdf-export', 'temp-images');
				if (fs.existsSync(vaultTempImagesDir)) {
					const files = fs.readdirSync(vaultTempImagesDir);
					for (const file of files) {
						fs.unlinkSync(pathModule.join(vaultTempImagesDir, file));
					}
					console.log('Export: Cleaned up temp-images directory');
				}
				
				// Clean up temp-pandoc directory
				const vaultTempPandocDir = pathModule.join(vaultPath, '.obsidian', 'plugins', 'obsidian-typst-pdf-export', 'temp-pandoc');
				if (fs.existsSync(vaultTempPandocDir)) {
					const files = fs.readdirSync(vaultTempPandocDir);
					for (const file of files) {
						fs.unlinkSync(pathModule.join(vaultTempPandocDir, file));
					}
					console.log('Export: Cleaned up temp-pandoc directory');
				}
			} catch (cleanupError) {
				console.warn('Export: Failed to clean up temporary directories:', cleanupError);
			}
		}
	}
	
	/**
	 * Cancel the current export
	 */
	private cancelExport(): void {
		if (this.currentExportController) {
			this.currentExportController.abort();
			this.currentExportController = null;
			new Notice('Export cancelled');
		}
	}
	
	/**
	 * Batch export multiple notes
	 */
	private async batchExportNotes(): Promise<void> {
		// This would show a modal to select multiple files
		// Implementation deferred for now
		new Notice('Batch export feature coming soon');
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
		
		new Notice(`Exporting ${markdownFiles.length} files from ${folder.name}...`);
		
		let successful = 0;
		let failed = 0;
		
		for (const file of markdownFiles) {
			try {
				await this.exportFile(file);
				successful++;
			} catch (error) {
				console.error(`Failed to export ${file.name}:`, error);
				failed++;
			}
		}
		
		new Notice(
			`Export complete: ${successful} successful, ${failed} failed`
		);
	}
	
	/**
	 * Show dependency status modal
	 */
	async showDependencyStatus(): Promise<void> {
		const { exec } = require('child_process');
		const { promisify } = require('util');
		const execAsync = promisify(exec);
		
		let pandocVersion = 'Not found';
		let typstVersion = 'Not found';
		let imagemagickVersion = 'Not found';
		
		// Check Pandoc
		try {
			const pandocPath = this.settings.pandocPath || 'pandoc';
			const { stdout } = await execAsync(`${pandocPath} --version`);
			const match = stdout.match(/pandoc\s+([\d.]+)/);
			if (match) {
				pandocVersion = match[1];
			}
		} catch (error) {
			console.error('Pandoc check failed:', error);
		}
		
		// Check Typst
		try {
			const typstPath = this.settings.typstPath || 'typst';
			const { stdout } = await execAsync(`${typstPath} --version`);
			const match = stdout.match(/typst\s+([\d.]+)/);
			if (match) {
				typstVersion = match[1];
			}
		} catch (error) {
			console.error('Typst check failed:', error);
		}
		
		// Check ImageMagick/convert
		try {
			const convertPath = this.settings.executablePaths.imagemagickPath || 'convert';
			const { stdout } = await execAsync(`${convertPath} --version`);
			const match = stdout.match(/ImageMagick\s+([\d.-]+)/);
			if (match) {
				imagemagickVersion = match[1];
			}
		} catch (error) {
			console.error('ImageMagick check failed:', error);
		}
		
		// Show results in a notice
		const missingDeps = [];
		if (pandocVersion === 'Not found') missingDeps.push('Pandoc');
		if (typstVersion === 'Not found') missingDeps.push('Typst');
		if (imagemagickVersion === 'Not found') missingDeps.push('ImageMagick');
		
		const message = `Dependency Status:
Pandoc: ${pandocVersion}
Typst: ${typstVersion}
ImageMagick: ${imagemagickVersion}

${missingDeps.length > 0 ? 
	`Missing dependencies: ${missingDeps.join(', ')}. Please install them and check the paths in settings.` : 
	'All dependencies found!'}`;
		
		new Notice(message, 12000); // Show for 12 seconds (longer due to more content)
	}

	private async checkDependenciesAsync(): Promise<void> {
		// Check dependencies silently on startup
		try {
			const { execSync } = require('child_process');
			const path = require('path');
			
			// Augment PATH
			const homeDir = process.env.HOME || process.env.USERPROFILE;
			const localBin = path.join(homeDir, '.local', 'bin');
			const cargoHome = process.env.CARGO_HOME || path.join(homeDir, '.cargo');
			const cargoBin = path.join(cargoHome, 'bin');
			
			const augmentedPath = `${process.env.PATH}:${localBin}:${cargoBin}:/usr/local/bin:/opt/homebrew/bin`;
			const env = { ...process.env, PATH: augmentedPath };
			
			let missingDeps = [];
			
			// Check Pandoc
			try {
				execSync('pandoc --version', { encoding: 'utf8', env });
			} catch {
				missingDeps.push('Pandoc');
			}
			
			// Check Typst
			try {
				execSync('typst --version', { encoding: 'utf8', env });
			} catch {
				missingDeps.push('Typst');
			}
			
			// Check ImageMagick
			try {
				execSync('convert --version', { encoding: 'utf8', env });
			} catch {
				missingDeps.push('ImageMagick');
			}
			
			// Only show notice if dependencies are missing
			if (missingDeps.length > 0) {
				new Notice(
					`Obsidian Typst PDF Export: Missing dependencies: ${missingDeps.join(', ')}. ` +
					`Run "Check Dependencies" command for details.`,
					8000
				);
			}
		} catch (error) {
			console.error('Error checking dependencies:', error);
		}
	}

	/**
	 * Process PDF embeds - convert PDF pages to images for inclusion
	 */
	private async processPdfEmbeds(processedResult: any, vaultBasePath: string, tempDir: string, currentFile?: TFile): Promise<void> {
		const { PdfToImageConverter } = await import('./src/PdfToImageConverter');
		const converter = PdfToImageConverter.getInstance(this);
		const pathModule = require('path');
		const fs = require('fs');
		
		console.log(`Export: Processing ${processedResult.metadata.pdfEmbeds.length} PDF embeds`);
		
		let updatedContent = processedResult.content;
		
		for (const pdfEmbed of processedResult.metadata.pdfEmbeds) {
			try {
				console.log(`Export: Processing PDF embed: ${pdfEmbed.originalPath}`);
				
				// Decode the URL-encoded sanitized path back to normal characters
				const decodedPath = decodeURIComponent(pdfEmbed.sanitizedPath);
				
				// Try multiple path resolution strategies
				const possiblePaths = [
					// Strategy 1: Relative to vault root (standard Obsidian behavior)
					pathModule.resolve(vaultBasePath, decodedPath),
					// Strategy 2: Relative to current file's directory (for local attachments)
					currentFile ? pathModule.resolve(vaultBasePath, pathModule.dirname(currentFile.path), decodedPath) : null
				].filter(p => p !== null);
				
				let fullPdfPath = null;
				
				// Try each possible path until we find one that exists
				for (const possiblePath of possiblePaths) {
					console.log(`Export: Checking path: ${possiblePath}`);
					if (fs.existsSync(possiblePath)) {
						fullPdfPath = possiblePath;
						console.log(`Export: Found PDF at: ${fullPdfPath}`);
						break;
					}
				}
				
				if (!fullPdfPath) {
					console.warn(`Export: PDF file not found: ${decodedPath}`);
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
					// Copy image to vault temp directory for access
					const vaultTempImagesDir = pathModule.join(vaultBasePath, '.obsidian', 'plugins', 'obsidian-typst-pdf-export', 'temp-images');
					await fs.promises.mkdir(vaultTempImagesDir, { recursive: true });
					
					const imageFileName = `${pdfEmbed.baseName}_preview.png`;
					const vaultImagePath = pathModule.join(vaultTempImagesDir, imageFileName);
					await fs.promises.copyFile(result.imagePath, vaultImagePath);
					
					// Get relative path for the generated image from vault base
					const relativeImagePath = pathModule.relative(vaultBasePath, vaultImagePath);
					
					// Use relative path to the original PDF from vault base for pdf.embed
					const relativePdfPath = pathModule.relative(vaultBasePath, fullPdfPath);
					
					// Create combined output with image and Typst pdf.embed
					// Use raw Typst blocks for the pdf.embed call
					const combinedOutput = [
						`![${pdfEmbed.baseName} - Page 1](${relativeImagePath})`,
						'',
						'```{=typst}',
						`#pdf.embed("${relativePdfPath}", description: "${pdfEmbed.baseName}", mime-type: "application/pdf")`,
						'```',
						'',
						`*PDF attached: ${pdfEmbed.baseName} - check your PDF reader's attachment panel*`
					].join('\n');
					
					// Replace the placeholder with the combined output
					updatedContent = updatedContent.replace(pdfEmbed.marker, combinedOutput);
					
					console.log(`Export: Successfully processed PDF embed with pdf.embed: ${pdfEmbed.baseName}`);
				} else {
					console.warn(`Export: Failed to convert PDF to image: ${result.error}`);
					const relativePdfPath = pathModule.relative(vaultBasePath, fullPdfPath);
					// Even without preview image, still embed the PDF
					const fallbackOutput = [
						'```{=typst}',
						`#pdf.embed("${relativePdfPath}", description: "${pdfEmbed.baseName}", mime-type: "application/pdf")`,
						'```',
						'',
						`*PDF attached: ${pdfEmbed.baseName} - check your PDF reader's attachment panel*`
					].join('\n');
					updatedContent = updatedContent.replace(pdfEmbed.marker, fallbackOutput);
				}
			} catch (error) {
				console.error(`Export: Error processing PDF embed ${pdfEmbed.originalPath}:`, error);
				// Still try to embed the PDF even if there's a processing error
				const relativePdfPath = pathModule.relative(vaultBasePath, pdfEmbed.originalPath);
				const fallbackOutput = [
					'```{=typst}',
					`#pdf.embed("${relativePdfPath}", description: "${pdfEmbed.baseName} (error occurred)", mime-type: "application/pdf")`,
					'```',
					'',
					`*PDF attached: ${pdfEmbed.baseName} (processing error) - check your PDF reader's attachment panel*`
				].join('\n');
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
					if (fs.existsSync(possiblePath)) {
						fullImagePath = possiblePath;
						console.log(`Export: Found image at: ${fullImagePath}`);
						break;
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
				console.error(`Export: Error processing image embed ${imageEmbed.originalPath}:`, error);
				const fallbackOutput = `[⚠️ **Image processing error:** ${imageEmbed.alt || imageEmbed.originalPath}]`;
				updatedContent = updatedContent.replace(imageEmbed.marker, fallbackOutput);
			}
		}
		
		// Update the processed result with the new content  
		processedResult.content = updatedContent;
	}
	
	/**
	 * Prepare the output path for a file
	 */
	private prepareOutputPath(file: TFile, outputFolder: string): string {
		const vaultPath = (this.app.vault.adapter as any).basePath;
		const outputDir = path.join(vaultPath, outputFolder);
		
		// Create output directory if it doesn't exist
		if (!fs.existsSync(outputDir)) {
			fs.mkdirSync(outputDir, { recursive: true });
		}
		
		// Preserve folder structure if configured
		let relativePath = '';
		if (this.settings.behavior.preserveFolderStructure) {
			const folderPath = path.dirname(file.path);
			if (folderPath !== '.') {
				relativePath = folderPath;
				const fullOutputDir = path.join(outputDir, relativePath);
				if (!fs.existsSync(fullOutputDir)) {
					fs.mkdirSync(fullOutputDir, { recursive: true });
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
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}
	
	async saveSettings() {
		await this.saveData(this.settings);
	}
	
	onunload() {
		// Cancel any ongoing exports
		if (this.currentExportController) {
			this.currentExportController.abort();
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
					this.plugin.settings.executablePaths.additionalPaths = value
						.split(',')
						.map(p => p.trim())
						.filter(p => p.length > 0);
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
						this.plugin.settings.outputFolder = value;
						await this.plugin.saveSettings();
					});

				new FolderSuggest(this.app, text.inputEl);
			});
	}
	
	private createTypographyDefaultsSection(containerEl: HTMLElement): void {
		containerEl.createEl('h3', { text: 'Typography Defaults' });
		
		new Setting(containerEl)
			.setName('Body font')
			.setDesc('Default font for body text')
			.addDropdown(async (dropdown) => {
				try {
					const fonts = await this.getAvailableFonts();
					fonts.forEach(font => {
						dropdown.addOption(font, font);
					});
					
					dropdown
						.setValue(this.plugin.settings.typography.fonts.body)
						.onChange(async (value) => {
							this.plugin.settings.typography.fonts.body = value;
							await this.plugin.saveSettings();
						});
				} catch (error) {
					console.error('Failed to load fonts:', error);
					dropdown.addOption(this.plugin.settings.typography.fonts.body, this.plugin.settings.typography.fonts.body);
				}
			});
		
		new Setting(containerEl)
			.setName('Heading font')
			.setDesc('Default font for headings')
			.addDropdown(async (dropdown) => {
				try {
					const fonts = await this.getAvailableFonts();
					fonts.forEach(font => {
						dropdown.addOption(font, font);
					});
					
					dropdown
						.setValue(this.plugin.settings.typography.fonts.heading)
						.onChange(async (value) => {
							this.plugin.settings.typography.fonts.heading = value;
							await this.plugin.saveSettings();
						});
				} catch (error) {
					console.error('Failed to load fonts:', error);
					dropdown.addOption(this.plugin.settings.typography.fonts.heading, this.plugin.settings.typography.fonts.heading);
				}
			});
		
		new Setting(containerEl)
			.setName('Monospace font')
			.setDesc('Default font for code and monospace text')
			.addDropdown(async (dropdown) => {
				try {
					const fonts = await this.getAvailableFonts();
					fonts.forEach(font => {
						dropdown.addOption(font, font);
					});
					
					dropdown
						.setValue(this.plugin.settings.typography.fonts.monospace)
						.onChange(async (value) => {
							this.plugin.settings.typography.fonts.monospace = value;
							await this.plugin.saveSettings();
						});
				} catch (error) {
					console.error('Failed to load fonts:', error);
					dropdown.addOption(this.plugin.settings.typography.fonts.monospace, this.plugin.settings.typography.fonts.monospace);
				}
			});
		
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
	
	private createPageSetupSection(containerEl: HTMLElement): void {
		containerEl.createEl('h3', { text: 'Page Setup' });
		
		new Setting(containerEl)
			.setName('Page size')
			.setDesc('Paper size for PDF output')
			.addDropdown(dropdown => dropdown
				.addOption('a4', 'A4')
				.addOption('a5', 'A5')
				.addOption('letter', 'US Letter')
				.addOption('legal', 'US Legal')
				.addOption('a3', 'A3')
				.setValue(this.plugin.settings.pageSetup.size)
				.onChange(async (value) => {
					this.plugin.settings.pageSetup.size = value;
					await this.plugin.saveSettings();
				}));
		
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
		
		new Setting(containerEl)
			.setName('Top margin')
			.setDesc('Top page margin in centimeters')
			.addText(text => text
				.setPlaceholder('2.5')
				.setValue(this.formatSingleMarginForDisplay(this.plugin.settings.pageSetup.margins.top))
				.onChange(async (value) => {
					this.plugin.settings.pageSetup.margins.top = this.parseMarginValue(value, 2.5);
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Bottom margin')
			.setDesc('Bottom page margin in centimeters')
			.addText(text => text
				.setPlaceholder('2.0')
				.setValue(this.formatSingleMarginForDisplay(this.plugin.settings.pageSetup.margins.bottom))
				.onChange(async (value) => {
					this.plugin.settings.pageSetup.margins.bottom = this.parseMarginValue(value, 2.0);
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Left margin')
			.setDesc('Left page margin in centimeters')
			.addText(text => text
				.setPlaceholder('2.5')
				.setValue(this.formatSingleMarginForDisplay(this.plugin.settings.pageSetup.margins.left))
				.onChange(async (value) => {
					this.plugin.settings.pageSetup.margins.left = this.parseMarginValue(value, 2.5);
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Right margin')
			.setDesc('Right page margin in centimeters')
			.addText(text => text
				.setPlaceholder('1.5')
				.setValue(this.formatSingleMarginForDisplay(this.plugin.settings.pageSetup.margins.right))
				.onChange(async (value) => {
					this.plugin.settings.pageSetup.margins.right = this.parseMarginValue(value, 1.5);
					await this.plugin.saveSettings();
				}));
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