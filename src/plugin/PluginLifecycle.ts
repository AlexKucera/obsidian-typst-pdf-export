/**
 * Plugin Lifecycle Management
 * Handles plugin loading, unloading, initialization, and cleanup
 */

import type { obsidianTypstPDFExport } from '../../main';
import { ExportErrorHandler } from '../core/ExportErrorHandler';
import { PandocTypstConverter } from '../converters/PandocTypstConverter';
import { TemplateManager } from '../templates/TemplateManager';
import { EmbeddedTemplateManager } from '../templates/embeddedTemplates';
import { TempDirectoryManager } from '../core/TempDirectoryManager';
import * as path from 'path';

export class PluginLifecycle {
	constructor(private plugin: obsidianTypstPDFExport) {}

	/**
	 * Initialize the plugin during onload
	 */
	async initialize(): Promise<void> {
		// Load settings first
		await this.plugin.loadSettings();
		
		// Initialize embedded template manager
		const vaultPath = (this.plugin.app.vault.adapter as { basePath: string }).basePath;
		const pluginDir = path.join(vaultPath, this.plugin.manifest.dir!);
		this.plugin.embeddedTemplateManager = new EmbeddedTemplateManager(pluginDir);
		
		// Extract any missing templates from embedded data
		try {
			const extractionResult = this.plugin.embeddedTemplateManager.extractAllMissingTemplates();
			if (extractionResult.failed.length > 0) {
				console.warn(`Failed to extract ${extractionResult.failed.length} templates:`, extractionResult.failed);
				ExportErrorHandler.showTemplateError(`Failed to extract some templates. Plugin may not work correctly.`);
			}
		} catch (error) {
			console.error('Error during template extraction:', error);
			ExportErrorHandler.showTemplateError(error);
		}
		
		// Initialize components with executable paths from settings
		this.plugin.converter = new PandocTypstConverter(this.plugin, {
			pandocPath: this.plugin.settings.pandocPath,
			typstPath: this.plugin.settings.typstPath
		});
		this.plugin.templateManager = new TemplateManager(this.plugin);

		// Clean up any leftover temp directories from previous sessions
		this.cleanupStartupTempDirectories();
		
		// Check dependencies on startup (async, don't await)
		this.plugin.checkDependenciesAsync();
		
		// Cache available fonts (async, don't await)
		this.plugin.cacheAvailableFonts();
	}

	/**
	 * Clean up resources during onunload
	 */
	cleanup(): void {
		// Cancel any ongoing exports
		if (this.plugin.currentExportController) {
			this.plugin.currentExportController.abort();
		}
		
		// Clean up temp directories on plugin unload
		try {
			const vaultPath = (this.plugin.app.vault.adapter as { basePath: string }).basePath;
			const cleanupManager = TempDirectoryManager.create(vaultPath, this.plugin.app.vault.configDir);
			cleanupManager.cleanupAllTempDirs();
		} catch (error) {
			console.warn('Export: Failed to clean up temp directories during unload:', error);
		}
	}

	/**
	 * Clean up leftover temp directories from previous sessions
	 */
	private cleanupStartupTempDirectories(): void {
		try {
			const vaultPath = (this.plugin.app.vault.adapter as { basePath: string }).basePath;
			const cleanupManager = TempDirectoryManager.create(vaultPath, this.plugin.app.vault.configDir);
			const _result = cleanupManager.cleanupAllTempDirs();
			
			if (this.plugin.settings.behavior.debugMode) {
				// Debug logging was here but empty in original
			}
		} catch (error) {
			console.warn('Export: Startup temp directory cleanup failed (non-critical):', error);
			// Don't throw - this shouldn't prevent plugin from loading
		}
	}
}