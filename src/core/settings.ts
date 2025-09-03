/**
 * Core settings and configuration for Obsidian Typst PDF Export plugin
 */

export enum ExportFormat {
	/** Standard multi-page PDF format */
	Standard = 'standard',
	/** Single-page continuous PDF format */
	SinglePage = 'single-page'
}

export interface obsidianTypstPDFExportSettings {
	/** Path to the Pandoc executable */
	pandocPath: string;
	/** Path to the Typst executable */
	typstPath: string;
	/** Default output folder for exported PDFs */
	outputFolder: string;
	
	/** Executable paths configuration */
	executablePaths: {
		/** Path to ImageMagick convert command (optional, uses PATH if not specified) */
		imagemagickPath: string;
		/** Additional paths to append to PATH environment variable */
		additionalPaths: string[];
	};
	
	/** Export defaults */
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
	};
}

export const DEFAULT_SETTINGS: obsidianTypstPDFExportSettings = {
	pandocPath: '',
	typstPath: '',
	outputFolder: 'exports',
	
	executablePaths: {
		imagemagickPath: '', // Empty means use system PATH
		additionalPaths: ['/opt/homebrew/bin', '/usr/local/bin', '/usr/bin']
	},
	
	exportDefaults: {
		template: 'default',
		format: ExportFormat.Standard,
		pageSize: 'a4',
		orientation: 'portrait',
		marginTop: '1in',
		marginBottom: '0.8in',
		marginLeft: '1in',
		marginRight: '0.6in',
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
			top: 72,
			right: 72,
			bottom: 72,
			left: 72
		}
	},
	
	behavior: {
		openAfterExport: true,
		preserveFolderStructure: true,
		exportConcurrency: 3,
		debugMode: false
	}
};