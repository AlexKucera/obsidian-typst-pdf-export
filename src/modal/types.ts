/**
 * Type definitions for the Export Configuration Modal
 */

import { ExportFormat } from '../core/settings';

export interface ExportConfig {
	/** Override default template */
	template?: string;
	/** Override default format */
	format?: ExportFormat;
	/** Override output folder */
	outputFolder?: string;
	/** Template variables for this export */
	templateVariables?: Record<string, any>;
	/** Typography settings for this export */
	typography?: {
		fontFamily?: string;
		fontSize?: string;
		lineHeight?: string;
	};
}

export interface ExportConfigModalSettings extends ExportConfig {
	/** Note being exported */
	notePath: string;
	/** Note title for display */
	noteTitle: string;
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
	render(containerEl: HTMLElement, state: ModalState): void;
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
	typography: {
		fontFamily: string;
		fontSize: string;
		lineHeight: string;
	};
	updateTypography(updates: Partial<ModalState['typography']>): void;
	updateSettings(updates: Partial<ExportConfigModalSettings>): void;
	updateTemplateVariables(updates: Record<string, any>): void;
	buildExportConfig(): ExportConfig;
	notifyChange(): void;
}