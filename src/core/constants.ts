/**
 * Constants used throughout the Obsidian Typst PDF Export plugin
 */

/**
 * Fallback fonts used when Typst font detection fails
 */
export const FALLBACK_FONTS = [
	'Times New Roman',
	'Arial',
	'Helvetica',
	'Georgia',
	'Courier New',
	'Monaco',
	'SF Pro Text',
	'SF Mono',
	'Concourse OT',
	'UbuntuMono Nerd Font Mono',
	'Source Code Pro'
] as const;

/**
 * Plugin-specific directory names
 */
export const PLUGIN_DIRS = {
	TEMP_IMAGES: 'temp-images',
	TEMP_PANDOC: 'temp-pandoc',
	FONTS_CACHE: 'fonts-cache.json'
} as const;

/**
 * Export-related constants
 */
export const EXPORT_CONSTANTS = {
	DEFAULT_TIMEOUT: 120000, // 2 minutes
	NOTICE_DURATION: {
		SHORT: 5000,
		LONG: 12000
	}
} as const;