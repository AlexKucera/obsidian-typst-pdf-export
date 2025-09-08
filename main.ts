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

	// Type predicate to filter for markdown TFiles
	isMarkdownFile(file: TAbstractFile): file is TFile {
		return file instanceof TFile && file.extension === 'md';
	}
	
	async onload() {
		// Initialize lifecycle manager
		this.lifecycle = new PluginLifecycle(this);
		
		// Initialize font manager first (needed by PluginLifecycle)
		this.fontManager = new FontManager(this);
		
		// Initialize core plugin functionality
		await this.lifecycle.initialize();
		
		// Initialize command registry
		this.commandRegistry = new CommandRegistry(this);
		
		// Initialize event handlers
		this.eventHandlers = new EventHandlers(this);
		
		// Initialize export orchestrator
		this.exportOrchestrator = new ExportOrchestrator(this);
		
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
	 * Resolve an executable path, handling empty settings by falling back to system search
	 */
	resolveExecutablePath(userPath: string | undefined, defaultName: string): string {
		// If user provided a path and it's not empty, use it
		if (userPath && userPath.trim() !== '') {
			return userPath;
		}
		
		// Try to find the executable using which command
		const { spawnSync } = require('child_process');
		try {
			const augmentedEnv = {
				...process.env,
				PATH: `/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:${process.env.PATH || ''}`
			};
			
			const result = spawnSync('which', [defaultName], {
				encoding: 'utf8',
				env: augmentedEnv
			});
			
			if (result.status === 0 && result.stdout) {
				const foundPath = result.stdout.trim();
				if (foundPath) {
					return foundPath;
				}
			}
		} catch {
			// Ignore errors from which command
		}
		
		// Fall back to the default name (will be found via PATH if available)
		return defaultName;
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
			try {
				await fs.promises.access(possiblePath);
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
	const vaultTempImagesDir = pathModule.join(vaultBasePath, this.manifest.dir!, 'temp-images');
	await fs.promises.mkdir(vaultTempImagesDir, { recursive: true });
	
	// Sanitize the basename for use in filename - replace problematic characters
	const sanitizedBaseName = baseName
		.replace(/[^a-zA-Z0-9\-_]/g, '_')  // Replace non-alphanumeric chars with underscore
		.replace(/_{2,}/g, '_')            // Collapse multiple underscores
		.replace(/^_+|_+$/g, '');          // Remove leading/trailing underscores
	
	const imageFileName = `${sanitizedBaseName}_preview.png`;
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
		errorSuffix?: string,
		embedPdfFiles: boolean = true
	): string {
		const description = `${baseName}${errorSuffix ? ` ${errorSuffix}` : ''}`;
		
		const content = [];
		
		// Always include image preview if available
		if (relativeImagePath) {
			content.push(`![${baseName} - Page 1](${relativeImagePath})`);
			content.push('');
		}
		
		// Only include PDF embedding and attachment note if embedPdfFiles is true
		if (embedPdfFiles) {
			content.push('```{=typst}');
			content.push(`#pdf.embed("${relativePdfPath}", description: "${description}", mime-type: "application/pdf")`);
			content.push('```');
			content.push('');
			content.push(`*PDF attached: ${description} - check your PDF reader's attachment panel*`);
		}
		
		return content.filter(line => line !== null).join('\n');
	}

	/**
	 * Generate file embed content with proper Typst pdf.embed syntax
	 */
	private generateFileEmbedContent(
		relativeFilePath: string,
		baseName: string,
		fileExtension: string,
		errorSuffix?: string
	): string {
		const description = `${baseName}${errorSuffix ? ` ${errorSuffix}` : ''}`;
		const mimeType = this.getMimeTypeFromExtension(fileExtension);
		const fileIcon = this.getFileTypeIcon(fileExtension);
		
		const content = [];
		
		// Add file embed using Typst's pdf.embed
		content.push('```{=typst}');
		content.push(`#pdf.embed("${relativeFilePath}", description: "${description}", mime-type: "${mimeType}")`);
		content.push('```');
		content.push('');
		content.push(`*File attached: ${fileIcon} ${description} - check your PDF reader's attachment panel*`);
		
		return content.filter(line => line !== null).join('\n');
	}

	/**
	 * Get MIME type from file extension
	 */
	private getMimeTypeFromExtension(extension: string): string {
		const mimeTypes: Record<string, string> = {
			// Office documents
			'.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
			'.xls': 'application/vnd.ms-excel',
			'.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
			'.ppt': 'application/vnd.ms-powerpoint',
			'.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
			'.doc': 'application/msword',
			// Open Document Format
			'.odt': 'application/vnd.oasis.opendocument.text',
			'.ods': 'application/vnd.oasis.opendocument.spreadsheet',
			'.odp': 'application/vnd.oasis.opendocument.presentation',
			// Archives
			'.zip': 'application/zip',
			'.rar': 'application/vnd.rar',
			'.7z': 'application/x-7z-compressed',
			'.tar': 'application/x-tar',
			'.gz': 'application/gzip',
			'.bz2': 'application/x-bzip2',
			// Text/data formats
			'.json': 'application/json',
			'.xml': 'application/xml',
			'.csv': 'text/csv',
			'.yaml': 'text/yaml',
			'.yml': 'text/yaml',
			'.toml': 'text/plain',
			'.txt': 'text/plain',
			'.md': 'text/markdown',
			'.rtf': 'application/rtf',
			// Code files
			'.js': 'text/javascript',
			'.ts': 'text/typescript',
			'.py': 'text/x-python',
			'.java': 'text/x-java-source',
			'.cpp': 'text/x-c++src',
			'.c': 'text/x-csrc',
			'.h': 'text/x-chdr',
			'.css': 'text/css',
			'.html': 'text/html',
			'.php': 'text/x-php',
			// Database files
			'.db': 'application/x-sqlite3',
			'.sqlite': 'application/x-sqlite3',
			'.sql': 'application/sql',
			// E-books
			'.epub': 'application/epub+zip',
			'.mobi': 'application/x-mobipocket-ebook',
			// Other formats
			'.ics': 'text/calendar',
			'.vcf': 'text/vcard',
			'.log': 'text/plain'
		};
		
		return mimeTypes[extension.toLowerCase()] || 'application/octet-stream';
	}

	/**
	 * Get appropriate icon for file type
	 */
	private getFileTypeIcon(extension: string): string {
		const iconMap: Record<string, string> = {
			// Office documents
			'.xlsx': '📊', '.xls': '📊',
			'.pptx': '📽️', '.ppt': '📽️',
			'.docx': '📄', '.doc': '📄',
			// Open Document
			'.odt': '📄', '.ods': '📊', '.odp': '📽️',
			// Archives
			'.zip': '📦', '.rar': '📦', '.7z': '📦', '.tar': '📦', '.gz': '📦', '.bz2': '📦',
			// Text/data
			'.json': '🗃️', '.xml': '🗃️', '.csv': '📊', '.yaml': '⚙️', '.yml': '⚙️',
			'.toml': '⚙️', '.txt': '📄', '.md': '📝', '.rtf': '📄',
			// Code files
			'.js': '💻', '.ts': '💻', '.py': '🐍', '.java': '☕', '.cpp': '💻', '.c': '💻',
			'.h': '💻', '.css': '🎨', '.html': '🌐', '.php': '💻',
			// Database
			'.db': '🗄️', '.sqlite': '🗄️', '.sql': '🗄️',
			// E-books
			'.epub': '📖', '.mobi': '📖',
			// Other
			'.ics': '📅', '.vcf': '👤', '.log': '📋'
		};
		
		return iconMap[extension.toLowerCase()] || '📎';
	}

	/**
	 * Resolve file path (similar to resolvePdfPath but for generic files)
	 */
	private async resolveFilePath(sanitizedPath: string, vaultBasePath: string, currentFile?: TFile): Promise<string | null> {
		const pathModule = require('path');
		const fs = require('fs');
		
		// Decode the URL-encoded sanitized path back to normal characters
		const decodedPath = decodeURIComponent(sanitizedPath);
		
		// Try multiple path resolution strategies
		const possiblePaths = [
			// Strategy 1: Relative to vault root (standard Obsidian behavior)
			pathModule.resolve(vaultBasePath, decodedPath),
			// Strategy 2: Relative to current file's directory (for local attachments)
			currentFile ? pathModule.resolve(vaultBasePath, pathModule.dirname(currentFile.path), decodedPath) : null,
			// Strategy 3: Check in attachments folder (common pattern)
			pathModule.resolve(vaultBasePath, 'attachments', pathModule.basename(decodedPath))
		].filter(p => p !== null);
		
		// Try each possible path until we find one that exists
		for (const possiblePath of possiblePaths) {
			try {
				await fs.promises.access(possiblePath);
				return possiblePath;
			} catch {
				// File doesn't exist, continue to next path
			}
		}
		
		return null;
	}

	async processPdfEmbeds(processedResult: any, vaultBasePath: string, tempDir: string, currentFile?: TFile, embedPdfFiles: boolean = true): Promise<void> {
		const { PdfToImageConverter } = await import('./src/converters/PdfToImageConverter');
		const converter = PdfToImageConverter.getInstance(this);
		const pathModule = require('path');
		const fs = require('fs');
		
		
		let updatedContent = processedResult.content;
		
		for (const pdfEmbed of processedResult.metadata.pdfEmbeds) {
			try {
				
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
					
					// Create combined output with image and optionally Typst pdf.embed using helper
					const combinedOutput = this.generatePdfEmbedContent(
						relativePdfPath,
						pdfEmbed.baseName,
						relativeImagePath,
						undefined,
						embedPdfFiles
					);
					
					// Replace the placeholder with the combined output
					updatedContent = updatedContent.replace(pdfEmbed.marker, combinedOutput);
					
				} else {
					console.warn(`Export: Failed to convert PDF to image: ${result.error}`);
					const relativePdfPath = pathModule.relative(vaultBasePath, fullPdfPath);
					// Even without preview image, still embed the PDF if requested
					const fallbackOutput = this.generatePdfEmbedContent(
						relativePdfPath, 
						pdfEmbed.baseName, 
						undefined, 
						'(preview not available)',
						embedPdfFiles
					);
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
					'(error occurred)',
					embedPdfFiles
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
	async processImageEmbeds(processedResult: any, vaultBasePath: string, tempDir: string, currentFile?: TFile): Promise<void> {
		const pathModule = require('path');
		const fs = require('fs');
		
		
		let updatedContent = processedResult.content;
		
		for (const imageEmbed of processedResult.metadata.imageEmbeds) {
			try {
				
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
	 * Process file embeds - Convert to attachments using Typst's pdf.embed
	 */
	async processFileEmbeds(processedResult: any, vaultBasePath: string, tempDir: string, currentFile?: TFile, embedAllFiles: boolean = true): Promise<void> {
		const pathModule = require('path');
		const fs = require('fs');
		
		let updatedContent = processedResult.content;
		
		for (const fileEmbed of processedResult.metadata.fileEmbeds) {
			try {
				
				// Resolve file path using helper method (similar to PDF processing)
				const fullFilePath = await this.resolveFilePath(fileEmbed.sanitizedPath, vaultBasePath, currentFile);
				
				if (!fullFilePath) {
					console.warn(`Export: File not found: ${decodeURIComponent(fileEmbed.sanitizedPath)}`);
					// Replace marker with fallback message
					const fallbackOutput = `*⚠️ File not found: ${fileEmbed.baseName}*`;
					updatedContent = updatedContent.replace(fileEmbed.marker, fallbackOutput);
					continue;
				}
				
				if (embedAllFiles) {
					// Get relative path from vault base
					const relativeFilePath = pathModule.relative(vaultBasePath, fullFilePath);
					
					// Create file embed content using helper method
					const combinedOutput = this.generateFileEmbedContent(
						relativeFilePath,
						fileEmbed.baseName,
						fileEmbed.fileType,
						undefined
					);
					
					// Replace the placeholder with the combined output
					updatedContent = updatedContent.replace(fileEmbed.marker, combinedOutput);
				} else {
					// Just show as a link if embedding is disabled
					const relativeFilePath = pathModule.relative(vaultBasePath, fullFilePath);
					const fileIcon = this.getFileTypeIcon(fileEmbed.fileType);
					const linkOutput = `[${fileIcon} ${fileEmbed.fileName}](${relativeFilePath})`;
					updatedContent = updatedContent.replace(fileEmbed.marker, linkOutput);
				}
				
			} catch (error) {
				ExportErrorHandler.handleProcessingError('File embed', fileEmbed.originalPath, error);
				// Still try to show as a link even if there's a processing error
				const relativeFilePath = pathModule.relative(vaultBasePath, fileEmbed.originalPath);
				const fileIcon = this.getFileTypeIcon(fileEmbed.fileType);
				const fallbackOutput = `[${fileIcon} ${fileEmbed.fileName} (error occurred)](${relativeFilePath})`;
				updatedContent = updatedContent.replace(fileEmbed.marker, fallbackOutput);
			}
		}
		
		// Update the processed result with the new content
		processedResult.content = updatedContent;
	}
	
	/**
	 * Prepare the output path for a file
	 */
	async prepareOutputPath(file: TFile, outputFolder: string): Promise<string> {
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

// Default export for Obsidian
export default obsidianTypstPDFExport;