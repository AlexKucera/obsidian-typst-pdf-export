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

import { PandocCommandBuilder } from './pandoc/PandocCommandBuilder';

export class PandocTypstConverter {
	private tempDir: string | null = null;
	private cleanupHandlers: (() => void)[] = [];
	private plugin: any; // Will be properly typed when we refactor the main plugin class
	private commandBuilder: PandocCommandBuilder;

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
		this.commandBuilder = new PandocCommandBuilder(plugin);
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
			
			// Add temp directory to pandocOptions for command builder
			const optionsWithTempDir = {
				...this.pandocOptions,
				tempDir: this.tempDir || undefined,
				typstSettings: this.typstSettings,
				cleanupHandlers: this.cleanupHandlers
			};
			
			// Build pandoc arguments
			const args = await this.commandBuilder.buildPandocArgs(inputPath, outputPath, optionsWithTempDir);
			
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
	async processPdfEmbeds(processedResult: any, vaultBasePath: string, tempDir: string, embedPdfFiles: boolean = true): Promise<void> {
		const { PdfToImageConverter } = require('./PdfToImageConverter');
		const converter = PdfToImageConverter.getInstance(this.plugin);
		
		for (const pdfEmbed of processedResult.metadata.pdfEmbeds) {
			try {
				
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
				
				// Convert PDF to image (always happens regardless of embedPdfFiles setting)
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
					
					// Create output based on embedPdfFiles setting
					let combinedOutput: string;
					if (embedPdfFiles) {
						// Include both image preview and PDF attachment note
						combinedOutput = [
							`![${pdfEmbed.fileName} - Page 1](${relativeImagePath})`,
							`[📎 **Download PDF:** ${pdfEmbed.fileName}](${pdfEmbed.sanitizedPath})`
						].join('\n\n');
					} else {
						// Only show image preview
						combinedOutput = `![${pdfEmbed.fileName} - Page 1](${relativeImagePath})`;
					}
					
					// Replace marker with output
					processedResult.content = processedResult.content.replace(pdfEmbed.marker, combinedOutput);
					
					
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
				const configDir = this.plugin?.app?.vault?.configDir || '.obsidian';
				const tempManager = TempDirectoryManager.create(this.pandocOptions.vaultBasePath, configDir);
				this.tempDir = tempManager.ensureTempDir('pandoc');
			} else {
				// Fallback to system temp if plugin folder not available
				this.tempDir = await fsPromises.mkdtemp(path.join(os.tmpdir(), 'obsidian-typst-'));
			}
		}
		return this.tempDir;
	}

	/**
	 * Execute pandoc process with the given arguments
	 */
	private async executePandoc(args: string[], progressCallback?: ProgressCallback): Promise<ConversionResult> {
		return new Promise((resolve) => {
			const pandocPath = this.commandBuilder.resolveExecutablePath(this.pandocOptions.pandocPath, 'pandoc');
			const timeout = this.pandocOptions.timeout || 60000;

			// Log the exact command being executed for debugging

			progressCallback?.('Starting Pandoc process...', 40);

			// Determine working directory - use vault base path if available, fallback to plugin directory
			let workingDir: string;
			
			if (this.pandocOptions.vaultBasePath) {
				workingDir = this.pandocOptions.vaultBasePath;
			} else {
				// Fallback to plugin directory
				const pluginDir = this.pandocOptions.pluginDir || process.cwd();
				workingDir = pluginDir;
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