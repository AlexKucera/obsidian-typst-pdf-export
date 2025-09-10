/**
 * WikilinkProcessor - Handles conversion of Obsidian wikilinks to standard markdown links
 */

export interface WikilinkConfig {
	/** Format for wikilink conversion ('md' for .md extension, 'none' for no extension) */
	format: 'md' | 'none';
	/** File extension to append to wikilinks */
	extension: string;
}

export interface WikilinkProcessorConfig {
	/** Wikilink conversion configuration */
	wikilinkConfig: WikilinkConfig;
	/** Base URL for relative link resolution */
	baseUrl?: string;
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

export class WikilinkProcessor {
	private wikilinkConfig: WikilinkConfig;
	private baseUrl?: string;
	
	// Regex pattern for comprehensive wikilink matching with headings
	private readonly WIKILINK_WITH_HEADING_PATTERN = /\[\[([^#\|\]]+)(?:#([^|\]]+))?(?:\|([^\]]+))?\]\]/g;
	
	constructor(config: WikilinkProcessorConfig) {
		this.wikilinkConfig = config.wikilinkConfig;
		this.baseUrl = config.baseUrl;
	}
	
	/**
	 * Convert wikilinks to standard markdown links
	 */
	public processWikilinks(content: string, result: PreprocessingResult): string {
		// Use the comprehensive pattern that handles headings
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
				if (this.baseUrl) {
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
	 * Made public as it's also used by embed processors
	 */
	public sanitizeFilePath(filePath: string): string {
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
		if (!this.baseUrl) {
			return path;
		}
		
		// Simple relative path resolution
		if (path.startsWith('/')) {
			return path; // Already absolute
		}
		
		const baseUrl = this.baseUrl.endsWith('/') ? 
			this.baseUrl : 
			`${this.baseUrl}/`;
			
		return `${baseUrl}${path}`;
	}
	
	/**
	 * Update configuration
	 */
	public updateConfig(config: Partial<WikilinkProcessorConfig>): void {
		if (config.wikilinkConfig) {
			this.wikilinkConfig = { ...this.wikilinkConfig, ...config.wikilinkConfig };
		}
		if (config.baseUrl !== undefined) {
			this.baseUrl = config.baseUrl;
		}
	}
	
	/**
	 * Get current configuration
	 */
	public getConfig(): WikilinkProcessorConfig {
		return {
			wikilinkConfig: this.wikilinkConfig,
			baseUrl: this.baseUrl
		};
	}
}

// Default configuration
export const DEFAULT_WIKILINK_CONFIG: WikilinkConfig = {
	format: 'md',
	extension: '.md'
};