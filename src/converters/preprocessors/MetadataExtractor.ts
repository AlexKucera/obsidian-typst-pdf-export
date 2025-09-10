/**
 * MetadataExtractor.ts
 * 
 * Handles extraction of metadata from markdown content for PDF export.
 * Currently focuses on title extraction from markdown headings.
 */

export class MetadataExtractor {
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