/**
 * Font Management
 * Handles font discovery, caching, and retrieval for the plugin
 */

import type { obsidianTypstPDFExport } from '../../main';
import { ExportErrorHandler } from '../core/ExportErrorHandler';
import { FALLBACK_FONTS } from '../core/constants';
import * as path from 'path';

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
				const typstProcess = spawn(typstPath, ['fonts'], { 
					stdio: ['pipe', 'pipe', 'pipe'],
					env: { 
						...process.env,
						PATH: `/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:${process.env.PATH || ''}`
					}
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
				typstPath: typstPath
			};
			
			const fontsCachePath = path.join(this.plugin.manifest.dir!, 'fonts-cache.json');
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
				error: error.message
			};
			
			const fontsCachePath = path.join(this.plugin.manifest.dir!, 'fonts-cache.json');
			await this.plugin.app.vault.adapter.write(fontsCachePath,
				JSON.stringify(cacheData, null, 2));
		}
	}

	/**
	 * Get cached fonts list
	 */
	async getCachedFonts(): Promise<string[]> {
		try {
			const fontsCachePath = path.join(this.plugin.manifest.dir!, 'fonts-cache.json');
			const cacheContent = await this.plugin.app.vault.adapter.read(fontsCachePath);
			const cacheData = JSON.parse(cacheContent);
			
			// Check if cache is older than 24 hours or typst path changed
			const isStale = Date.now() - cacheData.timestamp > 24 * 60 * 60 * 1000;
			const resolvedTypstPath = this.plugin.resolveExecutablePath(this.plugin.settings.typstPath, 'typst');
			const pathChanged = cacheData.typstPath !== resolvedTypstPath;
			
			if (isStale || pathChanged) {
				// Refresh cache in background
				this.cacheAvailableFonts();
			}
			
			return cacheData.fonts || [];
		} catch (error) {
			console.error('Failed to read fonts cache:', error);
			// Try to recreate cache
			await this.cacheAvailableFonts();
			
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
}