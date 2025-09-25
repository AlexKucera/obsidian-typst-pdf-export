// ABOUTME: Manages temporary directories for export operations
// ABOUTME: Uses normalizePath for cross-platform path operations

import { PLUGIN_DIRS } from './constants';
import { normalizePath } from 'obsidian';
import type { App } from 'obsidian';

export interface TempDirectoryOptions {
	/** Base path for the vault */
	vaultPath: string;
	/** Configuration directory path (from Vault#configDir) */
	configDir: string;
	/** Plugin directory name (defaults to 'typst-pdf-export') */
	pluginName?: string;
	/** App instance for vault.adapter operations */
	app: App;
}

export class TempDirectoryManager {
	private readonly vaultPath: string;
	private readonly configDir: string;
	private readonly pluginName: string;
	private readonly app: App;

	constructor(options: TempDirectoryOptions) {
		this.vaultPath = options.vaultPath;
		this.configDir = options.configDir;
		this.pluginName = options.pluginName || 'typst-pdf-export';
		this.app = options.app;
	}

	/**
	 * Get the plugin directory path
	 */
	private getPluginDir(): string {
		return normalizePath([this.vaultPath, this.configDir, 'plugins', this.pluginName].join('/'));
	}

	/**
	 * Get the path for a specific temp directory
	 */
	public getTempDir(type: 'images' | 'pandoc'): string {
		const dirName = type === 'images' ? PLUGIN_DIRS.TEMP_IMAGES : PLUGIN_DIRS.TEMP_PANDOC;
		return normalizePath([this.getPluginDir(), dirName].join('/'));
	}

	/**
	 * Ensure a temp directory exists, creating it if necessary
	 */
	public async ensureTempDir(type: 'images' | 'pandoc'): Promise<string> {
		const tempDir = this.getTempDir(type);

		const exists = await this.app.vault.adapter.exists(tempDir);
		if (!exists) {
			await this.app.vault.adapter.mkdir(tempDir);
		}

		return tempDir;
	}

	/**
	 * Clean up a specific temp directory
	 */
	public async cleanupTempDir(type: 'images' | 'pandoc'): Promise<boolean> {
		const tempDir = this.getTempDir(type);

		try {
			const exists = await this.app.vault.adapter.exists(tempDir);
			if (exists) {
				const list = await this.app.vault.adapter.list(tempDir);
				// Remove only files, not subdirectories (matching current pattern)
				for (const file of list.files) {
					await this.app.vault.adapter.remove(file);
				}
			}
			return true;
		} catch (error) {
			console.warn(`Export: Failed to clean up ${type === 'images' ? 'temp-images' : 'temp-pandoc'} directory:`, error);
			return false;
		}
	}

	/**
	 * Clean up all temp directories
	 */
	public async cleanupAllTempDirs(): Promise<{ images: boolean; pandoc: boolean }> {
		return {
			images: await this.cleanupTempDir('images'),
			pandoc: await this.cleanupTempDir('pandoc')
		};
	}

	/**
	 * Static helper to create manager from vault path and configDir
	 */
	public static create(vaultPath: string, configDir: string, pluginName: string | undefined, app: App): TempDirectoryManager {
		return new TempDirectoryManager({ vaultPath, configDir, pluginName, app });
	}

	/**
	 * Check if a path is within the plugin's temp directories
	 */
	public isPluginTempDir(dirPath: string): boolean {
		const pluginDir = this.getPluginDir();
		// Simple string comparison for temp directory validation
		return dirPath.startsWith(pluginDir) &&
		       (dirPath.includes(PLUGIN_DIRS.TEMP_IMAGES) || dirPath.includes(PLUGIN_DIRS.TEMP_PANDOC));
	}
}