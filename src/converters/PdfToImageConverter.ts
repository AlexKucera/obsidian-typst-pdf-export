/**
 * PDF to Image Converter using pdf-to-img
 * Converts PDF files to PNG images for preview in Typst exports
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { PdfProcessor } from './pdf/PdfProcessor';
import { ImageOptimizer } from './pdf/ImageOptimizer';

export interface PdfConversionOptions {
	/** Quality/scale factor for the rendered image (default: 2.0 for HiDPI) */
	scale?: number;
	/** Maximum width in pixels (default: 800) */
	maxWidth?: number;
	/** Maximum height in pixels (default: 600) */
	maxHeight?: number;
	/** Output format (default: 'png') */
	format?: 'png' | 'jpeg';
	/** JPEG quality if using jpeg format (default: 90) */
	quality?: number;
}

export interface PdfConversionResult {
	/** Path to the generated image file */
	imagePath: string;
	/** Original PDF dimensions */
	originalDimensions: {
		width: number;
		height: number;
	};
	/** Generated image dimensions */
	imageDimensions: {
		width: number;
		height: number;
	};
	/** Success status */
	success: boolean;
	/** Error message if conversion failed */
	error?: string;
}

export class PdfToImageConverter {
	private static instance: PdfToImageConverter;
	private plugin: any; // Plugin instance for accessing settings

	private constructor(plugin?: any) {
		this.plugin = plugin;
	}


	public static getInstance(plugin?: any): PdfToImageConverter {
		if (!PdfToImageConverter.instance) {
			PdfToImageConverter.instance = new PdfToImageConverter(plugin);
		} else if (plugin && !PdfToImageConverter.instance.plugin) {
			// Update the plugin reference if it wasn't set initially
			PdfToImageConverter.instance.plugin = plugin;
		}
		return PdfToImageConverter.instance;
	}

	/**
	 * Convert the first page of a PDF to an image
	 */
	public async convertFirstPageToImage(
		pdfPath: string, 
		outputDir: string, 
		options: PdfConversionOptions = {}
	): Promise<PdfConversionResult> {
		try {
			// Set default options
			const opts: Required<PdfConversionOptions> = {
				scale: options.scale || 2.0,
				maxWidth: options.maxWidth || 800,
				maxHeight: options.maxHeight || 600,
				format: options.format || 'png',
				quality: options.quality || 90
			};

			// Validate PDF file exists and is valid
			const pdfValidation = await PdfProcessor.validatePdfFile(pdfPath);
			if (!pdfValidation.success) {
				return {
					imagePath: '',
					originalDimensions: { width: 0, height: 0 },
					imageDimensions: { width: 0, height: 0 },
					success: false,
					error: pdfValidation.error
				};
			}

			// Ensure output directory exists
			await fs.mkdir(outputDir, { recursive: true });

			// Calculate relative path from vault to temp directory for pdf2img
			// pdf2img doesn't handle absolute paths correctly, needs relative paths
			const vaultPath = process.cwd(); // This should be the vault directory
			const relativeOutputDir = path.relative(vaultPath, outputDir);

			// Generate output file name for the first page
			const pdfBaseName = path.basename(pdfPath, path.extname(pdfPath));
			// pdf2img uses the pattern: "filename-1.png" for first page
			const expectedOutputFileName = `${pdfBaseName}-1.png`;
			const expectedOutputPath = path.join(outputDir, expectedOutputFileName);
			
			// Use the CLI to convert PDF to images
			const { exec } = require('child_process');
			const { promisify } = require('util');
			const execAsync = promisify(exec);

			// Get the plugin directory - need to handle Obsidian's environment
			// In Obsidian, __dirname points to electron.asar, so we need to find the actual plugin path
			let pluginDir: string;
			
			// Try multiple strategies to find the plugin directory
			const pluginDirName = this.plugin?.manifest?.dir || 'typst-pdf-export';
			const configDir = this.plugin?.app.vault.configDir || '.obsidian';
			const possiblePluginDirs = [
				// Strategy 1: From process.cwd() if it's in the vault
				path.join(process.cwd(), configDir, 'plugins', pluginDirName),
				// Strategy 2: Assuming we're running from vault root
				path.join(configDir, 'plugins', pluginDirName),
				// Strategy 3: From vault base path if plugin is available
				...(this.plugin ? [path.join((this.plugin.app.vault.adapter as any).basePath, this.plugin.manifest.dir!)] : [])
			];
			
			// Find the first directory that exists and has node_modules
			pluginDir = possiblePluginDirs.find(dir => {
				try {
					const nodeModulesPath = path.join(dir, 'node_modules');
					return require('fs').existsSync(nodeModulesPath);
				} catch {
					return false;
				}
			}) || possiblePluginDirs[0]; // Fallback to first option
			
			const pdf2imgPath = path.join(pluginDir, 'node_modules', '.bin', 'pdf2img');
			
			
			// Check if the binary exists
			const fs2 = require('fs');
			if (!fs2.existsSync(pdf2imgPath)) {
				return {
					imagePath: '',
					originalDimensions: { width: 0, height: 0 },
					imageDimensions: { width: 0, height: 0 },
					success: false,
					error: `PDF2IMG binary not found at: ${pdf2imgPath}`
				};
			}

			// Build the CLI command - the pdf2img binary is already executable
			const cliCommand = [
				`"${pdf2imgPath}"`,
				`"${pdfPath}"`,
				'--scale', opts.scale.toString(),
				'--output', `"${relativeOutputDir}"`,
				'--pages', '1' // Only convert the first page
			].join(' ');


			try {
				// Set environment variables to ensure node can be found
				// Use configured additional paths or fall back to defaults
				const additionalPaths = this.plugin?.settings?.executablePaths?.additionalPaths || 
					['/opt/homebrew/bin', '/usr/local/bin', '/usr/bin'];
				
				// Ensure Node.js paths are included for pdf2img execution
				const nodePaths = [
					'/usr/local/bin',     // Common Node.js installation
					'/opt/homebrew/bin',  // Homebrew on macOS
					'/usr/bin',           // System Node.js
					'/usr/local/node/bin' // Alternative Node.js location
				];
				
				const env = {
					...process.env,
					PATH: [
						process.env.PATH,
						...nodePaths,
						...additionalPaths
					].filter(Boolean).join(':')
				};
				
				const result = await execAsync(cliCommand, { 
					env
				});
				if (result.stderr) {
					console.warn(`PDF conversion stderr: ${result.stderr}`);
				}
			} catch (cliError) {
				console.error(`PDF conversion error: ${cliError.message}`);
				return {
					imagePath: '',
					originalDimensions: { width: 0, height: 0 },
					imageDimensions: { width: 0, height: 0 },
					success: false,
					error: `PDF CLI conversion failed: ${cliError.message}`
				};
			}

			// Check if the expected output file exists
			let actualOutputPath = expectedOutputPath;
			try {
				await fs.access(expectedOutputPath);
			} catch (error) {
				// Debug: List what files are actually in the output directory
				try {
					const files = await fs.readdir(outputDir);
					
					// Look for any PNG files that might match
					const pngFiles = files.filter(f => f.endsWith('.png'));
					if (pngFiles.length > 0) {
						
						// Try to find a file that matches the pattern (with or without exact name)
						// pdf2img might sanitize filenames differently
						const matchingFile = pngFiles.find(f => {
							// Try exact match first
							if (f === expectedOutputFileName) return true;
							// Try partial match by removing special characters
							const simplifiedExpected = expectedOutputFileName.replace(/[^a-zA-Z0-9.-]/g, '');
							const simplifiedActual = f.replace(/[^a-zA-Z0-9.-]/g, '');
							return simplifiedActual === simplifiedExpected;
						}) || pngFiles[0]; // Fallback to first PNG file
						
						if (matchingFile) {
							actualOutputPath = path.join(outputDir, matchingFile);
						}
					}
				} catch (listError) {
					console.error(`Failed to list output directory:`, listError);
				}
				
				// Final check if we found an alternative file
				try {
					await fs.access(actualOutputPath);
				} catch (finalError) {
					return {
						imagePath: '',
						originalDimensions: { width: 0, height: 0 },
						imageDimensions: { width: 0, height: 0 },
						success: false,
						error: `Generated image file not found: ${actualOutputPath}. Expected: ${expectedOutputPath}`
					};
				}
			}

			// Use ImageOptimizer to handle format conversion and dimension detection
			const optimizationResult = await ImageOptimizer.optimizeImage(
				actualOutputPath,
				outputDir,
				pdfBaseName,
				{
					format: opts.format,
					quality: opts.quality
				}
			);

			if (!optimizationResult.success) {
				return {
					imagePath: '',
					originalDimensions: { width: 0, height: 0 },
					imageDimensions: { width: 0, height: 0 },
					success: false,
					error: optimizationResult.error
				};
			}

			const finalOutputPath = optimizationResult.imagePath;
			const imageDimensions = optimizationResult.dimensions;

			return {
				imagePath: finalOutputPath,
				originalDimensions: imageDimensions, // Estimate based on converted image
				imageDimensions,
				success: true
			};

		} catch (error) {
			return {
				imagePath: '',
				originalDimensions: { width: 0, height: 0 },
				imageDimensions: { width: 0, height: 0 },
				success: false,
				error: `PDF conversion failed: ${error.message}`
			};
		}
	}

	/**
	 * Check if a file is a valid PDF
	 */
	public async isValidPdf(filePath: string): Promise<boolean> {
		return await PdfProcessor.isValidPdf(filePath);
	}

	/**
	 * Get PDF metadata (page count, dimensions, etc.)
	 */
	public async getPdfInfo(filePath: string): Promise<{
		pageCount: number;
		dimensions: { width: number; height: number };
		success: boolean;
		error?: string;
	}> {
		return await PdfProcessor.getPdfInfo(filePath);
	}
}