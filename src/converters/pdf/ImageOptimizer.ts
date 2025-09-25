/**
 * Image optimization utilities for PDF to image conversion.
 * Handles format conversion, quality management, and dimension detection.
 */

import * as path from 'path';
import { PathUtils } from '../../core/PathUtils';
import type { obsidianTypstPDFExport } from '../../../main';

export interface ImageOptimizationOptions {
	/** Output format (default: 'png') */
	format?: 'png' | 'jpeg';
	/** JPEG quality if using jpeg format (default: 90) */
	quality?: number;
}

export interface ImageDimensions {
	width: number;
	height: number;
}

export interface ImageOptimizationResult {
	/** Path to the optimized image file */
	imagePath: string;
	/** Image dimensions after optimization */
	dimensions: ImageDimensions;
	/** Success status */
	success: boolean;
	/** Error message if optimization failed */
	error?: string;
}

export class ImageOptimizer {
	/**
	 * Get augmented environment with extended PATH for ImageMagick
	 */
	private static getAugmentedEnv(): NodeJS.ProcessEnv {
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

	/**
	 * Convert PNG image to JPEG with quality optimization.
	 * Falls back to keeping PNG format if ImageMagick is not available.
	 */
	public static async convertPngToJpeg(
		inputPngPath: string,
		outputJpegPath: string,
		quality: number = 90
	): Promise<{success: boolean; error?: string}> {
		try {
			const { spawn } = require('child_process');
			
			// Use ImageMagick to convert PNG to JPEG
			const convertProcess = spawn('magick', [
				inputPngPath,
				'-quality', quality.toString(),
				outputJpegPath
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
			
			return { success: true };
		} catch (error: unknown) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			return {
				success: false,
				error: `JPEG conversion failed: ${errorMessage}`
			};
		}
	}

	/**
	 * Get image dimensions using ImageMagick identify command.
	 * Falls back to estimated dimensions if ImageMagick is not available.
	 */
	public static async getImageDimensions(
		imagePath: string,
		fallbackDimensions: ImageDimensions = { width: 800, height: 600 }
	): Promise<{dimensions: ImageDimensions; success: boolean; error?: string}> {
		try {
			const { spawn } = require('child_process');
			
			// Use ImageMagick identify to get image dimensions
			const identifyProcess = spawn('magick', [
				'identify',
				'-ping',
				'-format',
				'%wx%h',
				imagePath
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
				const dimensions = {
					width: parseInt(dimensionMatch[1], 10),
					height: parseInt(dimensionMatch[2], 10)
				};
				return {
					dimensions,
					success: true
				};
			} else {
				return {
					dimensions: fallbackDimensions,
					success: false,
					error: 'Could not parse dimensions from ImageMagick output'
				};
			}
		} catch (error: unknown) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			console.warn('ImageMagick not available for image metadata, using fallback dimensions');
			return {
				dimensions: fallbackDimensions,
				success: false,
				error: `Failed to get image dimensions: ${errorMessage}`
			};
		}
	}

	/**
	 * Optimize an image by converting format and/or adjusting quality.
	 * Handles both PNG to JPEG conversion and dimension detection.
	 */
	public static async optimizeImage(
		inputImagePath: string,
		outputDir: string,
		baseFileName: string,
		options: ImageOptimizationOptions = {},
		plugin?: obsidianTypstPDFExport
	): Promise<ImageOptimizationResult> {
		try {
			const opts = {
				format: options.format || 'png',
				quality: options.quality || 90
			};

			// Generate final output path
			const finalOutputFileName = `${baseFileName}_preview.${opts.format}`;
			let finalOutputPath: string;
			if (plugin?.app) {
				const pathUtils = new PathUtils(plugin.app);
				finalOutputPath = pathUtils.joinPath(outputDir, finalOutputFileName);
			} else {
				finalOutputPath = path.join(outputDir, finalOutputFileName);
			}

			let actualImagePath = inputImagePath;

			// Handle format conversion if needed
			if (opts.format === 'jpeg') {
				// Convert PNG to JPEG using ImageMagick
				const conversionResult = await this.convertPngToJpeg(
					inputImagePath,
					finalOutputPath,
					opts.quality
				);

				if (conversionResult.success) {
					// Clean up the original PNG if conversion succeeded
					try {
						if (plugin?.app) {
							await plugin.app.vault.adapter.remove(inputImagePath);
						} else {
							const fs = require('fs').promises;
							await fs.unlink(inputImagePath);
						}
					} catch (unlinkError) {
						console.warn(`Could not remove original PNG: ${unlinkError}`);
					}
					actualImagePath = finalOutputPath;
				} else {
					console.warn(`ImageMagick not available for JPEG conversion, keeping PNG format: ${conversionResult.error}`);
					// Just rename the file to PNG format
					const pngFinalPath = finalOutputPath.replace(/\.jpeg?$/, '.png');
					if (plugin?.app) {
						const content = await plugin.app.vault.adapter.readBinary(inputImagePath);
						await plugin.app.vault.adapter.writeBinary(pngFinalPath, content);
						await plugin.app.vault.adapter.remove(inputImagePath);
					} else {
						const fs = require('fs').promises;
						await fs.rename(inputImagePath, pngFinalPath);
					}
					actualImagePath = pngFinalPath;
				}
			} else {
				// Keep as PNG, just rename to final location
				if (plugin?.app) {
					const content = await plugin.app.vault.adapter.readBinary(inputImagePath);
					await plugin.app.vault.adapter.writeBinary(finalOutputPath, content);
					await plugin.app.vault.adapter.remove(inputImagePath);
				} else {
					const fs = require('fs').promises;
					await fs.rename(inputImagePath, finalOutputPath);
				}
				actualImagePath = finalOutputPath;
			}

			// Get image dimensions
			const dimensionResult = await this.getImageDimensions(actualImagePath);

			return {
				imagePath: actualImagePath,
				dimensions: dimensionResult.dimensions,
				success: true
			};

		} catch (error: unknown) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			return {
				imagePath: '',
				dimensions: { width: 0, height: 0 },
				success: false,
				error: `Image optimization failed: ${errorMessage}`
			};
		}
	}
}