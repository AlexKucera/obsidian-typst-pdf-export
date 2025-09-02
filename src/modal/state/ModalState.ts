/**
 * Modal State Management
 * Centralized state management for the Export Configuration Modal
 */

import { ExportConfigModalSettings, ExportConfig, ModalState as IModalState } from '../types';
import { ExportFormat } from '../../core/settings';

export class ModalState implements IModalState {
	settings: ExportConfigModalSettings;
	typography: {
		fontFamily: string;
		fontSize: string;
		lineHeight: string;
	};
	
	private changeListeners: Set<() => void> = new Set();
	
	constructor(initialSettings: Partial<ExportConfigModalSettings>) {
		// Initialize with defaults
		this.settings = {
			notePath: '',
			noteTitle: '',
			template: 'default.typ',
			format: ExportFormat.Standard,
			outputFolder: 'exports',
			templateVariables: {},
			availableTemplates: [],
			isExporting: false,
			progressPercent: 0,
			currentOperation: '',
			canCancel: false,
			...initialSettings
		};
		
		// Initialize typography with defaults that will be passed to template
		this.typography = {
			fontFamily: 'Concourse OT',
			fontSize: '11pt',
			lineHeight: '1.5'
		};
	}
	
	/**
	 * Update typography settings
	 */
	updateTypography(updates: Partial<ModalState['typography']>): void {
		this.typography = {
			...this.typography,
			...updates
		};
		this.notifyChange();
	}
	
	/**
	 * Build export configuration from current state
	 */
	buildExportConfig(): ExportConfig {
		const config: ExportConfig = {
			template: this.settings.template,
			format: this.settings.format,
			outputFolder: this.settings.outputFolder,
			templateVariables: {
				...this.settings.templateVariables,
				// Add typography settings to template variables
				font: this.typography.fontFamily,
				fontsize: this.typography.fontSize,
				lineheight: this.typography.lineHeight
			},
			// Include typography in the export config
			typography: {
				fontFamily: this.typography.fontFamily,
				fontSize: this.typography.fontSize,
				lineHeight: this.typography.lineHeight
			}
		};
		
		return config;
	}
	
	/**
	 * Register a change listener
	 */
	onChange(listener: () => void): void {
		this.changeListeners.add(listener);
	}
	
	/**
	 * Unregister a change listener
	 */
	offChange(listener: () => void): void {
		this.changeListeners.delete(listener);
	}
	
	/**
	 * Notify all listeners of state change
	 */
	notifyChange(): void {
		this.changeListeners.forEach(listener => listener());
	}
	
	/**
	 * Update settings
	 */
	updateSettings(updates: Partial<ExportConfigModalSettings>): void {
		this.settings = {
			...this.settings,
			...updates
		};
		this.notifyChange();
	}
	
	/**
	 * Update template variables
	 */
	updateTemplateVariables(updates: Record<string, any>): void {
		this.settings.templateVariables = {
			...this.settings.templateVariables,
			...updates
		};
		this.notifyChange();
	}
	
	/**
	 * Set export progress
	 */
	setProgress(percent: number, operation: string): void {
		this.settings.progressPercent = percent;
		this.settings.currentOperation = operation;
		this.notifyChange();
	}
	
	/**
	 * Reset state to defaults
	 */
	reset(): void {
		this.settings.templateVariables = {};
		this.settings.progressPercent = 0;
		this.settings.currentOperation = '';
		this.settings.isExporting = false;
		this.settings.canCancel = false;
		this.typography = {
			fontFamily: 'Concourse OT',
			fontSize: '11pt',
			lineHeight: '1.5'
		};
		this.notifyChange();
	}
}