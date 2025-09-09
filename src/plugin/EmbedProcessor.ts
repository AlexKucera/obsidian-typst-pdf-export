/**
 * Embed Processing
 * Handles processing of PDF, image, and file embeds for PDF export
 */

import { TFile } from 'obsidian';
import type { obsidianTypstPDFExport } from '../../main';
import { ExportErrorHandler } from '../core/ExportErrorHandler';
import * as path from 'path';
import * as fs from 'fs';

export class EmbedProcessor {
	constructor(private plugin: obsidianTypstPDFExport) {}
	
	/**
	 * Process PDF embeds - convert PDF pages to images for inclusion
	 */
	async processPdfEmbeds(processedResult: any, vaultBasePath: string, tempDir: string, currentFile?: TFile, embedPdfFiles: boolean = true): Promise<void> {
		const { PdfToImageConverter } = await import('../converters/PdfToImageConverter');
		const converter = PdfToImageConverter.getInstance(this.plugin);
		
		let updatedContent = processedResult.content;
		
		for (const pdfEmbed of processedResult.metadata.pdfEmbeds) {
			try {
				// Resolve PDF path using helper method
				const fullPdfPath = await this.resolvePdfPath(pdfEmbed.sanitizedPath, vaultBasePath, currentFile);
				
				if (!fullPdfPath) {
					console.warn(`Export: PDF file not found: ${decodeURIComponent(pdfEmbed.sanitizedPath)}`);
					// Replace marker with fallback message
					const fallbackOutput = `*⚠️ PDF not found: ${pdfEmbed.baseName}*`;
					updatedContent = updatedContent.replace(pdfEmbed.marker, fallbackOutput);
					continue;
				}
				
				// Convert PDF first page to image - pass options object as third parameter
				const result = await converter.convertFirstPageToImage(
					fullPdfPath,
					tempDir,
					{
						scale: 1.5,
						maxWidth: 800,
						maxHeight: 600,
						format: 'png'
					}
				);
				
				if (result.success && result.imagePath) {
					// Copy image to vault temp directory and get relative paths
					const { relativeImagePath, relativePdfPath } = await this.copyImageToVaultTemp(
						result.imagePath,
						fullPdfPath,
						pdfEmbed.baseName,
						vaultBasePath
					);
					
					// Create combined output with image and optionally Typst pdf.embed using helper
					const combinedOutput = this.generatePdfEmbedContent(
						relativePdfPath,
						pdfEmbed.baseName,
						relativeImagePath,
						undefined,
						embedPdfFiles
					);
					
					// Replace the placeholder with the combined output
					updatedContent = updatedContent.replace(pdfEmbed.marker, combinedOutput);
					
				} else {
					console.warn(`Export: Failed to convert PDF to image: ${result.error}`);
					const relativePdfPath = path.relative(vaultBasePath, fullPdfPath);
					// Even without preview image, still embed the PDF if requested
					const fallbackOutput = this.generatePdfEmbedContent(
						relativePdfPath, 
						pdfEmbed.baseName, 
						undefined, 
						'(preview not available)',
						embedPdfFiles
					);
					updatedContent = updatedContent.replace(pdfEmbed.marker, fallbackOutput);
				}
			} catch (error) {
				ExportErrorHandler.handleProcessingError('PDF embed', pdfEmbed.originalPath, error);
				// Still try to embed the PDF even if there's a processing error
				const relativePdfPath = path.relative(vaultBasePath, pdfEmbed.originalPath);
				const fallbackOutput = this.generatePdfEmbedContent(
					relativePdfPath, 
					pdfEmbed.baseName, 
					undefined, 
					'(error occurred)',
					embedPdfFiles
				);
				updatedContent = updatedContent.replace(pdfEmbed.marker, fallbackOutput);
			}
		}
		
		// Update the processed result with the new content
		processedResult.content = updatedContent;
	}
	
	/**
	 * Process image embeds - ensure images are accessible for Typst
	 */
	async processImageEmbeds(processedResult: any, vaultBasePath: string, tempDir: string, currentFile?: TFile): Promise<void> {
		let updatedContent = processedResult.content;
		
		for (const imageEmbed of processedResult.metadata.imageEmbeds) {
			try {
				// Decode the URL-encoded sanitized path back to normal characters
				const decodedPath = decodeURIComponent(imageEmbed.sanitizedPath);
				
				// Try multiple path resolution strategies
				const possiblePaths = [
					// Strategy 1: Relative to vault root (standard Obsidian behavior)
					path.resolve(vaultBasePath, decodedPath),
					// Strategy 2: Relative to current file's directory (for local attachments)
					currentFile ? path.resolve(vaultBasePath, path.dirname(currentFile.path), decodedPath) : null,
					// Strategy 3: Check in attachments folder (common pattern)
					path.resolve(vaultBasePath, 'attachments', path.basename(decodedPath))
				].filter((p): p is string => p !== null);
				
				let fullImagePath = null;
				
				// Try each possible path until we find one that exists
				for (const possiblePath of possiblePaths) {
					try {
						await fs.promises.access(possiblePath);
						fullImagePath = possiblePath;
						break;
					} catch {
						// File doesn't exist, continue to next path
					}
				}
				
				if (!fullImagePath) {
					console.warn(`Export: Image file not found: ${decodedPath}`);
					// Keep the original marker or replace with placeholder
					const fallbackOutput = `[⚠️ **Image not found:** ${imageEmbed.sizeOrAlt || imageEmbed.originalPath}]`;
					updatedContent = updatedContent.replace(imageEmbed.marker, fallbackOutput);
					continue;
				}
				
				// Handle WebP conversion if needed
				let finalImagePath = fullImagePath;
				const fileExtension = path.extname(fullImagePath).toLowerCase();
				
				if (fileExtension === '.webp') {
					// Convert WebP to PNG using ImageMagick
					const originalImageName = path.basename(fullImagePath);
					const pngFileName = originalImageName.replace(/\.webp$/i, '.png');
					const vaultTempImagesDir = path.join(vaultBasePath, this.plugin.manifest.dir!, 'temp-images');
					await fs.promises.mkdir(vaultTempImagesDir, { recursive: true });
					
					const convertedImagePath = path.join(vaultTempImagesDir, pngFileName);
					
					console.log(`Export: Converting WebP to PNG: ${originalImageName} -> ${pngFileName}`);
					
					const { exec } = require('child_process');
					const util = require('util');
					const execAsync = util.promisify(exec);
					
					try {
						// Use PathResolver to get the correct ImageMagick path
						const { PathResolver } = await import('./PathResolver');
						const pathResolver = new PathResolver(this.plugin);
						const imagemagickPath = pathResolver.resolveExecutablePath(
							this.plugin.settings.executablePaths.imagemagickPath,
							'magick'
						);
						
						if (!imagemagickPath) {
							throw new Error('ImageMagick not found - please install ImageMagick or configure the path in settings');
						}
						
						// Use resolved ImageMagick path to convert WebP to PNG
						await execAsync(`"${imagemagickPath}" "${fullImagePath}" "${convertedImagePath}"`);
						console.log(`Export: Successfully converted WebP to PNG: ${pngFileName}`);
						finalImagePath = convertedImagePath;
					} catch (convertError) {
						console.error(`Export: Failed to convert WebP image: ${convertError.message}`);
						// Fall back to original path and let Typst/Pandoc handle the error
						console.warn(`Export: Proceeding with original WebP file: ${fullImagePath}`);
					}
				}
				
				// Get relative path from vault base for the final image
				const relativeImagePath = path.relative(vaultBasePath, finalImagePath);
				
				// Create the appropriate markdown output based on size/alt text
				let imageOutput;
				if (imageEmbed.sizeOrAlt) {
					// Check if it's size information (width x height pattern)
					const sizeMatch = imageEmbed.sizeOrAlt.match(/^(\d+)(?:x(\d+))?$/);
					if (sizeMatch) {
						const width = sizeMatch[1];
						const height = sizeMatch[2];
						
						// Create image with size attributes (optimized for Pandoc → Typst conversion)
						if (height) {
							imageOutput = `<img src="${relativeImagePath}" width="${width}" height="${height}" alt="${imageEmbed.baseName}" />`;
						} else {
							imageOutput = `<img src="${relativeImagePath}" width="${width}" alt="${imageEmbed.baseName}" />`;
						}
					} else {
						// Treat as alt text
						imageOutput = `![${imageEmbed.sizeOrAlt}](${relativeImagePath})`;
					}
				} else {
					// Standard image reference
					imageOutput = `![${imageEmbed.baseName}](${relativeImagePath})`;
				}
				
				updatedContent = updatedContent.replace(imageEmbed.marker, imageOutput);
				
			} catch (error) {
				const { fallback } = ExportErrorHandler.handleProcessingError(
					'image embed',
					imageEmbed.originalPath,
					error,
					`[⚠️ **Image processing error:** ${imageEmbed.sizeOrAlt || imageEmbed.originalPath}]`
				);
				updatedContent = updatedContent.replace(imageEmbed.marker, fallback);
			}
		}
		
		// Update the processed result with the new content  
		processedResult.content = updatedContent;
	}
	
	/**
	 * Process file embeds - Convert to attachments using Typst's pdf.embed
	 */
	async processFileEmbeds(processedResult: any, vaultBasePath: string, tempDir: string, currentFile?: TFile, embedAllFiles: boolean = true): Promise<void> {
		let updatedContent = processedResult.content;
		
		for (const fileEmbed of processedResult.metadata.fileEmbeds) {
			try {
				// Resolve file path using helper method (similar to PDF processing)
				const fullFilePath = await this.resolveFilePath(fileEmbed.sanitizedPath, vaultBasePath, currentFile);
				
				if (!fullFilePath) {
					console.warn(`Export: File not found: ${decodeURIComponent(fileEmbed.sanitizedPath)}`);
					// Replace marker with fallback message
					const fallbackOutput = `*⚠️ File not found: ${fileEmbed.baseName}*`;
					updatedContent = updatedContent.replace(fileEmbed.marker, fallbackOutput);
					continue;
				}
				
				if (embedAllFiles) {
					// Get relative path from vault base
					const relativeFilePath = path.relative(vaultBasePath, fullFilePath);
					
					// Create file embed content using helper method
					const combinedOutput = this.generateFileEmbedContent(
						relativeFilePath,
						fileEmbed.baseName,
						fileEmbed.fileType,
						undefined
					);
					
					// Replace the placeholder with the combined output
					updatedContent = updatedContent.replace(fileEmbed.marker, combinedOutput);
				} else {
					// Just show as a link if embedding is disabled
					const relativeFilePath = path.relative(vaultBasePath, fullFilePath);
					const fileIcon = this.getFileTypeIcon(fileEmbed.fileType);
					const linkOutput = `[${fileIcon} ${fileEmbed.fileName}](${relativeFilePath})`;
					updatedContent = updatedContent.replace(fileEmbed.marker, linkOutput);
				}
				
			} catch (error) {
				ExportErrorHandler.handleProcessingError('File embed', fileEmbed.originalPath, error);
				// Still try to show as a link even if there's a processing error
				const relativeFilePath = path.relative(vaultBasePath, fileEmbed.originalPath);
				const fileIcon = this.getFileTypeIcon(fileEmbed.fileType);
				const fallbackOutput = `[${fileIcon} ${fileEmbed.fileName} (error occurred)](${relativeFilePath})`;
				updatedContent = updatedContent.replace(fileEmbed.marker, fallbackOutput);
			}
		}
		
		// Update the processed result with the new content
		processedResult.content = updatedContent;
	}

	/**
	 * Resolve PDF path using Obsidian's link resolution API and filesystem fallbacks
	 * @param sanitizedPath The sanitized path from the embed
	 * @param vaultBasePath Base path of the vault
	 * @param currentFile Current file being processed (optional)
	 * @returns Full path to PDF file if found, null otherwise
	 */
	private async resolvePdfPath(sanitizedPath: string, vaultBasePath: string, currentFile?: TFile): Promise<string | null> {
		// Decode the URL-encoded sanitized path back to normal characters
		const decodedPath = decodeURIComponent(sanitizedPath);
		
		// Strategy 1: Use Obsidian's link resolution API (primary strategy)
		if (currentFile) {
			const resolvedFile = this.plugin.app.metadataCache.getFirstLinkpathDest(
				decodedPath, 
				currentFile.path
			);
			
			if (resolvedFile && resolvedFile instanceof TFile) {
				// Convert to full filesystem path
				const fullPath = path.resolve(vaultBasePath, resolvedFile.path);
				try {
					await fs.promises.access(fullPath);
					return fullPath;
				} catch {
					// File exists in metadata but not on filesystem, continue to fallbacks
				}
			}
		}
		
		// Fallback strategies: Try filesystem-based resolution
		const possiblePaths = [
			// Strategy 2: Relative to vault root (standard Obsidian behavior)
			path.resolve(vaultBasePath, decodedPath),
			// Strategy 3: Relative to current file's directory (for local attachments)
			currentFile ? path.resolve(vaultBasePath, path.dirname(currentFile.path), decodedPath) : null
		].filter((p): p is string => p !== null);
		
		// Try each possible path until we find one that exists
		for (const possiblePath of possiblePaths) {
			try {
				await fs.promises.access(possiblePath);
				return possiblePath;
			} catch {
				// File doesn't exist, continue to next path
			}
		}
		
		return null;
	}

	/**
	 * Resolve file path using Obsidian's link resolution API and filesystem fallbacks
	 */
	private async resolveFilePath(sanitizedPath: string, vaultBasePath: string, currentFile?: TFile): Promise<string | null> {
		// Decode the URL-encoded sanitized path back to normal characters
		const decodedPath = decodeURIComponent(sanitizedPath);
		
		// Strategy 1: Use Obsidian's link resolution API (primary strategy)
		if (currentFile) {
			const resolvedFile = this.plugin.app.metadataCache.getFirstLinkpathDest(
				decodedPath, 
				currentFile.path
			);
			
			if (resolvedFile && resolvedFile instanceof TFile) {
				// Convert to full filesystem path
				const fullPath = path.resolve(vaultBasePath, resolvedFile.path);
				try {
					await fs.promises.access(fullPath);
					return fullPath;
				} catch {
					// File exists in metadata but not on filesystem, continue to fallbacks
				}
			}
		}
		
		// Fallback strategies: Try filesystem-based resolution
		const possiblePaths = [
			// Strategy 2: Relative to vault root (standard Obsidian behavior)
			path.resolve(vaultBasePath, decodedPath),
			// Strategy 3: Relative to current file's directory (for local attachments)
			currentFile ? path.resolve(vaultBasePath, path.dirname(currentFile.path), decodedPath) : null,
			// Strategy 4: Check in attachments folder (common pattern)
			path.resolve(vaultBasePath, 'attachments', path.basename(decodedPath))
		].filter((p): p is string => p !== null);
		
		// Try each possible path until we find one that exists
		for (const possiblePath of possiblePaths) {
			try {
				await fs.promises.access(possiblePath);
				return possiblePath;
			} catch {
				// File doesn't exist, continue to next path
			}
		}
		
		return null;
	}

	/**
	 * Copy converted PDF image to vault temp directory and get relative paths
	 * @param imagePath Path to the converted image
	 * @param pdfPath Path to the original PDF
	 * @param baseName Base name of the PDF
	 * @param vaultBasePath Base path of the vault
	 * @returns Object with relative paths for image and PDF
	 */
	private async copyImageToVaultTemp(
		imagePath: string,
		pdfPath: string,
		baseName: string,
		vaultBasePath: string
	): Promise<{ relativeImagePath: string; relativePdfPath: string }> {
		// Copy image to vault temp directory for access
		const vaultTempImagesDir = path.join(vaultBasePath, this.plugin.manifest.dir!, 'temp-images');
		await fs.promises.mkdir(vaultTempImagesDir, { recursive: true });
		
		// Sanitize the basename for use in filename - replace problematic characters
		const sanitizedBaseName = baseName
			.replace(/[^a-zA-Z0-9\-_]/g, '_')  // Replace non-alphanumeric chars with underscore
			.replace(/_{2,}/g, '_')            // Collapse multiple underscores
			.replace(/^_+|_+$/g, '');          // Remove leading/trailing underscores
		
		const imageFileName = `${sanitizedBaseName}_preview.png`;
		const vaultImagePath = path.join(vaultTempImagesDir, imageFileName);
		await fs.promises.copyFile(imagePath, vaultImagePath);
		
		// Get relative paths from vault base
		const relativeImagePath = path.relative(vaultBasePath, vaultImagePath);
		const relativePdfPath = path.relative(vaultBasePath, pdfPath);
		
		return { relativeImagePath, relativePdfPath };
	}

	private generatePdfEmbedContent(
		relativePdfPath: string,
		baseName: string,
		relativeImagePath?: string,
		errorSuffix?: string,
		embedPdfFiles: boolean = true
	): string {
		const description = `${baseName}${errorSuffix ? ` ${errorSuffix}` : ''}`;
		
		const content = [];
		
		// Always include image preview if available
		if (relativeImagePath) {
			content.push(`![${baseName} - Page 1](${relativeImagePath})`);
			content.push('');
		}
		
		// Only include PDF embedding and attachment note if embedPdfFiles is true
		if (embedPdfFiles) {
			content.push('```{=typst}');
			content.push(`#pdf.embed("${relativePdfPath}", description: "${description}", mime-type: "application/pdf")`);
			content.push('```');
			content.push('');
			content.push(`*PDF attached: ${description} - check your PDF reader's attachment panel*`);
		}
		
		return content.filter(line => line !== null).join('\n');
	}

	/**
	 * Generate file embed content with proper Typst pdf.embed syntax
	 */
	private generateFileEmbedContent(
		relativeFilePath: string,
		baseName: string,
		fileExtension: string,
		errorSuffix?: string
	): string {
		const description = `${baseName}${errorSuffix ? ` ${errorSuffix}` : ''}`;
		const mimeType = this.getMimeTypeFromExtension(fileExtension);
		const fileIcon = this.getFileTypeIcon(fileExtension);
		
		const content = [];
		
		// Add file embed using Typst's pdf.embed
		content.push('```{=typst}');
		content.push(`#pdf.embed("${relativeFilePath}", description: "${description}", mime-type: "${mimeType}")`);
		content.push('```');
		content.push('');
		content.push(`*File attached: ${fileIcon} ${description} - check your PDF reader's attachment panel*`);
		
		return content.filter(line => line !== null).join('\n');
	}

	/**
	 * Get MIME type from file extension
	 */
	private getMimeTypeFromExtension(extension: string): string {
		const mimeTypes: Record<string, string> = {
			// Office documents
			'.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
			'.xls': 'application/vnd.ms-excel',
			'.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
			'.ppt': 'application/vnd.ms-powerpoint',
			'.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
			'.doc': 'application/msword',
			// Open Document Format
			'.odt': 'application/vnd.oasis.opendocument.text',
			'.ods': 'application/vnd.oasis.opendocument.spreadsheet',
			'.odp': 'application/vnd.oasis.opendocument.presentation',
			// Archives
			'.zip': 'application/zip',
			'.rar': 'application/vnd.rar',
			'.7z': 'application/x-7z-compressed',
			'.tar': 'application/x-tar',
			'.gz': 'application/gzip',
			'.bz2': 'application/x-bzip2',
			// Text/data formats
			'.json': 'application/json',
			'.xml': 'application/xml',
			'.csv': 'text/csv',
			'.yaml': 'text/yaml',
			'.yml': 'text/yaml',
			'.toml': 'text/plain',
			'.txt': 'text/plain',
			'.md': 'text/markdown',
			'.rtf': 'application/rtf',
			// Code files
			'.js': 'text/javascript',
			'.ts': 'text/typescript',
			'.py': 'text/x-python',
			'.java': 'text/x-java-source',
			'.cpp': 'text/x-c++src',
			'.c': 'text/x-csrc',
			'.h': 'text/x-chdr',
			'.css': 'text/css',
			'.html': 'text/html',
			'.php': 'text/x-php',
			// Database files
			'.db': 'application/x-sqlite3',
			'.sqlite': 'application/x-sqlite3',
			'.sql': 'application/sql',
			// E-books
			'.epub': 'application/epub+zip',
			'.mobi': 'application/x-mobipocket-ebook',
			// Other formats
			'.ics': 'text/calendar',
			'.vcf': 'text/vcard',
			'.log': 'text/plain'
		};
		
		return mimeTypes[extension.toLowerCase()] || 'application/octet-stream';
	}

	/**
	 * Get appropriate icon for file type
	 */
	private getFileTypeIcon(extension: string): string {
		const iconMap: Record<string, string> = {
			// Office documents
			'.xlsx': '📊', '.xls': '📊',
			'.pptx': '📽️', '.ppt': '📽️',
			'.docx': '📄', '.doc': '📄',
			// Open Document
			'.odt': '📄', '.ods': '📊', '.odp': '📽️',
			// Archives
			'.zip': '📦', '.rar': '📦', '.7z': '📦', '.tar': '📦', '.gz': '📦', '.bz2': '📦',
			// Text/data
			'.json': '🗃️', '.xml': '🗃️', '.csv': '📊', '.yaml': '⚙️', '.yml': '⚙️',
			'.toml': '⚙️', '.txt': '📄', '.md': '📝', '.rtf': '📄',
			// Code files
			'.js': '💻', '.ts': '💻', '.py': '🐍', '.java': '☕', '.cpp': '💻', '.c': '💻',
			'.h': '💻', '.css': '🎨', '.html': '🌐', '.php': '💻',
			// Database
			'.db': '🗄️', '.sqlite': '🗄️', '.sql': '🗄️',
			// E-books
			'.epub': '📖', '.mobi': '📖',
			// Other
			'.ics': '📅', '.vcf': '👤', '.log': '📋'
		};
		
		return iconMap[extension.toLowerCase()] || '📎';
	}
}