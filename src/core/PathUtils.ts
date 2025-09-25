// ABOUTME: Centralized path utilities for safe Obsidian API operations
// ABOUTME: Handles vault paths, plugin directories, and file operations

import { FileSystemAdapter, normalizePath, Notice } from 'obsidian';
import type { App, PluginManifest } from 'obsidian';

export class PathUtils {
	constructor(private app: App) {}

	/**
	 * Get vault base path safely with FileSystemAdapter check
	 */
	getVaultPath(): string {
		const adapter = this.app.vault.adapter;
		if (!(adapter instanceof FileSystemAdapter)) {
			new Notice('This plugin requires desktop Obsidian');
			throw new Error('FileSystemAdapter not available - desktop Obsidian required');
		}
		return adapter.getBasePath();
	}

	/**
	 * Get plugin directory path
	 */
	getPluginDir(pluginManifest: PluginManifest): string {
		return normalizePath(pluginManifest.dir || '');
	}

	/**
	 * Join path segments with normalizePath
	 */
	joinPath(...segments: string[]): string {
		// Filter out empty segments
		const filtered = segments.filter(s => s);
		const joined = filtered.join('/');
		return normalizePath(joined);
	}

	/**
	 * Ensure directory exists, create if necessary
	 */
	async ensureDir(path: string): Promise<void> {
		const normalizedPath = normalizePath(path);
		try {
			const exists = await this.app.vault.adapter.exists(normalizedPath);
			if (!exists) {
				await this.app.vault.adapter.mkdir(normalizedPath);
			}
		} catch (error) {
			new Notice(`Failed to create directory: ${normalizedPath}`);
			throw error;
		}
	}

	/**
	 * Clean up directory contents (files only, like current TempDirectoryManager)
	 */
	async cleanupDir(path: string): Promise<boolean> {
		const normalizedPath = normalizePath(path);
		try {
			const exists = await this.app.vault.adapter.exists(normalizedPath);
			if (exists && this.app.vault.adapter instanceof FileSystemAdapter) {
				const list = await this.app.vault.adapter.list(normalizedPath);
				// Remove only files, not subdirectories (matching current pattern)
				for (const file of list.files) {
					await this.app.vault.adapter.remove(file);
				}
			}
			return true;
		} catch (error) {
			console.warn(`Failed to cleanup directory ${normalizedPath}:`, error);
			return false;
		}
	}

	/**
	 * Check if file or directory exists
	 */
	async fileExists(path: string): Promise<boolean> {
		const normalizedPath = normalizePath(path);
		try {
			return await this.app.vault.adapter.exists(normalizedPath);
		} catch {
			return false;
		}
	}
}