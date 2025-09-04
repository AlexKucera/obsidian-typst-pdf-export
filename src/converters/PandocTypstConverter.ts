/**
 * Pandoc to Typst PDF Converter
 * Handles the conversion of Markdown to PDF using Pandoc with Typst engine
 */

import { spawn, ChildProcess } from 'child_process';
import * as fs from 'fs';
import { promises as fsPromises } from 'fs';
import * as path from 'path';
import * as os from 'os';
import { mapToTypstPaperSize } from '../utils/paperSizeMapper';
import { PandocOptions, TypstSettings, ConversionResult, ProgressCallback } from './converterTypes';
import type { obsidianTypstPDFExportSettings } from '../core/settings';
import { TempDirectoryManager } from '../core/TempDirectoryManager';

export class PandocTypstConverter {
	private tempDir: string | null = null;
	private cleanupHandlers: (() => void)[] = [];
	private plugin: any; // Will be properly typed when we refactor the main plugin class
	
	// Cache for directory scanning optimization
	private resourcePathCache: string[] = [];
	private resourcePathCacheTimestamp: number = 0;
	private resourcePathCacheVaultPath: string = '';
	private readonly CACHE_EXPIRY_MS = 5 * 60 * 1000; // 5 minutes

	/**
	 * Create a new PandocTypstConverter instance
	 * @param plugin The main plugin instance for accessing settings
	 * @param pandocOptions Configuration options for Pandoc
	 * @param typstSettings Settings specific to Typst engine
	 */
	constructor(
		plugin: any,
		private pandocOptions: PandocOptions = {},
		private typstSettings: TypstSettings = {}
	) {
		this.plugin = plugin;
		// Set up cleanup handlers for process termination
		this.setupCleanup();
	}

	/**
	 * Convert a markdown file to PDF using Pandoc with Typst engine
	 * @param inputPath Path to the input markdown file
	 * @param outputPath Path where the PDF should be saved
	 * @param progressCallback Optional callback for progress updates
	 * @returns Promise resolving to conversion result
	 */
	async convertToPDF(
		inputPath: string, 
		outputPath: string, 
		progressCallback?: ProgressCallback
	): Promise<ConversionResult> {
		try {
			progressCallback?.('Starting PDF conversion...', 0);

			// Create temporary directory if needed
			await this.ensureTempDirectory();
			
			// Build pandoc arguments
			const args = await this.buildPandocArgs(inputPath, outputPath);
			
			progressCallback?.('Executing Pandoc with Typst engine...', 30);
			
			// Execute pandoc process
			const result = await this.executePandoc(args, progressCallback);
			
			// Add the output path to the result if successful
			if (result.success) {
				result.outputPath = outputPath;
			}
			
			progressCallback?.('Conversion complete!', 100);
			
			return result;
			
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			return {
				success: false,
				error: `Conversion failed: ${errorMessage}`
			};
		}
	}

	/**
	 * Convert markdown content to PDF
	 */
	async convertMarkdownToPDF(
		content: string,
		outputPath: string,
		options: Partial<PandocOptions> = {},
		progressCallback?: ProgressCallback
	): Promise<ConversionResult> {
		try {
			progressCallback?.('Preparing markdown content...', 10);
			
			// Create temporary markdown file
			await this.ensureTempDirectory();
			const tempInputPath = path.join(this.tempDir!, `temp-${Date.now()}.md`);
			await fsPromises.writeFile(tempInputPath, content, 'utf-8');
			
			// Merge options
			this.pandocOptions = { ...this.pandocOptions, ...options };
			
			// Convert using the file-based method
			const result = await this.convertToPDF(tempInputPath, outputPath, progressCallback);
			
			// Cleanup temp file
			try {
				await fsPromises.unlink(tempInputPath);
			} catch (error) {
				console.warn('Failed to cleanup temp file:', error);
			}
			
			return result;
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			return {
				success: false,
				error: `Conversion failed: ${errorMessage}`
			};
		}
	}

	/**
	 * Set up cleanup handlers for temporary files
	 */
	private setupCleanup(): void {
		const cleanup = () => {
			this.cleanup();
		};

		process.on('exit', cleanup);
		process.on('SIGINT', cleanup);
		process.on('SIGTERM', cleanup);
		process.on('uncaughtException', cleanup);
	}

	/**
	 * Process PDF embeds by converting them to images and creating combined output
	 */
	async processPdfEmbeds(processedResult: any, vaultBasePath: string, tempDir: string): Promise<void> {
		const { PdfToImageConverter } = require('./PdfToImageConverter');
		const converter = PdfToImageConverter.getInstance(this.plugin);
		
		for (const pdfEmbed of processedResult.metadata.pdfEmbeds) {
			try {
				console.log(`Export: Processing PDF embed: ${pdfEmbed.originalPath}`);
				
				// Resolve full path to the PDF
				const fullPdfPath = path.resolve(vaultBasePath, pdfEmbed.sanitizedPath);
				
				// Check if PDF file exists
				const fs = require('fs');
				if (!fs.existsSync(fullPdfPath)) {
					console.warn(`Export: PDF file not found: ${fullPdfPath}`);
					// Replace marker with error message
					processedResult.content = processedResult.content.replace(
						pdfEmbed.marker,
						`[⚠️ PDF not found: ${pdfEmbed.fileName}](${pdfEmbed.sanitizedPath})`
					);
					continue;
				}
				
				// Convert PDF to image
				const conversionResult = await converter.convertFirstPageToImage(
					fullPdfPath,
					tempDir,
					{
						scale: 1.5,
						maxWidth: 600,
						maxHeight: 400,
						format: 'png'
					}
				);
				
				if (conversionResult.success) {
					// Get relative path for the generated image
					const relativeImagePath = path.relative(vaultBasePath, conversionResult.imagePath);
					
					// Create combined output: image preview + PDF attachment link
					const combinedOutput = [
						`![${pdfEmbed.fileName} - Page 1](${relativeImagePath})`,
						`[📎 **Download PDF:** ${pdfEmbed.fileName}](${pdfEmbed.sanitizedPath})`
					].join('\n\n');
					
					// Replace marker with combined output
					processedResult.content = processedResult.content.replace(pdfEmbed.marker, combinedOutput);
					
					console.log(`Export: Successfully converted PDF: ${pdfEmbed.fileName} -> ${path.basename(conversionResult.imagePath)}`);
					
				} else {
					console.error(`Export: PDF conversion failed: ${conversionResult.error}`);
					
					// Replace marker with fallback link
					processedResult.content = processedResult.content.replace(
						pdfEmbed.marker,
						`[📖 ${pdfEmbed.fileName}](${pdfEmbed.sanitizedPath})\n\n*Note: PDF preview could not be generated*`
					);
				}
				
			} catch (error: any) {
				console.error(`Export: Error processing PDF embed: ${error.message}`);
				
				// Replace marker with error fallback
				processedResult.content = processedResult.content.replace(
					pdfEmbed.marker,
					`[⚠️ ${pdfEmbed.fileName}](${pdfEmbed.sanitizedPath})\n\n*Error: Could not process PDF embed*`
				);
			}
		}
	}

	/**
	 * Clean up temporary files and directories
	 */
	private async cleanup(): Promise<void> {
		try {
			// Execute registered cleanup handlers
			this.cleanupHandlers.forEach(handler => {
				try {
					handler();
				} catch (error) {
					console.warn('Cleanup handler failed:', error);
				}
			});

			// Remove temporary directory
			if (this.tempDir) {
				await fsPromises.rmdir(this.tempDir, { recursive: true });
				this.tempDir = null;
			}
		} catch (error) {
			console.warn('Cleanup failed:', error);
		}
	}

	/**
	 * Ensure temporary directory exists
	 */
	private async ensureTempDirectory(): Promise<string> {
		if (!this.tempDir) {
			if (this.pandocOptions.vaultBasePath) {
				// Use TempDirectoryManager for plugin temp directories
				const tempManager = TempDirectoryManager.create(this.pandocOptions.vaultBasePath);
				this.tempDir = tempManager.ensureTempDir('pandoc');
			} else {
				// Fallback to system temp if plugin folder not available
				this.tempDir = await fsPromises.mkdtemp(path.join(os.tmpdir(), 'obsidian-typst-'));
			}
		}
		return this.tempDir;
	}

	/**
	 * Build pandoc command-line arguments
	 */
	private async buildPandocArgs(inputPath: string, outputPath: string): Promise<string[]> {
	const args: string[] = [];

	// Input file
	args.push(inputPath);

	// Output file
	args.push('-o', outputPath);

	// Specify input format as markdown with smart extension disabled
	args.push('--from', 'markdown-smart');

	// Set PDF engine to Typst (use configured path if available)
	if (this.pandocOptions.typstPath) {
		args.push(`--pdf-engine=${this.pandocOptions.typstPath}`);
	} else {
		args.push('--pdf-engine=typst');
	}

	// Enable standalone mode (required for PDF output)
	args.push('--standalone');

	// Embed resources (images, etc.) directly into the output
	args.push('--embed-resources');

	// Add resource paths for attachment resolution
	if (this.pandocOptions.vaultBasePath) {
		const fs = require('fs');
		
		// Add vault root as primary resource path
		args.push('--resource-path', this.pandocOptions.vaultBasePath);
		
		// Add common attachment directories as additional resource paths
		const commonAttachmentPaths = [
			path.join(this.pandocOptions.vaultBasePath, 'attachments'),
			path.join(this.pandocOptions.vaultBasePath, 'assets'),
			path.join(this.pandocOptions.vaultBasePath, 'files'),
			path.join(this.pandocOptions.vaultBasePath, 'images'),
			path.join(this.pandocOptions.vaultBasePath, '.attachments')
		];
		
		// Check if these directories exist and add them
		for (const attachPath of commonAttachmentPaths) {
			if (fs.existsSync(attachPath)) {
				args.push('--resource-path', attachPath);
				console.log('Added resource path:', attachPath);
			}
		}
		
		// Also scan for note-specific attachment folders (Obsidian often creates these)
		// Use cache to avoid scanning entire vault on every export
		const now = Date.now();
		const cacheIsValid = this.resourcePathCacheVaultPath === this.pandocOptions.vaultBasePath &&
			(now - this.resourcePathCacheTimestamp) < this.CACHE_EXPIRY_MS &&
			this.resourcePathCache.length > 0;
			
		if (cacheIsValid) {
			// Use cached resource paths
			for (const cachedPath of this.resourcePathCache) {
				args.push('--resource-path', cachedPath);
				console.log('Added cached resource path:', cachedPath);
			}
		} else {
			// Cache is invalid or expired, perform fresh scan
			const foundResourcePaths: string[] = [];
			
			try {
				const vaultContents = fs.readdirSync(this.pandocOptions.vaultBasePath);
				for (const item of vaultContents) {
					const itemPath = path.join(this.pandocOptions.vaultBasePath, item);
					
					let stat;
					try {
						stat = await fsPromises.stat(itemPath);
					} catch (error) {
						// File might have been deleted between readdirSync and statSync
						console.warn(`Export: Unable to stat ${itemPath}:`, error.message);
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
								console.log('Added note-specific resource path:', itemPath);
							}
						} catch (e) {
							// Ignore directories we can't read
						}
					}
				}
				
				// Update cache with fresh results
				this.resourcePathCache = foundResourcePaths;
				this.resourcePathCacheTimestamp = now;
				this.resourcePathCacheVaultPath = this.pandocOptions.vaultBasePath;
				console.log(`Export: Cached ${foundResourcePaths.length} resource paths for future use`);
			} catch (e) {
				console.warn('Could not scan vault for attachment directories:', e);
			}
		}
	}

	// Use universal wrapper with --template and pass actual template as template_path variable
	if (this.pandocOptions.template) {
		// Get absolute path to universal wrapper using plugin directory from pandocOptions
		const fs = require('fs');
		const absolutePluginDir = this.pandocOptions.pluginDir || '';
		const wrapperPath = path.resolve(absolutePluginDir, 'templates', 'universal-wrapper.pandoc.typ');
		console.log('Universal wrapper path:', wrapperPath);
		
		// Verify wrapper exists
		if (!fs.existsSync(wrapperPath)) {
			throw new Error(`Universal wrapper template not found at: ${wrapperPath}`);
		}
		
		args.push('--template', wrapperPath);
		
		// Pass the actual template path as a variable
		// Make the path relative to the vault (working directory) for Typst
		let templatePathForTypst = this.pandocOptions.template;
		if (this.pandocOptions.vaultBasePath && path.isAbsolute(templatePathForTypst)) {
			// If template path is absolute and inside vault, make it relative
			if (templatePathForTypst.startsWith(this.pandocOptions.vaultBasePath)) {
				templatePathForTypst = path.relative(this.pandocOptions.vaultBasePath, templatePathForTypst);
			}
		}
		args.push('-V', `template_path=${templatePathForTypst}`);
	}

	// Add variables from the ExportConfig (these take priority)
	// These come from the modal and include all the new template variables
	if (this.pandocOptions.variables) {
		for (const [key, value] of Object.entries(this.pandocOptions.variables)) {
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

	// Add fallback typography and page setup from plugin settings
	// Only add these if not already provided by ExportConfig variables
	if (this.plugin && this.plugin.settings) {
		const settings: obsidianTypstPDFExportSettings = this.plugin.settings;
		const existingVars = this.pandocOptions.variables || {};
		
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

	// Add Typst engine options
	if (this.typstSettings.engineOptions) {
		for (const option of this.typstSettings.engineOptions) {
			args.push('--pdf-engine-opt', option);
		}
	}

	// Generate intermediate Typst file if requested
	if (this.pandocOptions.generateIntermediateTypst) {
		const tempDir = await this.ensureTempDirectory();
		const typstPath = path.join(tempDir, 'intermediate.typ');
		args.push('--output', typstPath);
		
		// Also create a copy to keep for debugging
		const debugTypstPath = path.join(tempDir, 'debug.typ');
		this.cleanupHandlers.push(() => {
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

	// Add working directory for relative paths
	if (this.pandocOptions.vaultBasePath) {
		process.chdir(this.pandocOptions.vaultBasePath);
	}

	return args;
}

	/**
	 * Execute pandoc process with the given arguments
	 */
	private async executePandoc(args: string[], progressCallback?: ProgressCallback): Promise<ConversionResult> {
		return new Promise((resolve) => {
			const pandocPath = this.pandocOptions.pandocPath || 'pandoc';
			const timeout = this.pandocOptions.timeout || 60000;

			// Log the exact command being executed for debugging
			console.log('Executing Pandoc command:', pandocPath, args.join(' '));

			progressCallback?.('Starting Pandoc process...', 40);

			// Determine working directory - use vault base path if available, fallback to plugin directory
			let workingDir: string;
			
			if (this.pandocOptions.vaultBasePath) {
				workingDir = this.pandocOptions.vaultBasePath;
				console.log('Pandoc working directory (vault):', workingDir);
			} else {
				// Fallback to plugin directory
				const pluginDir = this.pandocOptions.pluginDir || process.cwd();
				workingDir = pluginDir;
				console.log('Pandoc working directory (plugin fallback):', workingDir);
			}
			
			// Augment PATH to include common binary locations
			const augmentedEnv = {
				...process.env,
				PATH: `/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:${process.env.PATH || ''}`
			};
			
			// Spawn pandoc process with vault as working directory for attachment resolution
			const pandocProcess: ChildProcess = spawn(pandocPath, args, {
				stdio: ['pipe', 'pipe', 'pipe'],
				cwd: workingDir,
				env: augmentedEnv, // Use augmented environment
			});

			let stdout = '';
			let stderr = '';
			let hasTimedOut = false;

			// Set up timeout
			const timeoutHandle = setTimeout(() => {
				hasTimedOut = true;
				pandocProcess.kill('SIGTERM');
				resolve({
					success: false,
					error: `Pandoc process timed out after ${timeout}ms`,
					exitCode: -1
				});
			}, timeout);

			// Collect stdout
			pandocProcess.stdout?.on('data', (data: Buffer) => {
				stdout += data.toString();
				progressCallback?.('Processing document...', 60);
			});

			// Collect stderr and monitor for progress
			pandocProcess.stderr?.on('data', (data: Buffer) => {
				const output = data.toString();
				stderr += output;
				console.log('Pandoc stderr:', output);
				
				// Parse progress information from stderr if available
				this.parseProgressFromOutput(output, progressCallback);
			});

			// Handle process completion
			pandocProcess.on('close', (code: number | null) => {
				clearTimeout(timeoutHandle);
				
				if (hasTimedOut) {
					return; // Already resolved with timeout error
				}

				const success = code === 0;
				const result: ConversionResult = {
					success,
					stdout,
					stderr,
					exitCode: code || -1
				};

				if (!success) {
					result.error = this.extractErrorMessage(stderr, stdout);
				} else {
					progressCallback?.('PDF generation complete!', 90);
				}

				resolve(result);
			});

			// Handle process errors
			pandocProcess.on('error', (error: Error) => {
				clearTimeout(timeoutHandle);
				console.log('Pandoc process error:', error);
				resolve({
					success: false,
					error: `Failed to start Pandoc process: ${error.message}`,
					exitCode: -1
				});
			});
		});
	}

	/**
	 * Parse progress information from pandoc output
	 */
	private parseProgressFromOutput(output: string, progressCallback?: ProgressCallback): void {
		// Look for common progress indicators in pandoc/typst output
		if (output.includes('reading')) {
			progressCallback?.('Reading input file...', 50);
		} else if (output.includes('parsing')) {
			progressCallback?.('Parsing document...', 55);
		} else if (output.includes('typst')) {
			progressCallback?.('Generating PDF with Typst...', 70);
		} else if (output.includes('writing')) {
			progressCallback?.('Writing output file...', 80);
		}
	}

	/**
	 * Extract meaningful error messages from pandoc output
	 */
	private extractErrorMessage(stderr: string, stdout: string): string {
		// Look for common error patterns
		const errorPatterns = [
			/error:/i,
			/Error:/,
			/failed/i,
			/Fatal/i,
			/pandoc:/i
		];

		const allOutput = (stderr + '\n' + stdout).split('\n');
		
		for (const line of allOutput) {
			for (const pattern of errorPatterns) {
				if (pattern.test(line)) {
					return line.trim();
				}
			}
		}

		// If no specific error found, return first non-empty line from stderr
		const stderrLines = stderr.split('\n').filter(line => line.trim().length > 0);
		if (stderrLines.length > 0) {
			return stderrLines[0];
		}

		return 'Unknown error occurred during conversion';
	}

	/**
	 * Dispose of the converter and clean up resources
	 */
	async dispose(): Promise<void> {
		await this.cleanup();
	}
}