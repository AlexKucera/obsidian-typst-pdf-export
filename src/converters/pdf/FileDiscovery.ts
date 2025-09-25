/**
 * File discovery utilities for finding generated PDF to image conversion outputs.
 * Handles filename pattern matching when pdf2img generates files with different names.
 */

import * as path from 'path';
import { PathUtils } from '../../core/PathUtils';
import type { obsidianTypstPDFExport } from '../../../main';

export interface FileDiscoveryResult {
	/** Path to the discovered file */
	filePath: string;
	/** Whether the file was found successfully */
	found: boolean;
	/** Error message if file was not found */
	error?: string;
}

export class FileDiscovery {
	/**
	 * Find the generated image file in the output directory.
	 * Handles cases where pdf2img sanitizes filenames differently than expected.
	 * @param outputDir Directory where files were generated
	 * @param expectedFileName Expected output filename
	 * @param plugin Plugin instance for PathUtils
	 * @returns Discovery result with actual file path
	 */
	public static async findGeneratedFile(
		outputDir: string,
		expectedFileName: string,
		plugin?: obsidianTypstPDFExport
	): Promise<FileDiscoveryResult> {
		if (!plugin?.app) {
			// Fallback to path for external tool output directories
			const expectedOutputPath = path.join(outputDir, expectedFileName);
			const fs = require('fs').promises;
			try {
				await fs.access(expectedOutputPath);
				return {
					filePath: expectedOutputPath,
					found: true
				};
			} catch {
				return await this.findAlternativeFileFs(outputDir, expectedFileName, expectedOutputPath);
			}
		}

		const pathUtils = new PathUtils(plugin.app);
		const expectedOutputPath = pathUtils.joinPath(outputDir, expectedFileName);

		// Check if the expected output file exists first
		try {
			if (await pathUtils.fileExists(expectedOutputPath)) {
				return {
					filePath: expectedOutputPath,
					found: true
				};
			}
		} catch {
			// Continue to alternative search
		}

		// File not found with expected name, try to find alternatives
		return await this.findAlternativeFile(outputDir, expectedFileName, expectedOutputPath, plugin);
	}

	/**
	 * Find alternative files when the expected filename doesn't match (using vault.adapter).
	 * @param outputDir Output directory to search
	 * @param expectedFileName Expected filename for pattern matching
	 * @param expectedOutputPath Full expected output path
	 * @param plugin Plugin instance for vault access
	 * @returns Discovery result with alternative file if found
	 */
	private static async findAlternativeFile(
		outputDir: string,
		expectedFileName: string,
		expectedOutputPath: string,
		plugin: obsidianTypstPDFExport
	): Promise<FileDiscoveryResult> {
		try {
			// Debug: List what files are actually in the output directory
			const dirList = await plugin.app.vault.adapter.list(outputDir);
			const files = dirList.files.map(f => path.basename(f));
			const pathUtils = new PathUtils(plugin.app);

			// Look for any PNG files that might match
			const pngFiles = files.filter(f => f.endsWith('.png'));
			if (pngFiles.length === 0) {
				return {
					filePath: '',
					found: false,
					error: `No PNG files found in output directory: ${outputDir}`
				};
			}

			// Try to find a file that matches the pattern (with or without exact name)
			// pdf2img might sanitize filenames differently
			const matchingFile = this.matchFilePattern(pngFiles, expectedFileName);

			if (matchingFile) {
				const actualOutputPath = pathUtils.joinPath(outputDir, matchingFile);

				// Final check if we found an alternative file
				if (await pathUtils.fileExists(actualOutputPath)) {
					return {
						filePath: actualOutputPath,
						found: true
					};
				} else {
					return {
						filePath: '',
						found: false,
						error: `Alternative file not accessible: ${actualOutputPath}`
					};
				}
			} else {
				return {
					filePath: '',
					found: false,
					error: `Generated image file not found: ${expectedOutputPath}. Available files: ${pngFiles.join(', ')}`
				};
			}

		} catch (listError: unknown) {
			console.error(`Failed to list output directory:`, listError);
			const errorMessage = listError instanceof Error ? listError.message : String(listError);
			return {
				filePath: '',
				found: false,
				error: `Failed to search output directory: ${errorMessage}`
			};
		}
	}

	/**
	 * Find alternative files when the expected filename doesn't match (fs fallback).
	 * @param outputDir Output directory to search
	 * @param expectedFileName Expected filename for pattern matching
	 * @param expectedOutputPath Full expected output path
	 * @returns Discovery result with alternative file if found
	 */
	private static async findAlternativeFileFs(
		outputDir: string,
		expectedFileName: string,
		expectedOutputPath: string
	): Promise<FileDiscoveryResult> {
		try {
			const fs = require('fs').promises;
			// Debug: List what files are actually in the output directory
			const files = await fs.readdir(outputDir);

			// Look for any PNG files that might match
			const pngFiles = files.filter((f: string) => f.endsWith('.png'));
			if (pngFiles.length === 0) {
				return {
					filePath: '',
					found: false,
					error: `No PNG files found in output directory: ${outputDir}`
				};
			}

			// Try to find a file that matches the pattern (with or without exact name)
			// pdf2img might sanitize filenames differently
			const matchingFile = this.matchFilePattern(pngFiles, expectedFileName);

			if (matchingFile) {
				const actualOutputPath = path.join(outputDir, matchingFile);

				// Final check if we found an alternative file
				try {
					await fs.access(actualOutputPath);
					return {
						filePath: actualOutputPath,
						found: true
					};
				} catch {
					return {
						filePath: '',
						found: false,
						error: `Alternative file not accessible: ${actualOutputPath}`
					};
				}
			} else {
				return {
					filePath: '',
					found: false,
					error: `Generated image file not found: ${expectedOutputPath}. Available files: ${pngFiles.join(', ')}`
				};
			}

		} catch (listError: unknown) {
			console.error(`Failed to list output directory:`, listError);
			const errorMessage = listError instanceof Error ? listError.message : String(listError);
			return {
				filePath: '',
				found: false,
				error: `Failed to search output directory: ${errorMessage}`
			};
		}
	}

	/**
	 * Match files against expected filename patterns.
	 * Handles filename sanitization that pdf2img might apply.
	 * @param files Array of available filenames
	 * @param expectedFileName Expected filename pattern
	 * @returns Matching filename or null if no match found
	 */
	private static matchFilePattern(files: string[], expectedFileName: string): string | null {
		// Try exact match first
		const exactMatch = files.find(f => f === expectedFileName);
		if (exactMatch) {
			return exactMatch;
		}

		// Try partial match by removing special characters
		const simplifiedExpected = this.sanitizeFilename(expectedFileName);
		const matchingFile = files.find(f => {
			const simplifiedActual = this.sanitizeFilename(f);
			return simplifiedActual === simplifiedExpected;
		});

		if (matchingFile) {
			return matchingFile;
		}

		// Fallback to first PNG file if no pattern matches
		return files.length > 0 ? files[0] : null;
	}

	/**
	 * Sanitize filename by removing special characters for pattern matching.
	 * @param filename Original filename
	 * @returns Sanitized filename for comparison
	 */
	private static sanitizeFilename(filename: string): string {
		return filename.replace(/[^a-zA-Z0-9.-]/g, '');
	}

	/**
	 * Generate expected output filename for pdf2img conversion.
	 * pdf2img uses the pattern: "filename-1.png" for first page.
	 * @param pdfBaseName Base name of the PDF file (without extension)
	 * @param pageNumber Page number (1-based)
	 * @param format Output format ('png' or 'jpeg')
	 * @returns Expected output filename
	 */
	public static generateExpectedFilename(
		pdfBaseName: string,
		pageNumber: number = 1,
		format: string = 'png'
	): string {
		return `${pdfBaseName}-${pageNumber}.${format}`;
	}
}