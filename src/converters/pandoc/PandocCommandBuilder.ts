/**
 * Pandoc Command Builder
 * Handles construction of Pandoc command-line arguments for Typst PDF conversion
 */

import * as path from 'path';
import { promises as fsPromises } from 'fs';
import { spawnSync } from 'child_process';
import { mapToTypstPaperSize } from '../../utils/paperSizeMapper';
import { PandocOptions } from '../converterTypes';
import type { obsidianTypstPDFExportSettings } from '../../core/settings';

export class PandocCommandBuilder {
	private plugin: any;
	
	// Cache for directory scanning optimization
	private resourcePathCache: string[] = [];
	private resourcePathCacheTimestamp: number = 0;
	private resourcePathCacheVaultPath: string = '';
	private readonly CACHE_EXPIRY_MS = 5 * 60 * 1000; // 5 minutes

	constructor(plugin: any) {
		this.plugin = plugin;
	}

	/**
	 * Build pandoc command-line arguments
	 */
	async buildPandocArgs(inputPath: string, outputPath: string, pandocOptions: PandocOptions): Promise<string[]> {
		const args: string[] = [];

		// Input file
		args.push(inputPath);

		// Output file
		args.push('-o', outputPath);

		// Specify input format as markdown with smart extension disabled
		args.push('--from', 'markdown-smart');

		// Set PDF engine to Typst (use configured path if available)
		const typstPath = this.resolveExecutablePath(pandocOptions.typstPath, 'typst');
		args.push(`--pdf-engine=${typstPath}`);

		// Enable standalone mode (required for PDF output)
		args.push('--standalone');

		// Embed resources (images, etc.) directly into the output
		args.push('--embed-resources');

		// Add resource paths for attachment resolution
		await this.addResourcePaths(args, pandocOptions);

		// Handle template configuration
		await this.addTemplateConfiguration(args, pandocOptions);

		// Add variables from the ExportConfig (these take priority)
		this.addExportConfigVariables(args, pandocOptions);

		// Add fallback variables from plugin settings
		this.addPluginSettingsVariables(args, pandocOptions);

		// Add Typst engine options
		this.addTypstEngineOptions(args, pandocOptions);

		// Generate intermediate Typst file if requested
		await this.addIntermediateTypstOutput(args, pandocOptions);

		// Set working directory for relative paths
		if (pandocOptions.vaultBasePath) {
			process.chdir(pandocOptions.vaultBasePath);
		}

		return args;
	}

	/**
	 * Add resource paths for attachment resolution
	 */
	private async addResourcePaths(args: string[], pandocOptions: PandocOptions): Promise<void> {
		if (!pandocOptions.vaultBasePath) {
			return;
		}

		const fs = require('fs');
		
		// Add vault root as primary resource path
		args.push('--resource-path', pandocOptions.vaultBasePath);
		
		// Add common attachment directories as additional resource paths
		const commonAttachmentPaths = [
			path.join(pandocOptions.vaultBasePath, 'attachments'),
			path.join(pandocOptions.vaultBasePath, 'assets'),
			path.join(pandocOptions.vaultBasePath, 'files'),
			path.join(pandocOptions.vaultBasePath, 'images'),
			path.join(pandocOptions.vaultBasePath, '.attachments')
		];
		
		// Check if these directories exist and add them
		for (const attachPath of commonAttachmentPaths) {
			if (fs.existsSync(attachPath)) {
				args.push('--resource-path', attachPath);
			}
		}
		
		// Also scan for note-specific attachment folders (Obsidian often creates these)
		// Use cache to avoid scanning entire vault on every export
		const now = Date.now();
		const cacheIsValid = this.resourcePathCacheVaultPath === pandocOptions.vaultBasePath &&
			(now - this.resourcePathCacheTimestamp) < this.CACHE_EXPIRY_MS &&
			this.resourcePathCache.length > 0;
			
		if (cacheIsValid) {
			// Use cached resource paths
			for (const cachedPath of this.resourcePathCache) {
				args.push('--resource-path', cachedPath);
			}
		} else {
			// Cache is invalid or expired, perform fresh scan
			await this.scanAndCacheResourcePaths(args, pandocOptions, fs, now);
		}
	}

	/**
	 * Scan vault for additional resource paths and cache results
	 */
	private async scanAndCacheResourcePaths(args: string[], pandocOptions: PandocOptions, fs: any, now: number): Promise<void> {
		const foundResourcePaths: string[] = [];
		
		try {
			const vaultContents = fs.readdirSync(pandocOptions.vaultBasePath);
			for (const item of vaultContents) {
				const itemPath = path.join(pandocOptions.vaultBasePath!, item);
				
				let stat;
				try {
					stat = await fsPromises.stat(itemPath);
				} catch (error) {
					// File might have been deleted between readdirSync and statSync
					console.warn(`Export: Unable to stat ${itemPath}:`, (error as Error).message);
					continue;
				}
				
				if (stat.isDirectory() && !item.startsWith('.') && !item.startsWith('_')) {
					// Check if this directory contains images
					try {
						const dirContents = fs.readdirSync(itemPath);
						const hasImages = dirContents.some((file: string) => 
							/\.(png|jpg|jpeg|gif|svg|webp|bmp|ico|tiff)$/i.test(file)
						);
						if (hasImages) {
							foundResourcePaths.push(itemPath);
							args.push('--resource-path', itemPath);
						}
					} catch (e) {
						// Ignore directories we can't read
					}
				}
			}
			
			// Update cache with fresh results
			this.resourcePathCache = foundResourcePaths;
			this.resourcePathCacheTimestamp = now;
			this.resourcePathCacheVaultPath = pandocOptions.vaultBasePath!;
		} catch (e) {
			console.warn('Could not scan vault for attachment directories:', e);
		}
	}

	/**
	 * Add template configuration to pandoc arguments
	 */
	private async addTemplateConfiguration(args: string[], pandocOptions: PandocOptions): Promise<void> {
		// Use universal wrapper with --template and pass actual template as template_path variable
		if (pandocOptions.template) {
			const fs = require('fs');
			const absolutePluginDir = pandocOptions.pluginDir || '';
			const wrapperPath = path.resolve(absolutePluginDir, 'templates', 'universal-wrapper.pandoc.typ');
			
			// Verify wrapper exists
			if (!fs.existsSync(wrapperPath)) {
				throw new Error(`Universal wrapper template not found at: ${wrapperPath}`);
			}
			
			args.push('--template', wrapperPath);
			
			// Add plugin templates directory as a resource path so Typst can find template files
			const templatesDir = path.resolve(absolutePluginDir, 'templates');
			// Quote the path to handle spaces and special characters
			args.push('--resource-path', `"${templatesDir}"`);
			
			// Pass the actual template path as a variable
			// Use relative path from vault root for Typst import
			let templatePathForTypst = pandocOptions.template;
			if (path.isAbsolute(templatePathForTypst) && pandocOptions.vaultBasePath) {
				// Make template path relative to vault for Typst import
				templatePathForTypst = path.relative(pandocOptions.vaultBasePath, templatePathForTypst);
			}
			
			args.push('-V', `template_path=${templatePathForTypst}`);
		}
	}

	/**
	 * Add variables from ExportConfig (these take priority)
	 */
	private addExportConfigVariables(args: string[], pandocOptions: PandocOptions): void {
		if (!pandocOptions.variables) {
			return;
		}

		for (const [key, value] of Object.entries(pandocOptions.variables)) {
			if (value !== null && value !== undefined && value.toString().trim() !== '') {
				// Handle special variable name mappings for Typst compatibility
				let variableName = key;
				let processedValue = value;
				
				switch (key) {
					case 'bodyFont':
						variableName = 'font';
						break;
					case 'headingFont':
						variableName = 'heading_font';
						break;
					case 'monospaceFont':
						variableName = 'monospace_font';
						break;
					case 'bodyFontSize':
						variableName = 'fontsize';
						processedValue = value + 'pt';
						break;
					case 'pageSize':
						variableName = 'paper';
						// Convert to Typst-compatible paper size
						processedValue = mapToTypstPaperSize(value.toString());
						break;
					case 'marginTop':
						variableName = 'margin_top';
						processedValue = value + 'cm';
						break;
					case 'marginBottom':
						variableName = 'margin_bottom';
						processedValue = value + 'cm';
						break;
					case 'marginLeft':
						variableName = 'margin_left';
						processedValue = value + 'cm';
						break;
					case 'marginRight':
						variableName = 'margin_right';
						processedValue = value + 'cm';
						break;
					// Keep other variables as-is (orientation, flipped, width, etc.)
				}
				
				args.push('-V', `${variableName}=${processedValue}`);
			}
		}
	}

	/**
	 * Add fallback typography and page setup from plugin settings
	 */
	private addPluginSettingsVariables(args: string[], pandocOptions: PandocOptions): void {
		if (!this.plugin || !this.plugin.settings) {
			return;
		}

		const settings: obsidianTypstPDFExportSettings = this.plugin.settings;
		const existingVars = pandocOptions.variables || {};
		
		// Add typography variables only if not already present in variables
		if (settings.typography) {
			if (settings.typography.fonts) {
				// Only add if not already in variables from ExportConfig
				if (!existingVars.bodyFont && !existingVars.font && settings.typography.fonts.body) {
					args.push('-V', `font=${settings.typography.fonts.body}`);
				}
				if (!existingVars.headingFont && !existingVars.heading_font && settings.typography.fonts.heading) {
					args.push('-V', `heading_font=${settings.typography.fonts.heading}`);
				}
				if (!existingVars.monospaceFont && !existingVars.monospace_font && settings.typography.fonts.monospace) {
					args.push('-V', `monospace_font=${settings.typography.fonts.monospace}`);
				}
			}
			
			if (settings.typography.fontSizes) {
				if (!existingVars.bodyFontSize && !existingVars.fontsize && settings.typography.fontSizes.body) {
					args.push('-V', `fontsize=${settings.typography.fontSizes.body}pt`);
				}
			}
		}
		
		// Add page setup variables only if not already present
		if (settings.pageSetup) {
			if (!existingVars.pageSize && !existingVars.paper && settings.pageSetup.size) {
				const typstPaperSize = mapToTypstPaperSize(settings.pageSetup.size);
				args.push('-V', `paper=${typstPaperSize}`);
			}
			if (!existingVars.orientation && settings.pageSetup.orientation) {
				args.push('-V', `orientation=${settings.pageSetup.orientation}`);
			}
			
			// Add margin fallbacks only if not already specified
			if (settings.pageSetup.margins) {
				const margins = settings.pageSetup.margins;
				if (!existingVars.marginTop && !existingVars.margin_top && margins.top !== undefined) {
					args.push('-V', `margin_top=${margins.top}cm`);
				}
				if (!existingVars.marginRight && !existingVars.margin_right && margins.right !== undefined) {
					args.push('-V', `margin_right=${margins.right}cm`);
				}
				if (!existingVars.marginBottom && !existingVars.margin_bottom && margins.bottom !== undefined) {
					args.push('-V', `margin_bottom=${margins.bottom}cm`);
				}
				if (!existingVars.marginLeft && !existingVars.margin_left && margins.left !== undefined) {
					args.push('-V', `margin_left=${margins.left}cm`);
				}
			}
		}
		
		// Add export format variable - only use settings default if not already provided
		if (!existingVars.export_format && settings.exportDefaults && settings.exportDefaults.format) {
			args.push('-V', `export_format=${settings.exportDefaults.format}`);
		}
	}

	/**
	 * Add Typst engine options to pandoc arguments
	 */
	private addTypstEngineOptions(args: string[], pandocOptions: PandocOptions): void {
		if (pandocOptions.typstSettings?.engineOptions) {
			for (const option of pandocOptions.typstSettings.engineOptions) {
				args.push('--pdf-engine-opt', option);
			}
		}
	}

	/**
	 * Generate intermediate Typst file if requested
	 */
	private async addIntermediateTypstOutput(args: string[], pandocOptions: PandocOptions): Promise<void> {
		if (!pandocOptions.generateIntermediateTypst || !pandocOptions.tempDir) {
			return;
		}

		const typstPath = path.join(pandocOptions.tempDir, 'intermediate.typ');
		args.push('--output', typstPath);
		
		// Also create a copy to keep for debugging
		const debugTypstPath = path.join(pandocOptions.tempDir, 'debug.typ');
		// Store cleanup handler in pandocOptions to be handled by the caller
		if (!pandocOptions.cleanupHandlers) {
			pandocOptions.cleanupHandlers = [];
		}
		pandocOptions.cleanupHandlers.push(() => {
			try {
				const fs = require('fs');
				if (fs.existsSync(typstPath)) {
					fs.copyFileSync(typstPath, debugTypstPath);
				}
			} catch (e) {
				console.warn('Could not create debug Typst file:', e);
			}
		});
	}

	/**
	 * Resolve an executable path, handling empty settings by falling back to system search
	 */
	resolveExecutablePath(userPath: string | undefined, defaultName: string): string {
		// If user provided a path and it's not empty, use it
		if (userPath && userPath.trim() !== '') {
			return userPath;
		}
		
		// Try to find the executable using which command
		try {
			const augmentedEnv = {
				...process.env,
				PATH: `/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:${process.env.PATH || ''}`
			};
			
			const result = spawnSync('which', [defaultName], {
				encoding: 'utf8',
				env: augmentedEnv
			});
			
			if (result.status === 0 && result.stdout) {
				const foundPath = result.stdout.trim();
				if (foundPath) {
					return foundPath;
				}
			}
		} catch {
			// Ignore errors from which command
		}
		
		// Fall back to the default name (will be found via PATH if available)
		return defaultName;
	}
}