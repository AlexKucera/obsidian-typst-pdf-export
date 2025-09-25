/**
 * Font Management
 * Handles font discovery, caching, and retrieval for the plugin
 */

import type { obsidianTypstPDFExport } from '../../main';
import { ExportErrorHandler } from '../core/ExportErrorHandler';
import { FALLBACK_FONTS } from '../core/constants';
import { PathUtils } from '../core/PathUtils';

export class FontManager {
	constructor(private plugin: obsidianTypstPDFExport) {}
	
	/**
	 * Cache available fonts from typst to a file for quick access
	 */
	async cacheAvailableFonts(): Promise<void> {
		try {
			const { spawn } = require('child_process');
			
			const typstPath = this.plugin.resolveExecutablePath(this.plugin.settings.typstPath, 'typst');
			
			// Use spawn instead of exec for security - arguments passed separately
			const stdout = await new Promise<string>((resolve, reject) => {
				// Build platform-specific environment with enhanced PATH
				const pathValue = this.buildPlatformSpecificPATH();
				const enhancedEnv = {
					...process.env,
					PATH: pathValue,
					Path: pathValue
				};

				const typstProcess = spawn(typstPath, ['fonts'], {
					stdio: ['pipe', 'pipe', 'pipe'],
					env: enhancedEnv
				});
				
				let output = '';
				let error = '';
				
				typstProcess.stdout?.on('data', (data: Buffer) => {
					output += data.toString();
				});
				
				typstProcess.stderr?.on('data', (data: Buffer) => {
					error += data.toString();
				});
				
				typstProcess.on('close', (code: number | null) => {
					if (code === 0) {
						resolve(output);
					} else {
						reject(new Error(`typst fonts command failed with code ${code}: ${error}`));
					}
				});
				
				typstProcess.on('error', (err: Error) => {
					reject(new Error(`Failed to spawn typst process: ${err.message}`));
				});
			});
			
			const fonts = stdout
				.split('\n')
				.map((line: string) => line.trim())
				.filter((line: string) => line.length > 0)
				.sort();
			
			// Write fonts to cache file in plugin data directory
			const cacheData = {
				fonts: fonts,
				timestamp: Date.now(),
				typstPath: typstPath,
				platform: process.platform
			};

			const pathUtils = new PathUtils(this.plugin.app);
			const pluginDir = pathUtils.getPluginDir(this.plugin.manifest);
			// Use vault-relative path for adapter operations
			const fontsCachePath = pathUtils.joinPath(pluginDir, 'fonts-cache.json');
			await this.plugin.app.vault.adapter.write(fontsCachePath,
				JSON.stringify(cacheData, null, 2));
		} catch (error) {
			console.error('Failed to cache fonts from typst:', error);
			
			// Notify user of font caching failure (only if debug mode is enabled or if it's a critical error)
			ExportErrorHandler.showFontError(error, !this.plugin.settings.behavior.debugMode);
			
			// Create fallback cache file
			const fallbackFonts = FALLBACK_FONTS;

			const cacheData = {
				fonts: fallbackFonts,
				timestamp: Date.now(),
				typstPath: 'fallback',
				platform: process.platform,
				error: error instanceof Error ? error.message : String(error)
			};

			const pathUtils = new PathUtils(this.plugin.app);
			const pluginDir = pathUtils.getPluginDir(this.plugin.manifest);
			// Use vault-relative path for adapter operations
			const fontsCachePath = pathUtils.joinPath(pluginDir, 'fonts-cache.json');
			await this.plugin.app.vault.adapter.write(fontsCachePath,
				JSON.stringify(cacheData, null, 2));
		}
	}

	/**
	 * Get cached fonts list with improved validation and error recovery
	 */
	async getCachedFonts(): Promise<string[]> {
		try {
			const pathUtils = new PathUtils(this.plugin.app);
			const pluginDir = pathUtils.getPluginDir(this.plugin.manifest);
			// Use vault-relative path for adapter operations
			const fontsCachePath = pathUtils.joinPath(pluginDir, 'fonts-cache.json');
			const cacheContent = await this.plugin.app.vault.adapter.read(fontsCachePath);

			let cacheData;
			try {
				cacheData = JSON.parse(cacheContent);
			} catch (parseError) {
				console.error('Corrupted fonts cache file, regenerating:', parseError);
				// Remove corrupted cache and regenerate
				await this.plugin.app.vault.adapter.remove(fontsCachePath);
				await this.cacheAvailableFonts();
				return [...FALLBACK_FONTS];
			}

			// Validate cache structure
			if (!cacheData || typeof cacheData !== 'object' || !Array.isArray(cacheData.fonts)) {
				console.warn('Invalid fonts cache structure, regenerating');
				await this.plugin.app.vault.adapter.remove(fontsCachePath);
				await this.cacheAvailableFonts();
				return [...FALLBACK_FONTS];
			}

			// Check if cache needs refresh
			const isStale = Date.now() - (cacheData.timestamp || 0) > 24 * 60 * 60 * 1000;
			const resolvedTypstPath = this.plugin.resolveExecutablePath(this.plugin.settings.typstPath, 'typst');
			const pathChanged = cacheData.typstPath !== resolvedTypstPath;
			const platformChanged = cacheData.platform !== process.platform;

			if (isStale || pathChanged || platformChanged) {
				// Refresh cache in background
				this.cacheAvailableFonts().catch(error => {
					console.error('Background font cache refresh failed:', error);
				});
			}

			// Validate fonts array contains valid strings
			const validFonts = cacheData.fonts.filter((font: unknown) =>
				typeof font === 'string' && font.trim().length > 0
			);

			return validFonts.length > 0 ? validFonts : [...FALLBACK_FONTS];
		} catch (error) {
			console.error('Failed to read fonts cache:', error);
			// Try to recreate cache
			this.cacheAvailableFonts().catch(cacheError => {
				console.error('Failed to recreate fonts cache:', cacheError);
			});

			// Return fallback fonts
			return [...FALLBACK_FONTS];
		}
	}
	
	/**
	 * Get available fonts (wrapper for cached fonts)
	 */
	async getAvailableFonts(): Promise<string[]> {
		return await this.getCachedFonts();
	}

	/**
	 * Build platform-specific PATH environment variable for font discovery
	 * @private
	 */
	private buildPlatformSpecificPATH(): string {
		const currentPath = process.env.PATH || '';
		const pathSeparator = process.platform === 'win32' ? ';' : ':';

		// Helper function to expand tilde paths
		const expandTildePath = (path: string): string => {
			if (path.startsWith('~')) {
				const homeDir = process.env.HOME || process.env.USERPROFILE || '';
				return path.replace('~', homeDir);
			}
			return path;
		};

		// Platform-specific common installation paths
		let additionalPaths: string[] = [];

		switch (process.platform) {
			case 'darwin': // macOS
				additionalPaths = [
					'/opt/homebrew/bin',
					'/usr/local/bin',
					'/usr/bin',
					'/bin',
					'/opt/local/bin', // MacPorts
					'/sw/bin' // Fink
				];
				break;

			case 'linux':
				additionalPaths = [
					'/usr/local/bin',
					'/usr/bin',
					'/bin',
					'/opt/bin',
					'/snap/bin', // Snap packages
					'~/.cargo/bin', // Rust/Cargo installations
					'~/.local/bin' // User local installations
				];
				break;

			case 'win32': // Windows
				additionalPaths = [
					'C:\\Program Files\\Typst',
					'C:\\Program Files (x86)\\Typst',
					process.env.LOCALAPPDATA ? `${process.env.LOCALAPPDATA}\\Programs\\Typst` : '',
					process.env.APPDATA ? `${process.env.APPDATA}\\Typst` : '',
					'C:\\tools\\typst', // Chocolatey common path
					process.env.USERPROFILE ? `${process.env.USERPROFILE}\\.cargo\\bin` : ''
				].filter(path => path.length > 0);
				break;

			default:
				// Fallback for other platforms
				additionalPaths = ['/usr/local/bin', '/usr/bin', '/bin'];
		}

		// Expand tilde paths and filter empty strings
		const expandedPaths = additionalPaths
			.map(expandTildePath)
			.filter(path => path.length > 0);

		// Split current PATH and combine with additional paths
		const currentPaths = currentPath.split(pathSeparator).filter(path => path.length > 0);
		const allPaths = [...expandedPaths, ...currentPaths];

		// Remove duplicates while preserving order
		const uniquePaths = [...new Set(allPaths)];

		return uniquePaths.join(pathSeparator);
	}
}