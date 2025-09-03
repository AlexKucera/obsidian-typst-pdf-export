/**
 * Paper size mapping utilities for Typst compatibility
 */

export interface PaperSizeInfo {
	/** The value used internally and in UI */
	key: string;
	/** Display name for UI dropdowns */
	displayName: string;
	/** The actual Typst paper size value to use */
	typstValue: string;
}

/**
 * Supported paper sizes with their Typst-compatible mappings
 */
export const SUPPORTED_PAPER_SIZES: PaperSizeInfo[] = [
	{
		key: 'a3',
		displayName: 'A3 (297 × 420 mm)',
		typstValue: 'a3'
	},
	{
		key: 'a4',
		displayName: 'A4 (210 × 297 mm)',
		typstValue: 'a4'
	},
	{
		key: 'a5',
		displayName: 'A5 (148 × 210 mm)',
		typstValue: 'a5'
	},
	{
		key: 'a6',
		displayName: 'A6 (105 × 148 mm)',
		typstValue: 'a6'
	},
	{
		key: 'eu-business-card',
		displayName: 'EU Business Card (85 × 55 mm)',
		typstValue: 'eu-business-card'
	},
	{
		key: 'us-letter',
		displayName: 'US Letter (8.5 × 11 in)',
		typstValue: 'us-letter'
	},
	{
		key: 'us-legal',
		displayName: 'US Legal (8.5 × 14 in)',
		typstValue: 'us-legal'
	},
	{
		key: 'us-business-card',
		displayName: 'US Business Card (3.5 × 2 in)',
		typstValue: 'us-business-card'
	}
];

/**
 * Default paper size
 */
export const DEFAULT_PAPER_SIZE = 'a4';

/**
 * Map a paper size key to its Typst-compatible value
 * @param paperSizeKey - The paper size key from UI/settings
 * @returns The Typst-compatible paper size value
 */
export function mapToTypstPaperSize(paperSizeKey: string): string {
	// Find the paper size in our supported list
	const paperSize = SUPPORTED_PAPER_SIZES.find(size => size.key === paperSizeKey);
	
	if (paperSize) {
		return paperSize.typstValue;
	}

	// Fallback to default if unknown
	console.warn(`Unknown paper size: ${paperSizeKey}. Using default: ${DEFAULT_PAPER_SIZE}`);
	return SUPPORTED_PAPER_SIZES.find(size => size.key === DEFAULT_PAPER_SIZE)?.typstValue || 'a4';
}

/**
 * Get all valid Typst paper size values for validation
 * @returns Array of valid Typst paper size strings
 */
export function getValidTypstPaperSizes(): string[] {
	return SUPPORTED_PAPER_SIZES.map(size => size.typstValue);
}

/**
 * Check if a paper size key is supported
 * @param paperSizeKey - The paper size key to check
 * @returns True if the paper size is supported
 */
export function isSupportedPaperSize(paperSizeKey: string): boolean {
	return SUPPORTED_PAPER_SIZES.some(size => size.key === paperSizeKey);
}