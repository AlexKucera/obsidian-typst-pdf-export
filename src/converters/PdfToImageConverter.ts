/**
 * PDF to Image conversion for embedded PDF files in Obsidian notes.
 *
 * This module provides a robust conversion system for transforming PDF files into
 * images suitable for embedding in Typst-generated PDFs. Since Typst has limited
 * native PDF embedding capabilities, this converter extracts the first page of
 * embedded PDFs and converts them to high-quality PNG or JPEG images.
 *
 * Key features:
 * - Singleton pattern for resource efficiency and state management
 * - First-page-only conversion for preview purposes
 * - Configurable image quality and dimensions
 * - Multi-strategy PDF processing (pdf-to-img library with ImageMagick fallback)
 * - Automatic format conversion and optimization
 * - File discovery for handling various filename patterns
 * - Comprehensive error handling and validation
 *
 * Conversion Pipeline:
 * 1. PDF validation (file exists, valid format, readable)
 * 2. Output directory preparation
 * 3. CLI execution via pdf-to-img or ImageMagick
 * 4. Generated file discovery (handles naming variations)
 * 5. Image optimization (format conversion, dimension detection)
 * 6. Result packaging with metadata
 *
 * The converter delegates to specialized utilities:
 * - PdfProcessor: PDF validation and metadata extraction
 * - PdfCliExecutor: Command-line tool execution
 * - FileDiscovery: Generated file location
 * - ImageOptimizer: Format conversion and dimension detection
 *
 * Architecture Notes:
 * - Singleton pattern ensures consistent state across exports
 * - Plugin reference enables vault file operations
 * - Modular design allows easy extension for multi-page conversion
 * - Error results preserve context for debugging
 */

import * as path from 'path';
import { PdfProcessor } from './pdf/PdfProcessor';
import { ImageOptimizer } from './pdf/ImageOptimizer';
import { PdfCliExecutor } from './pdf/PdfCliExecutor';
import { FileDiscovery } from './pdf/FileDiscovery';
import type { obsidianTypstPDFExport } from '../../main';
import { PathUtils } from '../core/PathUtils';

/**
 * Configuration options for PDF to image conversion.
 *
 * These options control the quality, dimensions, and format of generated images.
 * All options are optional with sensible defaults optimized for embedding in PDFs.
 *
 * @property scale - Rendering scale factor for image quality (default: 2.0)
 *   Higher values produce sharper images but larger file sizes. 2.0 is optimal
 *   for HiDPI displays and print-quality PDFs. Use 1.0 for web-optimized exports.
 * @property maxWidth - Maximum output image width in pixels (default: 800)
 *   Images wider than this are scaled down proportionally. Prevents excessive
 *   file sizes while maintaining readability in typical PDF layouts.
 * @property maxHeight - Maximum output image height in pixels (default: 600)
 *   Images taller than this are scaled down proportionally. Balances quality
 *   with file size for typical document heights.
 * @property format - Output image format (default: 'png')
 *   - 'png': Lossless compression, best for diagrams and text
 *   - 'jpeg': Lossy compression, smaller files for photos
 * @property quality - JPEG compression quality 1-100 (default: 90)
 *   Only applies when format is 'jpeg'. Higher values preserve more detail
 *   but increase file size. 90 provides excellent quality with good compression.
 *
 * @example
 * ```typescript
 * // High-quality conversion for print
 * const printOptions: PdfConversionOptions = {
 *   scale: 3.0,
 *   maxWidth: 1200,
 *   maxHeight: 900,
 *   format: 'png'
 * };
 * ```
 *
 * @example
 * ```typescript
 * // Web-optimized conversion
 * const webOptions: PdfConversionOptions = {
 *   scale: 1.0,
 *   maxWidth: 600,
 *   maxHeight: 450,
 *   format: 'jpeg',
 *   quality: 85
 * };
 * ```
 */
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

/**
 * Result of PDF to image conversion operation.
 *
 * This interface provides comprehensive information about the conversion outcome,
 * including file paths, dimensions, and success status. The result always includes
 * a success flag - when false, the error field provides diagnostic information.
 *
 * @property imagePath - Absolute path to the generated image file
 *   Empty string if conversion failed. Use this path to embed the image in Typst.
 * @property originalDimensions - Original PDF page dimensions in pixels
 *   Width and height of the PDF page before conversion. Set to {0, 0} on failure.
 *   Note: Currently estimates based on converted image due to library limitations.
 * @property imageDimensions - Generated image dimensions in pixels
 *   Actual width and height of the output image file. May differ from original
 *   due to scaling, format conversion, or optimization. Set to {0, 0} on failure.
 * @property success - Conversion success flag
 *   True if image was generated successfully, false if any error occurred.
 *   Always check this before using imagePath or dimension data.
 * @property error - Error message if conversion failed
 *   Present only when success is false. Contains diagnostic information about
 *   what went wrong (file not found, invalid PDF, conversion failure, etc.).
 *
 * @example
 * ```typescript
 * const result = await converter.convertFirstPageToImage(pdfPath, outputDir);
 *
 * if (result.success) {
 *   console.log('Image created:', result.imagePath);
 *   console.log('Dimensions:', result.imageDimensions);
 *   // Use result.imagePath in Typst template
 * } else {
 *   console.error('Conversion failed:', result.error);
 *   // Fallback to placeholder or skip embed
 * }
 * ```
 *
 * @example
 * ```typescript
 * // Handle dimension information
 * const result = await converter.convertFirstPageToImage(pdfPath, outputDir);
 *
 * if (result.success) {
 *   const aspectRatio = result.imageDimensions.width / result.imageDimensions.height;
 *   console.log('Aspect ratio:', aspectRatio.toFixed(2));
 *
 *   // Adjust Typst layout based on dimensions
 *   if (aspectRatio > 1.5) {
 *     // Wide image - use landscape layout
 *   }
 * }
 * ```
 */
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

/**
 * Singleton converter for transforming PDF files into embeddable images.
 *
 * This class provides the primary interface for PDF to image conversion in the
 * export pipeline. It implements the singleton pattern to ensure consistent state
 * and resource management across multiple conversion operations.
 *
 * Key Responsibilities:
 * - First-page extraction from PDF files
 * - High-quality image generation with configurable options
 * - PDF validation and metadata extraction
 * - Integration with Obsidian vault file system
 * - Error handling and result reporting
 *
 * Architecture:
 * The converter delegates to specialized utility classes:
 * - **PdfProcessor**: PDF file validation and metadata
 * - **PdfCliExecutor**: Command-line tool execution (pdf-to-img, ImageMagick)
 * - **FileDiscovery**: Generated file location and verification
 * - **ImageOptimizer**: Format conversion and dimension detection
 * - **PathUtils**: Obsidian vault file operations
 *
 * Singleton Pattern:
 * Use `getInstance()` to obtain the converter instance. The singleton ensures:
 * - Single plugin reference across all conversions
 * - Consistent configuration and state
 * - Efficient resource usage
 * - Simplified dependency injection
 *
 * Usage Flow:
 * 1. Get instance with plugin reference: `PdfToImageConverter.getInstance(plugin)`
 * 2. Convert PDF: `await converter.convertFirstPageToImage(path, outDir, options)`
 * 3. Check result.success and use result.imagePath in Typst template
 * 4. Handle errors via result.error message
 *
 * @example
 * ```typescript
 * // Initialize converter with plugin reference
 * const converter = PdfToImageConverter.getInstance(this.plugin);
 *
 * // Convert PDF with default options
 * const result = await converter.convertFirstPageToImage(
 *   '/vault/attachments/document.pdf',
 *   '/vault/.obsidian/plugins/typst-pdf-export/temp-images'
 * );
 *
 * if (result.success) {
 *   console.log('Converted to:', result.imagePath);
 *   // Embed result.imagePath in Typst template
 * } else {
 *   console.error('Conversion failed:', result.error);
 * }
 * ```
 *
 * @example
 * ```typescript
 * // High-quality conversion with custom options
 * const converter = PdfToImageConverter.getInstance(this.plugin);
 *
 * const result = await converter.convertFirstPageToImage(
 *   pdfPath,
 *   outputDir,
 *   {
 *     scale: 3.0,        // 3x rendering for print quality
 *     maxWidth: 1200,    // Larger dimensions
 *     format: 'png'      // Lossless format
 *   }
 * );
 * ```
 */
export class PdfToImageConverter {
	private static instance: PdfToImageConverter;
	private plugin: obsidianTypstPDFExport | undefined;

	/**
	 * Private constructor for singleton pattern.
	 *
	 * Use getInstance() to obtain the converter instance instead of constructing directly.
	 *
	 * @param plugin - Optional plugin reference for vault operations
	 * @private
	 */
	private constructor(plugin?: obsidianTypstPDFExport) {
		this.plugin = plugin;
	}

	/**
	 * Gets or creates the singleton PdfToImageConverter instance.
	 *
	 * This method ensures only one converter instance exists throughout the application
	 * lifecycle. If a plugin reference is provided on subsequent calls, it updates the
	 * stored reference to ensure vault operations work correctly.
	 *
	 * Thread Safety:
	 * This implementation is safe for single-threaded JavaScript execution.
	 * The singleton is created on first access and reused thereafter.
	 *
	 * @param plugin - Optional plugin reference (updates stored reference if provided)
	 * @returns The singleton PdfToImageConverter instance
	 *
	 * @example
	 * ```typescript
	 * // First call creates instance
	 * const converter1 = PdfToImageConverter.getInstance(this.plugin);
	 *
	 * // Subsequent calls return same instance
	 * const converter2 = PdfToImageConverter.getInstance();
	 * console.log(converter1 === converter2); // true
	 * ```
	 *
	 * @example
	 * ```typescript
	 * // Update plugin reference after initialization
	 * const converter = PdfToImageConverter.getInstance();  // No plugin initially
	 * // ... later ...
	 * PdfToImageConverter.getInstance(this.plugin);  // Updates plugin reference
	 * ```
	 */
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
	 * Converts the first page of a PDF file to a high-quality image.
	 *
	 * This is the primary conversion method that orchestrates the complete PDF-to-image
	 * pipeline. It handles validation, conversion, optimization, and error reporting in
	 * a single operation suitable for embedding in Typst exports.
	 *
	 * Conversion Pipeline:
	 * 1. **Validation**: Verify PDF file exists and is valid
	 * 2. **Directory Setup**: Ensure output directory exists (via vault adapter)
	 * 3. **CLI Execution**: Run pdf-to-img or ImageMagick to convert first page
	 * 4. **File Discovery**: Locate generated image (handles various naming patterns)
	 * 5. **Optimization**: Convert format and detect dimensions
	 * 6. **Result Packaging**: Return success with image path and metadata
	 *
	 * Error Handling:
	 * Each stage reports specific errors via PdfConversionResult. Common failures:
	 * - File not found or inaccessible
	 * - Invalid or corrupted PDF format
	 * - CLI tool execution failure
	 * - Output file not found after conversion
	 * - Image optimization failure
	 *
	 * All errors are captured and returned in result.error, never thrown as exceptions.
	 *
	 * Performance:
	 * - First-page-only conversion is fast (~1-2 seconds typical)
	 * - Uses CLI tools for native-quality rendering
	 * - Temporary files cleaned up automatically by caller
	 * - Suitable for batch processing multiple PDFs
	 *
	 * @param pdfPath - Absolute path to PDF file to convert
	 * @param outputDir - Absolute path to output directory for generated image
	 * @param options - Optional conversion configuration (defaults to HiDPI quality)
	 * @returns Promise resolving to conversion result with success status and metadata
	 *
	 * @example
	 * ```typescript
	 * // Basic conversion with defaults
	 * const converter = PdfToImageConverter.getInstance(this.plugin);
	 * const result = await converter.convertFirstPageToImage(
	 *   '/vault/attachments/report.pdf',
	 *   '/vault/.obsidian/plugins/typst-pdf-export/temp-images'
	 * );
	 *
	 * if (result.success) {
	 *   console.log('Image:', result.imagePath);
	 *   console.log('Size:', result.imageDimensions.width, 'x', result.imageDimensions.height);
	 *   // Use result.imagePath in Typst: #image("path")
	 * } else {
	 *   new Notice(`PDF conversion failed: ${result.error}`);
	 * }
	 * ```
	 *
	 * @example
	 * ```typescript
	 * // High-quality conversion for print
	 * const result = await converter.convertFirstPageToImage(
	 *   pdfPath,
	 *   outputDir,
	 *   {
	 *     scale: 3.0,
	 *     maxWidth: 1600,
	 *     maxHeight: 1200,
	 *     format: 'png'
	 *   }
	 * );
	 * ```
	 *
	 * @example
	 * ```typescript
	 * // Batch convert multiple PDFs
	 * const converter = PdfToImageConverter.getInstance(this.plugin);
	 * const pdfPaths = ['/vault/doc1.pdf', '/vault/doc2.pdf', '/vault/doc3.pdf'];
	 *
	 * for (const pdfPath of pdfPaths) {
	 *   const result = await converter.convertFirstPageToImage(pdfPath, outputDir);
	 *   if (result.success) {
	 *     console.log(`✓ ${path.basename(pdfPath)}`);
	 *   } else {
	 *     console.error(`✗ ${path.basename(pdfPath)}: ${result.error}`);
	 *   }
	 * }
	 * ```
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

			// Ensure output directory exists (convert absolute path to vault-relative for vault.adapter)
			if (this.plugin?.app) {
				const pathUtils = new PathUtils(this.plugin.app);
				const relativeOutputDir = pathUtils.toVaultRelative(outputDir);
				await pathUtils.ensureDir(relativeOutputDir);
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
				},
				this.plugin
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
	 * Validates whether a file is a readable PDF document.
	 *
	 * This utility method provides quick PDF validation before attempting conversion.
	 * It checks both file existence and PDF format validity by delegating to PdfProcessor.
	 *
	 * Validation includes:
	 * - File exists and is accessible
	 * - File has PDF magic bytes (header signature)
	 * - File is not corrupted or truncated
	 *
	 * Use this for pre-flight checks before expensive conversion operations or to
	 * filter PDF files from mixed file lists.
	 *
	 * @param filePath - Absolute path to file to validate
	 * @returns Promise resolving to true if file is valid PDF, false otherwise
	 *
	 * @example
	 * ```typescript
	 * const converter = PdfToImageConverter.getInstance(this.plugin);
	 *
	 * // Validate before conversion
	 * if (await converter.isValidPdf(pdfPath)) {
	 *   const result = await converter.convertFirstPageToImage(pdfPath, outputDir);
	 *   // Process result...
	 * } else {
	 *   new Notice('Not a valid PDF file');
	 * }
	 * ```
	 *
	 * @example
	 * ```typescript
	 * // Filter PDF files from attachments
	 * const attachments = app.vault.getFiles();
	 * const converter = PdfToImageConverter.getInstance(this.plugin);
	 *
	 * const validPdfs = [];
	 * for (const file of attachments) {
	 *   if (file.extension === 'pdf' && await converter.isValidPdf(file.path)) {
	 *     validPdfs.push(file);
	 *   }
	 * }
	 * console.log(`Found ${validPdfs.length} valid PDFs`);
	 * ```
	 */
	public async isValidPdf(filePath: string): Promise<boolean> {
		return await PdfProcessor.isValidPdf(filePath);
	}

	/**
	 * Retrieves metadata about a PDF file without converting it.
	 *
	 * This method extracts essential PDF information including page count and page
	 * dimensions. It's useful for:
	 * - Determining if multi-page conversion is needed
	 * - Checking PDF dimensions before conversion
	 * - Pre-flight validation with detailed error messages
	 * - UI display of PDF properties
	 *
	 * The method delegates to PdfProcessor for actual metadata extraction. On success,
	 * returns page count and first page dimensions. On failure, returns error details.
	 *
	 * Note: Dimensions are for the first page only. Multi-page PDFs may have varying
	 * page sizes, but this implementation focuses on first-page conversion.
	 *
	 * @param filePath - Absolute path to PDF file
	 * @returns Promise resolving to metadata object with page count, dimensions, and success status
	 *
	 * @example
	 * ```typescript
	 * const converter = PdfToImageConverter.getInstance(this.plugin);
	 * const info = await converter.getPdfInfo(pdfPath);
	 *
	 * if (info.success) {
	 *   console.log(`Pages: ${info.pageCount}`);
	 *   console.log(`Size: ${info.dimensions.width}x${info.dimensions.height}px`);
	 *
	 *   if (info.pageCount > 1) {
	 *     new Notice(`PDF has ${info.pageCount} pages - only first will be converted`);
	 *   }
	 * } else {
	 *   console.error('Failed to read PDF info:', info.error);
	 * }
	 * ```
	 *
	 * @example
	 * ```typescript
	 * // Adjust conversion options based on PDF dimensions
	 * const info = await converter.getPdfInfo(pdfPath);
	 *
	 * if (info.success) {
	 *   const isLandscape = info.dimensions.width > info.dimensions.height;
	 *
	 *   const options: PdfConversionOptions = {
	 *     maxWidth: isLandscape ? 1200 : 800,
	 *     maxHeight: isLandscape ? 800 : 1200
	 *   };
	 *
	 *   const result = await converter.convertFirstPageToImage(pdfPath, outputDir, options);
	 * }
	 * ```
	 *
	 * @example
	 * ```typescript
	 * // Check PDF before showing conversion dialog
	 * const info = await converter.getPdfInfo(pdfPath);
	 *
	 * if (!info.success) {
	 *   new Notice(`Cannot process PDF: ${info.error}`);
	 *   return;
	 * }
	 *
	 * // Show dialog with PDF details
	 * new PDFConversionModal(
	 *   this.app,
	 *   pdfPath,
	 *   `${info.pageCount} pages, ${info.dimensions.width}x${info.dimensions.height}px`
	 * ).open();
	 * ```
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