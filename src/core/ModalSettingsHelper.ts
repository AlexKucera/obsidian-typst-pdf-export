/**
 * Helper utilities for preparing export modal settings
 */

import { TFile } from 'obsidian';
import { obsidianTypstPDFExportSettings } from './settings';
import { ExportConfigModalSettings } from '../ui/modal/modalTypes';

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

export class ModalSettingsHelper {
	/**
	 * Prepare modal settings from plugin defaults and file context
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
	 * Build template variables object from plugin settings
	 */
	private static buildTemplateVariables(settings: obsidianTypstPDFExportSettings): Record<string, string | number | boolean> {
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
	 * Helper for single file export modal settings
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
	 * Helper for multi-file export modal settings
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