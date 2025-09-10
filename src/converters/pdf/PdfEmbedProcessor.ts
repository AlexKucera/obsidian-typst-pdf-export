import * as path from 'path';

/**
 * Processes PDF embeds during document conversion.
 * Converts PDF files to images for display in the final PDF output.
 */
export class PdfEmbedProcessor {
	private plugin: any;

	constructor(plugin: any) {
		this.plugin = plugin;
	}

	/**
	 * Process PDF embeds by converting them to images and creating combined output
	 * @param processedResult The processed markdown content with metadata
	 * @param vaultBasePath Base path of the vault for resolving relative paths
	 * @param tempDir Temporary directory for conversion files
	 * @param embedPdfFiles Whether to include PDF download links alongside images
	 */
	async processPdfEmbeds(
		processedResult: any, 
		vaultBasePath: string, 
		tempDir: string, 
		embedPdfFiles: boolean = true
	): Promise<void> {
		const { PdfToImageConverter } = require('../PdfToImageConverter');
		const converter = PdfToImageConverter.getInstance(this.plugin);
		
		for (const pdfEmbed of processedResult.metadata.pdfEmbeds) {
			try {
				
				// Resolve full path to the PDF
				const fullPdfPath = path.resolve(vaultBasePath, pdfEmbed.sanitizedPath);
				
				// Check if PDF file exists
				const fs = require('fs');
				if (!fs.existsSync(fullPdfPath)) {
					console.warn(`Export: PDF file not found: ${fullPdfPath}`);
					// Replace marker with error message
					processedResult.content = processedResult.content.replace(
						pdfEmbed.marker,
						`[⚠️ PDF not found: ${pdfEmbed.fileName}](${pdfEmbed.sanitizedPath})`
					);
					continue;
				}
				
				// Convert PDF to image (always happens regardless of embedPdfFiles setting)
				const conversionResult = await converter.convertFirstPageToImage(
					fullPdfPath,
					tempDir,
					{
						scale: 1.5,
						maxWidth: 600,
						maxHeight: 400,
						format: 'png'
					}
				);
				
				if (conversionResult.success) {
					// Get relative path for the generated image
					const relativeImagePath = path.relative(vaultBasePath, conversionResult.imagePath);
					
					// Create output based on embedPdfFiles setting
					let combinedOutput: string;
					if (embedPdfFiles) {
						// Include both image preview and PDF attachment note
						combinedOutput = [
							`![${pdfEmbed.fileName} - Page 1](${relativeImagePath})`,
							`[📎 **Download PDF:** ${pdfEmbed.fileName}](${pdfEmbed.sanitizedPath})`
						].join('\n\n');
					} else {
						// Only show image preview
						combinedOutput = `![${pdfEmbed.fileName} - Page 1](${relativeImagePath})`;
					}
					
					// Replace marker with output
					processedResult.content = processedResult.content.replace(pdfEmbed.marker, combinedOutput);
					
					
				} else {
					console.error(`Export: PDF conversion failed: ${conversionResult.error}`);
					
					// Replace marker with fallback link
					processedResult.content = processedResult.content.replace(
						pdfEmbed.marker,
						`[📖 ${pdfEmbed.fileName}](${pdfEmbed.sanitizedPath})\n\n*Note: PDF preview could not be generated*`
					);
				}
				
			} catch (error: any) {
				console.error(`Export: Error processing PDF embed: ${error.message}`);
				
				// Replace marker with error fallback
				processedResult.content = processedResult.content.replace(
					pdfEmbed.marker,
					`[⚠️ ${pdfEmbed.fileName}](${pdfEmbed.sanitizedPath})\n\n*Error: Could not process PDF embed*`
				);
			}
		}
	}
}