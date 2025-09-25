/**
 * Pandoc Command Builder
 * Handles construction of Pandoc command-line arguments for Typst PDF conversion
 */

import * as path from 'path';
import { PandocOptions } from '../converterTypes';
import { TypstVariableMapper } from './TypstVariableMapper';
import { ResourcePathResolver } from './ResourcePathResolver';
import { PathResolver } from '../../plugin/PathResolver';
import type { obsidianTypstPDFExport } from '../../../main';
import { PathUtils } from '../../core/PathUtils';

export class PandocCommandBuilder {
	private plugin: obsidianTypstPDFExport;
	private variableMapper: TypstVariableMapper;
	private resourcePathResolver: ResourcePathResolver;
	private pathResolver: PathResolver;

	constructor(plugin: obsidianTypstPDFExport) {
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

		// Add enhanced Typst diagnostics for better error reporting
		this.addTypstDiagnostics(args, pandocOptions);

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
			const pathUtils = new PathUtils(this.plugin.app);
			const absolutePluginDir = pandocOptions.pluginDir || '';
			const wrapperPath = pathUtils.joinPath(absolutePluginDir, 'templates', 'universal-wrapper.pandoc.typ');

			// Verify wrapper exists
			if (!(await pathUtils.fileExists(wrapperPath))) {
				throw new Error(`Universal wrapper template not found at: ${wrapperPath}`);
			}

			args.push('--template', wrapperPath);

			// Add plugin templates directory as a resource path so Typst can find template files
			const templatesDir = pathUtils.joinPath(absolutePluginDir, 'templates');
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
	 * Add enhanced Typst diagnostics for better error reporting
	 */
	private addTypstDiagnostics(args: string[], pandocOptions: PandocOptions): void {
		// Add Typst diagnostic options for better error reporting
		args.push('--pdf-engine-opt', '--diagnostic-format=short');
	}

}