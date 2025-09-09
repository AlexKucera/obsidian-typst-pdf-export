/**
 * MetadataExtractor.ts
 * 
 * Handles extraction of metadata from markdown content including tags, titles, and word counts.
 * This module provides pure utility functions for processing markdown content to extract
 * various metadata elements used in the PDF export process.
 */

export class MetadataExtractor {
	/**
	 * Extracts hashtags from markdown content while avoiding false positives
	 * from code blocks and markdown headings.
	 * 
	 * @param content - The markdown content to extract tags from
	 * @returns Array of unique tags found in the content (without # prefix)
	 */
	public static extractTags(content: string): string[] {
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
	 * Calculates word count for markdown content by removing formatting and counting words.
	 * 
	 * @param content - The markdown content to count words in
	 * @returns Number of words in the content
	 */
	public static calculateWordCount(content: string): number {
		// Remove markdown syntax and count words
		const plainText = content
			.replace(/[#*_`~\[\]()]/g, '') // Remove markdown formatting
			.replace(/\s+/g, ' ') // Normalize whitespace
			.trim();
			
		return plainText ? plainText.split(/\s+/).length : 0;
	}

	/**
	 * Extracts title from markdown content by looking for the first heading.
	 * 
	 * @param content - The markdown content to extract title from
	 * @returns The title text if found, undefined otherwise
	 */
	public static extractTitle(content: string): string | undefined {
		// Look for first heading
		const headingMatch = content.match(/^#+\s+(.+)$/m);
		if (headingMatch) {
			return headingMatch[1].trim();
		}
		
		// Could be enhanced to use filename or frontmatter title
		return undefined;
	}
}