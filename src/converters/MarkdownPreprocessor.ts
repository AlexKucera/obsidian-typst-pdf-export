/**
 * Markdown preprocessing pipeline for Obsidian-to-Pandoc conversion.
 *
 * This module provides the central preprocessing system that transforms Obsidian's
 * proprietary markdown syntax into standard markdown compatible with Pandoc and Typst.
 * It coordinates multiple specialized processors to handle:
 * - YAML frontmatter extraction and formatting
 * - Wikilink conversion to standard markdown links
 * - Obsidian embed syntax (![[...]]) to standard images/includes
 * - Callout blocks (>[!note]) to custom Typst environments
 * - Email block formatting for email exports
 * - Remote image detection and download queue management
 * - Metadata extraction (tags, title, frontmatter)
 *
 * The preprocessor runs in a specific order to avoid conflicts:
 * 1. Horizontal rule normalization (prevent YAML delimiter confusion)
 * 2. Frontmatter extraction and processing
 * 3. Email block formatting
 * 4. Unnecessary link filtering (Open: links, Mail.app links)
 * 5. Embed processing (![[image]], ![[pdf]])
 * 6. Remote image detection (![](https://...))
 * 7. Wikilink conversion ([[link]] → [link](link.md))
 * 8. Callout block conversion
 * 9. Title extraction
 *
 * Key features:
 * - Stateless processing (each call is independent)
 * - Comprehensive metadata extraction for export pipeline
 * - Configurable wikilink and frontmatter handling
 * - Remote resource tracking for download coordination
 * - Error and warning reporting for user feedback
 * - Modular processor architecture for maintainability
 */

import { FrontmatterProcessor, FrontmatterProcessorConfig } from './preprocessors/FrontmatterProcessor';
import { WikilinkProcessor, WikilinkConfig, WikilinkProcessorConfig } from './preprocessors/WikilinkProcessor';
import { EmbedProcessor, EmbedProcessorConfig } from './preprocessors/EmbedProcessor';
import { CalloutProcessor } from './preprocessors/CalloutProcessor';
import { MetadataExtractor } from './preprocessors/MetadataExtractor';
import { HorizontalRuleProcessor } from './preprocessors/HorizontalRuleProcessor';
import * as path from 'path';

/**
 * Configuration options for markdown preprocessing behavior.
 *
 * @property preserveFrontmatter - Keep YAML frontmatter in output (true) or strip it (false)
 * @property baseUrl - Base URL for relative link resolution (optional)
 * @property printFrontmatter - Display frontmatter as formatted text at document start (optional)
 */
export interface PreprocessorOptions {
	/** Preserve existing frontmatter */
	preserveFrontmatter: boolean;
	/** Base URL for relative link resolution */
	baseUrl?: string;
	/** Display frontmatter as formatted text at the beginning of the document */
	printFrontmatter?: boolean;
}

/**
 * Result of markdown preprocessing operation.
 *
 * Contains the processed content, extracted metadata, and any errors or warnings
 * encountered during processing. The metadata includes information needed by
 * downstream export components like embedded resources and frontmatter data.
 *
 * @property content - Processed markdown content ready for Pandoc
 * @property metadata - Extracted metadata and resource tracking
 * @property metadata.tags - Extracted tags from frontmatter and content
 * @property metadata.frontmatter - Parsed YAML frontmatter object
 * @property metadata.title - Document title (from frontmatter or H1)
 * @property metadata.pdfEmbeds - PDF files embedded via ![[file.pdf]]
 * @property metadata.imageEmbeds - Images embedded via ![[image.png]] or ![](url)
 * @property metadata.fileEmbeds - Other files embedded via ![[file.ext]]
 * @property errors - Critical processing errors
 * @property warnings - Non-critical processing warnings
 */
export interface PreprocessingResult {
	/** Processed markdown content */
	content: string;
	/** Extracted metadata including tags and frontmatter */
	metadata: {
		tags: string[];
		frontmatter?: Record<string, unknown>;
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

/**
 * Configuration for MarkdownPreprocessor initialization.
 *
 * Provides all settings needed to initialize the preprocessor and its
 * constituent processors. This configuration is typically built from plugin
 * settings and file context.
 *
 * @property vaultPath - Absolute path to vault root for file resolution
 * @property options - Preprocessing behavior configuration
 * @property wikilinkConfig - Wikilink conversion settings
 * @property noteTitle - Optional title to prepend as H1 heading
 *
 * @example
 * ```typescript
 * const config: MarkdownPreprocessorConfig = {
 *   vaultPath: '/Users/name/vault',
 *   options: {
 *     preserveFrontmatter: true,
 *     printFrontmatter: false,
 *     baseUrl: ''
 *   },
 *   wikilinkConfig: {
 *     format: 'md',
 *     extension: '.md'
 *   },
 *   noteTitle: 'My Document'
 * };
 * const preprocessor = new MarkdownPreprocessor(config);
 * ```
 */
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

/**
 * Central markdown preprocessing coordinator for Obsidian-to-Pandoc conversion.
 *
 * This class orchestrates multiple specialized processors to transform Obsidian's
 * proprietary markdown into standard markdown that Pandoc can process. It ensures
 * processors run in the correct order to avoid syntax conflicts and maintains
 * comprehensive metadata about the conversion.
 *
 * The preprocessor is stateless - each process() call is independent and doesn't
 * affect previous or future calls. Configuration can be updated between calls via
 * updateConfig().
 *
 * Architecture:
 * - Delegates to specialized processors for specific syntax
 * - Maintains processing order to prevent conflicts
 * - Aggregates metadata from all processors
 * - Provides error and warning reporting
 *
 * Processing Pipeline:
 * 1. Horizontal rules (prevent YAML confusion)
 * 2. Frontmatter (extract metadata, optionally format)
 * 3. Email blocks (custom email formatting)
 * 4. Link filtering (remove unnecessary links)
 * 5. Embeds (convert ![[...]] syntax)
 * 6. Remote images (detect and queue for download)
 * 7. Wikilinks (convert [[...]] to standard links)
 * 8. Callouts (convert >[!type] blocks)
 * 9. Title extraction (from H1 or frontmatter)
 *
 * @example
 * ```typescript
 * // Initialize preprocessor
 * const preprocessor = new MarkdownPreprocessor({
 *   vaultPath: '/path/to/vault',
 *   options: {
 *     preserveFrontmatter: true,
 *     printFrontmatter: false
 *   },
 *   wikilinkConfig: {
 *     format: 'md',
 *     extension: '.md'
 *   },
 *   noteTitle: 'My Note'
 * });
 *
 * // Process markdown
 * const obsidianMarkdown = '# My Note\n\n[[internal-link]]\n\n![[image.png]]';
 * const result = preprocessor.process(obsidianMarkdown);
 *
 * console.log(result.content);  // Standard markdown
 * console.log(result.metadata.imageEmbeds);  // Image processing info
 * console.log(result.errors);   // Any errors encountered
 * ```
 *
 * @example
 * ```typescript
 * // Update configuration for different export
 * preprocessor.updateConfig({
 *   options: { preserveFrontmatter: false },
 *   noteTitle: 'Different Title'
 * });
 *
 * // Process with new configuration
 * const newResult = preprocessor.process(markdown);
 * ```
 */
export class MarkdownPreprocessor {
	private vaultPath: string;
	private options: PreprocessorOptions;
	private wikilinkConfig: WikilinkConfig;
	private noteTitle?: string;
	private horizontalRuleProcessor: HorizontalRuleProcessor;
	private frontmatterProcessor: FrontmatterProcessor;
	private wikilinkProcessor: WikilinkProcessor;
	private embedProcessor: EmbedProcessor;
	private calloutProcessor: CalloutProcessor;
	
	constructor(config: MarkdownPreprocessorConfig) {
		this.vaultPath = config.vaultPath;
		this.options = config.options;
		this.wikilinkConfig = config.wikilinkConfig;
		this.noteTitle = config.noteTitle;
		
		this.horizontalRuleProcessor = new HorizontalRuleProcessor();
		
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
		
		this.calloutProcessor = new CalloutProcessor();
	}
	
	/**
	 * Processes Obsidian markdown and converts it to standard Pandoc-compatible markdown.
	 *
	 * This is the main entry point for preprocessing. It runs all configured processors
	 * in the correct order, aggregates metadata from each stage, and returns a complete
	 * result with processed content and comprehensive metadata.
	 *
	 * Processing is stateless - each call operates independently on the provided content.
	 *
	 * Processing Order (critical for avoiding conflicts):
	 * 1. Horizontal rules → Prevent YAML delimiter confusion
	 * 2. Frontmatter → Extract metadata, optionally format
	 * 3. Email blocks → Custom formatting for email exports
	 * 4. Link filtering → Remove Open: and Mail.app links
	 * 5. Embeds → Convert ![[...]] syntax first (before wikilinks add .md)
	 * 6. Remote images → Detect and queue ![](https://...) for download
	 * 7. Wikilinks → Convert [[...]] after embeds processed
	 * 8. Callouts → Convert >[!type] blocks to Typst environments
	 * 9. Title extraction → From H1 or frontmatter
	 *
	 * @param content - Raw Obsidian markdown content to process
	 * @returns Preprocessing result with converted content, metadata, and diagnostics
	 *
	 * @example
	 * ```typescript
	 * // Process note with various Obsidian syntax
	 * const markdown = `---
	 * title: My Note
	 * tags: [export, pdf]
	 * ---
	 *
	 * # My Note
	 *
	 * Internal link: [[other-note]]
	 * Image: ![[screenshot.png]]
	 * Callout: > [!note] This is important
	 * `;
	 *
	 * const result = preprocessor.process(markdown);
	 *
	 * // Check for errors
	 * if (result.errors.length > 0) {
	 *   console.error('Processing errors:', result.errors);
	 * }
	 *
	 * // Access processed content
	 * console.log(result.content);  // Standard markdown
	 *
	 * // Access extracted metadata
	 * console.log(result.metadata.title);  // "My Note"
	 * console.log(result.metadata.tags);   // ["export", "pdf"]
	 * console.log(result.metadata.imageEmbeds);  // [{originalPath, ...}]
	 * ```
	 *
	 * @example
	 * ```typescript
	 * // Handle remote images
	 * const markdown = '![Remote](https://example.com/image.png)';
	 * const result = preprocessor.process(markdown);
	 *
	 * // Remote images are queued for download
	 * result.metadata.imageEmbeds.forEach(embed => {
	 *   console.log(`Download: ${embed.originalPath}`);
	 *   // Export pipeline will download and embed these
	 * });
	 * ```
	 */
	public process(content: string): PreprocessingResult {
		const result: PreprocessingResult = {
			content: content,
			metadata: {
				tags: [],
				frontmatter: undefined,
				title: undefined
			},
			errors: [],
			warnings: []
		};
		
		try {
			// Step 1: Process horizontal rules to avoid YAML delimiter conflicts
			result.content = this.horizontalRuleProcessor.process(result.content);
			
			// Step 2: Extract and process frontmatter (always process for metadata extraction)
			result.content = this.frontmatterProcessor.processFrontmatter(result.content, result);
			
			// Step 3: Convert email blocks to Typst format
			result.content = this.calloutProcessor.processEmailBlocks(result.content, result);
			
			// Step 4: Filter out unnecessary links (Open: links and Mail.app links)
			result.content = this.calloutProcessor.filterUnnecessaryLinks(result.content, result);
			
			// Step 5: Convert embeds FIRST (before wikilinks to avoid .md extension being added)
			result.content = this.embedProcessor.processEmbeds(result.content, result);

			// Step 5.5: Handle standard markdown images with remote URLs
			// Process after embeds (which handle ![[]] syntax) but before wikilinks
			// to ensure remote URLs in standard markdown ![](url) format are queued for download
			result.content = this.processStandardMarkdownImages(result.content, result);

			// Step 6: Convert wikilinks (after embeds are processed)
			result.content = this.wikilinkProcessor.processWikilinks(result.content, result);
			
			// Step 7: Convert callouts
			result.content = this.calloutProcessor.processCallouts(result.content, result);
			
			// Extract title from content if not available from frontmatter
			if (!result.metadata.title) {
				result.metadata.title = MetadataExtractor.extractTitle(result.content);
			}
			
		} catch (error) {
			result.errors.push(`Processing error: ${error.message}`);
		}
		
		return result;
	}

	/**
	 * Processes standard markdown images and queues remote URLs for download.
	 *
	 * This method scans the content for standard markdown image syntax `![alt](url)`
	 * and detects remote images (http:// or https://). Remote images are:
	 * - Replaced with marker placeholders in the content
	 * - Added to the imageEmbeds metadata for download by the export pipeline
	 * - Tracked with a warning message for user visibility
	 *
	 * Local images (file paths without http/https) are left unchanged for normal
	 * processing. This allows the export pipeline to handle them separately from
	 * remote resources that need downloading.
	 *
	 * The marker format is: `IMAGE_EMBED_MARKER:{url}:{baseName}:{alt}`
	 * This allows the export pipeline to:
	 * - Download the remote image
	 * - Replace the marker with the local path
	 * - Preserve the alt text for accessibility
	 *
	 * @param content - Markdown content to process
	 * @param result - Processing result to update with remote image metadata
	 * @returns Content with remote images replaced by markers
	 * @private
	 *
	 * @example
	 * ```typescript
	 * // Remote image detected and queued
	 * const markdown = '![Photo](https://example.com/image.png)';
	 * const result = { metadata: {}, warnings: [], errors: [] };
	 * const processed = this.processStandardMarkdownImages(markdown, result);
	 *
	 * // Content has marker: 'IMAGE_EMBED_MARKER:https://...:image:Photo'
	 * // result.metadata.imageEmbeds has entry for download
	 * // result.warnings includes "Remote URL image queued for download"
	 * ```
	 *
	 * @example
	 * ```typescript
	 * // Local image left unchanged
	 * const markdown = '![Local](local-image.png)';
	 * const result = { metadata: {}, warnings: [], errors: [] };
	 * const processed = this.processStandardMarkdownImages(markdown, result);
	 *
	 * // Content unchanged: '![Local](local-image.png)'
	 * // No entries added to metadata or warnings
	 * ```
	 */
	private processStandardMarkdownImages(content: string, result: PreprocessingResult): string {
		// Pattern to match standard markdown images: ![alt](url)
		const markdownImagePattern = /!\[([^\]]*)\]\(([^)]+)\)/g;

		return content.replace(markdownImagePattern, (match, alt, url) => {
			// Check if this is a remote URL (http:// or https://)
			const isRemoteUrl = /^https?:\/\//i.test(url.trim());

			if (isRemoteUrl) {
				const cleanUrl = url.trim();

				// Extract filename from URL for tracking
				let fileName = 'remote-image.png';
				try {
					const urlObj = new URL(cleanUrl);
					fileName = path.basename(urlObj.pathname) || fileName;
				} catch {
					// Use default if URL parsing fails
				}

				const baseName = fileName.replace(/\.[^/.]+$/, ""); // Remove extension

				// Create a marker that the export process can detect and replace
				const marker = `IMAGE_EMBED_MARKER:${cleanUrl}:${baseName}:${alt || ''}`;

				// Add to processing queue for later download and embedding
				if (!result.metadata.imageEmbeds) {
					result.metadata.imageEmbeds = [];
				}
				result.metadata.imageEmbeds.push({
					originalPath: cleanUrl,
					sanitizedPath: cleanUrl, // For remote URLs, sanitized = original
					fileName: fileName,
					baseName: baseName,
					sizeOrAlt: alt,
					marker: marker
				});

				result.warnings.push(`Remote URL image queued for download: ${cleanUrl}`);

				return marker;
			}

			// Keep local images as-is for normal processing
			return match;
		});
	}

	/**
	 * Updates the preprocessor configuration dynamically.
	 *
	 * This method allows modifying preprocessor settings after initialization without
	 * creating a new instance. It supports partial updates - only the provided fields
	 * are changed, leaving others intact. The method also propagates relevant changes
	 * to dependent processors (WikilinkProcessor, EmbedProcessor) to maintain consistency.
	 *
	 * When updating wikilink configuration or base URL, the changes cascade to:
	 * 1. WikilinkProcessor - Updated with new wikilink settings and base URL
	 * 2. EmbedProcessor - Receives updated WikilinkProcessor reference
	 *
	 * This cascading update ensures that all processors use consistent configuration
	 * throughout the preprocessing pipeline.
	 *
	 * Configuration updates are useful for:
	 * - Changing export settings between different notes
	 * - Applying user preference changes without reinitialization
	 * - Switching between different export contexts (web vs. local)
	 * - Testing different configuration combinations
	 *
	 * @param config - Partial configuration update (only specified fields are changed)
	 *
	 * @example
	 * ```typescript
	 * // Update base URL for web export
	 * preprocessor.updateConfig({
	 *   options: { baseUrl: 'https://example.com/notes' }
	 * });
	 *
	 * // Process note with web-friendly links
	 * const result = preprocessor.process(markdown);
	 * // Links will use the new base URL
	 * ```
	 *
	 * @example
	 * ```typescript
	 * // Change wikilink format for different export
	 * preprocessor.updateConfig({
	 *   wikilinkConfig: {
	 *     format: 'html',
	 *     extension: '.html'
	 *   }
	 * });
	 *
	 * // Process with HTML-style links
	 * const result = preprocessor.process(markdown);
	 * // [[note]] becomes [note](note.html)
	 * ```
	 *
	 * @example
	 * ```typescript
	 * // Update multiple settings at once
	 * preprocessor.updateConfig({
	 *   vaultPath: '/new/vault/path',
	 *   options: {
	 *     preserveFrontmatter: false,
	 *     printFrontmatter: true
	 *   }
	 * });
	 * ```
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
	 * Retrieves the current preprocessor configuration.
	 *
	 * This method returns a snapshot of the preprocessor's current settings,
	 * including vault path, processing options, and wikilink configuration.
	 * The returned object is a plain data object that can be:
	 * - Inspected for debugging
	 * - Serialized for logging or caching
	 * - Modified and passed to updateConfig() for changes
	 * - Used to create a new preprocessor with the same settings
	 *
	 * Note: The returned configuration does not include the noteTitle field,
	 * as this is typically set per-export rather than persisted in the
	 * preprocessor configuration.
	 *
	 * @returns Current preprocessor configuration object
	 *
	 * @example
	 * ```typescript
	 * // Inspect current settings
	 * const config = preprocessor.getConfig();
	 * console.log('Vault path:', config.vaultPath);
	 * console.log('Preserve frontmatter:', config.options.preserveFrontmatter);
	 * console.log('Wikilink format:', config.wikilinkConfig.format);
	 * ```
	 *
	 * @example
	 * ```typescript
	 * // Clone preprocessor with same configuration
	 * const currentConfig = preprocessor.getConfig();
	 * const clonedPreprocessor = new MarkdownPreprocessor({
	 *   ...currentConfig,
	 *   noteTitle: 'Different Title'
	 * });
	 * ```
	 *
	 * @example
	 * ```typescript
	 * // Modify and reapply configuration
	 * const config = preprocessor.getConfig();
	 * config.options.baseUrl = 'https://new-url.com';
	 * preprocessor.updateConfig(config);
	 * ```
	 */
	public getConfig(): MarkdownPreprocessorConfig {
		return {
			vaultPath: this.vaultPath,
			options: this.options,
			wikilinkConfig: this.wikilinkConfig
		};
	}
}

/**
 * Default preprocessor options for standard Markdown processing.
 *
 * These defaults are designed to work well for most Obsidian-to-Pandoc conversions:
 * - **preserveFrontmatter: true** - Keeps YAML frontmatter in the output, allowing
 *   Pandoc and Typst to access metadata (title, author, date, custom variables).
 *   Set to false if you want to strip frontmatter entirely.
 * - **baseUrl: ''** - Empty base URL means links remain relative to the vault.
 *   Set this when exporting to web to make links absolute (e.g., 'https://example.com/notes').
 *
 * These values are used when creating a new MarkdownPreprocessor without explicit
 * options. They can be overridden via the MarkdownPreprocessorConfig constructor
 * parameter or modified later via updateConfig().
 *
 * @example
 * ```typescript
 * // Use defaults implicitly
 * const preprocessor = new MarkdownPreprocessor({
 *   vaultPath: '/vault',
 *   options: DEFAULT_PREPROCESSOR_OPTIONS,  // Explicit use of defaults
 *   wikilinkConfig: DEFAULT_WIKILINK_CONFIG
 * });
 * ```
 *
 * @example
 * ```typescript
 * // Override defaults for web export
 * const webOptions = {
 *   ...DEFAULT_PREPROCESSOR_OPTIONS,
 *   baseUrl: 'https://blog.example.com/notes'
 * };
 * ```
 */
export const DEFAULT_PREPROCESSOR_OPTIONS: PreprocessorOptions = {
	preserveFrontmatter: true,
	baseUrl: ''
};

/**
 * Default wikilink conversion configuration for Markdown output.
 *
 * These defaults convert Obsidian wikilinks to standard Markdown links:
 * - **format: 'md'** - Convert to Markdown format `[text](link.md)`
 *   Other possible values: 'html' for `[text](link.html)`, 'wiki' to preserve `[[link]]`
 * - **extension: '.md'** - Add .md extension to converted links
 *   Ensures [[note]] becomes [note](note.md) for proper cross-reference handling
 *
 * This configuration is passed to WikilinkProcessor during preprocessing and
 * ensures consistent link handling throughout the conversion pipeline.
 *
 * These values work well for Pandoc conversion, as Pandoc expects standard
 * Markdown links with file extensions. For web publishing, you might want to
 * use format: 'html' and extension: '.html' instead.
 *
 * @example
 * ```typescript
 * // Use defaults for standard Markdown output
 * const preprocessor = new MarkdownPreprocessor({
 *   vaultPath: '/vault',
 *   options: DEFAULT_PREPROCESSOR_OPTIONS,
 *   wikilinkConfig: DEFAULT_WIKILINK_CONFIG  // [[note]] → [note](note.md)
 * });
 * ```
 *
 * @example
 * ```typescript
 * // Override for HTML export
 * const htmlWikilinkConfig = {
 *   ...DEFAULT_WIKILINK_CONFIG,
 *   format: 'html',
 *   extension: '.html'
 * };
 * // [[note]] → [note](note.html)
 * ```
 *
 * @example
 * ```typescript
 * // Preserve wikilinks (no conversion)
 * const preserveWikilinks = {
 *   format: 'wiki',
 *   extension: ''
 * };
 * // [[note]] → [[note]] (unchanged)
 * ```
 */
export const DEFAULT_WIKILINK_CONFIG: WikilinkConfig = {
	format: 'md',
	extension: '.md'
};