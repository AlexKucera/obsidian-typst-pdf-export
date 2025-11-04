// ABOUTME: Centralized path utilities for safe Obsidian API operations
// ABOUTME: Handles vault paths, plugin directories, and file operations

import { FileSystemAdapter, normalizePath, Notice } from 'obsidian';
import type { App, PluginManifest } from 'obsidian';
import * as path from 'path';

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
	 * Handles absolute paths correctly by using the last absolute path found
	 */
	joinPath(...segments: string[]): string {
		// Filter out empty segments
		const filtered = segments.filter(s => s);

		if (filtered.length === 0) {
			return '';
		}

		// Find the last absolute path in the segments
		// If a segment is absolute, it becomes the new base and we ignore previous segments
		let result = '';
		for (const segment of filtered) {
			if (path.isAbsolute(segment)) {
				// This segment is absolute, use it as the new base
				result = segment;
			} else if (result) {
				// Join with the current result
				result = path.join(result, segment);
			} else {
				// First relative segment
				result = segment;
			}
		}

		// Normalize the final path using path.normalize for cross-platform compatibility
		// then use Obsidian's normalizePath for vault-relative paths
		const normalized = path.normalize(result);
		return normalizePath(normalized);
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
	 * Handles both vault-relative paths and absolute filesystem paths
	 */
	async fileExists(path: string): Promise<boolean> {
		try {
			// First, try as vault-relative path
			const normalizedPath = normalizePath(path);
			const exists = await this.app.vault.adapter.exists(normalizedPath);
			if (exists) {
				return true;
			}
		} catch {
			// If vault.adapter fails, path might be absolute
		}

		// If path is absolute, convert to vault-relative and try again
		const vaultBasePath = this.getVaultPath();
		if (path.startsWith(vaultBasePath)) {
			try {
				// Remove vault base path and leading separator
				let relativePath = path.substring(vaultBasePath.length);
				if (relativePath.startsWith('/') || relativePath.startsWith('\\')) {
					relativePath = relativePath.substring(1);
				}
				const normalizedRelativePath = normalizePath(relativePath);
				return await this.app.vault.adapter.exists(normalizedRelativePath);
			} catch {
				return false;
			}
		}

		// For paths outside vault, use fs fallback (needed for external file processing)
		const isAbsolutePath = path.startsWith('/') || // Unix absolute
			/^[a-zA-Z]:[/\\]/.test(path) || // Windows drive letter (C:\ or C:/)
			path.startsWith('\\\\'); // Windows UNC path (\\server\share)

		if (isAbsolutePath) {
			try {
				const fs = require('fs').promises;
				await fs.access(path);
				return true;
			} catch {
				return false;
			}
		}

		return false;
	}
}