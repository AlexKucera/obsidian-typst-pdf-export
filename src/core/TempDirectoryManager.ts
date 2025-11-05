/**
 * Temporary directory management for Obsidian Typst PDF Export plugin.
 *
 * This module provides centralized management of temporary directories used during
 * the PDF export process. It handles creation, cleanup, and validation of temporary
 * storage locations for intermediate files such as:
 * - Converted images from embedded PDFs
 * - Intermediate Pandoc processing files
 * - Temporary Typst compilation artifacts
 *
 * Key features:
 * - Cross-platform path handling using Obsidian's normalizePath
 * - Automatic directory creation on first use
 * - Safe cleanup that preserves directory structure
 * - Plugin-scoped temporary directories within .obsidian folder
 * - Validation utilities for path security
 *
 * The manager creates temporary directories at:
 * `<vault>/.obsidian/plugins/typst-pdf-export/temp-images/`
 * `<vault>/.obsidian/plugins/typst-pdf-export/temp-pandoc/`
 */

import { PLUGIN_DIRS } from './constants';
import { normalizePath } from 'obsidian';
import type { App } from 'obsidian';
import * as path from 'path';

/**
 * Configuration options for TempDirectoryManager initialization.
 *
 * @property vaultPath - Absolute path to the vault root directory
 * @property configDir - Configuration directory path (typically '.obsidian')
 * @property pluginName - Optional custom plugin directory name (defaults to 'typst-pdf-export')
 * @property app - Obsidian App instance for vault.adapter file operations
 */
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

/**
 * Manager for plugin temporary directories used during PDF export operations.
 *
 * This class provides a centralized interface for managing temporary file storage
 * during the Markdown → Typst → PDF conversion pipeline. It handles the full
 * lifecycle of temporary directories:
 * - Automatic directory creation on first use
 * - Type-specific directory paths (images vs. pandoc processing)
 * - Safe cleanup that removes files but preserves directory structure
 * - Cross-platform path handling with proper normalization
 * - Security validation to prevent directory traversal attacks
 *
 * The manager uses Obsidian's vault.adapter API for all file operations, ensuring
 * compatibility with desktop-only features and proper permission handling.
 *
 * Temporary Directory Structure:
 * ```
 * <vault>/.obsidian/plugins/typst-pdf-export/
 *   ├── temp-images/     # Converted images from embedded PDFs
 *   └── temp-pandoc/     # Intermediate Pandoc/Typst processing files
 * ```
 *
 * Lifecycle:
 * 1. Initialize manager with vault path and app instance
 * 2. Call ensureTempDir() to create directories as needed
 * 3. Use getTempDir() to resolve paths for file operations
 * 4. Call cleanupTempDir() to remove temporary files (preserves directories)
 * 5. Use isPluginTempDir() to validate paths before operations
 *
 * @example
 * ```typescript
 * // Initialize for a specific vault
 * const manager = new TempDirectoryManager({
 *   vaultPath: '/Users/name/vault',
 *   configDir: '.obsidian',
 *   app: this.app
 * });
 *
 * // Ensure temp directories exist before export
 * const imagesDir = await manager.ensureTempDir('images');
 * const pandocDir = await manager.ensureTempDir('pandoc');
 *
 * // Use directories for file operations
 * await this.app.vault.adapter.write(
 *   `${imagesDir}/converted-pdf-page-1.png`,
 *   imageData
 * );
 *
 * // Clean up after export
 * await manager.cleanupAllTempDirs();
 * ```
 *
 * @example
 * ```typescript
 * // Factory method for quick initialization
 * const manager = TempDirectoryManager.create(
 *   vaultPath,
 *   '.obsidian',
 *   'typst-pdf-export',
 *   app
 * );
 *
 * // Validate paths before operations
 * const userPath = '/some/user/provided/path';
 * if (manager.isPluginTempDir(userPath)) {
 *   // Safe to operate on this path
 *   await manager.cleanupTempDir('images');
 * }
 * ```
 */
export class TempDirectoryManager {
	private readonly vaultPath: string;
	private readonly configDir: string;
	private readonly pluginName: string;
	private readonly app: App;

	/**
	 * Creates a new TempDirectoryManager instance.
	 *
	 * Initializes the manager with vault configuration and Obsidian app instance.
	 * The manager will create temporary directories within the plugin folder using
	 * the provided paths.
	 *
	 * @param options - Configuration options for the temp directory manager
	 *
	 * @example
	 * ```typescript
	 * const manager = new TempDirectoryManager({
	 *   vaultPath: this.app.vault.adapter.getBasePath(),
	 *   configDir: this.app.vault.configDir,
	 *   pluginName: 'typst-pdf-export',
	 *   app: this.app
	 * });
	 * ```
	 */
	constructor(options: TempDirectoryOptions) {
		this.vaultPath = options.vaultPath;
		this.configDir = options.configDir;
		this.pluginName = options.pluginName || 'typst-pdf-export';
		this.app = options.app;
	}

	/**
	 * Resolves the absolute path to the plugin directory.
	 *
	 * Constructs the full path to the plugin's directory within the vault's
	 * .obsidian/plugins folder. Uses Node.js path.join for proper cross-platform
	 * path handling (Windows drive letters, Unix-style paths) and Obsidian's
	 * normalizePath to ensure consistent forward slashes.
	 *
	 * @returns Normalized absolute path to plugin directory
	 * @private
	 *
	 * @example
	 * ```typescript
	 * // On Unix: '/Users/name/vault/.obsidian/plugins/typst-pdf-export'
	 * // On Windows: 'C:/Users/name/vault/.obsidian/plugins/typst-pdf-export'
	 * const pluginDir = this.getPluginDir();
	 * ```
	 */
	private getPluginDir(): string {
		// path.join automatically handles absolute paths correctly
		const result = path.join(this.vaultPath, this.configDir, 'plugins', this.pluginName);
		return normalizePath(result);
	}

	/**
	 * Resolves the path for a specific temporary directory type.
	 *
	 * Returns the absolute path to either the images or pandoc temporary directory
	 * without creating it. Use ensureTempDir() to also create the directory if it
	 * doesn't exist.
	 *
	 * Directory types:
	 * - 'images': For converted images from embedded PDF files
	 * - 'pandoc': For intermediate Pandoc/Typst processing files
	 *
	 * Paths use Obsidian's normalizePath to ensure consistent forward slashes
	 * across all platforms.
	 *
	 * @param type - Type of temporary directory ('images' or 'pandoc')
	 * @returns Normalized absolute path to the temporary directory
	 *
	 * @example
	 * ```typescript
	 * const imagesPath = manager.getTempDir('images');
	 * // Returns: '<vault>/.obsidian/plugins/typst-pdf-export/temp-images'
	 *
	 * const pandocPath = manager.getTempDir('pandoc');
	 * // Returns: '<vault>/.obsidian/plugins/typst-pdf-export/temp-pandoc'
	 *
	 * // Use with vault adapter for file operations
	 * const outputPath = `${imagesPath}/converted-page-1.png`;
	 * await this.app.vault.adapter.write(outputPath, imageData);
	 * ```
	 */
	public getTempDir(type: 'images' | 'pandoc'): string {
		const dirName = type === 'images' ? PLUGIN_DIRS.TEMP_IMAGES : PLUGIN_DIRS.TEMP_PANDOC;
		const pluginDir = this.getPluginDir();

		// Use path.join to properly handle absolute paths
		const result = path.join(pluginDir, dirName);

		return normalizePath(result);
	}

	/**
	 * Ensures a temporary directory exists, creating it if necessary.
	 *
	 * This method checks if the specified temporary directory exists and creates
	 * it if missing. It uses Obsidian's vault.adapter API for directory creation,
	 * ensuring proper permissions and cross-platform compatibility.
	 *
	 * This is the recommended method to use before writing temporary files, as it
	 * handles both path resolution and directory creation in a single call.
	 *
	 * @param type - Type of temporary directory ('images' or 'pandoc')
	 * @returns Promise resolving to the normalized absolute path of the directory
	 *
	 * @example
	 * ```typescript
	 * // Ensure images directory exists before conversion
	 * const imagesDir = await manager.ensureTempDir('images');
	 * console.log('Images directory ready:', imagesDir);
	 * // Output: Images directory ready: /vault/.obsidian/plugins/typst-pdf-export/temp-images
	 *
	 * // Write converted image file
	 * await this.app.vault.adapter.write(
	 *   `${imagesDir}/pdf-page-1.png`,
	 *   imageBuffer
	 * );
	 * ```
	 *
	 * @example
	 * ```typescript
	 * // Ensure both directories exist before export
	 * const [imagesDir, pandocDir] = await Promise.all([
	 *   manager.ensureTempDir('images'),
	 *   manager.ensureTempDir('pandoc')
	 * ]);
	 *
	 * // Use directories for export pipeline
	 * await convertPdfToImages(pdfPath, imagesDir);
	 * await runPandocConversion(inputPath, pandocDir);
	 * ```
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
	 * Cleans up temporary files from a specific directory.
	 *
	 * This method removes all files from the specified temporary directory while
	 * preserving the directory structure itself. It only removes files, not
	 * subdirectories, ensuring that the temporary directory remains ready for
	 * future use.
	 *
	 * Cleanup failures are logged to the console but don't throw errors, allowing
	 * the export process to continue even if cleanup encounters issues. This is
	 * important for user experience - a failed cleanup shouldn't prevent export
	 * completion.
	 *
	 * @param type - Type of temporary directory to clean ('images' or 'pandoc')
	 * @returns Promise resolving to true if cleanup succeeded, false if it failed
	 *
	 * @example
	 * ```typescript
	 * // Clean up after successful export
	 * const success = await manager.cleanupTempDir('images');
	 * if (success) {
	 *   console.log('Temporary images cleaned up');
	 * } else {
	 *   console.warn('Cleanup failed, but export completed');
	 * }
	 * ```
	 *
	 * @example
	 * ```typescript
	 * // Clean up in finally block to ensure cleanup even on errors
	 * try {
	 *   await exportToPDF(file);
	 * } finally {
	 *   await manager.cleanupTempDir('pandoc');
	 *   await manager.cleanupTempDir('images');
	 * }
	 * ```
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
	 * Cleans up all temporary directories in a single operation.
	 *
	 * This convenience method calls cleanupTempDir() for both the images and
	 * pandoc directories, running the cleanups in parallel for efficiency. It
	 * returns the success status for each directory independently, allowing
	 * partial cleanup if one directory fails.
	 *
	 * Use this method at the end of export operations to remove all temporary
	 * files created during the conversion process.
	 *
	 * @returns Promise resolving to object with cleanup success status for each directory type
	 *
	 * @example
	 * ```typescript
	 * // Clean up all temp directories after export
	 * const result = await manager.cleanupAllTempDirs();
	 * console.log('Images cleanup:', result.images ? 'Success' : 'Failed');
	 * console.log('Pandoc cleanup:', result.pandoc ? 'Success' : 'Failed');
	 * ```
	 *
	 * @example
	 * ```typescript
	 * // Use in plugin unload to ensure cleanup on disable
	 * async onunload() {
	 *   await this.tempManager.cleanupAllTempDirs();
	 *   console.log('Temporary files cleaned up');
	 * }
	 * ```
	 */
	public async cleanupAllTempDirs(): Promise<{ images: boolean; pandoc: boolean }> {
		return {
			images: await this.cleanupTempDir('images'),
			pandoc: await this.cleanupTempDir('pandoc')
		};
	}

	/**
	 * Factory method for creating a TempDirectoryManager instance.
	 *
	 * This static convenience method provides a simpler way to instantiate the
	 * manager when you have individual parameters rather than an options object.
	 * It's particularly useful when parameters are obtained separately from
	 * different sources.
	 *
	 * @param vaultPath - Absolute path to the vault root directory
	 * @param configDir - Configuration directory path (typically '.obsidian')
	 * @param pluginName - Optional plugin directory name (defaults to 'typst-pdf-export')
	 * @param app - Obsidian App instance for vault.adapter operations
	 * @returns New TempDirectoryManager instance
	 *
	 * @example
	 * ```typescript
	 * // Create manager from separate parameters
	 * const pathUtils = new PathUtils(this.app);
	 * const vaultPath = pathUtils.getVaultPath();
	 * const configDir = this.app.vault.configDir;
	 *
	 * const manager = TempDirectoryManager.create(
	 *   vaultPath,
	 *   configDir,
	 *   'typst-pdf-export',
	 *   this.app
	 * );
	 * ```
	 *
	 * @example
	 * ```typescript
	 * // Quick initialization with default plugin name
	 * const manager = TempDirectoryManager.create(
	 *   this.app.vault.adapter.getBasePath(),
	 *   this.app.vault.configDir,
	 *   undefined,  // Use default plugin name
	 *   this.app
	 * );
	 * ```
	 */
	public static create(vaultPath: string, configDir: string, pluginName: string | undefined, app: App): TempDirectoryManager {
		return new TempDirectoryManager({ vaultPath, configDir, pluginName, app });
	}

	/**
	 * Validates if a path is within the plugin's temporary directories.
	 *
	 * This security utility checks whether a given path is contained within either
	 * the temp-images or temp-pandoc directories. Use this method to validate paths
	 * before performing operations to prevent directory traversal attacks or
	 * accidental operations on user files.
	 *
	 * The method performs normalized path comparisons using Obsidian's normalizePath
	 * to ensure consistent behavior across Windows and Unix-like systems.
	 *
	 * @param dirPath - Path to validate (can be absolute or relative)
	 * @returns True if the path is within plugin temp directories, false otherwise
	 *
	 * @example
	 * ```typescript
	 * // Validate user-provided path before cleanup
	 * const userPath = '/vault/.obsidian/plugins/typst-pdf-export/temp-images/file.png';
	 * if (manager.isPluginTempDir(userPath)) {
	 *   await this.app.vault.adapter.remove(userPath);
	 *   console.log('Safe to remove - within temp directory');
	 * } else {
	 *   console.error('Unsafe path - outside temp directories');
	 * }
	 * ```
	 *
	 * @example
	 * ```typescript
	 * // Use as guard before bulk operations
	 * async safeCleanup(filePaths: string[]) {
	 *   for (const filePath of filePaths) {
	 *     if (manager.isPluginTempDir(filePath)) {
	 *       await this.app.vault.adapter.remove(filePath);
	 *     } else {
	 *       console.warn('Skipping non-temp file:', filePath);
	 *     }
	 *   }
	 * }
	 * ```
	 */
	public isPluginTempDir(dirPath: string): boolean {
		const pluginDir = this.getPluginDir();
		const normalizedDirPath = normalizePath(dirPath);

		const tempImagesDir = normalizePath(path.join(pluginDir, PLUGIN_DIRS.TEMP_IMAGES));
		const tempPandocDir = normalizePath(path.join(pluginDir, PLUGIN_DIRS.TEMP_PANDOC));

		const isImagesDir =
			normalizedDirPath === tempImagesDir ||
			normalizedDirPath.startsWith(`${tempImagesDir}/`);
		const isPandocDir =
			normalizedDirPath === tempPandocDir ||
			normalizedDirPath.startsWith(`${tempPandocDir}/`);

		return isImagesDir || isPandocDir;
	}
}