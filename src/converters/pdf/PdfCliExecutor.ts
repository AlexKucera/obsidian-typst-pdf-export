/**
 * PDF CLI Executor for handling pdf2img command line operations.
 * Executes external pdf2img binary to convert PDF pages to images.
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';
import { BinaryLocator } from './BinaryLocator';
import { EnvironmentUtils } from './EnvironmentUtils';
import type { obsidianTypstPDFExport } from '../../../main';

export interface PdfCliOptions {
	/** Scale factor for the rendered image */
	scale: number;
	/** Page number to convert (1-based) */
	pages: string;
	/** Output directory for generated images */
	outputDir: string;
}

export interface PdfCliResult {
	/** Whether the CLI execution succeeded */
	success: boolean;
	/** Standard output from the command */
	stdout?: string;
	/** Standard error from the command */
	stderr?: string;
	/** Error message if execution failed */
	error?: string;
}

export class PdfCliExecutor {
	/**
	 * Execute pdf2img CLI command to convert PDF to images.
	 * @param pdfPath Path to the input PDF file
	 * @param options CLI execution options
	 * @param plugin Plugin instance for accessing settings
	 * @returns CLI execution result
	 */
	public static async executePdf2Img(
		pdfPath: string,
		options: PdfCliOptions,
		plugin?: obsidianTypstPDFExport
	): Promise<PdfCliResult> {
		try {
			// Find the pdf2img binary
			const binaryLocation = await BinaryLocator.findPdf2ImgBinary(plugin);
			if (!binaryLocation.exists) {
				return {
					success: false,
					error: binaryLocation.error
				};
			}

			// Calculate relative path from vault to temp directory for pdf2img
			// pdf2img doesn't handle absolute paths correctly, needs relative paths
			const vaultPath = process.cwd(); // This should be the vault directory
			const relativeOutputDir = path.relative(vaultPath, options.outputDir);

			// Build the CLI command
			const cliCommand = this.buildCommand(
				binaryLocation.binaryPath,
				pdfPath,
				relativeOutputDir,
				options
			);

			// Execute the command
			return await this.executeCommand(cliCommand, plugin);

		} catch (error: unknown) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			return {
				success: false,
				error: `PDF CLI execution failed: ${errorMessage}`
			};
		}
	}

	/**
	 * Build the pdf2img CLI command string.
	 * @param binaryPath Full path to pdf2img binary
	 * @param pdfPath Path to input PDF file
	 * @param outputDir Output directory (relative path)
	 * @param options CLI options
	 * @returns Command string ready for execution
	 */
	private static buildCommand(
		binaryPath: string,
		pdfPath: string,
		outputDir: string,
		options: PdfCliOptions
	): string {
		// Build the CLI command - the pdf2img binary is already executable
		return [
			`"${binaryPath}"`,
			`"${pdfPath}"`,
			'--scale', options.scale.toString(),
			'--output', `"${outputDir}"`,
			'--pages', options.pages // Only convert the specified page(s)
		].join(' ');
	}

	/**
	 * Execute a CLI command with proper environment setup.
	 * @param command Command string to execute
	 * @param plugin Plugin instance for accessing settings
	 * @returns Command execution result
	 */
	private static async executeCommand(
		command: string,
		plugin?: obsidianTypstPDFExport
	): Promise<PdfCliResult> {
		try {
			const execAsync = promisify(exec);

			// Get augmented environment for CLI execution
			const env = EnvironmentUtils.getAugmentedEnvironment(plugin?.settings);
			
			const result = await execAsync(command, { env });
			
			// Log stderr as warning if present, but don't treat as error
			if (result.stderr) {
				console.warn(`PDF conversion stderr: ${result.stderr}`);
			}

			return {
				success: true,
				stdout: result.stdout,
				stderr: result.stderr
			};

		} catch (cliError: unknown) {
			const errorMessage = cliError instanceof Error ? cliError.message : String(cliError);
			console.error(`PDF conversion error: ${errorMessage}`);
			return {
				success: false,
				error: `PDF CLI conversion failed: ${errorMessage}`,
				stderr: (cliError as { stderr?: string })?.stderr || ''
			};
		}
	}

	/**
	 * Validate that pdf2img binary is available and working.
	 * @param plugin Plugin instance for accessing settings
	 * @returns Validation result
	 */
	public static async validatePdf2ImgAvailable(plugin?: obsidianTypstPDFExport): Promise<{
		available: boolean;
		error?: string;
	}> {
		try {
			const binaryLocation = await BinaryLocator.findPdf2ImgBinary(plugin);
			return {
				available: binaryLocation.exists,
				error: binaryLocation.error
			};
		} catch (error: unknown) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			return {
				available: false,
				error: `Failed to validate pdf2img: ${errorMessage}`
			};
		}
	}
}