import { PreprocessingResult } from '../MarkdownPreprocessor';

/**
 * Handles processing of Obsidian callouts and email blocks for Typst conversion
 */
export class CalloutProcessor {
	// Patterns for matching different block types
	private readonly CALLOUT_PATTERN = /^>\s*\[![\w-]+\]/;
	private readonly MULTI_LINE_CALLOUT_PATTERN = /^>\s*\[![\w-]+\][+-]?\s*.*$/;
	private readonly EMAIL_BLOCK_PATTERN = /^```email\s*\n([\s\S]*?)^```\s*$/gm;

	/**
	 * Main entry point for processing callouts
	 */
	public processCallouts(content: string, result: PreprocessingResult): string {
		// Process multi-line callouts first
		const processed = this.processMultiLineCallouts(content, result);
		return processed;
	}

	/**
	 * Main entry point for processing email blocks
	 */
	public processEmailBlocks(content: string, result: PreprocessingResult): string {
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
	 * Filters out unnecessary links from content
	 */
	public filterUnnecessaryLinks(content: string, result: PreprocessingResult): string {
		let processed = content;
		
		try {
			// Remove [[filename|Open: filename]] links
			processed = processed.replace(/\[\[.*?\|Open:.*?\]\]/g, '');
			
			// Remove [Open in Mail.app](message://) links  
			processed = processed.replace(/\[Open in Mail\.app\]\(message:\/\/[^)]+\)/g, '');
			
			// Clean up any resulting multiple newlines
			processed = processed.replace(/\n{3,}/g, '\n\n');
		} catch (error) {
			result.warnings.push(`Error filtering unnecessary links: ${error.message}`);
		}
		
		return processed;
	}

	/**
	 * Processes multi-line callout blocks
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
	 * Extracts content from a callout block
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
	 * Converts callout to Typst format with enhanced styling
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
	 * Processes individual email block
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
	 * Parses YAML header in email blocks
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
	 * Escapes quotes in text for safe Typst string usage
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
	 * Escapes email body content for safe Typst usage
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
}