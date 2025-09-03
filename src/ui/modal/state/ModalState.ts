/**
 * Modal State Management
 * Centralized state management for the Export Configuration Modal
 */

import { ExportConfigModalSettings, ExportConfig, ModalState as IModalState } from '../modalTypes';
import { ExportFormat } from '../../../core/settings';

export class ModalState implements IModalState {
	settings: ExportConfigModalSettings;
	templateVariables: Record<string, any>;
	
	private changeListeners: Set<() => void> = new Set();
	private static readonly STORAGE_KEY = 'typst-export-modal-state';
	
	constructor(initialSettings: Partial<ExportConfigModalSettings>) {
		// Load from localStorage if available
		const savedState = this.loadFromStorage();
		
		// Initialize with defaults, then saved state, then passed settings
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
			openAfterExport: false,
			preserveFolderStructure: false,
			...savedState?.settings,
			...initialSettings
		};
		
		// Use ONLY the passed templateVariables, with minimal fallbacks
		// Priority: initialSettings > savedState > absolute minimal fallbacks
		this.templateVariables = {
			// Only provide absolute minimal fallbacks for required fields
			pageSize: 'a4',
			orientation: 'portrait',
			flipped: false,
			marginTop: '1in',
			marginBottom: '0.8in',
			marginLeft: '1in',
			marginRight: '0.6in',
			bodyFont: 'Times New Roman', // Generic fallback
			headingFont: 'Times New Roman', // Generic fallback
			monospaceFont: 'Courier New', // Generic fallback
			bodyFontSize: '11pt',
			// Apply saved state if any
			...savedState?.templateVariables,
			// Apply passed settings (this should be the plugin defaults)
			...initialSettings.templateVariables
		};
		
		// Update settings to include merged template variables
		this.settings.templateVariables = this.templateVariables;
	}
	
	/**
	 * Update template variables
	 */
	updateTemplateVariables(updates: Record<string, any>): void {
		this.templateVariables = {
			...this.templateVariables,
			...updates
		};
		this.settings.templateVariables = this.templateVariables;
		this.saveToStorage();
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
			templateVariables: this.templateVariables,
			openAfterExport: this.settings.openAfterExport,
			preserveFolderStructure: this.settings.preserveFolderStructure
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
		this.saveToStorage();
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
	reset(pluginDefaults: any): void {
		// Reset to plugin defaults, not hardcoded defaults
		this.settings = {
			...this.settings,
			template: pluginDefaults.template,
			format: pluginDefaults.format,
			outputFolder: pluginDefaults.outputFolder || 'exports',
			templateVariables: {},
			progressPercent: 0,
			currentOperation: '',
			isExporting: false,
			canCancel: false,
			openAfterExport: pluginDefaults.openAfterExport || false,
			preserveFolderStructure: pluginDefaults.preserveFolderStructure || false
		};
		
		this.templateVariables = {
			pageSize: pluginDefaults.pageSize,
			orientation: pluginDefaults.orientation,
			flipped: pluginDefaults.orientation === 'landscape',
			marginTop: pluginDefaults.marginTop,
			marginBottom: pluginDefaults.marginBottom,
			marginLeft: pluginDefaults.marginLeft,
			marginRight: pluginDefaults.marginRight,
			bodyFont: pluginDefaults.bodyFont,
			headingFont: pluginDefaults.headingFont,
			monospaceFont: pluginDefaults.monospaceFont,
			bodyFontSize: pluginDefaults.bodyFontSize
		};
		
		this.settings.templateVariables = this.templateVariables;
		this.saveToStorage();
		this.notifyChange();
	}
	
	/**
	 * Save current state to localStorage
	 */
	private saveToStorage(): void {
		const stateToSave = {
			settings: {
				template: this.settings.template,
				format: this.settings.format,
				outputFolder: this.settings.outputFolder,
				openAfterExport: this.settings.openAfterExport,
				preserveFolderStructure: this.settings.preserveFolderStructure
			},
			templateVariables: this.templateVariables
		};
		
		try {
			localStorage.setItem(ModalState.STORAGE_KEY, JSON.stringify(stateToSave));
		} catch (error) {
			console.warn('Failed to save modal state to localStorage:', error);
		}
	}
	
	/**
	 * Load state from localStorage
	 */
	private loadFromStorage(): { settings: Partial<ExportConfigModalSettings>, templateVariables: Record<string, any> } | null {
		try {
			const saved = localStorage.getItem(ModalState.STORAGE_KEY);
			if (saved) {
				return JSON.parse(saved);
			}
		} catch (error) {
			console.warn('Failed to load modal state from localStorage:', error);
		}
		return null;
	}
}