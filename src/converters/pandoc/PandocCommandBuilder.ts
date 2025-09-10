/**
 * Pandoc Command Builder
 * Handles construction of Pandoc command-line arguments for Typst PDF conversion
 */

import * as path from 'path';
import { PandocOptions } from '../converterTypes';
import { TypstVariableMapper } from './TypstVariableMapper';
import { ResourcePathResolver } from './ResourcePathResolver';
import { PathResolver } from '../../plugin/PathResolver';

export class PandocCommandBuilder {
	private plugin: any;
	private variableMapper: TypstVariableMapper;
	private resourcePathResolver: ResourcePathResolver;
	private pathResolver: PathResolver;

	constructor(plugin: any) {
		this.plugin = plugin;
		this.variableMapper = new TypstVariableMapper(plugin);
		this.resourcePathResolver = new ResourcePathResolver();
		this.pathResolver = new PathResolver(plugin);
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
		const typstPath = this.pathResolver.resolveExecutablePath(pandocOptions.typstPath, 'typst');
		args.push(`--pdf-engine=${typstPath}`);

		// Enable standalone mode (required for PDF output)
		args.push('--standalone');

		// Embed resources (images, etc.) directly into the output
		args.push('--embed-resources');

		// Add resource paths for attachment resolution
		await this.addResourcePaths(args, pandocOptions);

		// Handle template configuration
		await this.addTemplateConfiguration(args, pandocOptions);

		// Add all variables using the variable mapper
		this.addTypstVariables(args, pandocOptions);

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

		// Get all resource paths from the resolver
		const resourcePaths = await this.resourcePathResolver.getResourcePaths(pandocOptions.vaultBasePath);
		
		// Add each path to the pandoc arguments
		for (const resourcePath of resourcePaths) {
			args.push('--resource-path', resourcePath);
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
	 * Add all Typst variables using the variable mapper
	 */
	private addTypstVariables(args: string[], pandocOptions: PandocOptions): void {
		// Map all variables (ExportConfig + plugin settings fallbacks) using the variable mapper
		const typstVariables = this.variableMapper.mapAllVariablesToTypst(pandocOptions);
		
		// Convert to pandoc arguments and add to args
		const variableArgs = this.variableMapper.convertVariablesToPandocArgs(typstVariables);
		args.push(...variableArgs);
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

}