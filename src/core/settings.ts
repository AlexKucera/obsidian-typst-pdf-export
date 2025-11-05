/**
 * Settings and configuration schema for Obsidian Typst PDF Export plugin.
 *
 * This module defines the complete configuration structure for the plugin, including:
 * - External tool paths (Pandoc, Typst, ImageMagick)
 * - Export defaults and presets
 * - Typography and page layout settings
 * - Behavior flags and preferences
 * - Default values for fresh installations
 *
 * The settings are persisted to the vault's data.json file and can be modified
 * through the plugin's settings tab. All settings have safe defaults that work
 * out-of-the-box when external tools are available in PATH.
 *
 * Settings Organization:
 * - Top-level: Core paths and output configuration
 * - executablePaths: External tool configuration
 * - exportDefaults: Default values for new exports
 * - typography: Font configuration
 * - pageSetup: Page layout and margins
 * - behavior: Plugin behavior flags
 *
 * Type Safety:
 * All settings use TypeScript for compile-time validation, preventing invalid
 * configuration values and catching errors before runtime.
 */

/**
 * Export format options for PDF generation.
 *
 * Determines the pagination and layout style of the exported PDF:
 * - Standard: Traditional multi-page format with page breaks
 * - Single-page: Continuous single-page format without pagination
 *
 * The format affects Typst compilation parameters and influences layout decisions
 * like automatic width adjustment for landscape orientation.
 */
export enum ExportFormat {
	/** Standard multi-page PDF format with automatic pagination */
	Standard = 'standard',
	/** Single-page continuous PDF format without page breaks */
	SinglePage = 'single-page'
}

/**
 * Complete plugin settings interface.
 *
 * Defines all configurable options for the plugin, organized into logical groups.
 * This interface serves as both the TypeScript type definition and the schema
 * for the settings tab UI.
 *
 * Settings Lifecycle:
 * 1. Plugin initializes with DEFAULT_SETTINGS
 * 2. Persisted settings loaded from data.json (if exists)
 * 3. User modifies via settings tab
 * 4. Changes saved immediately to data.json
 * 5. Export operations use current settings
 *
 * @example
 * ```typescript
 * // Load settings with defaults
 * const settings: obsidianTypstPDFExportSettings = {
 *   ...DEFAULT_SETTINGS,
 *   ...await this.loadData()
 * };
 *
 * // Use settings in export
 * const converter = new PandocTypstConverter(
 *   this.plugin,
 *   { template: settings.exportDefaults.template },
 *   { ppi: 144 }
 * );
 * ```
 */
export interface obsidianTypstPDFExportSettings {
	/**
	 * Path to the Pandoc executable.
	 *
	 * Can be either:
	 * - Empty string: Use system PATH resolution
	 * - Executable name: e.g., 'pandoc' (searches augmented PATH)
	 * - Absolute path: e.g., '/usr/local/bin/pandoc'
	 *
	 * Pandoc 2.0+ required for Typst output support.
	 */
	pandocPath: string;

	/**
	 * Path to the Typst executable.
	 *
	 * Can be either:
	 * - Empty string: Use system PATH resolution
	 * - Executable name: e.g., 'typst' (searches augmented PATH)
	 * - Absolute path: e.g., '/opt/typst/bin/typst'
	 *
	 * Typst 0.11+ recommended for best compatibility.
	 */
	typstPath: string;

	/**
	 * Default output folder for exported PDFs.
	 *
	 * Relative path from vault root. Will be created if it doesn't exist.
	 * Security: Must pass SecurityUtils.validateOutputPath() validation.
	 *
	 * @example 'exports' - PDF files saved to <vault>/exports/
	 * @example 'pdfs/from-notes' - PDF files saved to <vault>/pdfs/from-notes/
	 */
	outputFolder: string;

	/**
	 * Executable paths configuration for optional dependencies.
	 *
	 * Controls where the plugin searches for external tools and how
	 * it augments the PATH environment variable.
	 */
	executablePaths: {
		/**
		 * Path to ImageMagick command (optional).
		 *
		 * ImageMagick is optional but recommended for embedded PDF support.
		 * If not configured, embedded PDFs will be skipped during export.
		 *
		 * Can be:
		 * - Empty string: Use system PATH (default)
		 * - Executable name: e.g., 'magick'
		 * - Absolute path: e.g., '/usr/bin/magick'
		 */
		imagemagickPath: string;

		/**
		 * Additional directories to search for executables.
		 *
		 * These paths are added to the PATH environment variable when
		 * searching for external tools. Useful for non-standard installations
		 * or when tools aren't in the user's shell PATH.
		 *
		 * @example ['/opt/homebrew/bin', '/usr/local/bin']
		 */
		additionalPaths: string[];
	};

	/**
	 * Custom environment variables for subprocess execution.
	 *
	 * Additional environment variables passed to Pandoc and Typst processes.
	 * Useful for configuring tool behavior or providing authentication.
	 *
	 * @example { 'TYPST_FONT_PATHS': '/custom/fonts:/system/fonts' }
	 * @example { 'PANDOC_USER_DATA_DIR': '/custom/pandoc/data' }
	 */
	customEnvironmentVariables: { [key: string]: string };

	/**
	 * Default values for new export operations.
	 *
	 * These settings are used when opening the export modal. Users can override
	 * them on a per-export basis through the modal interface.
	 */
	exportDefaults: {
		/** Default template to use for exports */
		template: string;
		/** Default export format */
		format: ExportFormat;
		/** Default page size */
		pageSize: string;
		/** Default page orientation */
		orientation: 'portrait' | 'landscape';
		/** Default margins */
		marginTop: string;
		marginBottom: string;
		marginLeft: string;
		marginRight: string;
		/** Default fonts */
		bodyFont: string;
		headingFont: string;
		monospaceFont: string;
		/** Default body font size */
		bodyFontSize: string;
	};
	
	/** Typography settings */
	typography: {
		/** Font families for different text types */
		fonts: {
			body: string;
			heading: string;
			monospace: string;
		};
		/** Font sizes */
		fontSizes: {
			body: number;
			heading: number;
			small: number;
		};
	};
	
	/** Page setup configuration */
	pageSetup: {
		/** Page size (e.g., "a4", "letter", "custom") */
		size: string;
		/** Page orientation */
		orientation: "portrait" | "landscape";
		/** Page margins in points */
		margins: {
			top: number;
			right: number;
			bottom: number;
			left: number;
		};
	};
	
	/** Behavior flags */
	behavior: {
		/** Open PDF after export */
		openAfterExport: boolean;
		/** Preserve folder structure in output */
		preserveFolderStructure: boolean;
		/** Number of concurrent exports to run (default: 3) */
		exportConcurrency: number;
		/** Enable debug mode for verbose logging */
		debugMode: boolean;
		/** Whether to embed PDF files as attachments in the output PDF */
		embedPdfFiles: boolean;
		/** Whether to embed all file types as attachments in the output PDF */
		embedAllFiles: boolean;
		/** Display frontmatter as formatted text at the beginning of the document */
		printFrontmatter: boolean;
	};
}

/**
 * Default settings for fresh plugin installations.
 *
 * These values are used when:
 * - Plugin is first installed (no data.json exists)
 * - Settings are reset to defaults
 * - Individual settings are missing from persisted data
 *
 * The defaults are designed to:
 * - Work out-of-the-box when external tools are in PATH
 * - Produce professional-looking PDFs with minimal configuration
 * - Use widely-available fonts as fallbacks
 * - Enable helpful features (auto-open, folder structure preservation)
 *
 * Settings Strategy:
 * - Empty paths for executables (rely on PATH resolution)
 * - Common system paths in additionalPaths for macOS/Linux
 * - Conservative concurrency (3) for stability
 * - Professional typography (Concourse OT, SF Pro)
 * - Standard A4 paper with reasonable margins
 *
 * @example
 * ```typescript
 * // Initialize plugin with defaults
 * async onload() {
 *   await this.loadSettings();  // Merges with DEFAULT_SETTINGS
 *   this.registerSettingsTab();
 * }
 *
 * async loadSettings() {
 *   this.settings = Object.assign(
 *     {},
 *     DEFAULT_SETTINGS,
 *     await this.loadData()
 *   );
 * }
 * ```
 *
 * @example
 * ```typescript
 * // Reset individual settings to defaults
 * resetTypography() {
 *   this.settings.typography = {
 *     ...DEFAULT_SETTINGS.typography
 *   };
 *   await this.saveSettings();
 * }
 * ```
 */
export const DEFAULT_SETTINGS: obsidianTypstPDFExportSettings = {
	pandocPath: '',
	typstPath: '',
	outputFolder: 'exports',
	
	executablePaths: {
		imagemagickPath: '', // Empty means use system PATH
		additionalPaths: ['/opt/homebrew/bin', '/usr/local/bin', '/usr/bin']
	},
	
	customEnvironmentVariables: {},
	
	exportDefaults: {
		template: 'default',
		format: ExportFormat.Standard,
		pageSize: 'a4',
		orientation: 'portrait',
		marginTop: '2.5',
		marginBottom: '2.0',
		marginLeft: '2.5',
		marginRight: '1.5',
		bodyFont: 'Concourse OT',
		headingFont: 'Concourse OT',
		monospaceFont: 'Source Code Pro',
		bodyFontSize: '11pt'
	},
	
	typography: {
		fonts: {
			body: 'Concourse OT',
			heading: 'SF Pro Text',
			monospace: 'UbuntuMono Nerd Font Mono'
		},
		fontSizes: {
			body: 11,
			heading: 16,
			small: 9
		}
	},
	
	pageSetup: {
		size: 'a4',
		orientation: 'portrait',
		margins: {
			top: 2.54,
			right: 1.52,
			bottom: 2.03,
			left: 2.54
		}
	},
	
	behavior: {
		openAfterExport: true,
		preserveFolderStructure: true,
		exportConcurrency: 3,
		debugMode: false,
		embedPdfFiles: true,
		embedAllFiles: true,
		printFrontmatter: false
	}
};