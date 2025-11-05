/**
 * Embed Processing
 * Handles processing of PDF, image, and file embeds for PDF export
 */

import { TFile } from 'obsidian';
import type { obsidianTypstPDFExport } from '../../main';
import type { PreprocessingResult } from '../converters/MarkdownPreprocessor';
import { ExportErrorHandler } from '../core/ExportErrorHandler';
import { PathUtils } from '../core/PathUtils';
import * as path from 'path';
import * as https from 'https';
import * as http from 'http';

export class EmbedProcessor {
	private readonly pathUtils: PathUtils;

	constructor(private plugin: obsidianTypstPDFExport) {
		this.pathUtils = new PathUtils(plugin.app);
	}

	/**
	 * Resolve a local file path using Obsidian's API and filesystem fallbacks
	 * @param decodedPath The decoded (non-URL-encoded) path to resolve
	 * @param vaultBasePath Base path of the vault
	 * @param currentFile Current file being processed (optional, enables Obsidian API resolution)
	 * @param additionalPaths Additional paths to try after standard paths
	 * @param useObsidianApi Whether to try Obsidian's link resolution API first (requires currentFile)
	 * @returns Full path to file if found, null otherwise
	 */
	private async resolveLocalPath(
		decodedPath: string,
		vaultBasePath: string,
		currentFile?: TFile,
		additionalPaths: string[] = [],
		useObsidianApi: boolean = true
	): Promise<string | null> {
		// Strategy 1: Use Obsidian's link resolution API (if enabled and currentFile provided)
		if (useObsidianApi && currentFile) {
			const resolvedFile = this.plugin.app.metadataCache.getFirstLinkpathDest(
				decodedPath,
				currentFile.path
			);

			if (resolvedFile && resolvedFile instanceof TFile) {
				// Convert to full filesystem path
				const fullPath = path.resolve(vaultBasePath, resolvedFile.path);
				try {
					const exists = await this.pathUtils.fileExists(fullPath);
					if (exists) {
						return fullPath;
					}
				} catch {
					// File exists in metadata but not on filesystem, continue to fallbacks
				}
			}
		}

		// Fallback strategies: Try filesystem-based resolution
		const possiblePaths = [
			// Standard path relative to vault root
			path.resolve(vaultBasePath, decodedPath),
			// Relative to current file's directory (for local attachments)
			currentFile ? path.resolve(vaultBasePath, path.dirname(currentFile.path), decodedPath) : null,
			// Additional paths provided by caller
			...additionalPaths
		].filter((p): p is string => p !== null);

		// Try each possible path until we find one that exists
		for (const possiblePath of possiblePaths) {
			try {
				const exists = await this.pathUtils.fileExists(possiblePath);
				if (exists) {
					return possiblePath;
				}
			} catch {
				// File doesn't exist, continue to next path
			}
		}

		return null;
	}

	/**
	 * Download a remote image to the temp directory
	 * Returns the local path if successful, null if failed
	 */
	private async downloadRemoteImage(imageUrl: string, tempDir: string): Promise<string | null> {
		return new Promise((resolve) => {
			try {
				// Parse URL to get filename
				const urlObj = new URL(imageUrl);
				const urlPath = urlObj.pathname;
				const fileName = path.basename(urlPath) || `remote-image-${Date.now()}`;

				// Ensure we have a valid file extension
				// Extract extension and normalize it (lowercase)
				const ext = path.extname(fileName).toLowerCase();

				// Preserve any existing extension, or append .png if no extension present
				// This handles all image types (svg, ico, avif, etc.) without forcing .png
				const finalFileName = ext
					? fileName  // Has an extension, preserve it
					: `${fileName}.png`;  // No extension, append .png

				const outputPath = path.join(tempDir, finalFileName);

				// Select appropriate protocol based on parsed URL (handles case-insensitive schemes)
				const protocol = urlObj.protocol === 'https:' ? https : http;

				console.log(`Export: Downloading remote image: ${imageUrl}`);

				// Use parsed URL object for the request to ensure correct protocol handling
				const request = protocol.get(urlObj, (response) => {
					// Handle redirects
					if (response.statusCode === 301 || response.statusCode === 302) {
						const redirectUrl = response.headers.location;
						if (redirectUrl) {
							// Resolve relative redirects against the original request URL
							// This handles both absolute URLs (e.g., "https://example.com/img.png")
							// and relative URLs (e.g., "/assets/img.png" or "../img.png")
							const absoluteRedirectUrl = new URL(redirectUrl, imageUrl).href;
							console.log(`Export: Following redirect to: ${absoluteRedirectUrl}`);
							// Recursively follow redirect with resolved absolute URL
							this.downloadRemoteImage(absoluteRedirectUrl, tempDir).then(resolve);
							return;
						}
					}

					// Check for successful response
					if (response.statusCode !== 200) {
						console.warn(`Export: Failed to download image, status code: ${response.statusCode}`);
						resolve(null);
						return;
					}

					// Collect response data in memory
					const chunks: Buffer[] = [];

					response.on('data', (chunk: Buffer) => {
						chunks.push(chunk);
					});

					response.on('end', async () => {
						try {
							// Check if file already exists to avoid overwriting
							const exists = await this.pathUtils.fileExists(outputPath);
							if (exists) {
								console.warn(`Export: Image file already exists, using existing: ${outputPath}`);
								resolve(outputPath);
								return;
							}

							// Combine chunks and write using vault adapter
							const buffer = Buffer.concat(chunks);
							// Convert Buffer to ArrayBuffer for vault adapter
							const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
							await this.plugin.app.vault.adapter.writeBinary(outputPath, arrayBuffer);

							console.log(`Export: Successfully downloaded image to: ${outputPath}`);
							resolve(outputPath);
						} catch (err) {
							console.error(`Export: Error writing image file: ${err.message}`);
							resolve(null);
						}
					});

					response.on('error', (err) => {
						console.error(`Export: Error receiving image data: ${err.message}`);
						resolve(null);
					});
				});

				request.on('error', (err) => {
					console.error(`Export: Error downloading image: ${err.message}`);
					resolve(null);
				});

				// Set timeout
				request.setTimeout(10000, () => {
					request.destroy();
					console.warn(`Export: Image download timeout: ${imageUrl}`);
					resolve(null);
				});

			} catch (error) {
				console.error(`Export: Error in downloadRemoteImage: ${error.message}`);
				resolve(null);
			}
		});
	}
	
	/**
	 * Process PDF embeds - convert PDF pages to images for inclusion
	 */
	async processPdfEmbeds(processedResult: PreprocessingResult, vaultBasePath: string, tempDir: string, currentFile?: TFile, embedPdfFiles: boolean = true): Promise<void> {
		const { PdfToImageConverter } = await import('../converters/PdfToImageConverter');
		const converter = PdfToImageConverter.getInstance(this.plugin);
		
		let updatedContent = processedResult.content;
		
		for (const pdfEmbed of processedResult.metadata?.pdfEmbeds || []) {
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
	async processImageEmbeds(processedResult: PreprocessingResult, vaultBasePath: string, tempDir: string, currentFile?: TFile): Promise<void> {
		let updatedContent = processedResult.content;

		for (const imageEmbed of processedResult.metadata?.imageEmbeds || []) {
			try {
				// Decode the URL-encoded sanitized path back to normal characters
				const decodedPath = decodeURIComponent(imageEmbed.sanitizedPath);

				let fullImagePath: string | null = null;

				// Check if this is a remote URL (http:// or https://)
				const isRemoteUrl = /^https?:\/\//i.test(decodedPath);

				if (isRemoteUrl) {
					// Try to download the remote image
					console.log(`Export: Attempting to download remote image: ${decodedPath}`);
					const downloadedPath = await this.downloadRemoteImage(decodedPath, tempDir);

					if (downloadedPath) {
						// Successfully downloaded, use it as a local image
						fullImagePath = downloadedPath;
						console.log(`Export: Successfully downloaded and will embed remote image`);
					} else {
						// Download failed, use placeholder
						console.warn(`Export: Failed to download remote image: ${decodedPath}`);
						const fallbackOutput = `[🌐 **Remote image download failed:** ${imageEmbed.sizeOrAlt || imageEmbed.originalPath}]`;
						updatedContent = updatedContent.replace(imageEmbed.marker, fallbackOutput);
						continue;
					}
				} else {
					// Resolve local file path using helper method
					// Note: Image embeds don't use Obsidian API, only filesystem resolution
					const attachmentsPath = path.resolve(vaultBasePath, 'attachments', path.basename(decodedPath));
					fullImagePath = await this.resolveLocalPath(
						decodedPath,
						vaultBasePath,
						currentFile,
						[attachmentsPath],
						false // Don't use Obsidian API for image embeds
					);
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
					const vaultTempImagesDir = this.pathUtils.joinPath(vaultBasePath, this.pathUtils.getPluginDir(this.plugin.manifest), 'temp-images');
					await this.pathUtils.ensureDir(vaultTempImagesDir);
					
					const convertedImagePath = this.pathUtils.joinPath(vaultTempImagesDir, pngFileName);
					
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
	async processFileEmbeds(processedResult: PreprocessingResult, vaultBasePath: string, tempDir: string, currentFile?: TFile, embedAllFiles: boolean = true): Promise<void> {
		let updatedContent = processedResult.content;
		
		for (const fileEmbed of processedResult.metadata?.fileEmbeds || []) {
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

		// Use helper method with Obsidian API enabled
		return await this.resolveLocalPath(
			decodedPath,
			vaultBasePath,
			currentFile,
			[], // No additional paths for PDFs
			true // Use Obsidian API
		);
	}

	/**
	 * Resolve file path using Obsidian's link resolution API and filesystem fallbacks
	 */
	private async resolveFilePath(sanitizedPath: string, vaultBasePath: string, currentFile?: TFile): Promise<string | null> {
		// Decode the URL-encoded sanitized path back to normal characters
		const decodedPath = decodeURIComponent(sanitizedPath);

		// Use helper method with Obsidian API enabled and attachments folder as additional path
		const attachmentsPath = path.resolve(vaultBasePath, 'attachments', path.basename(decodedPath));
		return await this.resolveLocalPath(
			decodedPath,
			vaultBasePath,
			currentFile,
			[attachmentsPath], // Check attachments folder as additional path
			true // Use Obsidian API
		);
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
		const vaultTempImagesDir = this.pathUtils.joinPath(vaultBasePath, this.pathUtils.getPluginDir(this.plugin.manifest), 'temp-images');
		await this.pathUtils.ensureDir(vaultTempImagesDir);

		// Sanitize the basename for use in filename - replace problematic characters
		const sanitizedBaseName = baseName
			.replace(/[^a-zA-Z0-9\-_]/g, '_')  // Replace non-alphanumeric chars with underscore
			.replace(/_{2,}/g, '_')            // Collapse multiple underscores
			.replace(/^_+|_+$/g, '');          // Remove leading/trailing underscores

		const imageFileName = `${sanitizedBaseName}_preview.png`;
		const vaultImagePath = this.pathUtils.joinPath(vaultTempImagesDir, imageFileName);

		// Copy file using vault adapter
		const sourceBuffer = await this.plugin.app.vault.adapter.readBinary(imagePath);
		await this.plugin.app.vault.adapter.writeBinary(vaultImagePath, sourceBuffer);

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