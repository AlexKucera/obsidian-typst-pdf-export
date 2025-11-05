/**
 * Pandoc to Typst PDF Converter.
 *
 * This module provides the main conversion engine for transforming Markdown files
 * to PDF documents using the Pandoc → Typst → PDF pipeline. It coordinates all
 * aspects of the conversion process including:
 * - Temporary file and directory management
 * - Command building and execution
 * - Progress reporting
 * - Resource cleanup
 * - Error handling
 *
 * The converter supports both file-based and content-based conversions, automatically
 * managing temporary directories and cleanup on process termination.
 */

import { PandocOptions, TypstSettings, ConversionResult, ProgressCallback } from './converterTypes';
import type { obsidianTypstPDFExport } from '../../main';
import { TempDirectoryManager } from '../core/TempDirectoryManager';
import { PathUtils } from '../core/PathUtils';
import { promises as fs } from 'fs';

import { PandocCommandBuilder } from './pandoc/PandocCommandBuilder';
import { PandocExecutor } from './pandoc/PandocExecutor';

/**
 * Main converter class for Markdown → Typst → PDF conversion.
 *
 * This class orchestrates the PDF export process by delegating to specialized
 * components (PandocCommandBuilder, PandocExecutor) while managing temporary
 * resources and providing progress feedback.
 *
 * Key features:
 * - File and content-based conversion support
 * - Automatic temporary directory management
 * - Process cleanup on termination (exit, SIGINT, SIGTERM, exceptions)
 * - Progress callback support for UI updates
 * - Configurable Pandoc and Typst settings
 *
 * Lifecycle:
 * 1. Constructor initializes command builder and executor
 * 2. Conversion methods create temp directories and build commands
 * 3. Executor runs Pandoc with Typst engine
 * 4. Cleanup automatically removes temporary files
 * 5. dispose() for manual cleanup when done
 *
 * @example
 * ```typescript
 * const converter = new PandocTypstConverter(
 *   plugin,
 *   { template: 'modern', variables: { ... } },
 *   { ppi: 144 }
 * );
 *
 * try {
 *   const result = await converter.convertToPDF(
 *     'input.md',
 *     'output.pdf',
 *     (message, progress) => console.log(`${progress}%: ${message}`)
 *   );
 *
 *   if (result.success) {
 *     console.log('PDF created:', result.outputPath);
 *   } else {
 *     console.error('Conversion failed:', result.error);
 *   }
 * } finally {
 *   await converter.dispose();
 * }
 * ```
 */
export class PandocTypstConverter {
	private tempDir: string | null = null;
	private cleanupHandlers: (() => void)[] = [];
	private plugin: obsidianTypstPDFExport;
	private commandBuilder: PandocCommandBuilder;
	private pandocExecutor: PandocExecutor;
	private processCleanupHandler: (() => void) | null = null;
	private isDisposed = false;

	/**
	 * Creates a new PandocTypstConverter instance with configuration.
	 *
	 * Initializes the converter with the plugin instance and configuration options
	 * for both Pandoc and Typst. Sets up cleanup handlers to ensure temporary
	 * files are removed on process termination.
	 *
	 * @param plugin - The main plugin instance for accessing app and settings
	 * @param pandocOptions - Configuration options for Pandoc conversion (template, variables, etc.)
	 * @param typstSettings - Settings specific to Typst rendering engine (ppi, font-paths, etc.)
	 *
	 * @example
	 * ```typescript
	 * const converter = new PandocTypstConverter(
	 *   this.plugin,
	 *   {
	 *     template: 'modern',
	 *     variables: {
	 *       pageSize: 'a4',
	 *       bodyFont: 'Georgia'
	 *     },
	 *     metadata: { title: 'My Document' }
	 *   },
	 *   {
	 *     ppi: 144,
	 *     fontPaths: ['/usr/share/fonts']
	 *   }
	 * );
	 * ```
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
	 * Converts a Markdown file to PDF using the Pandoc → Typst → PDF pipeline.
	 *
	 * This is the primary conversion method that handles the complete export process:
	 * 1. Creates temporary directory for intermediate files
	 * 2. Builds Pandoc command with configured options
	 * 3. Executes Pandoc with Typst engine
	 * 4. Reports progress via optional callback
	 * 5. Returns result with success status and output path
	 *
	 * The method automatically manages temporary files and provides progress updates
	 * at key stages. If conversion fails, returns error information in the result
	 * object rather than throwing.
	 *
	 * @param inputPath - Absolute path to the input Markdown file
	 * @param outputPath - Absolute path where the PDF should be saved
	 * @param progressCallback - Optional callback for progress updates (message, percentage)
	 * @returns Promise resolving to conversion result with success flag and optional error
	 *
	 * @example
	 * ```typescript
	 * const result = await converter.convertToPDF(
	 *   '/path/to/note.md',
	 *   '/path/to/output.pdf',
	 *   (message, progress) => {
	 *     console.log(`${progress}%: ${message}`);
	 *     // Update UI progress bar
	 *   }
	 * );
	 *
	 * if (result.success) {
	 *   console.log('PDF created at:', result.outputPath);
	 * } else {
	 *   console.error('Conversion failed:', result.error);
	 *   console.log('Pandoc output:', result.stdout);
	 * }
	 * ```
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
				progressCallback?.('Conversion complete!', 100);
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
	 * Converts Markdown content (string) to PDF without requiring a file.
	 *
	 * This is a convenience method for converting Markdown content directly from
	 * memory without needing an existing file. It creates a temporary file,
	 * delegates to convertToPDF, then cleans up the temporary file.
	 *
	 * Useful for:
	 * - Converting dynamically generated content
	 * - Processing in-memory Markdown transformations
	 * - Testing conversion without file system operations
	 *
	 * Note: This method merges the provided options with existing pandocOptions.
	 *
	 * @param content - Markdown content to convert
	 * @param outputPath - Absolute path where the PDF should be saved
	 * @param options - Additional Pandoc options to merge with existing settings
	 * @param progressCallback - Optional callback for progress updates (message, percentage)
	 * @returns Promise resolving to conversion result with success flag and optional error
	 *
	 * @example
	 * ```typescript
	 * const markdown = `
	 * # My Document
	 * This is **dynamically generated** content.
	 * `;
	 *
	 * const result = await converter.convertMarkdownToPDF(
	 *   markdown,
	 *   '/path/to/output.pdf',
	 *   { variables: { title: 'Generated Doc' } },
	 *   (msg, pct) => updateProgress(pct)
	 * );
	 *
	 * if (result.success) {
	 *   console.log('Created PDF from content');
	 * }
	 * ```
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
		const pathUtils = new PathUtils(this.plugin.app);
		const tempInputPath = pathUtils.joinPath(this.tempDir!, `temp-${Date.now()}.md`);

		// Use fs.writeFile for temp files since external tools (Pandoc) need absolute paths
		await fs.writeFile(tempInputPath, content, 'utf-8');
		
		// Merge options
		this.pandocOptions = { ...this.pandocOptions, ...options };
		
		// Convert using the file-based method
		const result = await this.convertToPDF(tempInputPath, outputPath, progressCallback);
		
		// Cleanup temp file
		try {
			// Use fs.unlink for temp files since they're in external temp directories
			await fs.unlink(tempInputPath);
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
	 * Sets up automatic cleanup handlers for process termination events.
	 *
	 * Registers the cleanup method to run on various process termination events
	 * to ensure temporary files are removed even if the process exits unexpectedly.
	 * Handlers are registered for:
	 * - Normal exit
	 * - SIGINT (Ctrl+C)
	 * - SIGTERM (kill command)
	 *
	 * Note: Handlers are stored and removed on dispose() to prevent listener leaks.
	 * The uncaughtException handler is NOT registered to avoid swallowing errors.
	 *
	 * @private
	 */
	private setupCleanup(): void {
		// Store handler reference so we can remove it later
		this.processCleanupHandler = () => {
			// Only cleanup if not already disposed to avoid double-cleanup
			if (!this.isDisposed) {
				void this.cleanup();
			}
		};

		// Register cleanup handlers - these will be removed on dispose()
		process.on('exit', this.processCleanupHandler);
		process.on('SIGINT', this.processCleanupHandler);
		process.on('SIGTERM', this.processCleanupHandler);
		// Note: uncaughtException handler removed to avoid swallowing errors
	}


	/**
	 * Cleans up temporary files and directories.
	 *
	 * This method executes all registered cleanup handlers and removes the temporary
	 * directory created by the converter. Cleanup failures are logged but don't throw
	 * to avoid interfering with normal operation or other cleanup operations.
	 *
	 * Called automatically on process termination or manually via dispose().
	 *
	 * @private
	 * @returns Promise that resolves when cleanup is complete
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
				const pathUtils = new PathUtils(this.plugin.app);
				await pathUtils.cleanupDir(this.tempDir);
				this.tempDir = null;
			}
		} catch (error) {
			console.warn('Cleanup failed:', error);
		}
	}

	/**
	 * Ensures a temporary directory exists for intermediate conversion files.
	 *
	 * Creates a temporary directory on first call and reuses it for subsequent calls.
	 * The directory is created inside the plugin folder if vaultBasePath is available,
	 * otherwise falls back to vault-level temp directories.
	 *
	 * The temporary directory is used for:
	 * - Temporary Markdown files
	 * - Intermediate Typst files (if debug mode enabled)
	 * - Processed resource files
	 *
	 * @private
	 * @returns Promise resolving to the temporary directory path
	 */
	private async ensureTempDirectory(): Promise<string> {
		if (!this.tempDir) {
			if (this.pandocOptions.vaultBasePath) {
				// Use TempDirectoryManager for plugin temp directories
				const configDir = this.plugin?.app?.vault?.configDir;
				const tempManager = TempDirectoryManager.create(this.pandocOptions.vaultBasePath, configDir, undefined, this.plugin?.app);
				this.tempDir = await tempManager.ensureTempDir('pandoc');
			} else {
				// Fallback to system temp if plugin folder not available - use TempDirectoryManager fallback
				const pathUtils = new PathUtils(this.plugin.app);
				const vaultPath = pathUtils.getVaultPath();
				const configDir = this.plugin?.app?.vault?.configDir;
				const tempManager = new TempDirectoryManager({ vaultPath, configDir, app: this.plugin.app });
				this.tempDir = await tempManager.ensureTempDir('pandoc');
			}
		}
		return this.tempDir;
	}


	/**
	 * Disposes of the converter and cleans up all resources.
	 *
	 * This method should be called when done with the converter to ensure temporary
	 * files are removed. While cleanup happens automatically on process termination,
	 * calling dispose explicitly allows for immediate cleanup and is recommended
	 * when the converter is no longer needed.
	 *
	 * This method also removes all registered process event listeners to prevent
	 * memory leaks and allow the converter instance to be garbage collected.
	 *
	 * @returns Promise that resolves when cleanup is complete
	 *
	 * @example
	 * ```typescript
	 * const converter = new PandocTypstConverter(plugin, options);
	 * try {
	 *   await converter.convertToPDF(input, output);
	 * } finally {
	 *   await converter.dispose();  // Cleanup even if conversion fails
	 * }
	 * ```
	 */
	async dispose(): Promise<void> {
		if (this.isDisposed) {
			return; // Already disposed, avoid double-cleanup
		}

		this.isDisposed = true;

		// Remove process event listeners to prevent memory leaks
		if (this.processCleanupHandler) {
			process.off('exit', this.processCleanupHandler);
			process.off('SIGINT', this.processCleanupHandler);
			process.off('SIGTERM', this.processCleanupHandler);
			this.processCleanupHandler = null;
		}

		// Cleanup temporary files and resources
		await this.cleanup();
	}
}