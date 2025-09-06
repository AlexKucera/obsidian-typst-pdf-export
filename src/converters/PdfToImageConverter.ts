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
	private plugin: any; // Plugin instance for accessing settings

	private constructor(plugin?: any) {
		this.plugin = plugin;
	}

	/**
	 * Get augmented environment with extended PATH for ImageMagick
	 */
	private getAugmentedEnv(): NodeJS.ProcessEnv {
		const homeDir = process.env.HOME || process.env.USERPROFILE || '';
		const commonPaths = [
			'/opt/homebrew/bin',
			'/usr/local/bin',
			'/usr/bin'
		].map(p => homeDir.includes('Users') ? p : homeDir + p);
		
		return {
			...process.env,
			PATH: `${process.env.PATH}:${commonPaths.join(':')}`
		};
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
				
				const env = {
					...process.env,
					PATH: process.env.PATH + (additionalPaths.length > 0 
						? ':' + additionalPaths.join(':')
						: '')
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

			// Rename to our desired format if needed
			const finalOutputFileName = `${pdfBaseName}_preview.${opts.format}`;
			const finalOutputPath = path.join(outputDir, finalOutputFileName);

			let buffer: Buffer;
			if (opts.format === 'jpeg') {
				// Convert PNG to JPEG using ImageMagick
				try {
					const { spawn } = require('child_process');
					const { promisify } = require('util');
					
					// Use ImageMagick to convert PNG to JPEG
					const convertProcess = spawn('magick', [
						'convert',
						actualOutputPath,
						'-quality', opts.quality.toString(),
						finalOutputPath
					], {
						stdio: ['pipe', 'pipe', 'pipe'],
						env: this.getAugmentedEnv()
					});
					
					await new Promise<void>((resolve, reject) => {
						let error = '';
						convertProcess.stderr?.on('data', (data: Buffer) => {
							error += data.toString();
						});
						
						convertProcess.on('close', (code: number | null) => {
							if (code === 0) {
								resolve();
							} else {
								reject(new Error(`ImageMagick conversion failed with code ${code}: ${error}`));
							}
						});
						
						convertProcess.on('error', (err: Error) => {
							reject(new Error(`Failed to spawn ImageMagick: ${err.message}`));
						});
					});
					
					// Clean up the original PNG
					await fs.unlink(actualOutputPath);
					buffer = await fs.readFile(finalOutputPath);
				} catch (imagemagickError) {
					console.warn('ImageMagick not available for JPEG conversion, keeping PNG format');
					// Just rename the file to PNG format
					const pngFinalPath = finalOutputPath.replace(/\.jpeg?$/, '.png');
					await fs.rename(actualOutputPath, pngFinalPath);
					buffer = await fs.readFile(pngFinalPath);
				}
			} else {
				// Keep as PNG, just rename
				await fs.rename(actualOutputPath, finalOutputPath);
				buffer = await fs.readFile(finalOutputPath);
			}

			// Get image dimensions using ImageMagick
			let imageDimensions = { width: opts.maxWidth, height: opts.maxHeight };
			try {
				const { spawn } = require('child_process');
				
				// Use ImageMagick identify to get image dimensions
				const identifyProcess = spawn('magick', [
					'identify',
					'-ping',
					'-format',
					'%wx%h',
					finalOutputPath
				], {
					stdio: ['pipe', 'pipe', 'pipe'],
					env: this.getAugmentedEnv()
				});
				
				const dimensionsOutput = await new Promise<string>((resolve, reject) => {
					let output = '';
					let error = '';
					
					identifyProcess.stdout?.on('data', (data: Buffer) => {
						output += data.toString();
					});
					
					identifyProcess.stderr?.on('data', (data: Buffer) => {
						error += data.toString();
					});
					
					identifyProcess.on('close', (code: number | null) => {
						if (code === 0) {
							resolve(output.trim());
						} else {
							reject(new Error(`ImageMagick identify failed with code ${code}: ${error}`));
						}
					});
					
					identifyProcess.on('error', (err: Error) => {
						reject(new Error(`Failed to spawn ImageMagick identify: ${err.message}`));
					});
				});
				
				// Parse dimensions from "WIDTHxHEIGHT" format
				const dimensionMatch = dimensionsOutput.match(/^(\d+)x(\d+)$/);
				if (dimensionMatch) {
					imageDimensions = {
						width: parseInt(dimensionMatch[1], 10),
						height: parseInt(dimensionMatch[2], 10)
					};
				}
			} catch (imagemagickError) {
				// Fallback to estimated dimensions if ImageMagick is not available
				console.warn('ImageMagick not available for image metadata, using estimated dimensions');
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