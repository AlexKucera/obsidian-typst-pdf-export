import { spawn, ChildProcess } from 'child_process';
import { ConversionResult, ProgressCallback, PandocOptions } from '../converterTypes';
import { PathResolver } from '../../plugin/PathResolver';

/**
 * Handles pandoc process execution, monitoring, and error parsing.
 * Manages the spawning and lifecycle of pandoc processes for document conversion.
 */
export class PandocExecutor {
	private pathResolver: PathResolver;

	constructor(plugin: any) {
		this.pathResolver = new PathResolver(plugin);
	}

	/**
	 * Execute pandoc process with the given arguments
	 * @param args Command line arguments for pandoc
	 * @param pandocOptions Configuration options including paths and timeout
	 * @param progressCallback Optional callback for progress updates
	 * @returns Promise resolving to conversion result
	 */
	async executePandoc(
		args: string[], 
		pandocOptions: PandocOptions, 
		progressCallback?: ProgressCallback
	): Promise<ConversionResult> {
		return new Promise((resolve) => {
			const pandocPath = this.pathResolver.resolveExecutablePath(pandocOptions.pandocPath, 'pandoc');
			const timeout = pandocOptions.timeout || 60000;

			// Log the exact command being executed for debugging

			progressCallback?.('Starting Pandoc process...', 40);

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
	 * Parse progress information from pandoc output and update progress callback
	 * @param output Raw output from pandoc stderr
	 * @param progressCallback Optional callback to update progress
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
	 * Extract meaningful error messages from pandoc output
	 * @param stderr Standard error output from pandoc
	 * @param stdout Standard output from pandoc
	 * @returns Formatted error message
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