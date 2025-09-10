/**
 * EmbedProcessor - Handles conversion of Obsidian embed syntax to markdown references
 * Processes images, PDFs, and generic file embeds with appropriate markers for later processing
 */

import { WikilinkProcessor } from './WikilinkProcessor';

export interface EmbedProcessorConfig {
	/** WikilinkProcessor instance for path sanitization */
	wikilinkProcessor: WikilinkProcessor;
}

// Note: PreprocessingResult is imported from the parent MarkdownPreprocessor module
export interface PreprocessingResult {
	/** Processed markdown content */
	content: string;
	/** Extracted metadata including tags and frontmatter */
	metadata: {
		tags: string[];
		frontmatter?: Record<string, any>;
		title?: string;
		pdfEmbeds?: Array<{
			originalPath: string;
			sanitizedPath: string;
			fileName: string;
			baseName: string;
			options?: string;
			marker: string;
		}>;
		imageEmbeds?: Array<{
			originalPath: string;
			sanitizedPath: string;
			fileName: string;
			baseName: string;
			sizeOrAlt?: string;
			marker: string;
		}>;
		fileEmbeds?: Array<{
			originalPath: string;
			sanitizedPath: string;
			fileName: string;
			baseName: string;
			fileType: string;
			options?: string;
			marker: string;
		}>;
	};
	/** Processing errors and warnings */
	errors: string[];
	/** Processing warnings */
	warnings: string[];
}

export class EmbedProcessor {
	private wikilinkProcessor: WikilinkProcessor;
	
	// Regex patterns for embed matching
	private readonly EMBED_PATTERN = /!\[\[([^\|\]]+)(?:\|([^\]]+))?\]\]/g;
	private readonly EMBED_SIZE_PATTERN = /(\d+)(?:x(\d+))?/;
	
	constructor(config: EmbedProcessorConfig) {
		this.wikilinkProcessor = config.wikilinkProcessor;
	}
	
	/**
	 * Convert embed syntax to standard markdown references
	 */
	public processEmbeds(content: string, result: PreprocessingResult): string {
		return content.replace(this.EMBED_PATTERN, (match, embedPath, sizeOrAlt) => {
			try {
				const cleanPath = embedPath.trim();
				
				if (!cleanPath) {
					result.warnings.push(`Empty embed path found: ${match}`);
					return match;
				}
				
				// Parse file extension and path
				const fileExtension = this.getFileExtension(cleanPath);
				const fileType = this.determineFileType(fileExtension);
				
				// Handle different file types
				switch (fileType) {
					case 'image':
						return this.processImageEmbed(cleanPath, sizeOrAlt, result);
					
					case 'pdf':
						return this.processPdfEmbed(cleanPath, sizeOrAlt, result);
					
					case 'file':
						return this.processFileEmbed(cleanPath, sizeOrAlt, result);
					
					default:
						// This should never happen with the simplified type system
						result.warnings.push(`Unexpected file type for embed: ${cleanPath}`);
						return this.processFileEmbed(cleanPath, sizeOrAlt, result);
				}
				
			} catch (error) {
				result.warnings.push(`Failed to process embed: ${match} - ${error.message}`);
				return match; // Return original on error
			}
		});
	}
	
	/**
	 * Get file extension from path
	 */
	private getFileExtension(filePath: string): string {
		const lastDot = filePath.lastIndexOf('.');
		return lastDot > 0 ? filePath.substring(lastDot).toLowerCase() : '';
	}
	
	/**
	 * Determine file type based on extension
	 * Simplified to 3 types: image (displayed), pdf (embedded with preview), file (embedded)
	 */
	private determineFileType(extension: string): 'image' | 'pdf' | 'file' {
		const imageExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp', '.bmp', '.ico', '.tiff'];
		
		if (imageExtensions.includes(extension)) return 'image';
		if (extension === '.pdf') return 'pdf';
		
		// All other file types (including DOCX, videos, audio, etc.) are treated as files to be embedded
		return 'file';
	}
	
	/**
	 * Process image embeds with size parameters
	 */
	private processImageEmbed(imagePath: string, sizeOrAlt: string | undefined, result: PreprocessingResult): string {
		const sanitizedPath = this.wikilinkProcessor.sanitizeFilePath(imagePath);
		
		// For now, we'll mark this for async processing and return a placeholder
		// The actual copying will be handled in the main export process
		const fileName = imagePath.substring(imagePath.lastIndexOf('/') + 1);
		const baseName = fileName.replace(/\.[^/.]+$/, ""); // Remove extension
		
		// Create a marker that the export process can detect and replace
		const marker = `IMAGE_EMBED_MARKER:${imagePath}:${baseName}:${sizeOrAlt || ''}`;
		
		// Add to processing queue for later copying
		if (!result.metadata.imageEmbeds) {
			result.metadata.imageEmbeds = [];
		}
		result.metadata.imageEmbeds.push({
			originalPath: imagePath,
			sanitizedPath: sanitizedPath,
			fileName: fileName,
			baseName: baseName,
			sizeOrAlt: sizeOrAlt,
			marker: marker
		});
		
		result.warnings.push(`Image embed queued for processing: ${imagePath}`);
		
		return marker;
	}
	
	/**
	 * Process PDF embeds - Convert to image preview with PDF attachment using Typst's pdf.embed
	 */
	private processPdfEmbed(pdfPath: string, options: string | undefined, result: PreprocessingResult): string {
		const sanitizedPath = this.wikilinkProcessor.sanitizeFilePath(pdfPath);
		
		// For now, we'll mark this for async processing and return a placeholder
		// The actual conversion will be handled in the main export process
		const fileName = pdfPath.substring(pdfPath.lastIndexOf('/') + 1);
		const baseName = fileName.replace(/\.[^/.]+$/, ""); // Remove extension
		
		// Create a marker that the export process can detect and replace with Typst code
		const marker = `TYPST_PDF_EMBED_MARKER:${pdfPath}:${baseName}:${options || ''}`;
		
		// Add to processing queue for later conversion
		if (!result.metadata.pdfEmbeds) {
			result.metadata.pdfEmbeds = [];
		}
		result.metadata.pdfEmbeds.push({
			originalPath: pdfPath,
			sanitizedPath: sanitizedPath,
			fileName: fileName,
			baseName: baseName,
			options: options,
			marker: marker
		});
		
		result.warnings.push(`PDF embed queued for processing with Typst pdf.embed: ${pdfPath}`);
		
		return marker;
	}
	
	/**
	 * Process generic file embeds - Convert to attachment using Typst's pdf.embed
	 * Note: This handles all non-image, non-PDF files including videos, audio, documents, etc.
	 */
	private processFileEmbed(filePath: string, options: string | undefined, result: PreprocessingResult): string {
		const sanitizedPath = this.wikilinkProcessor.sanitizeFilePath(filePath);
		
		// For now, we'll mark this for async processing and return a placeholder
		// The actual embedding will be handled in the main export process
		const fileName = filePath.substring(filePath.lastIndexOf('/') + 1);
		const baseName = fileName.replace(/\.[^/.]+$/, ""); // Remove extension
		const fileExtension = this.getFileExtension(fileName);
		
		// Create a marker that the export process can detect and replace with Typst code
		const marker = `FILE_EMBED_MARKER:${filePath}:${baseName}:${options || ''}`;
		
		// Add to processing queue for later conversion
		if (!result.metadata.fileEmbeds) {
			result.metadata.fileEmbeds = [];
		}
		result.metadata.fileEmbeds.push({
			originalPath: filePath,
			sanitizedPath: sanitizedPath,
			fileName: fileName,
			baseName: baseName,
			fileType: fileExtension,
			options: options,
			marker: marker
		});
		
		result.warnings.push(`File embed queued for processing with Typst pdf.embed: ${filePath}`);
		
		return marker;
	}
	
	/**
	 * Update configuration
	 */
	public updateConfig(config: Partial<EmbedProcessorConfig>): void {
		if (config.wikilinkProcessor) {
			this.wikilinkProcessor = config.wikilinkProcessor;
		}
	}
	
	/**
	 * Get current configuration
	 */
	public getConfig(): EmbedProcessorConfig {
		return {
			wikilinkProcessor: this.wikilinkProcessor
		};
	}
}