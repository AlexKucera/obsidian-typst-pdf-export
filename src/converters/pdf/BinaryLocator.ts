/**
 * Binary locator utilities for finding external tool binaries.
 * Handles discovery of pdf2img and other CLI tools in the Obsidian environment.
 */

import * as path from 'path';
import type { obsidianTypstPDFExport } from '../../../main';

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
	 * @param plugin The plugin instance for accessing manifest and settings
	 * @returns Binary location info
	 */
	public static async findPdf2ImgBinary(plugin?: obsidianTypstPDFExport): Promise<BinaryLocation> {
		try {
			// Get the plugin directory - need to handle Obsidian's environment
			// In Obsidian, __dirname points to electron.asar, so we need to find the actual plugin path
			// Try multiple strategies to find the plugin directory
			const pluginDirName = plugin?.manifest?.dir || 'typst-pdf-export';
			const configDir = plugin?.app.vault.configDir || '.obsidian';
			const possiblePluginDirs = this.getPossiblePluginDirs(plugin, pluginDirName, configDir);
			
			// Find the first directory that exists and has node_modules
			const pluginDir = possiblePluginDirs.find(dir => {
				try {
					const nodeModulesPath = path.join(dir, 'node_modules');
					return require('fs').existsSync(nodeModulesPath);
				} catch {
					return false;
				}
			}) || possiblePluginDirs[0]; // Fallback to first option
			
			const pdf2imgPath = path.join(pluginDir, 'node_modules', '.bin', 'pdf2img');
			
			// Check if the binary exists
			const exists = await this.validateBinaryExists(pdf2imgPath);
			
			if (!exists) {
				return {
					binaryPath: pdf2imgPath,
					exists: false,
					error: `PDF2IMG binary not found at: ${pdf2imgPath}`
				};
			}

			return {
				binaryPath: pdf2imgPath,
				exists: true
			};

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
	 * Get possible plugin directory locations based on different Obsidian environments.
	 * @param plugin Plugin instance
	 * @param pluginDirName Name of the plugin directory
	 * @param configDir Obsidian config directory (.obsidian)
	 * @returns Array of possible plugin directory paths
	 */
	private static getPossiblePluginDirs(plugin: obsidianTypstPDFExport | undefined, pluginDirName: string, configDir: string): string[] {
		return [
			// Strategy 1: From process.cwd() if it's in the vault
			path.join(process.cwd(), configDir, 'plugins', pluginDirName),
			// Strategy 2: Assuming we're running from vault root
			path.join(configDir, 'plugins', pluginDirName),
			// Strategy 3: From vault base path if plugin is available
			...(plugin ? [path.join((plugin.app.vault.adapter as any).basePath, plugin.manifest.dir!)] : [])
		];
	}

	/**
	 * Validate that a binary exists and is accessible.
	 * @param binaryPath Full path to the binary
	 * @returns True if binary exists, false otherwise
	 */
	private static async validateBinaryExists(binaryPath: string): Promise<boolean> {
		try {
			const fs2 = require('fs');
			return fs2.existsSync(binaryPath);
		} catch {
			return false;
		}
	}
}