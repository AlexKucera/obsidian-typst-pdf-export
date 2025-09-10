/**
 * Processes horizontal rules to avoid conflicts with YAML frontmatter delimiters
 * 
 * Transforms markdown horizontal rules that could be mistaken for YAML delimiters
 * into alternative formats that Pandoc will still recognize as horizontal rules
 * but won't interpret as YAML frontmatter boundaries.
 * 
 * Preserves YAML frontmatter sections by detecting and skipping them.
 */
export class HorizontalRuleProcessor {
    private readonly FRONTMATTER_PATTERN = /^---\s*\n([\s\S]*?)\n---\s*\n/;

    constructor() {
        // No initialization needed
    }

    /**
     * Process horizontal rules to avoid YAML conflicts
     * 
     * Transforms:
     * - `---` (3 dashes) -> `***` (3 asterisks)
     * - `----` (4+ dashes) -> `****` (4+ asterisks)
     * 
     * Both formats are valid markdown horizontal rules but `***` won't be
     * mistaken for YAML delimiters by Pandoc.
     * 
     * Skips YAML frontmatter sections to preserve them.
     */
    process(content: string): string {
        // Check if content has frontmatter at the beginning
        const frontmatterMatch = content.match(this.FRONTMATTER_PATTERN);
        
        if (frontmatterMatch) {
            // Content has frontmatter - separate it from the main content
            const frontmatter = frontmatterMatch[0];
            const mainContent = content.slice(frontmatter.length);
            
            // Process only the main content (after frontmatter)
            const processedMainContent = this.processContentLines(mainContent);
            
            // Recombine frontmatter with processed main content
            return frontmatter + processedMainContent;
        } else {
            // No frontmatter - process the entire content
            return this.processContentLines(content);
        }
    }

    /**
     * Process lines for horizontal rule transformation
     */
    private processContentLines(content: string): string {
        // Split content into lines for processing
        const lines = content.split('\n');
        const processedLines: string[] = [];

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            
            // Check if line is a horizontal rule made of dashes
            // Must be at least 3 dashes, optionally with spaces
            const dashRuleMatch = line.match(/^(\s*)(---+)(\s*)$/);
            
            if (dashRuleMatch) {
                // Transform dash horizontal rule to asterisk horizontal rule
                const [, leadingSpaces, dashes, trailingSpaces] = dashRuleMatch;
                const asterisks = '*'.repeat(dashes.length);
                processedLines.push(`${leadingSpaces}${asterisks}${trailingSpaces}`);
            } else {
                // Keep line unchanged
                processedLines.push(line);
            }
        }

        return processedLines.join('\n');
    }
}