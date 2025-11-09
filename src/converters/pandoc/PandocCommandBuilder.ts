/**
 * Command-line argument builder for Pandoc-to-Typst PDF conversion.
 *
 * This module constructs complete Pandoc command-line arguments for converting
 * preprocessed Markdown to Typst format, which is then compiled to PDF by the
 * Typst engine. It orchestrates several key aspects of the conversion:
 * - Input/output path specification
 * - Typst PDF engine configuration
 * - Template loading and variable passing
 * - Resource path resolution for embedded media
 * - Diagnostic and error reporting options
 *
 * Key Features:
 * - Modular argument construction via specialized methods
 * - Template system with universal wrapper for dynamic template selection
 * - Comprehensive variable mapping from export config to Typst variables
 * - Smart resource path resolution for Obsidian attachments
 * - Enhanced diagnostics for debugging conversion failures
 * - Safe path handling with automatic quoting via spawn
 *
 * Architecture:
 * The builder delegates to specialized components:
 * - **TypstVariableMapper**: Maps export config to Typst variables
 * - **ResourcePathResolver**: Finds attachment directories in vault
 * - **PathResolver**: Resolves executable paths with fallback logic
 * - **PathUtils**: Obsidian vault file system operations
 *
 * Command Structure:
 * ```bash
 * pandoc input.md \
 *   -o output.pdf \
 *   --from markdown-smart \
 *   --pdf-engine=typst \
 *   --standalone \
 *   --no-citeproc \
 *   --embed-resources \
 *   --resource-path /vault/attachments \
 *   --template universal-wrapper.typ \
 *   -V template_path=default.typ \
 *   -V page_width=210mm \
 *   ... (more variables)
 *   --pdf-engine-opt --diagnostic-format=short
 * ```
 *
 * The universal wrapper template receives the actual template path as a variable,
 * allowing dynamic template selection without requiring separate wrapper files
 * for each template.
 */

import * as path from 'path';
import { PandocOptions } from '../converterTypes';
import { TypstVariableMapper } from './TypstVariableMapper';
import { ResourcePathResolver } from './ResourcePathResolver';
import { PathResolver } from '../../plugin/PathResolver';
import type { obsidianTypstPDFExport } from '../../../main';
import { PathUtils } from '../../core/PathUtils';

/**
 * Builder for Pandoc command-line arguments in the Markdown → Typst → PDF pipeline.
 *
 * This class encapsulates the complex logic for constructing Pandoc command arguments
 * that correctly configure Typst PDF generation. It manages several interdependent
 * concerns including template loading, variable mapping, resource path resolution,
 * and diagnostic configuration.
 *
 * Design Philosophy:
 * - Single responsibility: Only builds command arguments, doesn't execute
 * - Modular construction: Each argument category handled by dedicated method
 * - Dependency injection: Receives plugin reference for configuration access
 * - Async-safe: Handles file system checks without blocking
 *
 * The builder pattern allows testing argument construction independently from
 * command execution, and makes it easy to modify argument logic without touching
 * the execution layer.
 *
 * @example
 * ```typescript
 * const builder = new PandocCommandBuilder(this.plugin);
 *
 * const args = await builder.buildPandocArgs(
 *   '/vault/note.md',
 *   '/vault/exports/note.pdf',
 *   {
 *     template: 'default',
 *     vaultBasePath: '/vault',
 *     pluginDir: '/vault/.obsidian/plugins/typst-pdf-export',
 *     typstPath: 'typst',
 *     exportConfig: { pageSize: 'a4', orientation: 'portrait' }
 *   }
 * );
 *
 * // Execute with spawn
 * spawn('pandoc', args);
 * ```
 */
export class PandocCommandBuilder {
	private plugin: obsidianTypstPDFExport;
	private variableMapper: TypstVariableMapper;
	private resourcePathResolver: ResourcePathResolver;
	private pathResolver: PathResolver;

	/**
	 * Creates a new PandocCommandBuilder.
	 *
	 * Initializes all dependent components (variable mapper, resource path resolver,
	 * path resolver) that the builder needs to construct complete command arguments.
	 *
	 * @param plugin - Plugin instance for accessing configuration and vault operations
	 */
	constructor(plugin: obsidianTypstPDFExport) {
		this.plugin = plugin;
		this.variableMapper = new TypstVariableMapper(plugin);
		this.resourcePathResolver = new ResourcePathResolver(plugin);
		this.pathResolver = new PathResolver(plugin);
	}

	/**
	 * Builds complete Pandoc command-line arguments for Typst PDF generation.
	 *
	 * This is the primary interface method that orchestrates all argument construction.
	 * It delegates to specialized private methods for each category of arguments,
	 * ensuring proper ordering and completeness.
	 *
	 * Argument Order (important for Pandoc):
	 * 1. Input file path
	 * 2. Output file specification (-o)
	 * 3. Input format (--from markdown-smart)
	 * 4. PDF engine configuration (--pdf-engine=typst)
	 * 5. Standalone mode (--standalone)
	 * 6. Citation processing (--no-citeproc)
	 * 7. Resource embedding (--embed-resources)
	 * 8. Resource paths (--resource-path, multiple)
	 * 9. Template configuration (--template, -V template_path)
	 * 10. Typst variables (-V key=value, multiple)
	 * 11. Engine options (--pdf-engine-opt, multiple)
	 * 12. Diagnostics (--pdf-engine-opt --diagnostic-format=short)
	 *
	 * Side Effects:
	 * - Changes process.cwd() if vaultBasePath is provided
	 * - Reads file system to verify template existence
	 * - May throw Error if universal wrapper template not found
	 *
	 * @param inputPath - Absolute path to preprocessed Markdown input file
	 * @param outputPath - Absolute path for generated PDF output file
	 * @param pandocOptions - Configuration for Pandoc execution and Typst variables
	 * @returns Promise resolving to array of command-line arguments for Pandoc
	 *
	 * @throws {Error} If universal wrapper template not found
	 *
	 * @example
	 * ```typescript
	 * // Basic usage
	 * const builder = new PandocCommandBuilder(this.plugin);
	 * const args = await builder.buildPandocArgs(
	 *   '/vault/preprocessed.md',
	 *   '/vault/output.pdf',
	 *   {
	 *     template: 'modern',
	 *     vaultBasePath: '/vault',
	 *     typstPath: '/usr/local/bin/typst',
	 *     exportConfig: {
	 *       pageSize: 'letter',
	 *       margins: { top: '1in', bottom: '1in' }
	 *     }
	 *   }
	 * );
	 * console.log('Pandoc args:', args.join(' '));
	 * ```
	 *
	 * @example
	 * ```typescript
	 * // With custom engine options
	 * const args = await builder.buildPandocArgs(
	 *   inputPath,
	 *   outputPath,
	 *   {
	 *     template: 'article',
	 *     typstSettings: {
	 *       engineOptions: ['--root', '/custom/root', '--font-path', '/fonts']
	 *     }
	 *   }
	 * );
	 * ```
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
	 * Adds resource paths to command arguments for Obsidian attachment resolution.
	 *
	 * This method enables Pandoc to find embedded images, PDFs, and other attachments
	 * referenced in the markdown content. It uses ResourcePathResolver to discover all
	 * attachment directories in the vault and adds them via --resource-path flags.
	 *
	 * Multiple --resource-path arguments can be provided, and Pandoc searches them in
	 * order when resolving relative paths in the markdown. This allows attachments to
	 * be stored in various locations (root-level, nested folders, etc.) and still be
	 * found during conversion.
	 *
	 * @param args - Command arguments array to append to
	 * @param pandocOptions - Options including vaultBasePath for resource discovery
	 * @private
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
	 * Adds template configuration using the universal wrapper pattern.
	 *
	 * This method implements the plugin's template system using a universal wrapper
	 * template that dynamically loads the actual template via a Typst import. This
	 * approach allows template selection at runtime without maintaining separate
	 * wrapper files for each template.
	 *
	 * Template Resolution:
	 * 1. Locate universal-wrapper.pandoc.typ in plugin templates directory
	 * 2. Verify wrapper exists (throws if missing)
	 * 3. Add wrapper as Pandoc --template
	 * 4. Add templates directory to resource paths (enables Typst imports)
	 * 5. Pass actual template path as template_path variable
	 *
	 * Path Handling:
	 * - Absolute template paths are made relative to vault root for Typst imports
	 * - Relative paths are passed through unchanged
	 * - spawn automatically handles path quoting for spaces
	 *
	 * @param args - Command arguments array to append to
	 * @param pandocOptions - Options including template path and plugin directory
	 * @throws {Error} If universal wrapper template not found
	 * @private
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
			// Path quoting handled automatically by spawn
			args.push('--resource-path', templatesDir);
			
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
	 * Adds all Typst template variables mapped from export configuration.
	 *
	 * This method delegates to TypstVariableMapper to transform the export configuration
	 * into Typst template variables. These variables control typography, layout, margins,
	 * and other formatting aspects of the final PDF.
	 *
	 * Variable Mapping:
	 * - ExportConfig fields → Typst variable names (e.g., pageSize → page_size)
	 * - Plugin settings provide fallback values for missing config fields
	 * - Values converted to Typst-compatible formats (e.g., "2.5cm" for margins)
	 * - Variables passed via -V key=value arguments to Pandoc
	 *
	 * Example Variables:
	 * - page_width, page_height: Page dimensions
	 * - margin_top, margin_bottom, margin_left, margin_right: Margins
	 * - body_font, heading_font, monospace_font: Typography
	 * - font_size: Base font size
	 *
	 * @param args - Command arguments array to append to
	 * @param pandocOptions - Options including exportConfig and plugin settings
	 * @private
	 */
	private addTypstVariables(args: string[], pandocOptions: PandocOptions): void {
		// Map all variables (ExportConfig + plugin settings fallbacks) using the variable mapper
		const typstVariables = this.variableMapper.mapAllVariablesToTypst(pandocOptions);

		// Convert to pandoc arguments and add to args
		const variableArgs = this.variableMapper.convertVariablesToPandocArgs(typstVariables);
		args.push(...variableArgs);
	}

	/**
	 * Adds custom Typst engine options for advanced configuration.
	 *
	 * This method passes additional command-line options directly to the Typst engine
	 * via Pandoc's --pdf-engine-opt flag. These options can override Typst's default
	 * behavior for specific use cases.
	 *
	 * Common Engine Options:
	 * - --root /path: Set Typst root directory for imports
	 * - --font-path /fonts: Add custom font directories
	 * - --input key=value: Pass additional variables to Typst
	 *
	 * @param args - Command arguments array to append to
	 * @param pandocOptions - Options including typstSettings.engineOptions
	 * @private
	 */
	private addTypstEngineOptions(args: string[], pandocOptions: PandocOptions): void {
		if (pandocOptions.typstSettings?.engineOptions) {
			for (const option of pandocOptions.typstSettings.engineOptions) {
				args.push('--pdf-engine-opt', option);
			}
		}
	}

	/**
	 * Adds Typst diagnostic configuration for enhanced error reporting.
	 *
	 * This method enables short-format diagnostics in Typst, which provide cleaner
	 * and more readable error messages when compilation fails. The short format is
	 * easier to parse and present to users compared to the verbose default format.
	 *
	 * Diagnostic Format:
	 * - Short: Concise error messages with file:line:column locations
	 * - Default (verbose): Detailed multi-line error reports with context
	 *
	 * @param args - Command arguments array to append to
	 * @param pandocOptions - Pandoc options (currently unused but kept for consistency)
	 * @private
	 */
	private addTypstDiagnostics(args: string[], pandocOptions: PandocOptions): void {
		// Add Typst diagnostic options for better error reporting
		args.push('--pdf-engine-opt', '--diagnostic-format=short');
	}

}