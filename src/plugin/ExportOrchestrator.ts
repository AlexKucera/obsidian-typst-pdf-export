/**
 * Export Orchestration
 * Handles the coordination and execution of all export workflows
 */

import { TFile, TFolder, Notice, MarkdownView } from 'obsidian';
import type { obsidianTypstPDFExport } from '../../main';
import { ExportConfig } from '../ui/modal/modalTypes';
import { ExportConfigModal } from '../ui/modal/ExportConfigModal';
import { ModalSettingsHelper } from '../core/ModalSettingsHelper';
import { MarkdownPreprocessor } from '../converters/MarkdownPreprocessor';
import { TempDirectoryManager } from '../core/TempDirectoryManager';
import { ExportErrorHandler } from '../core/ExportErrorHandler';
import { PathUtils } from '../core/PathUtils';

export class ExportOrchestrator {
	private readonly pathUtils: PathUtils;

	constructor(private plugin: obsidianTypstPDFExport) {
		this.pathUtils = new PathUtils(plugin.app);
	}
	
	/**
	 * Export a file with default configuration
	 */
	async exportFile(file: TFile): Promise<void> {
		const config: ExportConfig = {
			template: this.plugin.settings.exportDefaults.template,
			format: this.plugin.settings.exportDefaults.format,
			outputFolder: this.plugin.settings.outputFolder,
			templateVariables: {
				// Page setup - use NEW settings structure (same as modal)
				pageSize: this.plugin.settings.pageSetup.size,
				orientation: this.plugin.settings.pageSetup.orientation,
				flipped: this.plugin.settings.pageSetup.orientation === 'landscape',
				marginTop: this.plugin.settings.pageSetup.margins.top.toString(),
				marginBottom: this.plugin.settings.pageSetup.margins.bottom.toString(),
				marginLeft: this.plugin.settings.pageSetup.margins.left.toString(),
				marginRight: this.plugin.settings.pageSetup.margins.right.toString(),
				// Typography - use NEW settings structure (same as modal)
				bodyFont: this.plugin.settings.typography.fonts.body,
				headingFont: this.plugin.settings.typography.fonts.heading,
				monospaceFont: this.plugin.settings.typography.fonts.monospace,
				bodyFontSize: this.plugin.settings.typography.fontSizes.body
			},
			openAfterExport: this.plugin.settings.behavior.openAfterExport,
			preserveFolderStructure: this.plugin.settings.behavior.preserveFolderStructure
		};
		
		await this.exportFileWithConfig(file, config);
	}

	/**
	 * Export multiple files with default configuration
	 */
	async exportFiles(files: TFile[]): Promise<void> {
		await this.processBatchExport(
			files,
			`Exporting ${files.length} files to PDF...`,
			(file: TFile) => this.exportFile(file)
		);
	}
	
	/**
	 * Show the export configuration modal
	 */
	async showExportModal(view: MarkdownView): Promise<void> {
		const file = view.file;
		if (!file) {
			ExportErrorHandler.showFileNotFoundWarning('markdown');
			return;
		}
		
		// Get available templates first
		const availableTemplates = await this.plugin.templateManager.getAvailableTemplates();
		
		// Prepare modal settings using helper
		const modalSettings = ModalSettingsHelper.prepareForSingleFile(
			file, 
			availableTemplates, 
			this.plugin.settings
		);
		
		// Show modal - ModalState will handle localStorage hierarchy automatically
		const modal = new ExportConfigModal(
			this.plugin.app,
			this.plugin,
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
	async showExportModalForFiles(files: TFile[]): Promise<void> {
		if (files.length === 0) {
			ExportErrorHandler.showNoFilesWarning();
			return;
		}

		// Get available templates first
		const availableTemplates = await this.plugin.templateManager.getAvailableTemplates();
		
		// Prepare modal settings using helper
		const modalSettings = ModalSettingsHelper.prepareForMultiFile(
			files, 
			availableTemplates, 
			this.plugin.settings
		);
		
		// Show modal - ModalState will handle localStorage hierarchy automatically
		const modal = new ExportConfigModal(
			this.plugin.app,
			this.plugin,
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
	 * Export a file with specific configuration
	 */
	async exportFileWithConfig(file: TFile, config: ExportConfig): Promise<void> {
		const vaultPath = this.pathUtils.getVaultPath();
		const pluginDir = this.pathUtils.joinPath(vaultPath, this.pathUtils.getPluginDir(this.plugin.manifest));
		
		// Create controller for this export (allows cancellation)
		this.plugin.currentExportController = new AbortController();
		
		try {
			// Create temp directory for conversion
			const tempManager = new TempDirectoryManager({
				vaultPath: vaultPath,
				configDir: this.plugin.app.vault.configDir,
				app: this.plugin.app,
				pluginName: this.plugin.manifest.id
			});
			const tempDir = await tempManager.ensureTempDir('pandoc');
			
			// Load file content
			const content = await this.plugin.app.vault.read(file);
			
			// Create progress notice with cancel button
			const progressNotice = new Notice('', 0);
			const cancelButton = progressNotice.noticeEl.createEl('button', {
				text: 'Cancel',
				cls: 'mod-warning'
			});
			cancelButton.addEventListener('click', () => this.cancelExport());
			progressNotice.setMessage('Preprocessing markdown content...');
			
			// Preprocess markdown
			const preprocessor = new MarkdownPreprocessor({
				vaultPath: vaultPath,
				options: {
					preserveFrontmatter: config.printFrontmatter ?? this.plugin.settings.behavior.printFrontmatter,
					baseUrl: undefined,
					printFrontmatter: config.printFrontmatter ?? this.plugin.settings.behavior.printFrontmatter
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
				const embedPdfFiles = config.embedPdfFiles ?? this.plugin.settings.behavior.embedPdfFiles;
				await this.plugin.processPdfEmbeds(processedResult, vaultPath, tempDir, file, embedPdfFiles);
			}
			
			// Process image embeds if any were found
			if (processedResult.metadata.imageEmbeds && processedResult.metadata.imageEmbeds.length > 0) {
				await this.plugin.processImageEmbeds(processedResult, vaultPath, tempDir, file);
			}
			
			// Process file embeds if any were found
			if (processedResult.metadata.fileEmbeds && processedResult.metadata.fileEmbeds.length > 0) {
				const embedAllFiles = config.embedAllFiles ?? this.plugin.settings.behavior.embedAllFiles;
				await this.plugin.processFileEmbeds(processedResult, vaultPath, tempDir, file, embedAllFiles);
			}
			
			// Prepare output path
			const outputPath = await this.plugin.prepareOutputPath(file, config.outputFolder || this.plugin.settings.outputFolder);
			
			// Get full template path
			const templatePath = config.template ? 
				this.plugin.templateManager.getTemplatePath(config.template) : 
				this.plugin.templateManager.getTemplatePath('default.typ');
			
			// Convert to PDF using the preprocessed content
			const templateVariables = {
				...(config.templateVariables || {}),
				// Add format from config if specified (takes priority over settings default)
				...(config.format && { export_format: config.format })
			};
			
			const result = await this.plugin.converter.convertMarkdownToPDF(
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
				ExportErrorHandler.showExportSuccess(result.outputPath!);
				
				// Open PDF if configured
				if (this.plugin.settings.behavior.openAfterExport) {
					this.plugin.openPDF(result.outputPath!);
				}
			} else {
				ExportErrorHandler.handleSingleExportError(result.error!);
			}
		} catch (error) {
			ExportErrorHandler.handleSingleExportError(error);
		} finally {
			this.plugin.currentExportController = null;
			
			// Clean up temporary directories
			try {
				const cleanupManager = TempDirectoryManager.create(vaultPath, this.plugin.app.vault.configDir, this.plugin.manifest.id, this.plugin.app);
				await cleanupManager.cleanupAllTempDirs();
			} catch (cleanupError) {
				console.warn('Export: Failed to clean up temporary directories:', cleanupError);
			}
		}
	}

	/**
	 * Export multiple files with specific configuration
	 */
	async exportFilesWithConfig(files: TFile[], config: ExportConfig): Promise<void> {
		await this.processBatchExport(
			files,
			`Exporting ${files.length} files with custom configuration...`,
			(file: TFile) => this.exportFileWithConfig(file, config)
		);
	}

	/**
	 * Common batch processing logic for exporting multiple files
	 */
	async processBatchExport(
		files: TFile[], 
		progressMessage: string, 
		exportFunction: (file: TFile) => Promise<void>
	): Promise<void> {
		if (files.length === 0) {
			ExportErrorHandler.showNoFilesWarning();
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
	cancelExport(): void {
		if (this.plugin.currentExportController) {
			this.plugin.currentExportController.abort();
			this.plugin.currentExportController = null;
			ExportErrorHandler.showCancellationNotice();
		}
	}

	/**
	 * Export an entire folder to PDF
	 */
	async handleFolderExport(folder: TFolder): Promise<void> {
		// Get all markdown files in the folder
		const markdownFiles = folder.children.filter(this.plugin.isMarkdownFile);
		
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
}