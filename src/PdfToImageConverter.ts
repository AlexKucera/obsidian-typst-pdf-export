/**
 * PDF to Image Converter using pdf-to-img
 * Converts PDF files to PNG images for preview in Typst exports
 */

import * as fs from 'fs/promises';
import * as path from 'path';

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

	private constructor() {}

	public static getInstance(): PdfToImageConverter {
		if (!PdfToImageConverter.instance) {
			PdfToImageConverter.instance = new PdfToImageConverter();
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

			// Ensure the PDF file exists
			try {
				await fs.access(pdfPath);
			} catch (error) {
				return {
					imagePath: '',
					originalDimensions: { width: 0, height: 0 },
					imageDimensions: { width: 0, height: 0 },
					success: false,
					error: `PDF file not found: ${pdfPath}`
				};
			}

			// Ensure output directory exists
			await fs.mkdir(outputDir, { recursive: true });

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
			const possiblePluginDirs = [
				// Strategy 1: From process.cwd() if it's in the vault
				path.join(process.cwd(), '.obsidian', 'plugins', 'obsidian-typst-pdf-export'),
				// Strategy 2: Assuming we're running from vault root
				path.join('.obsidian', 'plugins', 'obsidian-typst-pdf-export'),
				// Strategy 3: Direct path if running in development
				'/Users/alex/Obsidian/Dev/.obsidian/plugins/obsidian-typst-pdf-export'
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
			
			console.log(`Plugin directory: ${pluginDir}`);
			console.log(`PDF2IMG path: ${pdf2imgPath}`);
			
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
				'--output', `"${outputDir}"`,
				'--pages', '1' // Only convert the first page
			].join(' ');

			console.log(`PDF conversion command: ${cliCommand}`);

			try {
				// Set environment variables to ensure node can be found
				const env = {
					...process.env,
					PATH: process.env.PATH + ':/opt/homebrew/bin:/usr/local/bin:/usr/bin'
				};
				
				const result = await execAsync(cliCommand, { env });
				console.log(`PDF conversion stdout: ${result.stdout}`);
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
			try {
				await fs.access(expectedOutputPath);
			} catch (error) {
				return {
					imagePath: '',
					originalDimensions: { width: 0, height: 0 },
					imageDimensions: { width: 0, height: 0 },
					success: false,
					error: `Generated image file not found: ${expectedOutputPath}`
				};
			}

			// Rename to our desired format if needed
			const finalOutputFileName = `${pdfBaseName}_preview.${opts.format}`;
			const finalOutputPath = path.join(outputDir, finalOutputFileName);

			let buffer: Buffer;
			if (opts.format === 'jpeg') {
				// Convert PNG to JPEG if needed
				try {
					const sharp = require('sharp');
					const inputBuffer = await fs.readFile(expectedOutputPath);
					buffer = await sharp(inputBuffer)
						.jpeg({ quality: opts.quality })
						.toBuffer();
					await fs.writeFile(finalOutputPath, buffer);
					// Clean up the original PNG
					await fs.unlink(expectedOutputPath);
				} catch (sharpError) {
					console.warn('Sharp not available for JPEG conversion, keeping PNG format');
					// Just rename the file
					await fs.rename(expectedOutputPath, finalOutputPath);
					buffer = await fs.readFile(finalOutputPath);
				}
			} else {
				// Keep as PNG, just rename
				await fs.rename(expectedOutputPath, finalOutputPath);
				buffer = await fs.readFile(finalOutputPath);
			}

			// Get image dimensions
			let imageDimensions = { width: opts.maxWidth, height: opts.maxHeight };
			try {
				const sharp = require('sharp');
				const metadata = await sharp(buffer).metadata();
				imageDimensions = {
					width: metadata.width || opts.maxWidth,
					height: metadata.height || opts.maxHeight
				};
			} catch (sharpError) {
				// Fallback to estimated dimensions if sharp is not available
				console.warn('Sharp not available for image metadata, using estimated dimensions');
			}

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
		try {
			const buffer = await fs.readFile(filePath);
			
			// Check PDF signature
			const signature = buffer.subarray(0, 4).toString();
			return signature === '%PDF';
		} catch (error) {
			return false;
		}
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
		try {
			// pdf-to-img doesn't provide metadata directly
			// We'll use a basic approach with the PDF signature check
			const isValid = await this.isValidPdf(filePath);
			if (!isValid) {
				return {
					pageCount: 0,
					dimensions: { width: 0, height: 0 },
					success: false,
					error: 'Invalid PDF file'
				};
			}

			// For now, return basic info since pdf-to-img focuses on conversion
			// In a real implementation, you might want to use pdf-parse or similar for metadata
			return {
				pageCount: 1, // We only handle first page anyway
				dimensions: { width: 612, height: 792 }, // Standard letter size estimate
				success: true
			};
		} catch (error) {
			return {
				pageCount: 0,
				dimensions: { width: 0, height: 0 },
				success: false,
				error: error.message
			};
		}
	}
}