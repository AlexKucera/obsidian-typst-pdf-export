/**
 * Pandoc to Typst PDF Converter
 * Handles the conversion of Markdown to PDF using Pandoc with Typst engine
 */

import { promises as fsPromises } from 'fs';
import * as path from 'path';
import * as os from 'os';
import { PandocOptions, TypstSettings, ConversionResult, ProgressCallback } from './converterTypes';
import type { obsidianTypstPDFExport } from '../../main';
import { TempDirectoryManager } from '../core/TempDirectoryManager';

import { PandocCommandBuilder } from './pandoc/PandocCommandBuilder';
import { PandocExecutor } from './pandoc/PandocExecutor';

export class PandocTypstConverter {
	private tempDir: string | null = null;
	private cleanupHandlers: (() => void)[] = [];
	private plugin: obsidianTypstPDFExport;
	private commandBuilder: PandocCommandBuilder;
	private pandocExecutor: PandocExecutor;

	/**
	 * Create a new PandocTypstConverter instance
	 * @param plugin The main plugin instance for accessing settings
	 * @param pandocOptions Configuration options for Pandoc
	 * @param typstSettings Settings specific to Typst engine
	 */
	constructor(
		plugin: obsidianTypstPDFExport,
		private pandocOptions: PandocOptions = {},
		private typstSettings: TypstSettings = {}
	) {
		this.plugin = plugin;
		this.commandBuilder = new PandocCommandBuilder(plugin);
		this.pandocExecutor = new PandocExecutor(plugin);
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
			const result = await this.pandocExecutor.executePandoc(args, this.pandocOptions, progressCallback);
			
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
				const tempManager = TempDirectoryManager.create(this.pandocOptions.vaultBasePath, configDir, undefined, this.plugin?.app);
				this.tempDir = await tempManager.ensureTempDir('pandoc');
			} else {
				// Fallback to system temp if plugin folder not available
				this.tempDir = await fsPromises.mkdtemp(path.join(os.tmpdir(), 'obsidian-typst-'));
			}
		}
		return this.tempDir;
	}


	/**
	 * Dispose of the converter and clean up resources
	 */
	async dispose(): Promise<void> {
		await this.cleanup();
	}
}