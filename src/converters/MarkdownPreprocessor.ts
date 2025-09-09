/**
 * MarkdownPreprocessor - Converts Obsidian-specific markdown syntax to standard markdown
 * compatible with Pandoc for Typst PDF export
 */

import { FrontmatterProcessor, FrontmatterProcessorConfig } from './preprocessors/FrontmatterProcessor';
import { WikilinkProcessor, WikilinkConfig, WikilinkProcessorConfig } from './preprocessors/WikilinkProcessor';
import { EmbedProcessor, EmbedProcessorConfig } from './preprocessors/EmbedProcessor';

export interface PreprocessorOptions {
	/** Include metadata extraction in processing */
	includeMetadata: boolean;
	/** Preserve existing frontmatter */
	preserveFrontmatter: boolean;
	/** Base URL for relative link resolution */
	baseUrl?: string;
	/** Display frontmatter as formatted text at the beginning of the document */
	printFrontmatter?: boolean;
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
	private frontmatterProcessor: FrontmatterProcessor;
	private wikilinkProcessor: WikilinkProcessor;
	private embedProcessor: EmbedProcessor;
	
	// Regex patterns for Obsidian syntax
	private readonly WIKILINK_PATTERN = /\[\[([^\|\]]+)(?:\|([^\]]+))?\]\]/g;
	private readonly CALLOUT_PATTERN = /^>\s*\[!([\w-]+)\]([+-]?)\s*(.*)$/gm;
	private readonly MULTI_LINE_CALLOUT_PATTERN = /^(>\s*\[!([\w-]+)\]([+-]?)\s*(.*(?:\n(?:>.*|$))*?))/gm;
	private readonly TAG_PATTERN = /#(?:[^\s#]+)/g;
	private readonly EMAIL_BLOCK_PATTERN = /^```email\s*\n([\s\S]*?)^```\s*$/gm;
	
	constructor(config: MarkdownPreprocessorConfig) {
		this.vaultPath = config.vaultPath;
		this.options = config.options;
		this.wikilinkConfig = config.wikilinkConfig;
		this.noteTitle = config.noteTitle;
		
		const frontmatterConfig: FrontmatterProcessorConfig = {
			noteTitle: this.noteTitle,
			preserveFrontmatter: this.options.preserveFrontmatter,
			printFrontmatter: this.options.printFrontmatter || false
		};
		this.frontmatterProcessor = new FrontmatterProcessor(frontmatterConfig);
		
		const wikilinkProcessorConfig: WikilinkProcessorConfig = {
			wikilinkConfig: this.wikilinkConfig,
			baseUrl: this.options.baseUrl
		};
		this.wikilinkProcessor = new WikilinkProcessor(wikilinkProcessorConfig);
		
		const embedProcessorConfig: EmbedProcessorConfig = {
			wikilinkProcessor: this.wikilinkProcessor
		};
		this.embedProcessor = new EmbedProcessor(embedProcessorConfig);
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
			result.content = this.frontmatterProcessor.processFrontmatter(result.content, result);
			
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
			result.content = this.embedProcessor.processEmbeds(result.content, result);
			
			// Step 6: Convert wikilinks (after embeds are processed)
			result.content = this.wikilinkProcessor.processWikilinks(result.content, result);
			
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
		
		// Update WikilinkProcessor configuration if relevant options changed
		if (config.wikilinkConfig || config.options?.baseUrl !== undefined) {
			this.wikilinkProcessor.updateConfig({
				wikilinkConfig: this.wikilinkConfig,
				baseUrl: this.options.baseUrl
			});
			
			// Update EmbedProcessor since it depends on WikilinkProcessor
			this.embedProcessor.updateConfig({
				wikilinkProcessor: this.wikilinkProcessor
			});
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