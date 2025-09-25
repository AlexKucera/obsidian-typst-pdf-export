/**
 * PDF to Image Converter using pdf-to-img
 * Converts PDF files to PNG images for preview in Typst exports
 */

import * as path from 'path';
import { PdfProcessor } from './pdf/PdfProcessor';
import { ImageOptimizer } from './pdf/ImageOptimizer';
import { PdfCliExecutor } from './pdf/PdfCliExecutor';
import { FileDiscovery } from './pdf/FileDiscovery';
import type { obsidianTypstPDFExport } from '../../main';
import { PathUtils } from '../core/PathUtils';

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
	private plugin: obsidianTypstPDFExport | undefined;

	private constructor(plugin?: obsidianTypstPDFExport) {
		this.plugin = plugin;
	}


	public static getInstance(plugin?: obsidianTypstPDFExport): PdfToImageConverter {
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
			if (this.plugin?.app) {
				const pathUtils = new PathUtils(this.plugin.app);
				await pathUtils.ensureDir(outputDir);
			}

			// Generate expected output file name for the first page
			const pdfBaseName = path.basename(pdfPath, path.extname(pdfPath));
			const expectedOutputFileName = FileDiscovery.generateExpectedFilename(pdfBaseName, 1, 'png');
			
			// Execute PDF to image conversion using CLI
			const cliResult = await PdfCliExecutor.executePdf2Img(
				pdfPath,
				{
					scale: opts.scale,
					pages: '1', // Only convert the first page
					outputDir: outputDir
				},
				this.plugin
			);

			if (!cliResult.success) {
				return {
					imagePath: '',
					originalDimensions: { width: 0, height: 0 },
					imageDimensions: { width: 0, height: 0 },
					success: false,
					error: cliResult.error
				};
			}

			// Find the generated image file (may have different name than expected)
			const fileDiscovery = await FileDiscovery.findGeneratedFile(outputDir, expectedOutputFileName, this.plugin);
			if (!fileDiscovery.found) {
				return {
					imagePath: '',
					originalDimensions: { width: 0, height: 0 },
					imageDimensions: { width: 0, height: 0 },
					success: false,
					error: fileDiscovery.error
				};
			}

			// Use ImageOptimizer to handle format conversion and dimension detection
			const optimizationResult = await ImageOptimizer.optimizeImage(
				fileDiscovery.filePath,
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

		} catch (error: unknown) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			return {
				imagePath: '',
				originalDimensions: { width: 0, height: 0 },
				imageDimensions: { width: 0, height: 0 },
				success: false,
				error: `PDF conversion failed: ${errorMessage}`
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