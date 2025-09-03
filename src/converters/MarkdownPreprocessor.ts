/**
 * MarkdownPreprocessor - Converts Obsidian-specific markdown syntax to standard markdown
 * compatible with Pandoc for Typst PDF export
 */

export interface PreprocessorOptions {
	/** Include metadata extraction in processing */
	includeMetadata: boolean;
	/** Preserve existing frontmatter */
	preserveFrontmatter: boolean;
	/** Base URL for relative link resolution */
	baseUrl?: string;
}

export interface WikilinkConfig {
	/** Format for wikilink conversion ('md' for .md extension, 'none' for no extension) */
	format: 'md' | 'none';
	/** File extension to append to wikilinks */
	extension: string;
}

export interface PreprocessingResult {
	/** Processed markdown content */
	content: string;
	/** Extracted metadata including tags and frontmatter */
	metadata: {
		tags: string[];
		frontmatter?: Record<string, any>;
		title?: string;
		wordCount: number;
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
	};
	/** Processing errors and warnings */
	errors: string[];
	/** Processing warnings */
	warnings: string[];
}

export interface MarkdownPreprocessorConfig {
	/** Vault path for file resolution */
	vaultPath: string;
	/** Processing options */
	options: PreprocessorOptions;
	/** Wikilink conversion configuration */
	wikilinkConfig: WikilinkConfig;
	/** Note title to add as H1 heading at top (optional) */
	noteTitle?: string;
}

export class MarkdownPreprocessor {
	private vaultPath: string;
	private options: PreprocessorOptions;
	private wikilinkConfig: WikilinkConfig;
	private noteTitle?: string;
	
	// Regex patterns for Obsidian syntax
	private readonly WIKILINK_PATTERN = /\[\[([^\|\]]+)(?:\|([^\]]+))?\]\]/g;
	private readonly WIKILINK_WITH_HEADING_PATTERN = /\[\[([^#\|\]]+)(?:#([^|\]]+))?(?:\|([^\]]+))?\]\]/g;
	private readonly EMBED_PATTERN = /!\[\[([^\|\]]+)(?:\|([^\]]+))?\]\]/g;
	private readonly EMBED_SIZE_PATTERN = /(\d+)(?:x(\d+))?/;
	private readonly CALLOUT_PATTERN = /^>\s*\[!([\w-]+)\]([+-]?)\s*(.*)$/gm;
	private readonly MULTI_LINE_CALLOUT_PATTERN = /^(>\s*\[!([\w-]+)\]([+-]?)\s*(.*(?:\n(?:>.*|$))*?))/gm;
	private readonly TAG_PATTERN = /#(?:[^\s#]+)/g;
	private readonly FRONTMATTER_PATTERN = /^---\s*\n([\s\S]*?)\n---\s*\n/;
	private readonly EMAIL_BLOCK_PATTERN = /^```email\s*\n([\s\S]*?)^```\s*$/gm;
	
	constructor(config: MarkdownPreprocessorConfig) {
		this.vaultPath = config.vaultPath;
		this.options = config.options;
		this.wikilinkConfig = config.wikilinkConfig;
		this.noteTitle = config.noteTitle;
	}
	
	/**
	 * Main processing method that converts Obsidian markdown to standard markdown
	 */
	public async process(content: string): Promise<PreprocessingResult> {
		const result: PreprocessingResult = {
			content: content,
			metadata: {
				tags: [],
				frontmatter: undefined,
				title: undefined,
				wordCount: 0
			},
			errors: [],
			warnings: []
		};
		
		try {
			// Step 1: Extract and process frontmatter first (always process for metadata extraction)
			result.content = this.processFrontmatter(result.content, result);
			
			// Step 2: Extract additional tags from content (combine with frontmatter tags)
			if (this.options.includeMetadata) {
				const contentTags = this.extractTags(result.content);
				
				// Merge content tags with frontmatter tags, avoiding duplicates
				for (const tag of contentTags) {
					if (!result.metadata.tags.includes(tag)) {
						result.metadata.tags.push(tag);
					}
				}
			}
			
			// Step 3: Convert email blocks to Typst format
			result.content = this.parseEmailBlocks(result.content, result);
			
			// Step 4: Filter out unnecessary links (Open: links and Mail.app links)
			result.content = this.filterUnnecessaryLinks(result.content, result);
			
			// Step 5: Convert embeds FIRST (before wikilinks to avoid .md extension being added)
			result.content = this.parseEmbeds(result.content, result);
			
			// Step 6: Convert wikilinks (after embeds are processed)
			result.content = this.parseWikilinks(result.content, result);
			
			// Step 7: Convert callouts
			result.content = this.parseCallouts(result.content, result);
			
			// Step 8: Calculate final metadata
			result.metadata.wordCount = this.calculateWordCount(result.content);
			
			// Use title from frontmatter if available, otherwise extract from content
			if (!result.metadata.title) {
				result.metadata.title = this.extractTitle(result.content);
			}
			
		} catch (error) {
			result.errors.push(`Processing error: ${error.message}`);
		}
		
		return result;
	}
	
	/**
	 * Process frontmatter using the gray-matter library approach
	 */
	private processFrontmatter(content: string, result: PreprocessingResult): string {
		try {
			// Use gray-matter for robust frontmatter parsing
			const matter = require('gray-matter');
			const parsed = matter(content);
			
			if (parsed.data && Object.keys(parsed.data).length > 0) {
				// Replace frontmatter title with filename if noteTitle is provided
				if (this.noteTitle) {
					const frontmatterCopy = { ...parsed.data };
					frontmatterCopy.title = this.noteTitle;
					result.metadata.frontmatter = frontmatterCopy;
				} else {
					result.metadata.frontmatter = parsed.data;
				}
				
				// Extract tags from frontmatter if they exist
				if (parsed.data.tags) {
					let frontmatterTags: string[] = [];
					
					if (Array.isArray(parsed.data.tags)) {
						// Handle array of tags
						frontmatterTags = parsed.data.tags
							.map((tag: any) => typeof tag === 'string' ? tag : String(tag))
							.filter((tag: string) => tag.trim() !== '');
					} else if (typeof parsed.data.tags === 'string') {
						// Handle comma-separated string or single tag
						frontmatterTags = parsed.data.tags
							.split(/[,\s]+/)
							.map((tag: string) => tag.trim())
							.filter((tag: string) => tag !== '');
					}
					
					// Merge with existing tags (avoid duplicates)
					for (const tag of frontmatterTags) {
						if (!result.metadata.tags.includes(tag)) {
							result.metadata.tags.push(tag);
						}
					}
				}
				
				// Extract title - use noteTitle if available, otherwise frontmatter title
				if (this.noteTitle) {
					result.metadata.title = this.noteTitle;
				} else if (parsed.data.title && typeof parsed.data.title === 'string') {
					result.metadata.title = parsed.data.title.trim();
				}
				
				if (this.options.preserveFrontmatter) {
					// Keep the frontmatter in the content, but reconstruct it with the modified title
					if (this.noteTitle) {
						const yaml = require('js-yaml');
						const frontmatterCopy = { ...parsed.data };
						frontmatterCopy.title = this.noteTitle;
						const newFrontmatter = yaml.dump(frontmatterCopy);
						return `---\n${newFrontmatter}---\n${parsed.content}`;
					} else {
						return content;
					}
				} else {
					// Return content without frontmatter, but add title as frontmatter for Pandoc
					if (this.noteTitle) {
						const yaml = require('js-yaml');
						const titleFrontmatter = yaml.dump({ title: this.noteTitle });
						console.log('Replacing frontmatter with title:', titleFrontmatter);
						return `---\n${titleFrontmatter}---\n${parsed.content}`;
					} else {
						return parsed.content;
					}
				}
			} else {
				// No frontmatter found - add title frontmatter if we have a noteTitle
				if (this.noteTitle) {
					const yaml = require('js-yaml');
					const titleFrontmatter = yaml.dump({ title: this.noteTitle });
					console.log('Adding title frontmatter:', titleFrontmatter);
					return `---\n${titleFrontmatter}---\n${content}`;
				} else {
					return content;
				}
			}
		} catch (error: any) {
			result.warnings.push(`Failed to parse frontmatter with gray-matter: ${error.message}`);
			
			// Fallback to simple regex-based parsing
			const frontmatterMatch = content.match(this.FRONTMATTER_PATTERN);
			
			if (frontmatterMatch) {
				try {
					const yamlContent = frontmatterMatch[1];
					const frontmatter: Record<string, any> = {};
					
					const lines = yamlContent.split('\n');
					for (const line of lines) {
						const colonIndex = line.indexOf(':');
						if (colonIndex > 0) {
							const key = line.substring(0, colonIndex).trim();
							const value = line.substring(colonIndex + 1).trim();
							const cleanValue = value.replace(/^["']|["']$/g, '');
							frontmatter[key] = cleanValue;
						}
					}
					
					// Replace title with noteTitle if provided
					if (this.noteTitle) {
						frontmatter.title = this.noteTitle;
					}
					
					result.metadata.frontmatter = frontmatter;
					
					if (this.options.preserveFrontmatter) {
						// Reconstruct frontmatter with modified title
						if (this.noteTitle) {
							const yaml = require('js-yaml');
							const newFrontmatter = yaml.dump(frontmatter);
							return content.replace(this.FRONTMATTER_PATTERN, `---\n${newFrontmatter}---\n`);
						} else {
							return content;
						}
					} else {
						// Add title as frontmatter for Pandoc even when not preserving original
						if (this.noteTitle) {
							const yaml = require('js-yaml');
							const titleFrontmatter = yaml.dump({ title: this.noteTitle });
							return content.replace(this.FRONTMATTER_PATTERN, `---\n${titleFrontmatter}---\n`);
						} else {
							return content.replace(this.FRONTMATTER_PATTERN, '');
						}
					}
				} catch (fallbackError: any) {
					result.warnings.push(`Fallback frontmatter parsing also failed: ${fallbackError.message}`);
				}
			}
			
			return content;
		}
	}
	
	/**
	 * Extract tags from content
	 */
	private extractTags(content: string): string[] {
		const tags: string[] = [];
		
		// Use more sophisticated regex to avoid false positives
		// This pattern matches hashtags that are:
		// 1. At the start of a line (with optional whitespace)
		// 2. After whitespace
		// 3. Not part of headings (# ## ### etc.)
		// 4. Not inside code blocks or inline code
		const enhancedTagPattern = /(?:^|\s)#([a-zA-Z][a-zA-Z0-9_/-]*[a-zA-Z0-9_]|[a-zA-Z][a-zA-Z0-9_]*)/gm;
		
		// Remove code blocks to avoid extracting tags from them
		const contentWithoutCodeBlocks = content
			.replace(/```[\s\S]*?```/g, '') // Remove fenced code blocks
			.replace(/`[^`\n]*`/g, ''); // Remove inline code
		
		let match;
		while ((match = enhancedTagPattern.exec(contentWithoutCodeBlocks)) !== null) {
			const tag = match[1]; // Get the tag without the # prefix
			
			// Additional validation to ensure it's a proper tag
			if (tag && tag.length > 0 && !tags.includes(tag)) {
				// Skip if it looks like a heading (check if preceded by multiple #)
				const fullMatch = match[0];
				const beforeTag = contentWithoutCodeBlocks.substring(Math.max(0, match.index - 5), match.index);
				
				// Skip if this appears to be part of a markdown heading
				if (!beforeTag.includes('#')) {
					tags.push(tag);
				}
			}
		}
		
		enhancedTagPattern.lastIndex = 0; // Reset regex state
		return tags;
	}
	
	/**
	 * Convert wikilinks to standard markdown links
	 */
	private parseWikilinks(content: string, result: PreprocessingResult): string {
		// Use the more comprehensive pattern that handles headings
		return content.replace(this.WIKILINK_WITH_HEADING_PATTERN, (match, notePath, headingPath, alias) => {
			try {
				// Clean the paths
				const cleanNotePath = notePath ? notePath.trim() : '';
				const cleanHeadingPath = headingPath ? headingPath.trim() : '';
				const cleanAlias = alias ? alias.trim() : '';
				
				if (!cleanNotePath) {
					result.warnings.push(`Empty wikilink path found: ${match}`);
					return match;
				}
				
				// Handle special characters in filenames
				const sanitizedNotePath = this.sanitizeFilePath(cleanNotePath);
				
				// Build the final path
				let finalPath = sanitizedNotePath;
				
				// Add extension based on configuration
				if (this.wikilinkConfig.format === 'md') {
					finalPath += this.wikilinkConfig.extension;
				}
				
				// Add heading anchor if present
				if (cleanHeadingPath) {
					const sanitizedHeading = this.sanitizeHeadingForLink(cleanHeadingPath);
					finalPath += `#${sanitizedHeading}`;
				}
				
				// Determine display text
				let displayText: string;
				if (cleanAlias) {
					displayText = cleanAlias;
				} else if (cleanHeadingPath) {
					displayText = `${cleanNotePath}#${cleanHeadingPath}`;
				} else {
					displayText = cleanNotePath;
				}
				
				// Handle relative path resolution if baseUrl is provided
				if (this.options.baseUrl) {
					finalPath = this.resolveRelativePath(finalPath);
				}
				
				// Create standard markdown link
				return `[${displayText}](${finalPath})`;
				
			} catch (error) {
				result.warnings.push(`Failed to process wikilink: ${match} - ${error.message}`);
				return match; // Return original on error
			}
		});
	}
	
	/**
	 * Sanitize file paths for cross-platform compatibility
	 */
	private sanitizeFilePath(filePath: string): string {
		// Remove or replace characters that might cause issues
		return filePath
			.replace(/[<>:"|?*]/g, '_') // Replace problematic characters
			.replace(/\s+/g, '%20') // URL encode spaces
			.replace(/[\\\/]/g, '/'); // Normalize path separators
	}
	
	/**
	 * Sanitize heading text for use in markdown links
	 */
	private sanitizeHeadingForLink(heading: string): string {
		return heading
			.toLowerCase()
			.replace(/\s+/g, '-') // Replace spaces with dashes
			.replace(/[^\w\-]/g, '') // Remove special characters except dashes
			.replace(/--+/g, '-'); // Collapse multiple dashes
	}
	
	/**
	 * Resolve relative paths if baseUrl is configured
	 */
	private resolveRelativePath(path: string): string {
		if (!this.options.baseUrl) {
			return path;
		}
		
		// Simple relative path resolution
		if (path.startsWith('/')) {
			return path; // Already absolute
		}
		
		const baseUrl = this.options.baseUrl.endsWith('/') ? 
			this.options.baseUrl : 
			`${this.options.baseUrl}/`;
			
		return `${baseUrl}${path}`;
	}
	
	/**
	 * Convert embed syntax to standard markdown references
	 */
	private parseEmbeds(content: string, result: PreprocessingResult): string {
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
					
					case 'video':
						return this.processVideoEmbed(cleanPath, sizeOrAlt, result);
					
					case 'audio':
						return this.processAudioEmbed(cleanPath, sizeOrAlt, result);
					
					case 'document':
						return this.processDocumentEmbed(cleanPath, result);
					
					case 'pdf':
						return this.processPdfEmbed(cleanPath, sizeOrAlt, result);
					
					default:
						// Fallback to link reference for unknown types
						result.warnings.push(`Unknown file type for embed: ${cleanPath}`);
						return `[${cleanPath}](${cleanPath})`;
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
	 */
	private determineFileType(extension: string): 'image' | 'video' | 'audio' | 'document' | 'pdf' | 'unknown' {
		const imageExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp', '.bmp', '.ico', '.tiff'];
		const videoExtensions = ['.mp4', '.avi', '.mov', '.wmv', '.flv', '.webm', '.mkv', '.m4v'];
		const audioExtensions = ['.mp3', '.wav', '.ogg', '.m4a', '.flac', '.aac', '.wma'];
		const documentExtensions = ['.md', '.txt', '.doc', '.docx', '.rtf'];
		const pdfExtensions = ['.pdf'];
		
		if (imageExtensions.includes(extension)) return 'image';
		if (videoExtensions.includes(extension)) return 'video';
		if (audioExtensions.includes(extension)) return 'audio';
		if (documentExtensions.includes(extension)) return 'document';
		if (pdfExtensions.includes(extension)) return 'pdf';
		
		return 'unknown';
	}
	
	/**
	 * Process image embeds with size parameters
	 */
	private processImageEmbed(imagePath: string, sizeOrAlt: string | undefined, result: PreprocessingResult): string {
		const sanitizedPath = this.sanitizeFilePath(imagePath);
		
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
	 * Process video embeds
	 */
	private processVideoEmbed(videoPath: string, options: string | undefined, result: PreprocessingResult): string {
		const sanitizedPath = this.sanitizeFilePath(videoPath);
		
		// For Typst/Pandoc, videos are typically handled as links with descriptive text
		const fileName = videoPath.substring(videoPath.lastIndexOf('/') + 1);
		result.warnings.push(`Video embed converted to link: ${videoPath}`);
		
		return `[🎥 ${fileName}](${sanitizedPath})`;
	}
	
	/**
	 * Process audio embeds
	 */
	private processAudioEmbed(audioPath: string, options: string | undefined, result: PreprocessingResult): string {
		const sanitizedPath = this.sanitizeFilePath(audioPath);
		
		// For Typst/Pandoc, audio is typically handled as links with descriptive text
		const fileName = audioPath.substring(audioPath.lastIndexOf('/') + 1);
		result.warnings.push(`Audio embed converted to link: ${audioPath}`);
		
		return `[🎵 ${fileName}](${sanitizedPath})`;
	}
	
	/**
	 * Process document embeds
	 */
	private processDocumentEmbed(docPath: string, result: PreprocessingResult): string {
		const sanitizedPath = this.sanitizeFilePath(docPath);
		
		// For document embeds, create a clear link reference
		const fileName = docPath.substring(docPath.lastIndexOf('/') + 1);
		return `[📄 ${fileName}](${sanitizedPath})`;
	}
	
	/**
	 * Process PDF embeds - Convert to image preview with PDF attachment using Typst's pdf.embed
	 */
	private processPdfEmbed(pdfPath: string, options: string | undefined, result: PreprocessingResult): string {
		const sanitizedPath = this.sanitizeFilePath(pdfPath);
		
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
	 * Convert Obsidian callouts to standard blockquotes with styling markers
	 */
	private parseCallouts(content: string, result: PreprocessingResult): string {
		// Process multi-line callouts first
		const processed = this.processMultiLineCallouts(content, result);
		return processed;
	}

	/**
	 * Convert Obsidian email blocks to Typst email-block format
	 */
	private parseEmailBlocks(content: string, result: PreprocessingResult): string {
		return content.replace(this.EMAIL_BLOCK_PATTERN, (match, blockContent) => {
			try {
				return this.processEmailBlock(blockContent, result);
			} catch (error) {
				result.warnings.push(`Failed to process email block: ${error.message}`);
				return match; // Return original on error
			}
		});
	}
	
	/**
	 * Filter out unnecessary links from the markdown content
	 * This includes [[filename|Open: filename]] links and [Open in Mail.app](message://) links
	 */
	private filterUnnecessaryLinks(content: string, result: PreprocessingResult): string {
		// Remove [[filename|Open: filename]] links from general content
		let filtered = content.replace(/\[\[.*?\|Open:.*?\]\]/g, '');
		
		// Remove [Open in Mail.app](message://) links from general content
		filtered = filtered.replace(/\[Open in Mail\.app\]\(message:\/\/[^)]+\)/g, '');
		
		// Clean up any resulting excessive newlines
		filtered = filtered.replace(/\n{3,}/g, '\n\n');
		
		result.warnings.push('Filtered out unnecessary Open: and Mail.app links from content');
		
		return filtered;
	}

	/**
	 * Process individual email block content and convert to Typst format
	 */
	private processEmailBlock(blockContent: string, result: PreprocessingResult): string {
		try {
			// Split at --- to separate header from body
			const parts = blockContent.split('---');
			const yamlHeader = parts[0].trim();
			let body = parts.length > 1 ? parts.slice(1).join('---').trim() : '';
			
			// Filter out unnecessary links from the body
			// Remove [[filename|Open: filename]] links
			body = body.replace(/\[\[.*?\|Open:.*?\]\]/g, '');
			// Remove [Open in Mail.app](message://) links
			body = body.replace(/\[Open in Mail\.app\]\(message:\/\/[^)]+\)/g, '');
			// Clean up any resulting double newlines
			body = body.replace(/\n{3,}/g, '\n\n').trim();
			
			// Parse YAML header
			const params = this.parseEmailYaml(yamlHeader);
			
			// Build Typst function call arguments
			const args: string[] = [];
			
			// Add parameters in the order expected by the Typst template
			if (params.from) {
				args.push(`from: "${this.escapeQuotes(params.from)}"`);
			}
			if (params.to) {
				args.push(`to: "${this.escapeQuotes(params.to)}"`);
			}
			if (params.subject) {
				args.push(`subject: "${this.escapeQuotes(params.subject)}"`);
			}
			if (params.date) {
				args.push(`date: "${this.escapeQuotes(params.date)}"`);
			}
			
			// Add body as string parameter (always present, even if empty)
			// Use the escapeQuotes method to preserve paragraphs but keep as string
			const bodyParam = `"${this.escapeBodyForTypst(body)}"`;
			
			// Construct the Typst email-block function call with proper line breaks
			// Wrap in Pandoc raw blocks so it's treated as Typst code, not markdown text
			const argsString = args.length > 0 ? args.join(', ') + ', ' : '';
			return `\n\n\`\`\`{=typst}\n#email-block(${argsString}${bodyParam})\n\`\`\`\n\n`;
			
		} catch (error) {
			result.warnings.push(`Error processing email block content: ${error.message}`);
			// Return as code block to preserve original content
			return `\`\`\`\n${blockContent}\n\`\`\``;
		}
	}

	/**
	 * Format email body content for Typst content blocks (not string literals)
	 */
	private formatBodyForTypst(body: string): string {
		if (!body) return '';
		
		// Split into paragraphs and format each one
		const paragraphs = body.split(/\n\s*\n/); // Split on blank lines
		const formattedParagraphs = paragraphs
			.map(para => para.trim())
			.filter(para => para.length > 0)
			.map(para => {
				// Escape special Typst characters but preserve the content structure
				const escaped = para
					.replace(/\\/g, '\\\\')  // Escape backslashes
					.replace(/#/g, '\\#')    // Escape hash symbols
					.replace(/\[/g, '\\[')   // Escape square brackets
					.replace(/\]/g, '\\]')   // Escape square brackets
					.replace(/\*/g, '\\*')   // Escape asterisks
					.replace(/_/g, '\\_');   // Escape underscores
				
				return escaped;
			});
		
		// Join paragraphs with proper Typst paragraph breaks
		return formattedParagraphs.join('\n\n');
	}
	
	/**
	 * Parse email YAML header, handling edge cases from the email block plugin
	 */
	private parseEmailYaml(yamlString: string): Record<string, string> {
		try {
			let processedYaml = yamlString;
			
			// Handle wikilinks - quote them if not already quoted (from email block plugin logic)
			if (processedYaml.includes('[[') && !processedYaml.includes('"[[')) {
				processedYaml = processedYaml.replace(/\[\[/g, '"[[');
				processedYaml = processedYaml.replace(/\]\]/g, ']]"');
			}
			
			// Handle template variables - quote them if not already quoted
			if (processedYaml.includes('{{') && !processedYaml.includes('"{{')) {
				processedYaml = processedYaml.replace(/\{\{/g, '"{{');
				processedYaml = processedYaml.replace(/\}\}/g, '}}"');
			}
			
			// Use Obsidian's YAML parser (from email block plugin approach)
			// For now, we'll do simple parsing since we don't have access to Obsidian's parseYaml
			const params: Record<string, string> = {};
			const lines = processedYaml.split('\n');
			
			for (const line of lines) {
				const colonIndex = line.indexOf(':');
				if (colonIndex > 0) {
					const key = line.substring(0, colonIndex).trim();
					let value = line.substring(colonIndex + 1).trim();
					
					// Remove quotes if present
					if ((value.startsWith('"') && value.endsWith('"')) || 
						(value.startsWith("'") && value.endsWith("'"))) {
						value = value.slice(1, -1);
					}
					
					// Handle array values (convert to comma-separated string)
					if (value.startsWith('[') && value.endsWith(']')) {
						value = value.slice(1, -1).replace(/"/g, '').replace(/'/g, '');
					}
					
					params[key] = value;
				}
			}
			
			return params;
			
		} catch (error) {
			throw new Error(`YAML parsing failed: ${error.message}`);
		}
	}
	
	/**
	 * Escape quotes in string content for Typst
	 */
	private escapeQuotes(text: string): string {
		if (!text) return '';
		return text
			.replace(/\\/g, '\\\\')   // Escape backslashes first
			.replace(/"/g, '\\"')     // Escape double quotes
			.replace(/'/g, "\\'")     // Escape single quotes to prevent smart quote conversion
			.replace(/\n/g, '\\n')    // Convert newlines to literal \n for string parameters
			.replace(/\r/g, '\\r');   // Convert carriage returns
	}
	
	/**
	 * Escape text for Typst string parameters while preserving actual newlines
	 * Used specifically for email body content where we want to keep paragraph breaks
	 * Also cleans up problematic Unicode characters that cause formatting issues
	 */
	private escapeBodyForTypst(text: string): string {
		if (!text) return '';
		
		// First, clean up problematic Unicode characters
		let cleaned = text
			// Replace various Unicode spaces with regular spaces
			.replace(/[\u00A0\u1680\u2000-\u200B\u202F\u205F\u3000\uFEFF]/g, ' ')
			// Replace Unicode line separators with regular newlines
			.replace(/[\u2028\u2029]/g, '\n') // Line Separator and Paragraph Separator
			// Replace Unicode hyphens/dashes with regular hyphen
			.replace(/[\u2010-\u2015\u2212]/g, '-')
			// Remove or replace problematic symbols that can cause layout issues
			.replace(/[\u2020\u2021]/g, '') // Remove dagger symbols
			.replace(/[\u2022\u2023\u2043]/g, '• ') // Replace various bullets with standard bullet
			// Remove zero-width characters
			.replace(/[\u200B-\u200D\uFEFF]/g, '')
			// Remove other problematic Unicode characters that can cause spacing issues
			.replace(/[\u00AD\u061C\u180E\u2066-\u2069]/g, '')
			// Normalize multiple spaces to single space (but preserve newlines)
			.replace(/[ \t]+/g, ' ')
			// Preserve paragraph breaks but clean up excessive newlines
			.replace(/\n{3,}/g, '\n\n');
		
		// Then escape for Typst string safety
		return cleaned
			.replace(/\\/g, '\\\\')   // Escape backslashes first
			.replace(/"/g, '\\"')     // Escape double quotes
			.replace(/'/g, "\\'");    // Escape single quotes
		// Note: DO NOT replace newlines - they should be preserved for proper formatting
	}
	
	/**
	 * Process multi-line callouts with comprehensive support
	 */
	private processMultiLineCallouts(content: string, result: PreprocessingResult): string {
		const lines = content.split('\n');
		const processedLines: string[] = [];
		let i = 0;
		
		while (i < lines.length) {
			const line = lines[i];
			const calloutMatch = line.match(/^>\s*\[!([\w-]+)\]([+-]?)\s*(.*)$/);
			
			if (calloutMatch) {
				const [, calloutType, foldable, title] = calloutMatch;
				const calloutBlock = this.extractCalloutBlock(lines, i);
				const processedCallout = this.convertCalloutToTypstFormat(
					calloutType, 
					title, 
					foldable, 
					calloutBlock.content, 
					result
				);
				
				processedLines.push(processedCallout);
				i = calloutBlock.endIndex;
			} else {
				processedLines.push(line);
				i++;
			}
		}
		
		return processedLines.join('\n');
	}
	
	/**
	 * Extract the full callout block content
	 */
	private extractCalloutBlock(lines: string[], startIndex: number): { content: string[]; endIndex: number } {
		const calloutContent: string[] = [];
		let currentIndex = startIndex + 1;
		
		// Add the title/first line content if present
		const firstLineMatch = lines[startIndex].match(/^>\s*\[![\w-]+\]([+-]?)\s*(.*)$/);
		if (firstLineMatch && firstLineMatch[2].trim()) {
			calloutContent.push(firstLineMatch[2].trim());
		}
		
		// Continue reading lines that start with '>' or are empty (within callout)
		while (currentIndex < lines.length) {
			const line = lines[currentIndex];
			
			if (line.startsWith('>')) {
				// Remove the '>' prefix and add to content
				const contentLine = line.substring(1).trim();
				calloutContent.push(contentLine);
				currentIndex++;
			} else if (line.trim() === '' && currentIndex + 1 < lines.length && lines[currentIndex + 1].startsWith('>')) {
				// Empty line followed by more callout content
				calloutContent.push('');
				currentIndex++;
			} else {
				// End of callout block
				break;
			}
		}
		
		return {
			content: calloutContent,
			endIndex: currentIndex
		};
	}
	
	/**
	 * Convert callout to Typst-compatible format
	 */
	private convertCalloutToTypstFormat(
		calloutType: string, 
		title: string, 
		foldable: string, 
		content: string[], 
		result: PreprocessingResult
	): string {
		// Enhanced callout type mapping with icons and styling hints
		const calloutTypeMap: Record<string, { display: string; icon: string; class: string }> = {
			'note': { display: 'Note', icon: '📝', class: 'callout-note' },
			'abstract': { display: 'Abstract', icon: '📋', class: 'callout-abstract' },
			'info': { display: 'Info', icon: 'ℹ️', class: 'callout-info' },
			'tip': { display: 'Tip', icon: '💡', class: 'callout-tip' },
			'success': { display: 'Success', icon: '✅', class: 'callout-success' },
			'question': { display: 'Question', icon: '❓', class: 'callout-question' },
			'warning': { display: 'Warning', icon: '⚠️', class: 'callout-warning' },
			'failure': { display: 'Failure', icon: '❌', class: 'callout-failure' },
			'danger': { display: 'Danger', icon: '⚡', class: 'callout-danger' },
			'bug': { display: 'Bug', icon: '🐛', class: 'callout-bug' },
			'example': { display: 'Example', icon: '📋', class: 'callout-example' },
			'quote': { display: 'Quote', icon: '💬', class: 'callout-quote' },
			'cite': { display: 'Citation', icon: '📖', class: 'callout-cite' }
		};
		
		const calloutInfo = calloutTypeMap[calloutType.toLowerCase()] || {
			display: calloutType.charAt(0).toUpperCase() + calloutType.slice(1),
			icon: '📌',
			class: 'callout-default'
		};
		
		// Build the blockquote with enhanced formatting
		let blockquote = '';
		
		// Add Typst comment with class for styling
		blockquote += `<!-- ${calloutInfo.class} -->\n`;
		
		// Create the header
		const headerText = title.trim() || calloutInfo.display;
		blockquote += `> **${calloutInfo.icon} ${headerText}**`;
		
		// Add foldable indicator if present
		if (foldable === '+') {
			blockquote += ' 🔽'; // Expanded
		} else if (foldable === '-') {
			blockquote += ' 🔼'; // Collapsed
		}
		
		blockquote += '\n>';
		
		// Add content with proper blockquote formatting
		if (content.length > 0) {
			blockquote += '\n';
			content.forEach(line => {
				if (line.trim() === '') {
					blockquote += '>\n';
				} else {
					blockquote += `> ${line}\n`;
				}
			});
		} else {
			blockquote += '\n';
		}
		
		// Add spacing after callout
		blockquote += '\n';
		
		return blockquote.trimEnd();
	}
	
	/**
	 * Calculate word count from processed content
	 */
	private calculateWordCount(content: string): number {
		// Remove markdown syntax and count words
		const plainText = content
			.replace(/[#*_`~\[\]()]/g, '') // Remove markdown formatting
			.replace(/\s+/g, ' ') // Normalize whitespace
			.trim();
			
		return plainText ? plainText.split(/\s+/).length : 0;
	}
	
	/**
	 * Extract title from content (first heading or inferred from filename)
	 */
	private extractTitle(content: string): string | undefined {
		// Look for first heading
		const headingMatch = content.match(/^#+\s+(.+)$/m);
		if (headingMatch) {
			return headingMatch[1].trim();
		}
		
		// Could be enhanced to use filename or frontmatter title
		return undefined;
	}
	
	/**
	 * Update configuration
	 */
	public updateConfig(config: Partial<MarkdownPreprocessorConfig>): void {
		if (config.vaultPath) {
			this.vaultPath = config.vaultPath;
		}
		if (config.options) {
			this.options = { ...this.options, ...config.options };
		}
		if (config.wikilinkConfig) {
			this.wikilinkConfig = { ...this.wikilinkConfig, ...config.wikilinkConfig };
		}
	}
	
	/**
	 * Get current configuration
	 */
	public getConfig(): MarkdownPreprocessorConfig {
		return {
			vaultPath: this.vaultPath,
			options: this.options,
			wikilinkConfig: this.wikilinkConfig
		};
	}
}

// Default configurations
export const DEFAULT_PREPROCESSOR_OPTIONS: PreprocessorOptions = {
	includeMetadata: true,
	preserveFrontmatter: true,
	baseUrl: ''
};

export const DEFAULT_WIKILINK_CONFIG: WikilinkConfig = {
	format: 'md',
	extension: '.md'
};