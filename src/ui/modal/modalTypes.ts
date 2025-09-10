/**
 * Type definitions for the Export Configuration Modal
 */

import { TFile, App } from 'obsidian';
import { ExportFormat, obsidianTypstPDFExportSettings } from '../../core/settings';

export interface ExportConfig {
	/** Override default template */
	template?: string;
	/** Override default format */
	format?: ExportFormat;
	/** Override output folder */
	outputFolder?: string;
	/** Template variables for this export */
	templateVariables?: Record<string, any>;
	/** Open PDF after export */
	openAfterExport?: boolean;
	/** Preserve folder structure when exporting */
	preserveFolderStructure?: boolean;
	/** Whether to embed PDF files as attachments in the output PDF */
	embedPdfFiles?: boolean;
	/** Whether to embed all file types as attachments in the output PDF */
	embedAllFiles?: boolean;
	/** Display frontmatter as formatted text at the beginning of the document */
	printFrontmatter?: boolean;
}

export interface ExportConfigModalSettings extends ExportConfig {
	/** Note being exported */
	notePath: string;
	/** Note title for display */
	noteTitle: string;
	/** Files being exported (for multi-file export) */
	files?: TFile[];
	/** Available templates from TemplateManager */
	availableTemplates: string[];
	/** Current export in progress */
	isExporting: boolean;
	/** Progress percentage (0-100) */
	progressPercent: number;
	/** Current operation description */
	currentOperation: string;
	/** Whether export can be cancelled */
	canCancel: boolean;
}

export interface ModalSection {
	render(containerEl: HTMLElement, state: ModalState, app?: App): void;
	validate?(): ValidationResult;
	getId(): string;
}

export interface ValidationResult {
	isValid: boolean;
	errors: string[];
	warnings?: string[];
}

export interface ModalState {
	settings: ExportConfigModalSettings;
	templateVariables: Record<string, any>;
	updateSettings(updates: Partial<ExportConfigModalSettings>): void;
	updateTemplateVariables(updates: Record<string, any>): void;
	buildExportConfig(): ExportConfig;
	notifyChange(): void;
	setProgress(percent: number, operation: string): void;
	reset(pluginDefaults: obsidianTypstPDFExportSettings): void;
	onChange(listener: () => void): void;
}