/**
 * Manages temporary directories for export operations
 */

import { PLUGIN_DIRS } from './constants';

export interface TempDirectoryOptions {
	/** Base path for the vault */
	vaultPath: string;
	/** Plugin directory name (defaults to 'obsidian-typst-pdf-export') */
	pluginName?: string;
}

export class TempDirectoryManager {
	private readonly fs = require('fs');
	private readonly path = require('path');
	private readonly vaultPath: string;
	private readonly pluginName: string;

	constructor(options: TempDirectoryOptions) {
		this.vaultPath = options.vaultPath;
		this.pluginName = options.pluginName || 'obsidian-typst-pdf-export';
	}

	/**
	 * Get the plugin directory path
	 */
	private getPluginDir(): string {
		return this.path.join(this.vaultPath, '.obsidian', 'plugins', this.pluginName);
	}

	/**
	 * Get the path for a specific temp directory
	 */
	public getTempDir(type: 'images' | 'pandoc'): string {
		const dirName = type === 'images' ? PLUGIN_DIRS.TEMP_IMAGES : PLUGIN_DIRS.TEMP_PANDOC;
		return this.path.join(this.getPluginDir(), dirName);
	}

	/**
	 * Ensure a temp directory exists, creating it if necessary
	 */
	public ensureTempDir(type: 'images' | 'pandoc'): string {
		const tempDir = this.getTempDir(type);
		
		if (!this.fs.existsSync(tempDir)) {
			this.fs.mkdirSync(tempDir, { recursive: true });
		}
		
		return tempDir;
	}

	/**
	 * Clean up a specific temp directory
	 */
	public cleanupTempDir(type: 'images' | 'pandoc'): boolean {
		const tempDir = this.getTempDir(type);
		
		try {
			if (this.fs.existsSync(tempDir)) {
				const files = this.fs.readdirSync(tempDir);
				for (const file of files) {
					this.fs.unlinkSync(this.path.join(tempDir, file));
				}
				return true;
			}
		} catch (error) {
			console.warn(`Export: Failed to clean up ${type === 'images' ? 'temp-images' : 'temp-pandoc'} directory:`, error);
			return false;
		}
		
		return true;
	}

	/**
	 * Clean up all temp directories
	 */
	public cleanupAllTempDirs(): { images: boolean; pandoc: boolean } {
		return {
			images: this.cleanupTempDir('images'),
			pandoc: this.cleanupTempDir('pandoc')
		};
	}

	/**
	 * Static helper to create manager from vault path
	 */
	public static create(vaultPath: string, pluginName?: string): TempDirectoryManager {
		return new TempDirectoryManager({ vaultPath, pluginName });
	}

	/**
	 * Check if a path is within the plugin's temp directories
	 */
	public isPluginTempDir(dirPath: string): boolean {
		const pluginDir = this.getPluginDir();
		const normalizedPath = this.path.resolve(dirPath);
		const normalizedPluginDir = this.path.resolve(pluginDir);
		
		return normalizedPath.startsWith(normalizedPluginDir) && 
		       (dirPath.includes(PLUGIN_DIRS.TEMP_IMAGES) || dirPath.includes(PLUGIN_DIRS.TEMP_PANDOC));
	}
}