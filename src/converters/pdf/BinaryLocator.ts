/**
 * Binary locator utilities for finding external tool binaries.
 * Handles discovery of pdf2img and other CLI tools in the Obsidian environment.
 */

import { promises as fs } from 'fs';
import * as path from 'path';
import type { obsidianTypstPDFExport } from '../../../main';
import { PathUtils } from '../../core/PathUtils';

export interface BinaryLocation {
	/** Full path to the binary */
	binaryPath: string;
	/** Whether the binary was found and is executable */
	exists: boolean;
	/** Error message if binary was not found */
	error?: string;
}

export class BinaryLocator {
	/**
	 * Find the pdf2img binary in the plugin's node_modules directory.
	 * Handles the complex Obsidian environment where __dirname points to electron.asar.
	 * Includes Windows-specific executable detection and fallback paths.
	 * @param plugin The plugin instance for accessing manifest and settings
	 * @returns Binary location info
	 */
	public static async findPdf2ImgBinary(plugin?: obsidianTypstPDFExport): Promise<BinaryLocation> {
		try {
			// Get the plugin directory - need to handle Obsidian's environment
			// In Obsidian, __dirname points to electron.asar, so we need to find the actual plugin path
			// Try multiple strategies to find the plugin directory
			const pluginDirName = plugin?.manifest?.dir || 'typst-pdf-export';
			const configDir = plugin?.app.vault.configDir;
			if (!configDir) {
				throw new Error('Unable to determine Obsidian configuration directory');
			}
			const possiblePluginDirs = this.getPossiblePluginDirs(plugin, pluginDirName, configDir);

			// Find the first directory that exists and has node_modules
			let pluginDir = possiblePluginDirs[0]; // Default fallback
			for (const dir of possiblePluginDirs) {
				try {
					const nodeModulesPath = path.join(dir, 'node_modules');
					if (plugin?.app) {
						const pathUtils = new PathUtils(plugin.app);
						if (await pathUtils.fileExists(nodeModulesPath)) {
							pluginDir = dir;
							break;
						}
					}
				} catch {
					continue;
				}
			}

			// Try to find the binary with platform-specific handling
			const binaryLocation = await this.findBinaryWithFallbacks(pluginDir, plugin);

			return binaryLocation;

		} catch (error: unknown) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			return {
				binaryPath: '',
				exists: false,
				error: `Failed to locate pdf2img binary: ${errorMessage}`
			};
		}
	}

	/**
	 * Find the pdf2img binary with platform-specific extensions and multiple fallback paths.
	 * @param pluginDir The plugin directory path
	 * @param plugin The plugin instance for path utilities
	 * @returns Binary location info
	 */
	private static async findBinaryWithFallbacks(pluginDir: string, plugin?: obsidianTypstPDFExport): Promise<BinaryLocation> {
		// Define Windows-specific executable extensions
		const windowsExtensions = process.platform === 'win32' ? ['.cmd', '.bat', '.ps1', '.exe'] : [''];

		// Get platform-specific binary name
		const baseBinaryName = 'pdf2img';

		// Define fallback search paths for different installation methods
		const fallbackPaths = [
			// Standard npm binary location
			path.join(pluginDir, 'node_modules', '.bin'),
			// Direct package binary location
			path.join(pluginDir, 'node_modules', 'pdf-to-img', 'bin'),
			// Windows-specific npm locations
			...(process.platform === 'win32' ? [
				path.join(process.env.APPDATA || '', 'npm'),
				path.join(process.env.LOCALAPPDATA || '', 'npm-cache'),
				// Additional Windows global npm locations
				path.join(process.env.PROGRAMFILES || 'C:\\Program Files', 'nodejs'),
				path.join(process.env['PROGRAMFILES(X86)'] || 'C:\\Program Files (x86)', 'nodejs')
			] : [])
		];

		// Try each fallback path with platform-specific extensions
		for (const searchPath of fallbackPaths) {
			for (const extension of windowsExtensions) {
				const binaryName = baseBinaryName + extension;
				const fullBinaryPath = path.join(searchPath, binaryName);

				// Check if this binary exists and is accessible
				const exists = await this.validateBinaryExists(fullBinaryPath, plugin);

				if (exists) {
					return {
						binaryPath: fullBinaryPath,
						exists: true
					};
				}
			}
		}

		// If no binary found, return the default expected path for error reporting
		const defaultPath = path.join(pluginDir, 'node_modules', '.bin', baseBinaryName);
		const finalPath = process.platform === 'win32' ? defaultPath + '.cmd' : defaultPath;

		return {
			binaryPath: finalPath,
			exists: false,
			error: `PDF2IMG binary not found. Searched in ${fallbackPaths.length} locations with platform-specific extensions. Expected at: ${finalPath}`
		};
	}

	/**
	 * Get possible plugin directory locations based on different Obsidian environments.
	 * @param plugin Plugin instance
	 * @param pluginDirName Name of the plugin directory
	 * @param configDir Obsidian config directory (.obsidian)
	 * @returns Array of possible plugin directory paths
	 */
	private static getPossiblePluginDirs(plugin: obsidianTypstPDFExport | undefined, pluginDirName: string, configDir: string): string[] {
		const pathUtils = plugin ? new PathUtils(plugin.app) : null;

		return [
			// Strategy 1: From process.cwd() if it's in the vault
			path.join(process.cwd(), configDir, 'plugins', pluginDirName),
			// Strategy 2: Assuming we're running from vault root
			path.join(configDir, 'plugins', pluginDirName),
			// Strategy 3: From vault base path if plugin is available
			// Use PathUtils.joinPath to handle absolute paths correctly on Windows
			...(pathUtils ? [pathUtils.joinPath(pathUtils.getVaultPath(), plugin!.manifest.dir!)] : [])
		];
	}

	/**
	 * Validate that a binary exists and is accessible.
	 * @param binaryPath Full path to the binary
	 * @param plugin Plugin instance for PathUtils
	 * @returns True if binary exists, false otherwise
	 */
	private static async validateBinaryExists(binaryPath: string, plugin?: obsidianTypstPDFExport): Promise<boolean> {
		try {
			if (!plugin?.app) {
				// This should not happen in normal plugin operation, but provide fallback
				await fs.access(binaryPath);
				return true;
			}

			const pathUtils = new PathUtils(plugin.app);
			return await pathUtils.fileExists(binaryPath);
		} catch {
			return false;
		}
	}
}