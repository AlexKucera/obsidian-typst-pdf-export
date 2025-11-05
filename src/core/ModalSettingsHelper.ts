/**
 * Helper utilities for preparing export modal settings.
 *
 * This module provides utilities for transforming plugin settings and file context
 * into the format expected by the export configuration modal. It handles both single
 * and multi-file export scenarios, extracting defaults from plugin settings and
 * building template variable objects.
 *
 * Key features:
 * - Automatic template variable extraction from plugin settings
 * - Multi-file export support with automatic title generation
 * - Landscape mode width adjustment for single-page exports
 * - Clean separation between single and multi-file modal preparation
 */

import { TFile } from 'obsidian';
import { obsidianTypstPDFExportSettings } from './settings';
import { ExportConfigModalSettings } from '../ui/modal/modalTypes';

/**
 * Input parameters for modal settings preparation.
 *
 * @property file - Primary file for the export
 * @property additionalFiles - Additional files for multi-file export (optional)
 * @property availableTemplates - List of available template names
 * @property settings - Plugin settings to extract defaults from
 */
export interface ModalSettingsInput {
	/** Primary file for the export */
	file: TFile;
	/** Additional files for multi-file export (optional) */
	additionalFiles?: TFile[];
	/** Available templates list */
	availableTemplates: string[];
	/** Plugin settings to extract defaults from */
	settings: obsidianTypstPDFExportSettings;
}

/**
 * Utility class for preparing export modal configuration from plugin settings.
 *
 * This class transforms plugin settings into the format required by the export
 * configuration modal. It extracts defaults for all export options and builds
 * template variable objects that can be customized in the modal before export.
 *
 * The helper handles special cases like:
 * - Multi-file export title formatting ("5 files" instead of filename)
 * - Landscape orientation width adjustments for single-page exports
 * - Template variable extraction from typography and page setup settings
 *
 * @example
 * ```typescript
 * // Single file export
 * const modalSettings = ModalSettingsHelper.prepareForSingleFile(
 *   file,
 *   ['default', 'modern', 'article'],
 *   this.plugin.settings
 * );
 * const modal = new ExportConfigModal(this.app, modalSettings, async (config) => {
 *   await this.exportWithConfig(config);
 * });
 *
 * // Multi-file export
 * const modalSettings = ModalSettingsHelper.prepareForMultiFile(
 *   selectedFiles,
 *   ['default', 'modern'],
 *   this.plugin.settings
 * );
 * // Modal title will show "5 files" if 5 files selected
 * ```
 */
export class ModalSettingsHelper {
	/**
	 * Prepares modal settings from plugin defaults and file context.
	 *
	 * This is the core method that transforms plugin settings and file information
	 * into the format expected by ExportConfigModal. It automatically detects multi-file
	 * scenarios, builds template variables from plugin settings, and extracts export
	 * defaults.
	 *
	 * For multi-file exports, the modal title is set to "{count} files" instead of
	 * the primary file name. Template variables include automatic width adjustment
	 * for landscape single-page exports.
	 *
	 * @param input - Configuration object containing file(s), templates, and settings
	 * @returns Partial modal settings ready for ExportConfigModal initialization
	 *
	 * @example
	 * ```typescript
	 * // Single file
	 * const settings = ModalSettingsHelper.prepareModalSettings({
	 *   file: activeFile,
	 *   availableTemplates: ['default', 'modern'],
	 *   settings: this.settings
	 * });
	 * // settings.noteTitle = "My Note"
	 *
	 * // Multiple files
	 * const settings = ModalSettingsHelper.prepareModalSettings({
	 *   file: files[0],
	 *   additionalFiles: files.slice(1),
	 *   availableTemplates: ['default'],
	 *   settings: this.settings
	 * });
	 * // settings.noteTitle = "5 files"
	 * // settings.files = [file1, file2, file3, file4, file5]
	 * ```
	 */
	public static prepareModalSettings(input: ModalSettingsInput): Partial<ExportConfigModalSettings> {
		const { file, additionalFiles, availableTemplates, settings } = input;
		
		// Determine if this is a multi-file export
		const allFiles = additionalFiles ? [file, ...additionalFiles] : [file];
		const isMultiFile = allFiles.length > 1;
		
		// Prepare template variables from plugin settings
		const templateVariables = this.buildTemplateVariables(settings);
		
		return {
			notePath: file.path,
			noteTitle: isMultiFile ? `${allFiles.length} files` : file.basename,
			files: isMultiFile ? allFiles : undefined,
			
			// Plugin defaults from settings tab
			template: settings.exportDefaults.template,
			format: settings.exportDefaults.format,
			outputFolder: settings.outputFolder,
			openAfterExport: settings.behavior.openAfterExport,
			preserveFolderStructure: settings.behavior.preserveFolderStructure,
			availableTemplates,
			
			// Template variables from settings
			templateVariables
		};
	}

	/**
	 * Builds template variables object from plugin settings.
	 *
	 * This method extracts typography and page setup settings and formats them
	 * as template variables suitable for Typst compilation. It handles special cases
	 * like automatic width adjustment for landscape single-page exports.
	 *
	 * Variables include:
	 * - Page setup: pageSize, orientation, flipped, margins (top/bottom/left/right)
	 * - Typography: bodyFont, headingFont, monospaceFont, bodyFontSize
	 * - Format-specific: width='auto' for landscape single-page mode
	 *
	 * @param settings - Plugin settings containing typography and page setup configuration
	 * @returns Object with template variables ready for Pandoc/Typst
	 * @private
	 *
	 * @example
	 * ```typescript
	 * const vars = ModalSettingsHelper.buildTemplateVariables(settings);
	 * // {
	 * //   pageSize: 'a4',
	 * //   orientation: 'landscape',
	 * //   flipped: true,  // auto-set for landscape
	 * //   marginTop: '71',
	 * //   bodyFont: 'Georgia',
	 * //   width: 'auto'  // for landscape single-page
	 * // }
	 * ```
	 */
	private static buildTemplateVariables(settings: obsidianTypstPDFExportSettings): Record<string, string | number | boolean | undefined> {
		const baseVariables = {
			pageSize: settings.pageSetup.size,
			orientation: settings.pageSetup.orientation,
			flipped: settings.pageSetup.orientation === 'landscape',
			marginTop: settings.pageSetup.margins.top.toString(),
			marginBottom: settings.pageSetup.margins.bottom.toString(),
			marginLeft: settings.pageSetup.margins.left.toString(),
			marginRight: settings.pageSetup.margins.right.toString(),
			bodyFont: settings.typography.fonts.body,
			headingFont: settings.typography.fonts.heading,
			monospaceFont: settings.typography.fonts.monospace,
			bodyFontSize: settings.typography.fontSizes.body
		};

		// Auto-adjust width for single-page landscape mode
		const landscapeAdjustment = settings.pageSetup.orientation === 'landscape' 
			&& settings.exportDefaults.format === 'single-page'
			? { width: 'auto' }
			: {};

		return {
			...baseVariables,
			...landscapeAdjustment
		};
	}

	/**
	 * Convenience method for preparing modal settings for single file export.
	 *
	 * This is a simplified wrapper around prepareModalSettings for the common case
	 * of exporting a single file. It automatically sets up the modal with the file's
	 * basename as the title and extracts all defaults from plugin settings.
	 *
	 * @param file - The file to export
	 * @param availableTemplates - List of available template names
	 * @param settings - Plugin settings for default extraction
	 * @returns Partial modal settings for single file export
	 *
	 * @example
	 * ```typescript
	 * const activeFile = this.app.workspace.getActiveFile();
	 * if (activeFile) {
	 *   const modalSettings = ModalSettingsHelper.prepareForSingleFile(
	 *     activeFile,
	 *     this.templateManager.getAvailableTemplates(),
	 *     this.settings
	 *   );
	 *   new ExportConfigModal(this.app, modalSettings, async (config) => {
	 *     await this.exportFile(activeFile, config);
	 *   }).open();
	 * }
	 * ```
	 */
	public static prepareForSingleFile(
		file: TFile,
		availableTemplates: string[],
		settings: obsidianTypstPDFExportSettings
	): Partial<ExportConfigModalSettings> {
		return this.prepareModalSettings({
			file,
			availableTemplates,
			settings
		});
	}

	/**
	 * Convenience method for preparing modal settings for multi-file export.
	 *
	 * This method handles batch export scenarios where multiple files should be
	 * exported together. It automatically splits the files array into primary and
	 * additional files, and sets the modal title to show the file count.
	 *
	 * The first file in the array becomes the primary file (used for initial path
	 * resolution), and the remaining files are treated as additional files for the
	 * batch export.
	 *
	 * @param files - Array of files to export (must contain at least one file)
	 * @param availableTemplates - List of available template names
	 * @param settings - Plugin settings for default extraction
	 * @returns Partial modal settings for multi-file export with "{count} files" title
	 *
	 * @example
	 * ```typescript
	 * // Export all files in a folder
	 * const folder = this.app.vault.getAbstractFileByPath('my-folder');
	 * if (folder instanceof TFolder) {
	 *   const files = folder.children.filter(f => f instanceof TFile) as TFile[];
	 *   const modalSettings = ModalSettingsHelper.prepareForMultiFile(
	 *     files,
	 *     this.templateManager.getAvailableTemplates(),
	 *     this.settings
	 *   );
	 *   // modalSettings.noteTitle = "15 files" (if 15 files)
	 *   new ExportConfigModal(this.app, modalSettings, async (config) => {
	 *     await this.exportFiles(files, config);
	 *   }).open();
	 * }
	 * ```
	 */
	public static prepareForMultiFile(
		files: TFile[],
		availableTemplates: string[],
		settings: obsidianTypstPDFExportSettings
	): Partial<ExportConfigModalSettings> {
		const [primaryFile, ...additionalFiles] = files;
		return this.prepareModalSettings({
			file: primaryFile,
			additionalFiles,
			availableTemplates,
			settings
		});
	}
}