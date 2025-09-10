/**
 * Type definitions for Pandoc and Typst conversion
 */

export interface PandocOptions {
	/** Path to pandoc executable (optional, uses PATH if not specified) */
	pandocPath?: string;
	/** Path to typst executable (optional, uses PATH if not specified) */
	typstPath?: string;
	/** Template file path */
	template?: string;
	/** Template variables to pass to pandoc */
	variables?: Record<string, string | number | boolean>;
	/** Additional pandoc arguments */
	additionalArgs?: string[];
	/** Timeout for pandoc process in milliseconds (default: 60000) */
	timeout?: number;
	/** Generate intermediate .typ file for debugging */
	generateIntermediateTypst?: boolean;
	/** Vault base path for resolving attachment paths */
	vaultBasePath?: string;
	/** Plugin directory path for resolving plugin-relative paths */
	pluginDir?: string;
	/** Temporary directory path for intermediate files */
	tempDir?: string;
	/** Cleanup handlers to be executed when process completes */
	cleanupHandlers?: (() => void)[];
	/** Typst-specific settings */
	typstSettings?: TypstSettings;
}

export interface TypstSettings {
	/** Additional options to pass to Typst engine */
	engineOptions?: string[];
}

export interface ConversionResult {
	/** Whether the conversion was successful */
	success: boolean;
	/** Path to the output PDF file */
	outputPath?: string;
	/** Path to intermediate .typ file (if generated) */
	intermediateTypstPath?: string;
	/** Error message if conversion failed */
	error?: string;
	/** Pandoc stdout output */
	stdout?: string;
	/** Pandoc stderr output */
	stderr?: string;
	/** Process exit code */
	exitCode?: number;
}

export type ProgressCallback = (message: string, progress?: number) => void;