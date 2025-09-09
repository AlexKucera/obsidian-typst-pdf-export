/**
 * FrontmatterProcessor - Handles YAML frontmatter parsing and processing
 * Extracted from MarkdownPreprocessor for better code organization
 */

import { PreprocessingResult } from '../MarkdownPreprocessor';

export interface FrontmatterProcessorConfig {
	noteTitle?: string;
	preserveFrontmatter: boolean;
	printFrontmatter: boolean;
}

export class FrontmatterProcessor {
	private readonly FRONTMATTER_PATTERN = /^---\s*\n([\s\S]*?)\n---\s*\n/;
	private readonly noteTitle?: string;
	private readonly preserveFrontmatter: boolean;
	private readonly printFrontmatter: boolean;
	
	constructor(config: FrontmatterProcessorConfig) {
		this.noteTitle = config.noteTitle;
		this.preserveFrontmatter = config.preserveFrontmatter;
		this.printFrontmatter = config.printFrontmatter;
	}
	
	/**
	 * Process frontmatter using the gray-matter library approach
	 */
	public processFrontmatter(content: string, result: PreprocessingResult): string {
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
				
				// Handle frontmatter preservation and display options
				const finalFrontmatter = this.noteTitle ? 
					{ ...parsed.data, title: this.noteTitle } : 
					parsed.data;
				
				if (this.preserveFrontmatter) {
					// Keep the frontmatter in the content, but reconstruct it with the modified title
					const yaml = require('js-yaml');
					const newFrontmatter = yaml.dump(finalFrontmatter);
					let processedContent = `---\n${newFrontmatter}---\n${parsed.content}`;
					
					// Add printed frontmatter if requested
					if (this.printFrontmatter) {
						const frontmatterDisplay = this.formatFrontmatterForDisplay(finalFrontmatter);
						processedContent = `---\n${newFrontmatter}---\n\n${frontmatterDisplay}\n\n${parsed.content}`;
					}
					
					return processedContent;
				} else {
					// Return content without frontmatter, but add title as frontmatter for Pandoc
					let processedContent: string;
					if (this.noteTitle) {
						const yaml = require('js-yaml');
						const titleFrontmatter = yaml.dump({ title: this.noteTitle });
						processedContent = `---\n${titleFrontmatter}---\n${parsed.content}`;
					} else {
						processedContent = parsed.content;
					}
					
					// Add printed frontmatter if requested
					if (this.printFrontmatter) {
						const frontmatterDisplay = this.formatFrontmatterForDisplay(finalFrontmatter);
						// Insert after the title frontmatter but before content
						const lines = processedContent.split('\n');
						if (lines[0] === '---' && lines.findIndex(line => line === '---') > 0) {
							const endIndex = lines.findIndex((line, i) => i > 0 && line === '---');
							lines.splice(endIndex + 1, 0, '', frontmatterDisplay, '');
							processedContent = lines.join('\n');
						} else {
							processedContent = `${frontmatterDisplay}\n\n${processedContent}`;
						}
					}
					
					return processedContent;
				}
			} else {
				// No frontmatter found - add title frontmatter if we have a noteTitle
				if (this.noteTitle) {
					const yaml = require('js-yaml');
					const titleFrontmatter = yaml.dump({ title: this.noteTitle });
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
					
					if (this.preserveFrontmatter) {
						// Reconstruct frontmatter with modified title
						if (this.noteTitle) {
							const yaml = require('js-yaml');
							const newFrontmatter = yaml.dump(frontmatter);
							let processedContent = content.replace(this.FRONTMATTER_PATTERN, `---\n${newFrontmatter}---\n`);
							
							// Add printed frontmatter if requested
							if (this.printFrontmatter) {
								const frontmatterDisplay = this.formatFrontmatterForDisplay(frontmatter);
								processedContent = processedContent.replace(
									this.FRONTMATTER_PATTERN, 
									`---\n${newFrontmatter}---\n\n${frontmatterDisplay}\n\n`
								);
							}
							
							return processedContent;
						} else {
							return content;
						}
					} else {
						// Add title as frontmatter for Pandoc even when not preserving original
						if (this.noteTitle) {
							const yaml = require('js-yaml');
							const titleFrontmatter = yaml.dump({ title: this.noteTitle });
							let processedContent = content.replace(this.FRONTMATTER_PATTERN, `---\n${titleFrontmatter}---\n`);
							
							// Add printed frontmatter if requested
							if (this.printFrontmatter) {
								const frontmatterDisplay = this.formatFrontmatterForDisplay(frontmatter);
								processedContent = processedContent.replace(
									this.FRONTMATTER_PATTERN,
									`---\n${titleFrontmatter}---\n\n${frontmatterDisplay}\n\n`
								);
							}
							
							return processedContent;
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
	 * Format frontmatter as a readable display block
	 */
	private formatFrontmatterForDisplay(frontmatter: Record<string, any>): string {
	if (!frontmatter || Object.keys(frontmatter).length === 0) {
		return '';
	}
	
	const lines: string[] = [];
	lines.push('**Document Information**');
	lines.push('');
	
	// Format each frontmatter field
	for (const [key, value] of Object.entries(frontmatter)) {
		if (value !== undefined && value !== null && value !== '') {
			// Format the key nicely (capitalize first letter, convert underscores to spaces)
			const formattedKey = key.charAt(0).toUpperCase() + key.slice(1).replace(/_/g, ' ');
			
			// Handle different value types
			let formattedValue: string;
			if (Array.isArray(value)) {
				// For arrays, put each item on its own line if there are many items
				if (value.length > 3) {
					formattedValue = '\n\n' + value.map(item => `- ${item}`).join('\n') + '\n';
				} else {
					formattedValue = value.join(', ');
				}
			} else if (typeof value === 'object') {
				formattedValue = JSON.stringify(value);
			} else {
				const valueStr = String(value);
				// If the value is very long (like email lists), break it up
				if (valueStr.length > 80 && valueStr.includes(',')) {
					// Split on commas and format as a bulleted list
					const items = valueStr.split(',').map(item => item.trim());
					if (items.length > 1) {
						formattedValue = '\n\n' + items.map(item => `- ${item}`).join('\n') + '\n';
					} else {
						formattedValue = valueStr;
					}
				} else if (valueStr.length > 100) {
					// For other very long values, try to break at word boundaries
					const words = valueStr.split(' ');
					let currentLine = '';
					const wrappedLines: string[] = [];
					
					for (const word of words) {
						if (currentLine.length + word.length + 1 > 80) {
							if (currentLine) {
								wrappedLines.push(currentLine);
								currentLine = word;
							} else {
								wrappedLines.push(word);
							}
						} else {
							currentLine += (currentLine ? ' ' : '') + word;
						}
					}
					if (currentLine) {
						wrappedLines.push(currentLine);
					}
					
					formattedValue = '\n\n' + wrappedLines.join('  \n') + '\n';
				} else {
					formattedValue = valueStr;
				}
			}
			
			// Add line break after the property label, then the value
			if (formattedValue.startsWith('\n')) {
				// Value already starts with newline (like lists), so just add the label
				lines.push(`**${formattedKey}:**${formattedValue}`);
			} else {
				// Add a line break after the label for regular values
				lines.push(`**${formattedKey}:**\n${formattedValue}`);
			}
			}
	}
	
	// Join with double newlines to ensure proper spacing between fields
	const result = lines.join('\n\n');
	return result;
}
}