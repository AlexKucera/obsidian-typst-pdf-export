import { spawn, ChildProcess } from 'child_process';
import { ConversionResult, ProgressCallback, PandocOptions } from '../converterTypes';
import { PathResolver } from '../../plugin/PathResolver';
import type { obsidianTypstPDFExport } from '../../../main';

/**
 * Process executor for Pandoc command-line conversions with progress monitoring.
 *
 * This class manages the complete lifecycle of Pandoc subprocess execution including:
 * - Process spawning with augmented PATH and working directory configuration
 * - Real-time stdout/stderr streaming and parsing
 * - Progress monitoring and user feedback via callbacks
 * - Timeout enforcement to prevent hanging conversions
 * - Error extraction and formatting for user-friendly messages
 * - Graceful process termination and cleanup
 *
 * Key Features:
 * - **Augmented PATH**: Ensures Pandoc and Typst are found in common locations
 * - **Working Directory**: Sets vault root as CWD for proper attachment resolution
 * - **Progress Callbacks**: Updates UI during conversion stages
 * - **Timeout Protection**: Kills hung processes after configurable duration
 * - **Error Parsing**: Extracts meaningful error messages from raw output
 * - **Promise-based API**: Clean async interface for callers
 *
 * Process Lifecycle:
 * 1. Resolve Pandoc executable path with PathResolver
 * 2. Determine working directory (vault root preferred)
 * 3. Augment PATH environment with common binary locations
 * 4. Spawn Pandoc process with stdio piping
 * 5. Set up timeout handler for hanging processes
 * 6. Stream and parse stdout/stderr for progress
 * 7. Handle process completion or error
 * 8. Clean up timeout handler and resolve promise
 *
 * The executor is designed to work reliably across different environments (macOS,
 * Linux, Windows) by handling path resolution and environment variables carefully.
 *
 * @example
 * ```typescript
 * const executor = new PandocExecutor(this.plugin);
 *
 * const result = await executor.executePandoc(
 *   ['input.md', '-o', 'output.pdf', '--pdf-engine=typst'],
 *   {
 *     pandocPath: 'pandoc',
 *     vaultBasePath: '/vault',
 *     timeout: 120000
 *   },
 *   (message, progress) => {
 *     console.log(`${progress}%: ${message}`);
 *   }
 * );
 *
 * if (result.success) {
 *   console.log('Conversion succeeded');
 * } else {
 *   console.error('Error:', result.error);
 * }
 * ```
 */
export class PandocExecutor {
	private pathResolver: PathResolver;

	/**
	 * Creates a new PandocExecutor.
	 *
	 * @param plugin - Plugin instance for accessing PathResolver configuration
	 */
	constructor(plugin: obsidianTypstPDFExport) {
		this.pathResolver = new PathResolver(plugin);
	}

	/**
	 * Executes Pandoc process with comprehensive monitoring and error handling.
	 *
	 * This is the primary execution method that spawns a Pandoc subprocess, monitors
	 * its progress, enforces timeouts, and returns a detailed result. The method is
	 * fully asynchronous and promise-based for clean integration with async workflows.
	 *
	 * Process Configuration:
	 * - **Executable Resolution**: Uses PathResolver to find Pandoc (handles custom paths)
	 * - **Working Directory**: Sets vault root for relative path resolution
	 * - **PATH Augmentation**: Adds common binary locations to ensure tool discovery
	 * - **Stdio Piping**: Captures stdout/stderr for progress parsing and error reporting
	 *
	 * Progress Monitoring:
	 * The progressCallback receives updates at various stages:
	 * - 45%: Reading input (parsing phase)
	 * - 60%: Processing document (conversion phase)
	 * - 75%: Generating output (template application)
	 * - 85%: Running Typst engine (PDF generation)
	 * - 90%: Complete
	 *
	 * Timeout Handling:
	 * - Default: 60 seconds (configurable via pandocOptions.timeout)
	 * - Process killed with SIGTERM on timeout
	 * - Returns error result with timeout message
	 * - Prevents hung processes from blocking export queue
	 *
	 * Error Handling:
	 * - Non-zero exit code → Parses stderr for meaningful error
	 * - Process spawn failure → Returns startup error
	 * - Timeout → Returns timeout error
	 * - All errors include diagnostic context for debugging
	 *
	 * @param args - Complete command-line arguments for Pandoc (from PandocCommandBuilder)
	 * @param pandocOptions - Configuration including paths, timeout, and working directory
	 * @param progressCallback - Optional callback for real-time progress updates
	 * @returns Promise resolving to ConversionResult with success status and output
	 *
	 * @example
	 * ```typescript
	 * // Basic execution
	 * const executor = new PandocExecutor(this.plugin);
	 * const result = await executor.executePandoc(args, options);
	 *
	 * if (!result.success) {
	 *   new Notice(`Conversion failed: ${result.error}`);
	 * }
	 * ```
	 *
	 * @example
	 * ```typescript
	 * // With progress callback for UI updates
	 * const result = await executor.executePandoc(
	 *   args,
	 *   options,
	 *   (message, progress) => {
	 *     progressModal.update(message, progress);
	 *   }
	 * );
	 * ```
	 *
	 * @example
	 * ```typescript
	 * // With custom timeout for large documents
	 * const result = await executor.executePandoc(
	 *   args,
	 *   {
	 *     ...options,
	 *     timeout: 300000  // 5 minutes for large PDF
	 *   }
	 * );
	 * ```
	 */
	async executePandoc(
		args: string[],
		pandocOptions: PandocOptions,
		progressCallback?: ProgressCallback
	): Promise<ConversionResult> {
		return new Promise((resolve) => {
			const pandocPath = this.pathResolver.resolveExecutablePath(pandocOptions.pandocPath, 'pandoc');
			const timeout = pandocOptions.timeout || 60000;

			// Determine working directory - use vault base path if available, fallback to plugin directory
			let workingDir: string;
			
			if (pandocOptions.vaultBasePath) {
				workingDir = pandocOptions.vaultBasePath;
			} else {
				// Fallback to plugin directory
				const pluginDir = pandocOptions.pluginDir || process.cwd();
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
	 * Parses Pandoc's stderr output to detect conversion progress and update the UI.
	 *
	 * This method implements heuristic progress detection by scanning stderr output for
	 * specific keywords that indicate which phase of the conversion pipeline is active.
	 * While Pandoc doesn't provide structured progress events, certain log patterns
	 * reliably appear during specific phases.
	 *
	 * Detection Heuristics:
	 * - **"parsing" or "reading"** → 45% (Input parsing phase)
	 *   - Pandoc is reading and parsing the markdown input
	 *   - AST construction is underway
	 * - **"writing" or "generating"** → 75% (Output generation phase)
	 *   - Pandoc is generating Typst markup from the AST
	 *   - Template application is occurring
	 * - **"typst"** → 85% (PDF generation phase)
	 *   - Typst engine is compiling to PDF
	 *   - Final rendering in progress
	 *
	 * Progress updates are only sent if a progressCallback was provided. Multiple
	 * matches to the same pattern won't duplicate callbacks - only one update per
	 * phase is typical.
	 *
	 * Enhancement Opportunities:
	 * - Parse Typst's own progress output for more granular PDF generation updates
	 * - Detect specific error keywords to provide early warning
	 * - Track file processing count for multi-file conversions
	 *
	 * @param output - Raw text from Pandoc's stderr stream
	 * @param progressCallback - Optional callback to invoke with progress updates
	 * @private
	 *
	 * @example
	 * ```typescript
	 * // Typical stderr patterns that trigger updates:
	 * parseProgressFromOutput('[INFO] Parsing markdown...', callback);
	 * // → Triggers: callback('Reading input...', 45)
	 *
	 * parseProgressFromOutput('[INFO] Writing typst output...', callback);
	 * // → Triggers: callback('Generating output...', 75)
	 *
	 * parseProgressFromOutput('Running typst compile...', callback);
	 * // → Triggers: callback('Running Typst engine...', 85)
	 * ```
	 *
	 * @example
	 * ```typescript
	 * // Used in stderr stream handler:
	 * pandocProcess.stderr?.on('data', (data: Buffer) => {
	 *   const output = data.toString();
	 *   stderr += output;
	 *   this.parseProgressFromOutput(output, progressCallback);
	 * });
	 * ```
	 */
	private parseProgressFromOutput(output: string, progressCallback?: ProgressCallback): void {
		// Basic progress parsing - could be enhanced based on pandoc output patterns
		if (output.includes('parsing') || output.includes('reading')) {
			progressCallback?.('Reading input...', 45);
		} else if (output.includes('writing') || output.includes('generating')) {
			progressCallback?.('Generating output...', 75);
		} else if (output.includes('typst')) {
			progressCallback?.('Running Typst engine...', 85);
		}
	}

	/**
	 * Extracts meaningful, user-friendly error messages from Pandoc's raw output.
	 *
	 * This method implements a multi-tier fallback strategy to find the most relevant
	 * error information from Pandoc's stderr and stdout streams. Pandoc and Typst can
	 * produce verbose diagnostic output, so this method filters to find the most
	 * actionable error message for users.
	 *
	 * Extraction Strategy (in priority order):
	 * 1. **Pattern Matching**: Scan all output for common error indicators
	 *    - Case-insensitive "error:" matches most Pandoc/Typst errors
	 *    - Case-sensitive "Error:" catches Python and other tool errors
	 *    - "failed" indicates operation failures
	 *    - "Fatal" indicates critical termination errors
	 *    - "pandoc:" catches Pandoc-specific diagnostic messages
	 *
	 * 2. **First Stderr Line**: If no pattern matches, use first non-empty stderr line
	 *    - Assumes most important error appears early in stderr
	 *    - Filters out empty lines for cleaner messages
	 *
	 * 3. **Generic Fallback**: If no stderr content, return generic error
	 *    - Indicates process failure with no diagnostic output
	 *    - Should be rare in practice
	 *
	 * Error Pattern Examples:
	 * - `Error: Could not find template: custom.typ` (Pandoc template error)
	 * - `pandoc: Cannot find file input.md` (File not found)
	 * - `error: font not found: "NonexistentFont"` (Typst font error)
	 * - `Fatal error: out of memory` (Resource exhaustion)
	 * - `failed to compile: syntax error at line 42` (Typst compilation error)
	 *
	 * The extracted message is displayed directly to users in error notices, so it
	 * should be concise and actionable without requiring interpretation.
	 *
	 * @param stderr - Complete stderr output captured from Pandoc process
	 * @param stdout - Complete stdout output captured from Pandoc process
	 * @returns User-friendly error message suitable for display in Notice
	 * @private
	 *
	 * @example
	 * ```typescript
	 * // Template not found error
	 * const stderr = "Error: Could not find template: custom.typ\nUsage: pandoc...";
	 * const error = this.extractErrorMessage(stderr, '');
	 * // Returns: "Error: Could not find template: custom.typ"
	 * ```
	 *
	 * @example
	 * ```typescript
	 * // Typst compilation error
	 * const stderr = "typst compile failed\nerror: undefined function `foo`\n  at line 15";
	 * const error = this.extractErrorMessage(stderr, '');
	 * // Returns: "error: undefined function `foo`"
	 * ```
	 *
	 * @example
	 * ```typescript
	 * // Generic failure with no specific error
	 * const stderr = "";
	 * const stdout = "Some non-error output";
	 * const error = this.extractErrorMessage(stderr, stdout);
	 * // Returns: "Unknown error occurred during conversion"
	 * ```
	 *
	 * @example
	 * ```typescript
	 * // Used in process close handler:
	 * pandocProcess.on('close', (code: number | null) => {
	 *   if (!success) {
	 *     result.error = this.extractErrorMessage(stderr, stdout);
	 *     new Notice(`Export failed: ${result.error}`);
	 *   }
	 * });
	 * ```
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
}