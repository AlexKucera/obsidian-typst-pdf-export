// ABOUTME: Centralized path utilities for safe Obsidian API operations
// ABOUTME: Handles vault paths, plugin directories, and file operations

import { promises as fs } from 'fs';
import { FileSystemAdapter, normalizePath, Notice } from 'obsidian';
import type { App, PluginManifest } from 'obsidian';
import * as path from 'path';

/**
 * Centralized path utilities for safe Obsidian API operations.
 *
 * This class provides a unified interface for path operations that work correctly
 * with both vault-relative and absolute filesystem paths. It handles cross-platform
 * path normalization and provides safe wrappers around Obsidian's vault adapter.
 *
 * Key features:
 * - Automatic path normalization for cross-platform compatibility
 * - Safe handling of absolute and relative paths
 * - FileSystemAdapter validation for desktop-only operations
 * - Error handling with user notifications
 *
 * @example
 * ```typescript
 * const pathUtils = new PathUtils(app);
 * const vaultPath = pathUtils.getVaultPath();
 * const pluginDir = pathUtils.getPluginDir(manifest);
 * const fullPath = pathUtils.joinPath(vaultPath, pluginDir, 'templates');
 * ```
 */
export class PathUtils {
	/**
	 * Creates a new PathUtils instance.
	 *
	 * @param app - The Obsidian App instance used for vault operations
	 */
	constructor(private app: App) {}

	/**
	 * Gets the absolute filesystem path to the vault root directory.
	 *
	 * This method requires desktop Obsidian as it relies on FileSystemAdapter.
	 * If the adapter is not available (e.g., mobile), it will show a notice
	 * and throw an error.
	 *
	 * @returns The absolute path to the vault root directory
	 * @throws {Error} If FileSystemAdapter is not available (non-desktop environment)
	 *
	 * @example
	 * ```typescript
	 * const vaultPath = pathUtils.getVaultPath();
	 * // Returns: '/Users/username/Documents/MyVault'
	 * ```
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
	 * Gets the vault-relative path to the plugin directory.
	 *
	 * Extracts the directory path from the plugin manifest and normalizes it
	 * for cross-platform compatibility. This is typically something like
	 * '.obsidian/plugins/plugin-name'.
	 *
	 * @param pluginManifest - The plugin's manifest containing directory information
	 * @returns The normalized vault-relative path to the plugin directory
	 *
	 * @example
	 * ```typescript
	 * const pluginDir = pathUtils.getPluginDir(this.manifest);
	 * // Returns: '.obsidian/plugins/typst-pdf-export'
	 * ```
	 */
	getPluginDir(pluginManifest: PluginManifest): string {
		return normalizePath(pluginManifest.dir || '');
	}

	/**
	 * Joins multiple path segments into a single normalized path.
	 *
	 * This method filters out empty segments, joins them using Node's path.join,
	 * and normalizes the result for Obsidian compatibility. It correctly handles
	 * absolute paths by using Node's standard path joining behavior (which uses
	 * the rightmost absolute path if multiple absolute paths are provided).
	 *
	 * @param segments - Variable number of path segments to join
	 * @returns The joined and normalized path, or empty string if no segments
	 *
	 * @example
	 * ```typescript
	 * const fullPath = pathUtils.joinPath(vaultPath, '.obsidian', 'plugins', 'my-plugin');
	 * // Returns: '/path/to/vault/.obsidian/plugins/my-plugin'
	 *
	 * const withEmpty = pathUtils.joinPath('folder', '', 'subfolder');
	 * // Returns: 'folder/subfolder' (empty segments filtered)
	 * ```
	 */
	joinPath(...segments: string[]): string {
		const filtered = segments.filter(s => s);
		if (filtered.length === 0) {
			return '';
		}
		const result = path.join(...filtered);
		// Don't use normalizePath on absolute paths as it strips the leading slash
		// Only normalize vault-relative paths
		if (path.isAbsolute(result)) {
			return result;
		}
		return normalizePath(result);
	}

	/**
	 * Ensures a directory exists, creating it if necessary.
	 *
	 * This method checks if the directory exists and creates it if it doesn't.
	 * The path is automatically normalized before operations. If creation fails,
	 * a notice is shown to the user and the error is re-thrown.
	 *
	 * @param path - The path to the directory (vault-relative or absolute)
	 * @throws {Error} If directory creation fails
	 *
	 * @example
	 * ```typescript
	 * await pathUtils.ensureDir('.obsidian/plugins/my-plugin/temp');
	 * // Creates directory if it doesn't exist
	 * ```
	 */
	async ensureDir(path: string): Promise<void> {
		const normalizedPath = normalizePath(path);
		try {
			const exists = await this.app.vault.adapter.exists(normalizedPath);
			if (!exists) {
				await this.app.vault.adapter.mkdir(normalizedPath);
			}
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			const userMessage = `Failed to create output directory "${normalizedPath}". ${errorMessage.includes('parent') || errorMessage.includes('ENOENT') ? 'The parent directory may not exist or you may not have write permissions.' : 'You may not have write permissions or the path is invalid.'}`;
			new Notice(userMessage);
			throw new Error(userMessage);
		}
	}

	/**
	 * Cleans up directory contents by removing all files (but not subdirectories).
	 *
	 * This method removes only the files directly within the directory, leaving
	 * any subdirectories intact. This matches the behavior of TempDirectoryManager
	 * for safe cleanup operations. If the directory doesn't exist or cleanup fails,
	 * the method returns false and logs a warning.
	 *
	 * @param path - The path to the directory to clean (vault-relative or absolute)
	 * @returns True if cleanup succeeded or directory doesn't exist, false on error
	 *
	 * @example
	 * ```typescript
	 * const success = await pathUtils.cleanupDir('temp-images');
	 * if (success) {
	 *   console.log('Temp directory cleaned');
	 * }
	 * ```
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
	 * Checks if a file or directory exists at the given path.
	 *
	 * This method intelligently handles multiple path formats:
	 * 1. First attempts as vault-relative path
	 * 2. If that fails and path is within vault, converts absolute to relative
	 * 3. For paths outside vault, uses Node's fs module directly
	 *
	 * Supports:
	 * - Vault-relative paths: 'folder/file.md'
	 * - Absolute Unix paths: '/home/user/vault/file.md'
	 * - Windows drive letters: 'C:\\Users\\vault\\file.md'
	 * - Windows UNC paths: '\\\\server\\share\\file.md'
	 *
	 * @param path - The path to check (vault-relative or absolute)
	 * @returns True if the file or directory exists, false otherwise
	 *
	 * @example
	 * ```typescript
	 * // Check vault-relative path
	 * const exists = await pathUtils.fileExists('templates/default.typ');
	 *
	 * // Check absolute path
	 * const exists = await pathUtils.fileExists('/usr/bin/pandoc');
	 *
	 * // Check Windows path
	 * const exists = await pathUtils.fileExists('C:\\Program Files\\Pandoc\\pandoc.exe');
	 * ```
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
				await fs.access(path);
				return true;
			} catch {
				return false;
			}
		}

		return false;
	}

	/**
	 * Converts an absolute path to a vault-relative path.
	 *
	 * This method is used to convert absolute filesystem paths to vault-relative
	 * paths suitable for use with Obsidian's vault adapter operations. If the path
	 * does not start with the vault base path, it is returned unchanged.
	 *
	 * @param absolutePath - The absolute path to convert
	 * @returns The vault-relative path (without leading slash) or the original path if not within vault
	 *
	 * @example
	 * ```typescript
	 * const pathUtils = new PathUtils(app);
	 * const vaultPath = '/Users/name/vault';
	 * const absolutePath = '/Users/name/vault/folder/file.md';
	 * const relative = pathUtils.toVaultRelativePath(absolutePath);
	 * // Returns: 'folder/file.md'
	 * ```
	 */
	toVaultRelativePath(absolutePath: string): string {
		const vaultBasePath = this.getVaultPath();
		if (!absolutePath.startsWith(vaultBasePath)) {
			return absolutePath;
		}

		let relativePath = absolutePath.substring(vaultBasePath.length);
		if (relativePath.startsWith('/') || relativePath.startsWith('\\')) {
			relativePath = relativePath.substring(1);
		}
		return relativePath;
	}
}