/**
 * MarkdownPreprocessor - Converts Obsidian-specific markdown syntax to standard markdown
 * compatible with Pandoc for Typst PDF export
 */

import { FrontmatterProcessor, FrontmatterProcessorConfig } from './preprocessors/FrontmatterProcessor';
import { WikilinkProcessor, WikilinkConfig, WikilinkProcessorConfig } from './preprocessors/WikilinkProcessor';
import { EmbedProcessor, EmbedProcessorConfig } from './preprocessors/EmbedProcessor';
import { CalloutProcessor } from './preprocessors/CalloutProcessor';
import { MetadataExtractor } from './preprocessors/MetadataExtractor';

export interface PreprocessorOptions {
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
	private calloutProcessor: CalloutProcessor;
	
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
		
		this.calloutProcessor = new CalloutProcessor();
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
				title: undefined
			},
			errors: [],
			warnings: []
		};
		
		try {
			// Step 1: Extract and process frontmatter first (always process for metadata extraction)
			result.content = this.frontmatterProcessor.processFrontmatter(result.content, result);
			
			// Step 2: Convert email blocks to Typst format
			result.content = this.calloutProcessor.processEmailBlocks(result.content, result);
			
			// Step 3: Filter out unnecessary links (Open: links and Mail.app links)
			result.content = this.calloutProcessor.filterUnnecessaryLinks(result.content, result);
			
			// Step 4: Convert embeds FIRST (before wikilinks to avoid .md extension being added)
			result.content = this.embedProcessor.processEmbeds(result.content, result);
			
			// Step 5: Convert wikilinks (after embeds are processed)
			result.content = this.wikilinkProcessor.processWikilinks(result.content, result);
			
			// Step 6: Convert callouts
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
	preserveFrontmatter: true,
	baseUrl: ''
};

export const DEFAULT_WIKILINK_CONFIG: WikilinkConfig = {
	format: 'md',
	extension: '.md'
};