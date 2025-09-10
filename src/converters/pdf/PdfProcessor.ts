/**
 * PDF Processing utilities for validation and metadata extraction.
 * Handles PDF-specific operations separate from image conversion.
 */

import * as fs from 'fs/promises';

export interface PdfMetadata {
	/** Number of pages in the PDF */
	pageCount: number;
	/** PDF dimensions (width x height) */
	dimensions: { width: number; height: number };
	/** Operation success status */
	success: boolean;
	/** Error message if operation failed */
	error?: string;
}

export class PdfProcessor {
	/**
	 * Check if a file is a valid PDF by examining its signature.
	 * @param filePath Path to the file to validate
	 * @returns True if the file is a valid PDF, false otherwise
	 */
	public static async isValidPdf(filePath: string): Promise<boolean> {
		try {
			const buffer = await fs.readFile(filePath);
			
			// Check PDF signature - all valid PDFs must start with %PDF
			const signature = buffer.subarray(0, 4).toString();
			return signature === '%PDF';
		} catch (error) {
			return false;
		}
	}

	/**
	 * Get PDF metadata including page count and dimensions.
	 * @param filePath Path to the PDF file
	 * @returns PDF metadata with page count, dimensions, and status
	 */
	public static async getPdfInfo(filePath: string): Promise<PdfMetadata> {
		try {
			// First validate that this is a proper PDF file
			const isValid = await this.isValidPdf(filePath);
			if (!isValid) {
				return {
					pageCount: 0,
					dimensions: { width: 0, height: 0 },
					success: false,
					error: 'Invalid PDF file'
				};
			}

			// For now, return basic info since we use pdf-to-img for conversion
			// In a real implementation, you might want to use pdf-parse or similar for metadata
			// We only handle first page anyway in the conversion process
			return {
				pageCount: 1, // We only handle first page anyway
				dimensions: { width: 612, height: 792 }, // Standard letter size estimate
				success: true
			};
		} catch (error: unknown) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			return {
				pageCount: 0,
				dimensions: { width: 0, height: 0 },
				success: false,
				error: errorMessage
			};
		}
	}

	/**
	 * Validate that a PDF file exists and is accessible.
	 * @param filePath Path to the PDF file
	 * @returns Object with success status and error message if applicable
	 */
	public static async validatePdfFile(filePath: string): Promise<{
		success: boolean;
		error?: string;
	}> {
		try {
			await fs.access(filePath);
			return { success: true };
		} catch (error: unknown) {
			return {
				success: false,
				error: `PDF file not found: ${filePath}`
			};
		}
	}

	/**
	 * Check if a file exists and is a valid PDF.
	 * Combines file existence check with PDF validation.
	 * @param filePath Path to the file to check
	 * @returns True if file exists and is a valid PDF, false otherwise
	 */
	public static async isValidPdfFile(filePath: string): Promise<boolean> {
		const validation = await this.validatePdfFile(filePath);
		if (!validation.success) {
			return false;
		}
		
		return await this.isValidPdf(filePath);
	}
}