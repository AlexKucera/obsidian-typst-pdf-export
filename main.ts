import { App, Notice, Plugin, PluginSettingTab, Setting, Modal, MarkdownRenderer, TFile, TFolder, Menu } from 'obsidian';
import { DependencyChecker } from './src/DependencyChecker';
import { TemplateManager } from './src/template-manager';
import { spawn, ChildProcess } from 'child_process';
import { promises as fs } from 'fs';
import * as path from 'path';
import * as os from 'os';

/**
 * Configuration options for Pandoc conversion
 */
interface PandocOptions {
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
}

/**
 * Settings specific to Typst engine
 */
interface TypstSettings {
	/** Additional options to pass to Typst engine */
	engineOptions?: string[];
}

/**
 * Result of a Pandoc conversion operation
 */
interface ConversionResult {
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

/**
 * Progress callback function type
 */
type ProgressCallback = (message: string, progress?: number) => void;

/**
 * Core converter class for Pandoc to Typst PDF conversion
 */
class PandocTypstConverter {
	private tempDir: string | null = null;
	private cleanupHandlers: (() => void)[] = [];

	/**
	 * Create a new PandocTypstConverter instance
	 * @param pandocOptions Configuration options for Pandoc
	 * @param typstSettings Settings specific to Typst engine
	 */
	constructor(
		private pandocOptions: PandocOptions = {},
		private typstSettings: TypstSettings = {}
	) {
		// Set up cleanup handlers for process termination
		this.setupCleanup();
	}

	/**
	 * Convert a markdown file to PDF using Pandoc with Typst engine
	 * @param inputPath Path to the input markdown file
	 * @param outputPath Path where the PDF should be saved
	 * @param progressCallback Optional callback for progress updates
	 * @returns Promise resolving to conversion result
	 */
	async convertToPDF(
		inputPath: string, 
		outputPath: string, 
		progressCallback?: ProgressCallback
	): Promise<ConversionResult> {
		try {
			progressCallback?.('Starting PDF conversion...', 0);

			// Create temporary directory if needed
			await this.ensureTempDirectory();
			
			// Build pandoc arguments
			const args = await this.buildPandocArgs(inputPath, outputPath);
			
			progressCallback?.('Executing Pandoc with Typst engine...', 30);
			
			// Execute pandoc process
			const result = await this.executePandoc(args, progressCallback);
			
			progressCallback?.('Conversion complete!', 100);
			
			return result;
			
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			return {
				success: false,
				error: `Conversion failed: ${errorMessage}`
			};
		}
	}

	/**
	 * Set up cleanup handlers for temporary files
	 */
	private setupCleanup(): void {
		const cleanup = () => {
			this.cleanup();
		};

		process.on('exit', cleanup);
		process.on('SIGINT', cleanup);
		process.on('SIGTERM', cleanup);
		process.on('uncaughtException', cleanup);
	}

	/**
	 * Clean up temporary files and directories
	 */
	private async cleanup(): Promise<void> {
		try {
			// Execute registered cleanup handlers
			this.cleanupHandlers.forEach(handler => {
				try {
					handler();
				} catch (error) {
					console.warn('Cleanup handler failed:', error);
				}
			});

			// Remove temporary directory
			if (this.tempDir) {
				await fs.rmdir(this.tempDir, { recursive: true });
				this.tempDir = null;
			}
		} catch (error) {
			console.warn('Cleanup failed:', error);
		}
	}

	/**
	 * Ensure temporary directory exists
	 */
	private async ensureTempDirectory(): Promise<string> {
		if (!this.tempDir) {
			this.tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'obsidian-typst-'));
		}
		return this.tempDir;
	}

	/**
	 * Build pandoc command-line arguments
	 */
	private async buildPandocArgs(inputPath: string, outputPath: string): Promise<string[]> {
const args: string[] = [];

// Input file
args.push(inputPath);

// Output file
args.push('-o', outputPath);

// Set PDF engine to Typst (use configured path if available)
if (this.pandocOptions.typstPath) {
	args.push(`--pdf-engine=${this.pandocOptions.typstPath}`);
} else {
	args.push('--pdf-engine=typst');
}

// Enable standalone mode (required for PDF output)
args.push('--standalone');

// Add resource paths for attachment resolution
if (this.pandocOptions.vaultBasePath) {
	const path = require('path');
	
	// Add vault root as primary resource path
	args.push('--resource-path', this.pandocOptions.vaultBasePath);
	
	// Add common attachment directories as additional resource paths
	const commonAttachmentPaths = [
		path.join(this.pandocOptions.vaultBasePath, 'attachments'),
		path.join(this.pandocOptions.vaultBasePath, 'assets'),
		path.join(this.pandocOptions.vaultBasePath, 'files'),
		path.join(this.pandocOptions.vaultBasePath, 'images'),
		path.join(this.pandocOptions.vaultBasePath, '.attachments')
	];
	
	// Check if these directories exist and add them
	const fs = require('fs');
	for (const attachPath of commonAttachmentPaths) {
		if (fs.existsSync(attachPath)) {
			args.push('--resource-path', attachPath);
		}
	}
}

// Use -V template= syntax for Typst templates (not --template)
if (this.pandocOptions.template) {
	args.push('-V', `template=${this.pandocOptions.template}`);
}

// Add variables for document metadata
if (this.pandocOptions.variables) {
	for (const [key, value] of Object.entries(this.pandocOptions.variables)) {
		if (value && value.toString().trim() !== '') {
			args.push('-V', `${key}=${value}`);
		}
	}
}

// Add Typst engine options
if (this.typstSettings.engineOptions) {
	for (const option of this.typstSettings.engineOptions) {
		args.push('--pdf-engine-opt', option);
	}
}

// Generate intermediate Typst file if requested
if (this.pandocOptions.generateIntermediateTypst) {
	const tempDir = await this.ensureTempDirectory();
	const typstPath = path.join(tempDir, 'intermediate.typ');
	args.push('--output', typstPath);
}

// Add additional arguments
if (this.pandocOptions.additionalArgs) {
	args.push(...this.pandocOptions.additionalArgs);
}

return args;
}

	/**
	 * Execute pandoc process with the given arguments
	 */
	private async executePandoc(args: string[], progressCallback?: ProgressCallback): Promise<ConversionResult> {
return new Promise((resolve) => {
	const pandocPath = this.pandocOptions.pandocPath || 'pandoc';
	const timeout = this.pandocOptions.timeout || 60000;

	// Log the exact command being executed for debugging
	console.log('Executing Pandoc command:', pandocPath, args.join(' '));

	progressCallback?.('Starting Pandoc process...', 40);

	// Determine working directory - use vault base path if available, fallback to plugin directory
	const path = require('path');
	let workingDir: string;
	
	if (this.pandocOptions.vaultBasePath) {
		workingDir = this.pandocOptions.vaultBasePath;
		console.log('Pandoc working directory (vault):', workingDir);
	} else {
		// Fallback to plugin directory
		const pluginDir = (this.pandocOptions as any).pluginDir || process.cwd();
		workingDir = pluginDir;
		console.log('Pandoc working directory (plugin fallback):', workingDir);
	}
	
	// Spawn pandoc process with vault as working directory for attachment resolution
	const pandocProcess: ChildProcess = spawn(pandocPath, args, {
		stdio: ['pipe', 'pipe', 'pipe'],
		cwd: workingDir,
		env: process.env, // Inherit environment variables
	});

	let stdout = '';
	let stderr = '';
	let hasTimedOut = false;

	// Set up timeout
	const timeoutHandle = setTimeout(() => {
		hasTimedOut = true;
		pandocProcess.kill('SIGTERM');
		resolve({
			success: false,
			error: `Pandoc process timed out after ${timeout}ms`,
			exitCode: -1
		});
	}, timeout);

	// Collect stdout
	pandocProcess.stdout?.on('data', (data: Buffer) => {
		stdout += data.toString();
		progressCallback?.('Processing document...', 60);
	});

	// Collect stderr and monitor for progress
	pandocProcess.stderr?.on('data', (data: Buffer) => {
		const output = data.toString();
		stderr += output;
		console.log('Pandoc stderr:', output);
		
		// Parse progress information from stderr if available
		this.parseProgressFromOutput(output, progressCallback);
	});

	// Handle process completion
	pandocProcess.on('close', (code: number | null) => {
		clearTimeout(timeoutHandle);
		
		if (hasTimedOut) {
			return; // Already resolved with timeout error
		}

		const success = code === 0;
		const result: ConversionResult = {
			success,
			stdout,
			stderr,
			exitCode: code || -1
		};

		if (!success) {
			result.error = this.extractErrorMessage(stderr, stdout);
		} else {
			progressCallback?.('PDF generation complete!', 90);
		}

		resolve(result);
	});

	// Handle process errors
	pandocProcess.on('error', (error: Error) => {
		clearTimeout(timeoutHandle);
		console.log('Pandoc process error:', error);
		resolve({
			success: false,
			error: `Failed to start Pandoc process: ${error.message}`,
			exitCode: -1
		});
	});
});
}

	/**
	 * Parse progress information from pandoc output
	 */
	private parseProgressFromOutput(output: string, progressCallback?: ProgressCallback): void {
		// Look for common progress indicators in pandoc/typst output
		if (output.includes('reading')) {
			progressCallback?.('Reading input file...', 50);
		} else if (output.includes('parsing')) {
			progressCallback?.('Parsing document...', 55);
		} else if (output.includes('typst')) {
			progressCallback?.('Generating PDF with Typst...', 70);
		} else if (output.includes('writing')) {
			progressCallback?.('Writing output file...', 80);
		}
	}

	/**
	 * Extract meaningful error messages from pandoc output
	 */
	private extractErrorMessage(stderr: string, stdout: string): string {
		// Look for common error patterns
		const errorPatterns = [
			/error:/i,
			/Error:/,
			/failed/i,
			/Fatal/i,
			/pandoc:/i
		];

		const allOutput = (stderr + '\n' + stdout).split('\n');
		
		for (const line of allOutput) {
			for (const pattern of errorPatterns) {
				if (pattern.test(line)) {
					return line.trim();
				}
			}
		}

		// If no specific error found, return first non-empty line from stderr
		const stderrLines = stderr.split('\n').filter(line => line.trim().length > 0);
		if (stderrLines.length > 0) {
			return stderrLines[0];
		}

		return 'Unknown error occurred during conversion';
	}

	/**
	 * Dispose of the converter and clean up resources
	 */
	async dispose(): Promise<void> {
		await this.cleanup();
	}
}

/**
 * Obsidian Typst PDF Export Plugin
 * 
 * This plugin exports Obsidian notes to PDF using the Typst typesetting system.
 * It provides features for converting Obsidian markdown to Typst format and 
 * generating high-quality PDFs with customizable styling.
 */

/** Export mode options for different conversion approaches */
enum ExportMode {
	/** Typography-focused export optimizing for readability */
	Typography = 'typography',
	/** Style-preserving export maintaining original formatting */
	StylePreserving = 'style-preserving'
}

/** Export format options for output structure */
enum ExportFormat {
	/** Standard multi-page PDF format */
	Standard = 'standard',
	/** Single-page continuous PDF format */
	SinglePage = 'single-page'
}

/** Template interface for Typst template management */
interface Template {
	/** Display name of the template */
	name: string;
	/** File path to the template */
	filePath: string;
	/** Template variables and their types */
	variables: Record<string, {
		type: 'string' | 'number' | 'boolean';
		defaultValue: any;
		description?: string;
		required: boolean;
	}>;
	/** Template metadata */
	metadata: {
		author?: string;
		version?: string;
		description?: string;
		compatibility: string[];
	};
}

/** Configuration for individual export operations */
interface ExportConfig {
	/** Override default template */
	template?: string;
	/** Override default format */
	format?: ExportFormat;
	/** Override default mode */
	mode?: ExportMode;
	/** Override output folder */
	outputFolder?: string;
	/** Template variables for this export */
	templateVariables?: Record<string, any>;
}

interface obsidianTypstPDFExportSettings {
	/** Path to the Pandoc executable */
	pandocPath: string;
	/** Path to the Typst executable */
	typstPath: string;
	/** Default output folder for exported PDFs */
	outputFolder: string;
	
	/** Export defaults */
	exportDefaults: {
		/** Default template to use for exports */
		template: string;
		/** Default export format */
		format: ExportFormat;
		/** Default export mode */
		mode: ExportMode;
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

const DEFAULT_SETTINGS: obsidianTypstPDFExportSettings = {
	pandocPath: '',
	typstPath: '',
	outputFolder: 'exports',
	
	exportDefaults: {
		template: 'default',
		format: ExportFormat.Standard,
		mode: ExportMode.Typography
	},
	
	typography: {
		fonts: {
			body: 'Times New Roman',
			heading: 'Arial',
			monospace: 'Courier New'
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
}

export default class obsidianTypstPDFExport extends Plugin {
	settings: obsidianTypstPDFExportSettings;
	dependencyChecker: DependencyChecker;
	templateManager: TemplateManager;
	private converter: PandocTypstConverter;

	async onload() {
	console.log('Loading Typst PDF Export Plugin...');

	// Load settings first
	await this.loadSettings();

	// Initialize dependency checker and converter
	this.dependencyChecker = new DependencyChecker();
	this.converter = new PandocTypstConverter();
	
	// Initialize template manager
	const pluginDir = (this.manifest as any).dir || path.join(this.app.vault.configDir, 'plugins', this.manifest.id);
	// Convert to absolute path using vault adapter base path
	const vaultBasePath = (this.app.vault.adapter as any).basePath || process.cwd();
	const absolutePluginDir = path.resolve(vaultBasePath, pluginDir);
	console.log('Plugin directory (relative):', pluginDir);
	console.log('Vault base path:', vaultBasePath);
	console.log('Plugin directory (absolute):', absolutePluginDir);
	console.log('Manifest dir:', (this.manifest as any).dir);
	console.log('Config dir:', this.app.vault.configDir);
	this.templateManager = new TemplateManager(this.app, absolutePluginDir);

	// Check dependencies asynchronously (don't block plugin startup)
	this.checkDependenciesAsync();

	// Register commands
	this.registerCommands();

	// Add ribbon icon with Lucide icon name
	this.addRibbonIcon('download', 'Export to PDF with Typst', (event: MouseEvent) => {
		this.handleRibbonClick(event);
	});

	// Register context menu events
	this.registerEvents();

	// This adds a settings tab so the user can configure various aspects of the plugin
	this.addSettingTab(new TypstPDFExportSettingTab(this.app, this));
}

	/**
	 * Auto-detect dependency paths and update settings if not already configured
	 */
	// Method removed - not needed since paths are already correctly configured in settings

	onunload() {

	}

	/**
	 * Check dependencies asynchronously without blocking plugin startup
	 */
	private async checkDependenciesAsync(): Promise<void> {
		try {
			const result = await this.dependencyChecker.checkAllDependencies(
				{ customPath: this.settings.pandocPath },
				{ customPath: this.settings.typstPath }
			);

			if (!result.allAvailable) {
				// Show notice only if some dependencies are missing
				const missingTools = [];
				if (!result.pandoc.isAvailable) missingTools.push('Pandoc');
				if (!result.typst.isAvailable) missingTools.push('Typst');
				
				new Notice(`Typst PDF Export: ${missingTools.join(' and ')} not found. Use "Check dependencies" command for setup instructions.`, 8000);
			}
		} catch (error) {
			console.warn('Dependency check failed on startup:', error);
		}
	}


	/**
	 * Show detailed dependency status
	 */
	private async showDependencyStatus(): Promise<void> {
		try {
			const result = await this.dependencyChecker.checkAllDependencies(
				{ customPath: this.settings.pandocPath },
				{ customPath: this.settings.typstPath }
			);

			let message = '## Dependency Status\n\n';

			// Pandoc status
			message += '### Pandoc\n';
			if (result.pandoc.isAvailable) {
				message += `✅ **Available** (v${result.pandoc.version})\n`;
				message += `Path: ${result.pandoc.executablePath}\n\n`;
			} else {
				message += '❌ **Not Available**\n';
				message += `Error: ${result.pandoc.error}\n\n`;
				message += this.dependencyChecker.formatInstallationGuide(
					this.dependencyChecker.getInstallationGuide('pandoc')
				);
				message += '\n\n';
			}

			// Typst status
			message += '### Typst\n';
			if (result.typst.isAvailable) {
				message += `✅ **Available** (v${result.typst.version})\n`;
				message += `Path: ${result.typst.executablePath}\n\n`;
			} else {
				message += '❌ **Not Available**\n';
				message += `Error: ${result.typst.error}\n\n`;
				message += this.dependencyChecker.formatInstallationGuide(
					this.dependencyChecker.getInstallationGuide('typst')
				);
			}

			// Create and show modal with dependency status
			const modal = new DependencyStatusModal(this.app, this);
			modal.open();

		} catch (error) {
			new Notice(`Error checking dependencies: ${error instanceof Error ? error.message : String(error)}`);
		}
	}

	/**
	 * Show dependency error dialog with installation instructions
	 */
	private showDependencyErrorDialog(result: { pandoc: any; typst: any; allAvailable: boolean }): void {
		let message = '## Missing Dependencies\n\nThe following dependencies are required:\n\n';

		if (!result.pandoc.isAvailable) {
			message += `**Pandoc**: ${result.pandoc.error}\n\n`;
		}

		if (!result.typst.isAvailable) {
			message += `**Typst**: ${result.typst.error}\n\n`;
		}

		message += 'Use the "Check Pandoc and Typst dependencies" command for detailed installation instructions.';

		const modal = new DependencyStatusModal(this.app, this);
		modal.open();
	}

	async loadSettings() {
		try {
			const loadedData = await this.loadData();
			
			if (!loadedData) {
				// No saved settings, use defaults
				this.settings = { ...DEFAULT_SETTINGS };
				return;
			}

			// Start with defaults and merge loaded data
			this.settings = { ...DEFAULT_SETTINGS };
			
			// Validate and merge loaded settings
			const validatedSettings = this.validateSettings(loadedData);
			this.settings = { ...this.settings, ...validatedSettings };
			
			// Migrate settings if needed
			this.settings = this.migrateSettings(this.settings);
			
		} catch (error) {
			console.error('Failed to load Typst PDF Export settings:', error);
			new Notice('Failed to load settings, using defaults');
			this.settings = { ...DEFAULT_SETTINGS };
		}
	}

	/**
	 * Validates loaded settings data and returns a clean settings object
	 */
	private validateSettings(data: any): Partial<obsidianTypstPDFExportSettings> {
		const validated: Partial<obsidianTypstPDFExportSettings> = {};

		// Validate string paths
		if (typeof data.pandocPath === 'string') {
			validated.pandocPath = data.pandocPath;
		}
		if (typeof data.typstPath === 'string') {
			validated.typstPath = data.typstPath;
		}
		if (typeof data.outputFolder === 'string') {
			validated.outputFolder = data.outputFolder;
		}

		// Validate export defaults
		if (data.exportDefaults && typeof data.exportDefaults === 'object') {
			const exportDefaults: Partial<obsidianTypstPDFExportSettings['exportDefaults']> = {};
			
			if (typeof data.exportDefaults.template === 'string') {
				exportDefaults.template = data.exportDefaults.template;
			}
			
			// Validate enum values
			if (Object.values(ExportFormat).includes(data.exportDefaults.format)) {
				exportDefaults.format = data.exportDefaults.format;
			}
			
			if (Object.values(ExportMode).includes(data.exportDefaults.mode)) {
				exportDefaults.mode = data.exportDefaults.mode;
			}
			
			if (Object.keys(exportDefaults).length > 0) {
				validated.exportDefaults = exportDefaults as any;
			}
		}

		// Validate typography settings
		if (data.typography && typeof data.typography === 'object') {
			const typography: Partial<obsidianTypstPDFExportSettings['typography']> = {};
			
			if (data.typography.fonts && typeof data.typography.fonts === 'object') {
				const fonts: Partial<obsidianTypstPDFExportSettings['typography']['fonts']> = {};
				['body', 'heading', 'monospace'].forEach(key => {
					if (typeof data.typography.fonts[key] === 'string') {
						(fonts as any)[key] = data.typography.fonts[key];
					}
				});
				if (Object.keys(fonts).length > 0) {
					typography.fonts = fonts as any;
				}
			}
			
			if (data.typography.fontSizes && typeof data.typography.fontSizes === 'object') {
				const fontSizes: Partial<obsidianTypstPDFExportSettings['typography']['fontSizes']> = {};
				['body', 'heading', 'small'].forEach(key => {
					if (typeof data.typography.fontSizes[key] === 'number' && data.typography.fontSizes[key] > 0) {
						(fontSizes as any)[key] = data.typography.fontSizes[key];
					}
				});
				if (Object.keys(fontSizes).length > 0) {
					typography.fontSizes = fontSizes as any;
				}
			}
			
			if (Object.keys(typography).length > 0) {
				validated.typography = typography as any;
			}
		}

		// Validate page setup
		if (data.pageSetup && typeof data.pageSetup === 'object') {
			const pageSetup: Partial<obsidianTypstPDFExportSettings['pageSetup']> = {};
			
			if (typeof data.pageSetup.size === 'string') {
				pageSetup.size = data.pageSetup.size;
			}
			
			if (['portrait', 'landscape'].includes(data.pageSetup.orientation)) {
				pageSetup.orientation = data.pageSetup.orientation;
			}
			
			if (data.pageSetup.margins && typeof data.pageSetup.margins === 'object') {
				const margins: Partial<obsidianTypstPDFExportSettings['pageSetup']['margins']> = {};
				['top', 'right', 'bottom', 'left'].forEach(key => {
					if (typeof data.pageSetup.margins[key] === 'number' && data.pageSetup.margins[key] >= 0) {
						(margins as any)[key] = data.pageSetup.margins[key];
					}
				});
				if (Object.keys(margins).length > 0) {
					pageSetup.margins = margins as any;
				}
			}
			
			if (Object.keys(pageSetup).length > 0) {
				validated.pageSetup = pageSetup as any;
			}
		}

		// Validate behavior flags
		if (data.behavior && typeof data.behavior === 'object') {
			const behavior: Partial<obsidianTypstPDFExportSettings['behavior']> = {};
			
			if (typeof data.behavior.openAfterExport === 'boolean') {
				behavior.openAfterExport = data.behavior.openAfterExport;
			}
			
			if (typeof data.behavior.preserveFolderStructure === 'boolean') {
				behavior.preserveFolderStructure = data.behavior.preserveFolderStructure;
			}
			
			if (typeof data.behavior.exportConcurrency === 'number' && 
				data.behavior.exportConcurrency > 0 && 
				data.behavior.exportConcurrency <= 10) {
				behavior.exportConcurrency = data.behavior.exportConcurrency;
			}
			
			if (Object.keys(behavior).length > 0) {
				validated.behavior = behavior as any;
			}
		}

		return validated;
	}

	/**
	 * Migrates settings from older versions to current format
	 */
	private migrateSettings(settings: obsidianTypstPDFExportSettings): obsidianTypstPDFExportSettings {
		// Future version migrations can be added here
		// For now, just ensure all required properties exist with defaults
		
		const migrated = { ...settings };
		
		// Ensure all nested objects exist
		if (!migrated.exportDefaults) {
			migrated.exportDefaults = DEFAULT_SETTINGS.exportDefaults;
		}
		
		if (!migrated.typography) {
			migrated.typography = DEFAULT_SETTINGS.typography;
		}
		
		if (!migrated.pageSetup) {
			migrated.pageSetup = DEFAULT_SETTINGS.pageSetup;
		}
		
		if (!migrated.behavior) {
			migrated.behavior = DEFAULT_SETTINGS.behavior;
		} else {
			// Migrate behavior settings - add exportConcurrency if missing
			if (typeof migrated.behavior.exportConcurrency !== 'number') {
				migrated.behavior.exportConcurrency = DEFAULT_SETTINGS.behavior.exportConcurrency;
			}
		}

		return migrated;
	}

	async saveSettings() {
		try {
			// Validate settings before saving
			const validatedSettings = this.validateSettings(this.settings);
			const mergedSettings = { ...DEFAULT_SETTINGS, ...validatedSettings };
			
			// Update current settings with validated data
			this.settings = mergedSettings;
			
			// Save to disk
			await this.saveData(this.settings);
			
		} catch (error) {
			console.error('Failed to save Typst PDF Export settings:', error);
			new Notice('Failed to save settings');
			throw error;
		}
	}

	/**
	 * Register all commands with proper checkCallback validation
	 */
	private registerCommands(): void {
		// Export current note to Typst PDF
		this.addCommand({
			id: 'export-current-note',
			name: 'Export current note to Typst PDF',
			hotkeys: [{ modifiers: ['Mod', 'Shift'], key: 'e' }],
			checkCallback: (checking: boolean) => {
				const activeFile = this.app.workspace.getActiveFile();
				const canRun = activeFile && activeFile.extension === 'md';
				
				if (canRun && !checking) {
					this.handleExportWithDependencyCheck(activeFile);
				}
				
				return !!canRun;
			}
		});

		// Export with previous settings
		this.addCommand({
			id: 'export-with-previous-settings',
			name: 'Export with previous settings',
			hotkeys: [{ modifiers: ['Mod', 'Shift', 'Alt'], key: 'e' }],
			checkCallback: (checking: boolean) => {
				const activeFile = this.app.workspace.getActiveFile();
				const canRun = activeFile && activeFile.extension === 'md' && 
					this.settings.exportDefaults && Object.keys(this.settings.exportDefaults).length > 0;
				
				if (canRun && !checking) {
					this.handleExportWithPreviousSettings(activeFile);
				}
				
				return !!canRun;
			}
		});

		// Export folder to PDF
		this.addCommand({
			id: 'export-folder-to-pdf',
			name: 'Export folder to PDF',
			checkCallback: (checking: boolean) => {
				const activeFile = this.app.workspace.getActiveFile();
				const canRun = activeFile && activeFile.parent;
				
				if (canRun && !checking && activeFile.parent) {
					this.handleFolderExport(activeFile.parent);
				}
				
				return !!canRun;
			}
		});

		// Keep existing dependency check command
		this.addCommand({
			id: 'check-dependencies',
			name: 'Check Pandoc and Typst dependencies',
			callback: () => {
				this.showDependencyStatus();
			}
		});
	}

	/**
	 * Register workspace events for context menus
	 */
	private registerEvents(): void {
		// Register file context menu event
		this.registerEvent(
			this.app.workspace.on('file-menu', (menu, file, source) => {
				if (file instanceof TFile && file.extension === 'md') {
					menu.addItem((item) => {
						item
							.setTitle('Export to Typst PDF')
							.setIcon('file-pdf')
							.onClick(() => {
								this.handleExportWithDependencyCheck(file);
							});
					});
				}
				
				// Add folder export option for directories
				if (file instanceof TFolder) {
					menu.addItem((item) => {
						item
							.setTitle('Export folder to PDF')
							.setIcon('folder-open')
							.onClick(() => {
								this.handleFolderExport(file);
							});
					});
				}
			})
		);

		// Register files context menu for multiple file selection
		this.registerEvent(
			this.app.workspace.on('files-menu', (menu, files, source) => {
				const markdownFiles = files.filter(f => f instanceof TFile && f.extension === 'md') as TFile[];
				
				if (markdownFiles.length > 0) {
					menu.addItem((item) => {
						item
							.setTitle(`Export ${markdownFiles.length} files to PDF`)
							.setIcon('file-pdf')
							.onClick(() => {
								this.handleBatchExport(markdownFiles);
							});
					});
				}
			})
		);
	}

	/**
	 * Handle ribbon icon click with context menu
	 */
	private handleRibbonClick(event: MouseEvent): void {
		const activeFile = this.app.workspace.getActiveFile();
		
		if (!activeFile || activeFile.extension !== 'md') {
			new Notice('Please open a markdown file to export');
			return;
		}

		// Create context menu for ribbon click
		const menu = new Menu();

		menu.addItem((item) =>
			item
				.setTitle('Export current note')
				.setIcon('file-pdf')
				.onClick(() => {
					this.handleExportWithDependencyCheck(activeFile);
				})
		);

		if (this.settings.exportDefaults && Object.keys(this.settings.exportDefaults).length > 0) {
			menu.addItem((item) =>
				item
					.setTitle('Export with previous settings')
					.setIcon('history')
					.onClick(() => {
						this.handleExportWithPreviousSettings(activeFile);
					})
			);
		}

		if (activeFile.parent) {
			menu.addSeparator();
			menu.addItem((item) =>
				item
					.setTitle('Export folder to PDF')
					.setIcon('folder-open')
					.onClick(() => {
						this.handleFolderExport(activeFile.parent!);
					})
			);
		}

		menu.showAtMouseEvent(event);
	}

	/**
	 * Handle export with dependency checking for a specific file
	 */
	private async handleExportWithDependencyCheck(file?: TFile | null): Promise<void> {
		if (!file) {
			file = this.app.workspace.getActiveFile();
		}
		
		if (!file || file.extension !== 'md') {
			new Notice('Please select a markdown file to export');
			return;
		}

		const result = await this.dependencyChecker.checkAllDependencies(
			{ customPath: this.settings.pandocPath },
			{ customPath: this.settings.typstPath }
		);

		if (!result.allAvailable) {
			this.showDependencyErrorDialog(result);
			return;
		}

		// Get the current file or active file
		const activeFile = file || this.app.workspace.getActiveFile();
		if (!activeFile) {
			new Notice('No file selected for export.');
			return;
		}

		// Open the export configuration modal
		new ExportConfigModal(
			this.app, 
			this, 
			activeFile.path,
			async (config) => {
				await this.performExport(activeFile, config);
			},
			async () => {
				// Modal was cancelled - no action needed
			}
		).open();
	}

	/**
	 * Handle export with previous settings
	 */
	private async handleExportWithPreviousSettings(file: TFile): Promise<void> {
		const result = await this.dependencyChecker.checkAllDependencies(
			{ customPath: this.settings.pandocPath },
			{ customPath: this.settings.typstPath }
		);

		if (!result.allAvailable) {
			this.showDependencyErrorDialog(result);
			return;
		}

		// TODO: Implement direct export using previous settings without modal
		new Notice('Export with previous settings will be implemented in a future version.');
	}

	/**
	 * Handle folder export with batch processing
	 */
	private async handleFolderExport(folder: TFolder): Promise<void> {
		const result = await this.dependencyChecker.checkAllDependencies(
			{ customPath: this.settings.pandocPath },
			{ customPath: this.settings.typstPath }
		);

		if (!result.allAvailable) {
			this.showDependencyErrorDialog(result);
			return;
		}

		// Get all markdown files in the folder recursively
		const markdownFiles = this.getMarkdownFilesInFolder(folder);
		
		if (markdownFiles.length === 0) {
			new Notice(`No markdown files found in folder: ${folder.name}`);
			return;
		}

		// Open export configuration modal for batch mode
		new ExportConfigModal(
			this.app, 
			this, 
			folder.path,
			async (config) => {
				// TODO: Implement batch export with config
				await this.processBatchFiles(markdownFiles, config);
			},
			async () => {
				// Modal was cancelled - no action needed
			}
		).open();
	}

	/**
	 * Handle batch export for multiple selected files
	 */
	private async handleBatchExport(files: TFile[]): Promise<void> {
		const result = await this.dependencyChecker.checkAllDependencies(
			{ customPath: this.settings.pandocPath },
			{ customPath: this.settings.typstPath }
		);

		if (!result.allAvailable) {
			this.showDependencyErrorDialog(result);
			return;
		}

		// Open export configuration modal for batch mode  
		new ExportConfigModal(
			this.app, 
			this, 
			'batch-export',
			async (config) => {
				// Process each file individually with the same config
				for (const file of files) {
					await this.performExport(file, config);
				}
			},
			async () => {
				// Modal was cancelled - no action needed
			}
		).open();
	}

	/**
	 * Get all markdown files in a folder recursively
	 */
	private getMarkdownFilesInFolder(folder: TFolder): TFile[] {
		const markdownFiles: TFile[] = [];
		
		const traverse = (currentFolder: TFolder) => {
			for (const child of currentFolder.children) {
				if (child instanceof TFile && child.extension === 'md') {
					markdownFiles.push(child);
				} else if (child instanceof TFolder) {
					traverse(child);
				}
			}
		};
		
		traverse(folder);
		return markdownFiles;
	}

	/**
	 * Simple concurrency limiter for batch operations (simplified version)
	 */
	private async processBatch<T, R>(
		items: T[],
		processor: (item: T, index: number) => Promise<R>,
		concurrency: number = 3
	): Promise<{ results: (R | Error)[]; errors: number }> {
		const results: (R | Error)[] = [];
		let errors = 0;

		// Simple batch processing - process items in chunks
		for (let i = 0; i < items.length; i += concurrency) {
			const chunk = items.slice(i, i + concurrency);
			const promises = chunk.map(async (item, index) => {
				try {
					return await processor(item, i + index);
				} catch (error) {
					errors++;
					return error instanceof Error ? error : new Error(String(error));
				}
			});
			
			const chunkResults = await Promise.all(promises);
			results.push(...chunkResults);
		}

		return { results, errors };
	}

	/**
	 * Perform export of a single file using the conversion pipeline
	 */
	private async performExport(file: TFile, config: ExportConfig): Promise<void> {
try {
	// Read the file content
	const content = await this.app.vault.read(file);
	
	// Set up path utilities (used throughout function)
	const path = require('path');
	const fs = require('fs');
	const vaultBasePath = (this.app.vault.adapter as any).basePath || process.cwd();
	
	// Create output directory if it doesn't exist
	const absoluteOutputDir = path.resolve(vaultBasePath, this.settings.outputFolder);
	if (!fs.existsSync(absoluteOutputDir)) {
		fs.mkdirSync(absoluteOutputDir, { recursive: true });
	}
	
	// Generate output filename
	const baseName = file.name.replace(/\.md$/, '');
	const outputPath = path.join(absoluteOutputDir, `${baseName}.pdf`);
	
	console.log('Export: Output directory:', absoluteOutputDir);
	console.log('Export: Output path:', outputPath);
	console.log('Export: Vault base path:', vaultBasePath);
	
	// Create temporary file for the processed markdown
	const tempDir = require('os').tmpdir();
	const tempInputFile = path.join(tempDir, `${baseName}_${Date.now()}.md`);
	
	// Preprocess the markdown content using MarkdownPreprocessor
	const MarkdownPreprocessor = require('./src/MarkdownPreprocessor').MarkdownPreprocessor;
	const preprocessor = new MarkdownPreprocessor({
		vaultPath: vaultBasePath,
		options: {
			includeMetadata: true,
			preserveFrontmatter: false,
			baseUrl: undefined
		},
		wikilinkConfig: {
			format: 'md',
			extension: '.md'
		}
	});
	
	const processedResult = await preprocessor.process(content);
	
	if (processedResult.errors.length > 0) {
		console.warn('Preprocessing errors:', processedResult.errors);
	}
	if (processedResult.warnings.length > 0) {
		console.warn('Preprocessing warnings:', processedResult.warnings);
	}
	
	// Write processed markdown to temporary file
	await require('fs').promises.writeFile(tempInputFile, processedResult.content, 'utf8');
	
	// Resolve template name to file path
	const templateName = config.template || this.settings.exportDefaults.template;
	console.log('Export: Selected template name:', templateName);
	const templatePath = this.templateManager.getTemplatePath(templateName);
	console.log('Export: Resolved template path:', templatePath);
	
	if (!templatePath) {
		throw new Error(`Template '${templateName}' not found. Available templates: ${(await this.templateManager.getAvailableTemplates()).join(', ')}`);
	}
	
	// Verify template file exists and get absolute path
	const pluginDir = (this.manifest as any).dir || path.join(this.app.vault.configDir, 'plugins', this.manifest.id);
	const absolutePluginDir = path.resolve(vaultBasePath, pluginDir);
	const absoluteTemplatePath = path.resolve(absolutePluginDir, templatePath);
	const templateExists = fs.existsSync(absoluteTemplatePath);
	console.log('Export: Template file exists:', templateExists);
	console.log('Export: Absolute template path:', absoluteTemplatePath);
	if (!templateExists) {
		throw new Error(`Template file not found at path: ${absoluteTemplatePath}`);
	}
	
	// Set up conversion parameters with vault base path for attachment resolution
	// Use absolute template path since we're running Pandoc from vault directory
	const pandocOptions: PandocOptions = {
		pandocPath: this.settings.pandocPath,
		typstPath: this.settings.typstPath,
		template: absoluteTemplatePath, // Use absolute path since working dir is vault
		variables: config.templateVariables || {},
		timeout: 60000,
		vaultBasePath: vaultBasePath // Add vault base path for attachment resolution
	} as any;
	
	console.log('Export: Pandoc options:', pandocOptions);
	
	// Create converter with the updated options
	const converter = new PandocTypstConverter(pandocOptions);
	
	// Perform the conversion
	new Notice('Converting to PDF...');
	const result = await converter.convertToPDF(tempInputFile, outputPath);
	
	// Clean up temporary file
	try {
		await require('fs').promises.unlink(tempInputFile);
	} catch (cleanupError) {
		console.warn('Failed to clean up temporary file:', cleanupError);
	}
	
	if (result.success) {
		new Notice(`PDF exported successfully: ${outputPath}`);
		
		// Optionally open the PDF after export
		if (this.settings.behavior.openAfterExport) {
			require('electron').shell.openPath(outputPath);
		}
	} else {
		new Notice(`Export failed: ${result.error || 'Unknown error'}`, 5000);
		console.error('Export failed:', result);
	}
	
} catch (error) {
	new Notice(`Export failed: ${error instanceof Error ? error.message : String(error)}`, 5000);
	console.error('Export error:', error);
}
}

	/**
	 * Process batch of files with export configuration
	 */
	private async processBatchFiles(files: TFile[], config: ExportConfig): Promise<void> {
		new Notice(`Starting batch export of ${files.length} files...`);
		
		const processor = async (file: TFile, index: number) => {
			new Notice(`Processing file ${index + 1}/${files.length}: ${file.name}`);
			await this.performExport(file, config);
			return `Exported ${file.name}`;
		};

		const result = await this.processBatch(files, processor, this.settings.behavior.exportConcurrency);
		
		if (result.errors > 0) {
			new Notice(`Batch export completed with ${result.errors} errors out of ${files.length} files.`);
		} else {
			new Notice(`Successfully exported ${files.length} files.`);
		}
	}
}

/**
 * Modal for displaying dependency status and installation instructions
 */
class DependencyStatusModal extends Modal {
	plugin: obsidianTypstPDFExport;

	constructor(app: App, plugin: obsidianTypstPDFExport) {
		super(app);
		this.plugin = plugin;
	}

	async onOpen() {
		const { contentEl } = this;
		contentEl.empty();

		contentEl.createEl('h2', { text: 'External Dependencies Status' });

		// Show loading indicator
		const loadingEl = contentEl.createDiv();
		loadingEl.setText('Checking dependencies...');

		try {
			// Check dependencies
			const results = await this.plugin.dependencyChecker.checkAllDependencies(
				{ customPath: this.plugin.settings.pandocPath },
				{ customPath: this.plugin.settings.typstPath }
			);

			// Clear loading indicator
			loadingEl.remove();

			// Show overall status
			const overallStatus = contentEl.createDiv({ cls: 'dependency-overall-status' });
			if (results.allAvailable) {
				overallStatus.createEl('div', { 
					text: '✅ All dependencies are available and ready to use',
					cls: 'dependency-success'
				});
			} else {
				overallStatus.createEl('div', { 
					text: '❌ Some dependencies need attention',
					cls: 'dependency-error'
				});
			}

			// Pandoc status
			this.createDependencySection(contentEl, 'Pandoc', results.pandoc);

			// Typst status
			this.createDependencySection(contentEl, 'Typst', results.typst);

			// Add refresh button
			const buttonContainer = contentEl.createDiv({ cls: 'dependency-button-container' });
			const refreshButton = buttonContainer.createEl('button', { text: 'Refresh Status' });
			refreshButton.onclick = () => {
				this.close();
				new DependencyStatusModal(this.app, this.plugin).open();
			};

		} catch (error) {
			loadingEl.remove();
			const errorEl = contentEl.createDiv({ cls: 'dependency-error' });
			errorEl.setText(`Error checking dependencies: ${error instanceof Error ? error.message : String(error)}`);
		}
	}

	private createDependencySection(containerEl: HTMLElement, toolName: string, result: any) {
		const section = containerEl.createDiv({ cls: 'dependency-section' });
		
		// Tool header
		const header = section.createEl('h3', { text: toolName });
		
		// Status indicator
		const statusEl = section.createDiv({ cls: 'dependency-status' });
		if (result.isAvailable) {
			statusEl.createEl('span', { 
				text: `✅ ${toolName} v${result.version} - Ready`,
				cls: 'dependency-success'
			});
			if (result.executablePath) {
				statusEl.createEl('div', { 
					text: `Path: ${result.executablePath}`,
					cls: 'dependency-path'
				});
			}
			if (result.warning) {
				statusEl.createEl('div', { 
					text: `⚠️ ${result.warning}`,
					cls: 'dependency-warning'
				});
			}
		} else {
			statusEl.createEl('span', { 
				text: `❌ ${toolName} - Not Available`,
				cls: 'dependency-error'
			});
			if (result.error) {
				statusEl.createEl('div', { 
					text: `Error: ${result.error}`,
					cls: 'dependency-error-detail'
				});
			}

			// Show installation guide
			this.createInstallationGuide(section, toolName.toLowerCase() as 'pandoc' | 'typst');
		}
	}

	private createInstallationGuide(containerEl: HTMLElement, toolName: 'pandoc' | 'typst') {
		const guide = this.plugin.dependencyChecker.getInstallationGuide(toolName);
		const platform = this.plugin.dependencyChecker.getCurrentPlatform();
		const platformInstructions = guide.instructions[platform];

		const guideEl = containerEl.createDiv({ cls: 'dependency-install-guide' });
		guideEl.createEl('h4', { text: 'Installation Instructions' });
		
		guideEl.createEl('p', { text: platformInstructions.description });

		if (platformInstructions.commands && platformInstructions.commands.length > 0) {
			const commandsEl = guideEl.createDiv();
			commandsEl.createEl('strong', { text: 'Installation commands:' });
			const commandsList = commandsEl.createEl('ul');
			platformInstructions.commands.forEach(cmd => {
				const listItem = commandsList.createEl('li');
				listItem.createEl('code', { text: cmd });
			});
		}

		const linksEl = guideEl.createDiv();
		linksEl.createEl('strong', { text: 'Useful links:' });
		const linksList = linksEl.createEl('ul');
		platformInstructions.links.forEach(link => {
			const listItem = linksList.createEl('li');
			const linkEl = listItem.createEl('a', { text: link, href: link });
			linkEl.setAttr('target', '_blank');
		});

		if (guide.troubleshooting.length > 0) {
			const troubleshootingEl = guideEl.createDiv();
			troubleshootingEl.createEl('strong', { text: 'Troubleshooting:' });
			const troubleshootingList = troubleshootingEl.createEl('ul');
			guide.troubleshooting.forEach(tip => {
				troubleshootingList.createEl('li', { text: tip });
			});
		}
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}

class TypstPDFExportSettingTab extends PluginSettingTab {
	plugin: obsidianTypstPDFExport;

	constructor(app: App, plugin: obsidianTypstPDFExport) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const {containerEl} = this;

		containerEl.empty();

		// Main settings heading
		new Setting(containerEl)
			.setName('Typst PDF Export Settings')
			.setHeading();

		// Dependency Status Section
		new Setting(containerEl)
			.setName('Dependencies')
			.setHeading();

		new Setting(containerEl)
			.setName('Dependency Status')
			.setDesc('Check the status of external dependencies')
			.addButton(button => button
				.setButtonText('Check Dependencies')
				.setCta()
				.onClick(async () => {
					// Open dependency status modal
					const modal = new DependencyStatusModal(this.app, this.plugin);
					modal.open();
				}));

		// External Tools Section
		new Setting(containerEl)
			.setName('External Tools')
			.setHeading();

		new Setting(containerEl)
			.setDesc('Configure paths to external tools required for PDF export');

		new Setting(containerEl)
			.setName('Pandoc path')
			.setDesc('Path to the Pandoc executable (leave empty to use system PATH)')
			.addText(text => text
				.setPlaceholder('/usr/local/bin/pandoc')
				.setValue(this.plugin.settings.pandocPath)
				.onChange(async (value) => {
					this.plugin.settings.pandocPath = value;
					await this.plugin.saveSettings();
				}))
			.addExtraButton(button => button
				.setIcon('folder-open')
				.setTooltip('Browse for Pandoc executable')
				.onClick(async () => {
					// TODO: Implement file picker for executable selection
					new Notice('File picker not yet implemented');
				}))
			.addExtraButton(button => button
				.setIcon('check-circle')
				.setTooltip('Validate Pandoc installation')
				.onClick(async () => {
					// TODO: Implement path validation
					new Notice('Path validation not yet implemented');
				}));

		new Setting(containerEl)
			.setName('Typst path')
			.setDesc('Path to the Typst executable (leave empty to use system PATH)')
			.addText(text => text
				.setPlaceholder('/usr/local/bin/typst')
				.setValue(this.plugin.settings.typstPath)
				.onChange(async (value) => {
					this.plugin.settings.typstPath = value;
					await this.plugin.saveSettings();
				}))
			.addExtraButton(button => button
				.setIcon('folder-open')
				.setTooltip('Browse for Typst executable')
				.onClick(async () => {
					// TODO: Implement file picker for executable selection
					new Notice('File picker not yet implemented');
				}))
			.addExtraButton(button => button
				.setIcon('check-circle')
				.setTooltip('Validate Typst installation')
				.onClick(async () => {
					// TODO: Implement path validation
					new Notice('Path validation not yet implemented');
				}));

		new Setting(containerEl)
			.setName('Output folder')
			.setDesc('Default folder for exported PDF files (relative to vault root)')
			.addText(text => text
				.setPlaceholder('exports')
				.setValue(this.plugin.settings.outputFolder)
				.onChange(async (value) => {
					this.plugin.settings.outputFolder = value;
					await this.plugin.saveSettings();
				}))
			.addExtraButton(button => button
				.setIcon('folder-open')
				.setTooltip('Browse for output folder')
				.onClick(async () => {
					// TODO: Implement folder picker
					new Notice('Folder picker not yet implemented');
				}));

		// Export Defaults Section
		new Setting(containerEl)
			.setName('Export Defaults')
			.setHeading();

		new Setting(containerEl)
			.setDesc('Default settings for PDF export operations');

		new Setting(containerEl)
			.setName('Default template')
			.setDesc('Template name to use for exports')
			.addText(text => text
				.setPlaceholder('default')
				.setValue(this.plugin.settings.exportDefaults.template)
				.onChange(async (value) => {
					this.plugin.settings.exportDefaults.template = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Export format')
			.setDesc('Default PDF format for exports')
			.addDropdown(dropdown => dropdown
				.addOption(ExportFormat.Standard, 'Standard multi-page')
				.addOption(ExportFormat.SinglePage, 'Single continuous page')
				.setValue(this.plugin.settings.exportDefaults.format)
				.onChange(async (value) => {
					this.plugin.settings.exportDefaults.format = value as ExportFormat;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Export mode')
			.setDesc('Processing approach for document conversion')
			.addDropdown(dropdown => dropdown
				.addOption(ExportMode.Typography, 'Typography-focused (optimized readability)')
				.addOption(ExportMode.StylePreserving, 'Style-preserving (maintain formatting)')
				.setValue(this.plugin.settings.exportDefaults.mode)
				.onChange(async (value) => {
					this.plugin.settings.exportDefaults.mode = value as ExportMode;
					await this.plugin.saveSettings();
				}));

		// Typography Section
		new Setting(containerEl)
			.setName('Typography')
			.setHeading();

		new Setting(containerEl)
			.setDesc('Font and text formatting settings');

		new Setting(containerEl)
			.setName('Body font')
			.setDesc('Font family for body text')
			.addText(text => text
				.setPlaceholder('Times New Roman')
				.setValue(this.plugin.settings.typography.fonts.body)
				.onChange(async (value) => {
					this.plugin.settings.typography.fonts.body = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Heading font')
			.setDesc('Font family for headings')
			.addText(text => text
				.setPlaceholder('Arial')
				.setValue(this.plugin.settings.typography.fonts.heading)
				.onChange(async (value) => {
					this.plugin.settings.typography.fonts.heading = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Monospace font')
			.setDesc('Font family for code blocks and inline code')
			.addText(text => text
				.setPlaceholder('Courier New')
				.setValue(this.plugin.settings.typography.fonts.monospace)
				.onChange(async (value) => {
					this.plugin.settings.typography.fonts.monospace = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Body font size')
			.setDesc('Font size for body text (in points)')
			.addSlider(slider => slider
				.setLimits(8, 24, 1)
				.setValue(this.plugin.settings.typography.fontSizes.body)
				.setDynamicTooltip()
				.onChange(async (value) => {
					this.plugin.settings.typography.fontSizes.body = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Heading font size')
			.setDesc('Font size for headings (in points)')
			.addSlider(slider => slider
				.setLimits(12, 36, 1)
				.setValue(this.plugin.settings.typography.fontSizes.heading)
				.setDynamicTooltip()
				.onChange(async (value) => {
					this.plugin.settings.typography.fontSizes.heading = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Small font size')
			.setDesc('Font size for small text like captions (in points)')
			.addSlider(slider => slider
				.setLimits(6, 16, 1)
				.setValue(this.plugin.settings.typography.fontSizes.small)
				.setDynamicTooltip()
				.onChange(async (value) => {
					this.plugin.settings.typography.fontSizes.small = value;
					await this.plugin.saveSettings();
				}));

		// Page Setup Section
		new Setting(containerEl)
			.setName('Page Setup')
			.setHeading();

		new Setting(containerEl)
			.setDesc('PDF page layout and formatting');

		new Setting(containerEl)
			.setName('Page size')
			.setDesc('Paper size for PDF output')
			.addDropdown(dropdown => dropdown
				.addOption('a4', 'A4')
				.addOption('letter', 'US Letter')
				.addOption('a3', 'A3')
				.addOption('a5', 'A5')
				.addOption('legal', 'US Legal')
				.setValue(this.plugin.settings.pageSetup.size)
				.onChange(async (value) => {
					this.plugin.settings.pageSetup.size = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Orientation')
			.setDesc('Page orientation')
			.addDropdown(dropdown => dropdown
				.addOption('portrait', 'Portrait')
				.addOption('landscape', 'Landscape')
				.setValue(this.plugin.settings.pageSetup.orientation)
				.onChange(async (value) => {
					this.plugin.settings.pageSetup.orientation = value as 'portrait' | 'landscape';
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Top margin')
			.setDesc('Top page margin (in points)')
			.addSlider(slider => slider
				.setLimits(18, 144, 6)
				.setValue(this.plugin.settings.pageSetup.margins.top)
				.setDynamicTooltip()
				.onChange(async (value) => {
					this.plugin.settings.pageSetup.margins.top = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Right margin')
			.setDesc('Right page margin (in points)')
			.addSlider(slider => slider
				.setLimits(18, 144, 6)
				.setValue(this.plugin.settings.pageSetup.margins.right)
				.setDynamicTooltip()
				.onChange(async (value) => {
					this.plugin.settings.pageSetup.margins.right = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Bottom margin')
			.setDesc('Bottom page margin (in points)')
			.addSlider(slider => slider
				.setLimits(18, 144, 6)
				.setValue(this.plugin.settings.pageSetup.margins.bottom)
				.setDynamicTooltip()
				.onChange(async (value) => {
					this.plugin.settings.pageSetup.margins.bottom = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Left margin')
			.setDesc('Left page margin (in points)')
			.addSlider(slider => slider
				.setLimits(18, 144, 6)
				.setValue(this.plugin.settings.pageSetup.margins.left)
				.setDynamicTooltip()
				.onChange(async (value) => {
					this.plugin.settings.pageSetup.margins.left = value;
					await this.plugin.saveSettings();
				}));

		// Advanced Options Section
		new Setting(containerEl)
			.setName('Advanced Options')
			.setHeading();

		new Setting(containerEl)
			.setDesc('Advanced plugin behavior and performance settings');

		new Setting(containerEl)
			.setName('Open PDF after export')
			.setDesc('Automatically open the exported PDF file')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.behavior.openAfterExport)
				.onChange(async (value) => {
					this.plugin.settings.behavior.openAfterExport = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Preserve folder structure')
			.setDesc('Maintain the original folder structure in the output directory')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.behavior.preserveFolderStructure)
				.onChange(async (value) => {
					this.plugin.settings.behavior.preserveFolderStructure = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Export concurrency')
			.setDesc('Number of files to export simultaneously during batch operations (1-10)')
			.addSlider(slider => slider
				.setLimits(1, 10, 1)
				.setValue(this.plugin.settings.behavior.exportConcurrency)
				.setDynamicTooltip()
				.onChange(async (value) => {
					this.plugin.settings.behavior.exportConcurrency = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Debug mode')
			.setDesc('Enable verbose logging for troubleshooting export issues')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.behavior.debugMode || false)
				.onChange(async (value) => {
					this.plugin.settings.behavior.debugMode = value;
					await this.plugin.saveSettings();
				}));

		// Template Management Section
		new Setting(containerEl)
			.setName('Template Management')
			.setHeading();

		new Setting(containerEl)
			.setDesc('Manage custom Typst templates for document styling');

		new Setting(containerEl)
			.setName('Import template')
			.setDesc('Import a custom Typst template file (.typ)')
			.addButton(button => button
				.setButtonText('Import Template')
				.setIcon('file-plus')
				.onClick(async () => {
					// TODO: Implement template import functionality
					new Notice('Template import not yet implemented');
				}));

		new Setting(containerEl)
			.setName('Export templates')
			.setDesc('Export current templates for sharing or backup')
			.addButton(button => button
				.setButtonText('Export Templates')
				.setIcon('download')
				.onClick(async () => {
					// TODO: Implement template export functionality
					new Notice('Template export not yet implemented');
				}));

		new Setting(containerEl)
			.setName('Reset to defaults')
			.setDesc('Reset all settings to their default values')
			.addButton(button => button
				.setButtonText('Reset Settings')
				.setWarning()
				.onClick(async () => {
					// TODO: Implement settings reset with confirmation
					new Notice('Settings reset not yet implemented');
				}));
	}
}

/**
 * Configuration interface for export modal settings
 * Combines user preferences with runtime state for export operations
 */
interface ExportConfigModalSettings extends ExportConfig {
	/** Note being exported */
	notePath: string;
	/** Note title for display */
	noteTitle: string;
	/** Available templates from TemplateManager */
	availableTemplates: string[];
	/** Current export in progress */
	isExporting: boolean;
	/** Progress percentage (0-100) */
	progressPercent: number;
	/** Current operation description */
	currentOperation: string;
	/** Whether export can be cancelled */
	canCancel: boolean;
}

/**
 * Export Configuration Modal
 * Provides intuitive interface for configuring PDF export options
 * with real-time preview and validation
 */
export class ExportConfigModal extends Modal {
	private settings: ExportConfigModalSettings;
	private plugin: obsidianTypstPDFExport;
	private onSubmit: (config: ExportConfig) => Promise<void>;
	private onCancel?: () => void;

	// UI Elements
	private contentContainer: HTMLElement;
	private formContainer: HTMLElement;
	private previewContainer: HTMLElement;
	private progressContainer: HTMLElement;
	private progressBar: HTMLElement | null = null;
	private progressText: HTMLElement | null = null;
	private cancelButton: HTMLButtonElement | null = null;

	constructor(
		app: App,
		plugin: obsidianTypstPDFExport,
		notePath: string,
		onSubmit: (config: ExportConfig) => Promise<void>,
		onCancel?: () => void
	) {
		super(app);
		this.plugin = plugin;
		this.onSubmit = onSubmit;
		this.onCancel = onCancel;

		// Initialize settings from plugin defaults and note context
		const noteTitle = this.getNoteTitleFromPath(notePath);
		this.settings = {
			notePath,
			noteTitle,
			template: plugin.settings.exportDefaults.template,
			format: plugin.settings.exportDefaults.format,
			mode: plugin.settings.exportDefaults.mode,
			outputFolder: plugin.settings.outputFolder,
			templateVariables: {},
			availableTemplates: [], // Will be populated by TemplateManager
			isExporting: false,
			progressPercent: 0,
			currentOperation: '',
			canCancel: false
		};
	}

	/**
	 * Initialize modal when opened
	 */
	/**
	 * Initialize modal when opened
	 */
	/**
	 * Initialize modal when opened
	 */
	onOpen(): void {
		this.addModalStyles();
		
		// Set modal dimensions to match Obsidian Settings window
		if (this.modalEl) {
			this.modalEl.style.width = '1100px';
			this.modalEl.style.height = '750px';
			this.modalEl.style.maxWidth = '90vw';
			this.modalEl.style.maxHeight = '90vh';
		}
		
		this.setTitle(`Export "${this.settings.noteTitle}" to PDF`);
		
		// Load templates FIRST, then generate form and load previous config
		this.loadAvailableTemplates().then(() => {
			this.generateForm();
			this.loadPreviousConfig();
		});
	}

	/**
	 * Cleanup when modal is closed
	 */
	onClose(): void {
		if (this.onCancel && this.settings.isExporting) {
			this.onCancel();
		}
	}

	/**
	 * Extract note title from file path for display
	 */
	private getNoteTitleFromPath(path: string): string {
		const fileName = path.split('/').pop() || path;
		return fileName.replace(/\.md$/, '');
	}

	/**
	 * Load available templates from TemplateManager
	 * This will be implemented when TemplateManager is available
	 */
	private async loadAvailableTemplates(): Promise<void> {
		// Load available templates from TemplateManager via plugin
		console.log('Modal: Loading available templates...');
		console.log('TemplateManager exists:', !!this.plugin.templateManager);
		
		if (this.plugin.templateManager) {
			this.settings.availableTemplates = await this.plugin.templateManager.getAvailableTemplates();
			console.log('Templates loaded from TemplateManager:', this.settings.availableTemplates);
		} else {
			// Fallback to hardcoded defaults if TemplateManager not initialized
			console.log('Using fallback templates');
			this.settings.availableTemplates = [
				'default.typ',
				'article.typ', 
				'report.typ',
				'single-page.typ'
			];
		}
		
		// Update template dropdown if already rendered
		this.updateTemplateDropdown();
	}

	/**
	 * Update template dropdown options
	 * Called after templates are loaded
	 */
	private updateTemplateDropdown(): void {
	console.log('updateTemplateDropdown called');
	console.log('templateDropdown exists:', !!this.templateDropdown);
	console.log('Available templates:', this.settings.availableTemplates);
	
	if (!this.templateDropdown) {
		console.log('templateDropdown not yet created');
		return;
	}
	
	// Clear existing options
	this.templateDropdown.selectEl.empty();
	
	// Add available templates
	this.settings.availableTemplates.forEach(template => {
		const displayName = this.getTemplateDisplayName(template);
		console.log(`Adding template option: ${template} -> ${displayName}`);
		this.templateDropdown.addOption(template, displayName);
	});
	
	// Set current value or default with proper extension
	const currentValue = this.settings.template || 'default.typ';
	this.templateDropdown.setValue(currentValue);
}

	/**
	 * Generate the main form UI
	 * Placeholder for Task 7.2
	 */
	/**
	 * Generate the main form UI
	 * Creates comprehensive form with all export configuration options
	 */
	private generateForm(): void {
		const { contentEl } = this;
		contentEl.empty();
		
		// Create main container with responsive layout
		this.contentContainer = contentEl.createDiv('export-config-container');
		this.contentContainer.style.display = 'flex';
		this.contentContainer.style.gap = '20px';
		this.contentContainer.style.minHeight = '400px';

		// Form container (left side) - CREATE FIRST, then set styles
		this.formContainer = this.contentContainer.createDiv('export-config-form');
		this.formContainer.style.flex = '1';
		this.formContainer.style.minWidth = '400px';

		// Preview container (right side)
		this.previewContainer = this.contentContainer.createDiv('export-config-preview');
		this.previewContainer.style.flex = '1';
		this.previewContainer.style.maxWidth = '300px';
		this.previewContainer.style.border = '1px solid var(--background-modifier-border)';
		this.previewContainer.style.borderRadius = '8px';
		this.previewContainer.style.padding = '16px';

		// Progress container (initially hidden)
		this.progressContainer = this.contentContainer.createDiv('export-progress');
		this.progressContainer.style.display = 'none';

		// Generate form sections
		this.createExportModeSection();
		this.createFormatSection();
		this.createTemplateSection();
		this.createOutputSection();
		this.createPageConfigSection();
		this.createTypographySection();
		this.createActionButtons();

		// Initialize preview
		this.createPreviewSection();
		this.updatePreview();
	}

	/**
	 * Create export mode selection section
	 */
	private createExportModeSection(): void {
		const section = this.formContainer.createDiv('export-section');
		section.createEl('h3', { text: 'Export Mode' });

		new Setting(section)
			.setName('Export mode')
			.setDesc('Choose between typography-focused or style-preserving export')
			.addDropdown(dropdown => {
				dropdown
					.addOption(ExportMode.Typography, 'Typography (optimized for readability)')
					.addOption(ExportMode.StylePreserving, 'Style-preserving (maintains original formatting)')
					.setValue(this.settings.mode || ExportMode.Typography)
					.onChange(value => {
						this.settings.mode = value as ExportMode;
						this.updatePreview();
					});
			});
	}

	/**
	 * Create format selection section
	 */
	private createFormatSection(): void {
		const section = this.formContainer.createDiv('export-section');
		section.createEl('h3', { text: 'Format Options' });

		new Setting(section)
			.setName('PDF format')
			.setDesc('Choose document layout format')
			.addDropdown(dropdown => {
				dropdown
					.addOption(ExportFormat.Standard, 'Standard (multi-page PDF)')
					.addOption(ExportFormat.SinglePage, 'Single-page (continuous layout)')
					.setValue(this.settings.format || ExportFormat.Standard)
					.onChange(value => {
						this.settings.format = value as ExportFormat;
						this.updatePreview();
					});
			});
	}

	/**
	 * Create template selection section
	 */
	private createTemplateSection(): void {
	const section = this.formContainer.createDiv('export-section');
	section.createEl('h3', { text: 'Template' });

	new Setting(section)
		.setName('Typst template')
		.setDesc('Select template for document styling')
		.addDropdown(dropdown => {
			// Initially populate with available templates
			this.settings.availableTemplates.forEach(template => {
				dropdown.addOption(template, this.getTemplateDisplayName(template));
			});
			
			// Set default value with proper extension
			const defaultTemplate = this.settings.template || 'default.typ';
			dropdown
				.setValue(defaultTemplate)
				.onChange(value => {
					this.settings.template = value;
					this.updatePreview();
				});
			
			// Store reference for updates
			this.templateDropdown = dropdown;
		});

	// Template variables section
	this.createTemplateVariablesSection(section);
}

	/**
	 * Create template variables section
	 */
	private createTemplateVariablesSection(parentSection: HTMLElement): void {
		const variablesContainer = parentSection.createDiv('template-variables');
		
		// Title field
		new Setting(variablesContainer)
			.setName('Document title')
			.setDesc('Override document title (uses note title by default)')
			.addText(text => {
				text
					.setPlaceholder(this.settings.noteTitle)
					.setValue(this.settings.templateVariables?.title || '')
					.onChange(value => {
						this.settings.templateVariables = this.settings.templateVariables || {};
						this.settings.templateVariables.title = value || this.settings.noteTitle;
						this.updatePreview();
					});
			});

		// Author field
		new Setting(variablesContainer)
			.setName('Author')
			.setDesc('Document author name')
			.addText(text => {
				text
					.setPlaceholder('Your name')
					.setValue(this.settings.templateVariables?.author || '')
					.onChange(value => {
						this.settings.templateVariables = this.settings.templateVariables || {};
						this.settings.templateVariables.author = value;
						this.updatePreview();
					});
			});

		// Date field
		new Setting(variablesContainer)
			.setName('Date')
			.setDesc('Document date (leave blank for current date)')
			.addText(text => {
				text
					.setPlaceholder(new Date().toLocaleDateString())
					.setValue(this.settings.templateVariables?.date || '')
					.onChange(value => {
						this.settings.templateVariables = this.settings.templateVariables || {};
						this.settings.templateVariables.date = value || new Date().toLocaleDateString();
						this.updatePreview();
					});
			});
	}

	/**
	 * Create output settings section
	 */
	private createOutputSection(): void {
		const section = this.formContainer.createDiv('export-section');
		section.createEl('h3', { text: 'Output Settings' });

		// Output folder
		new Setting(section)
			.setName('Output folder')
			.setDesc('Folder where the PDF will be saved')
			.addText(text => {
				text
					.setPlaceholder(this.plugin.settings.outputFolder)
					.setValue(this.settings.outputFolder || '')
					.onChange(value => {
						this.settings.outputFolder = value || this.plugin.settings.outputFolder;
						this.updatePreview();
					});
			});

		// Filename pattern (advanced)
		const filenamePattern = this.settings.templateVariables?.filenamePattern || '{title}';
		new Setting(section)
			.setName('Filename pattern')
			.setDesc('Pattern for generated filename. Use {title}, {date}, {author}')
			.addText(text => {
				text
					.setPlaceholder('{title}')
					.setValue(filenamePattern)
					.onChange(value => {
						this.settings.templateVariables = this.settings.templateVariables || {};
						this.settings.templateVariables.filenamePattern = value || '{title}';
						this.updatePreview();
					});
			});
	}

	/**
	 * Create page configuration section
	 */
	private createPageConfigSection(): void {
		const section = this.formContainer.createDiv('export-section');
		section.createEl('h3', { text: 'Page Setup' });

		// Page size
		new Setting(section)
			.setName('Page size')
			.setDesc('Standard page sizes or custom dimensions')
			.addDropdown(dropdown => {
				dropdown
					.addOption('a4', 'A4 (210 × 297 mm)')
					.addOption('letter', 'Letter (8.5 × 11 in)')
					.addOption('legal', 'Legal (8.5 × 14 in)')
					.addOption('a3', 'A3 (297 × 420 mm)')
					.addOption('custom', 'Custom size')
					.setValue(this.plugin.settings.pageSetup.size)
					.onChange(value => {
						// Note: This updates plugin defaults, not per-export settings
						// TODO: Consider adding per-export page settings to ExportConfig
						this.updatePreview();
					});
			});

		// Orientation
		new Setting(section)
			.setName('Orientation')
			.setDesc('Page orientation')
			.addDropdown(dropdown => {
				dropdown
					.addOption('portrait', 'Portrait')
					.addOption('landscape', 'Landscape')
					.setValue(this.plugin.settings.pageSetup.orientation)
					.onChange(value => {
						// Note: This updates plugin defaults
						this.updatePreview();
					});
			});

		// Margins
		this.createMarginsSection(section);
	}

	/**
	 * Create margins configuration subsection
	 */
	private createMarginsSection(parentSection: HTMLElement): void {
		const marginsContainer = parentSection.createDiv('margins-container');
		marginsContainer.createEl('h4', { text: 'Margins (in points)' });

		const margins = this.plugin.settings.pageSetup.margins;
		
		// Top margin
		new Setting(marginsContainer)
			.setName('Top')
			.addSlider(slider => {
				slider
					.setLimits(36, 144, 6) // 0.5" to 2" in 6pt increments
					.setValue(margins.top)
					.setDynamicTooltip()
					.onChange(value => {
						this.updatePreview();
					});
			});

		// Bottom margin  
		new Setting(marginsContainer)
			.setName('Bottom')
			.addSlider(slider => {
				slider
					.setLimits(36, 144, 6)
					.setValue(margins.bottom)
					.setDynamicTooltip()
					.onChange(value => {
						this.updatePreview();
					});
			});

		// Left margin
		new Setting(marginsContainer)
			.setName('Left')
			.addSlider(slider => {
				slider
					.setLimits(36, 144, 6)
					.setValue(margins.left)
					.setDynamicTooltip()
					.onChange(value => {
						this.updatePreview();
					});
			});

		// Right margin
		new Setting(marginsContainer)
			.setName('Right')
			.addSlider(slider => {
				slider
					.setLimits(36, 144, 6)
					.setValue(margins.right)
					.setDynamicTooltip()
					.onChange(value => {
						this.updatePreview();
					});
			});
	}

	/**
	 * Create typography settings section
	 */
	private createTypographySection(): void {
		const section = this.formContainer.createDiv('export-section');
		section.createEl('h3', { text: 'Typography' });

		const fonts = this.plugin.settings.typography.fonts;
		const fontSizes = this.plugin.settings.typography.fontSizes;

		// Body font
		new Setting(section)
			.setName('Body font')
			.setDesc('Primary font for document text')
			.addText(text => {
				text
					.setPlaceholder('System default')
					.setValue(fonts.body)
					.onChange(value => {
						this.updatePreview();
					});
			});

		// Heading font
		new Setting(section)
			.setName('Heading font')
			.setDesc('Font for headings and titles')
			.addText(text => {
				text
					.setPlaceholder('System default')
					.setValue(fonts.heading)
					.onChange(value => {
						this.updatePreview();
					});
			});

		// Monospace font
		new Setting(section)
			.setName('Code font')
			.setDesc('Monospace font for code blocks')
			.addText(text => {
				text
					.setPlaceholder('System default')
					.setValue(fonts.monospace)
					.onChange(value => {
						this.updatePreview();
					});
			});

		// Font sizes
		this.createFontSizesSection(section, fontSizes);
	}

	/**
	 * Create font sizes subsection
	 */
	private createFontSizesSection(parentSection: HTMLElement, fontSizes: any): void {
		const sizesContainer = parentSection.createDiv('font-sizes');
		sizesContainer.createEl('h4', { text: 'Font Sizes (in points)' });

		// Body size
		new Setting(sizesContainer)
			.setName('Body text')
			.addSlider(slider => {
				slider
					.setLimits(8, 16, 0.5)
					.setValue(fontSizes.body)
					.setDynamicTooltip()
					.onChange(value => {
						this.updatePreview();
					});
			});

		// Heading size
		new Setting(sizesContainer)
			.setName('Headings')
			.addSlider(slider => {
				slider
					.setLimits(12, 24, 0.5)
					.setValue(fontSizes.heading)
					.setDynamicTooltip()
					.onChange(value => {
						this.updatePreview();
					});
			});

		// Small text size
		new Setting(sizesContainer)
			.setName('Small text')
			.addSlider(slider => {
				slider
					.setLimits(6, 12, 0.5)
					.setValue(fontSizes.small)
					.setDynamicTooltip()
					.onChange(value => {
						this.updatePreview();
					});
			});
	}

	/**
	 * Create action buttons section
	 */
	private createActionButtons(): void {
		const buttonsContainer = this.formContainer.createDiv('export-actions');
		buttonsContainer.style.marginTop = '20px';
		buttonsContainer.style.paddingTop = '20px';
		buttonsContainer.style.borderTop = '1px solid var(--background-modifier-border)';

		new Setting(buttonsContainer)
			.addButton(btn => {
				btn
					.setButtonText('Export PDF')
					.setCta()
					.onClick(() => this.submitExport());
			})
			.addButton(btn => {
				btn
					.setButtonText('Cancel')
					.onClick(() => this.close());
			});
	}

	/**
	 * Create preview section
	 */
	private createPreviewSection(): void {
		this.previewContainer.createEl('h3', { text: 'Preview' });
		
		// Export summary
		const summaryContainer = this.previewContainer.createDiv('export-summary');
		
		// Document info
		const docInfo = summaryContainer.createDiv('doc-info');
		docInfo.createEl('h4', { text: 'Document' });
		docInfo.createEl('p', { text: `Note: ${this.settings.noteTitle}` });
		
		// Configuration preview
		const configInfo = summaryContainer.createDiv('config-info');
		configInfo.createEl('h4', { text: 'Configuration' });
		
		// This will be populated by updatePreview()
		this.configPreview = configInfo.createDiv('config-details');
		
		// Output info
		const outputInfo = summaryContainer.createDiv('output-info');
		outputInfo.createEl('h4', { text: 'Output' });
		
		// This will be populated by updatePreview()
		this.outputPreview = outputInfo.createDiv('output-details');
	}

	/**
	 * Get display name for template
	 */
	private getTemplateDisplayName(template: string): string {
	// Remove .typ extension for display name mapping
	const templateKey = template.replace('.typ', '');
	
	const displayNames: Record<string, string> = {
		'default': 'Default',
		'article': 'Article',
		'report': 'Report', 
		'single-page': 'Single Page'
	};
	
	return displayNames[templateKey] || templateKey.charAt(0).toUpperCase() + templateKey.slice(1);
}

	// Properties to store UI element references
	private templateDropdown?: any;
	private configPreview?: HTMLElement;
	private outputPreview?: HTMLElement;

	/**
	 * Update preview based on current settings
	 * Placeholder for Task 7.3
	 */
	/**
	 * Update preview based on current settings
	 * Shows configuration summary and output preview
	 */
	private updatePreview(): void {
		if (!this.configPreview || !this.outputPreview) {
			return; // Preview not yet initialized
		}

		// Clear existing content
		this.configPreview.empty();
		this.outputPreview.empty();

		// Configuration summary
		const configItems = this.configPreview.createDiv('config-items');
		
		configItems.createDiv('config-item').innerHTML = 
			`<strong>Mode:</strong> ${this.settings.mode === ExportMode.Typography ? 'Typography' : 'Style-preserving'}`;
		
		configItems.createDiv('config-item').innerHTML = 
			`<strong>Format:</strong> ${this.settings.format === ExportFormat.Standard ? 'Standard PDF' : 'Single-page PDF'}`;
			
		configItems.createDiv('config-item').innerHTML = 
			`<strong>Template:</strong> ${this.getTemplateDisplayName(this.settings.template || 'default')}`;

		// Template variables preview
		if (this.settings.templateVariables) {
			const vars = this.settings.templateVariables;
			if (vars.title || vars.author || vars.date) {
				const varsDiv = configItems.createDiv('config-item');
				varsDiv.innerHTML = '<strong>Variables:</strong>';
				const varsList = varsDiv.createDiv('variables-list');
				
				if (vars.title) varsList.createDiv('var-item').innerHTML = `Title: ${vars.title}`;
				if (vars.author) varsList.createDiv('var-item').innerHTML = `Author: ${vars.author}`;
				if (vars.date) varsList.createDiv('var-item').innerHTML = `Date: ${vars.date}`;
			}
		}

		// Output preview
		const outputItems = this.outputPreview.createDiv('output-items');
		
		// Output folder
		const outputFolder = this.settings.outputFolder || this.plugin.settings.outputFolder;
		outputItems.createDiv('output-item').innerHTML = 
			`<strong>Folder:</strong> ${outputFolder}`;

		// Filename preview
		const filename = this.generatePreviewFilename();
		outputItems.createDiv('output-item').innerHTML = 
			`<strong>Filename:</strong> ${filename}.pdf`;

		// File size estimate (placeholder)
		outputItems.createDiv('output-item').innerHTML = 
			`<strong>Est. size:</strong> ~${this.estimateFileSize()} KB`;
	}

	/**
	 * Generate preview filename based on current settings
	 */
	private generatePreviewFilename(): string {
		const pattern = this.settings.templateVariables?.filenamePattern || '{title}';
		const title = this.settings.templateVariables?.title || this.settings.noteTitle;
		const author = this.settings.templateVariables?.author || '';
		const date = this.settings.templateVariables?.date || new Date().toLocaleDateString();

		return pattern
			.replace('{title}', title)
			.replace('{author}', author)
			.replace('{date}', date)
			.replace(/[<>:"/\\|?*]/g, '_'); // Replace invalid filename characters
	}

	/**
	 * Estimate output file size based on content and settings
	 */
	private estimateFileSize(): number {
		// Simple estimation based on mode and format
		// In a real implementation, this could analyze content length
		let baseSize = 150; // Base size in KB
		
		if (this.settings.mode === ExportMode.StylePreserving) {
			baseSize *= 1.5; // Style-preserving adds overhead
		}
		
		if (this.settings.format === ExportFormat.SinglePage) {
			baseSize *= 1.2; // Single-page format may be larger
		}
		
		return Math.round(baseSize);
	}

	/**
	 * Validate current settings
	 * Placeholder for Task 7.3
	 */
	/**
	 * Validate current settings and show visual feedback
	 * Returns true if settings are valid for export
	 */
	private validateSettings(): boolean {
		let isValid = true;
		const errors: string[] = [];

		// Clear previous validation styling
		this.clearValidationErrors();

		// Validate template selection
		if (!this.settings.template || this.settings.template.trim() === '') {
			errors.push('Template selection is required');
			this.showFieldError('template', 'Please select a template');
			isValid = false;
		} else if (!this.settings.availableTemplates.includes(this.settings.template)) {
			errors.push('Selected template is not available');
			this.showFieldError('template', 'Template not found');
			isValid = false;
		}

		// Validate output folder
		const outputFolder = this.settings.outputFolder?.trim();
		if (!outputFolder) {
			errors.push('Output folder is required');
			this.showFieldError('outputFolder', 'Please specify an output folder');
			isValid = false;
		} else if (outputFolder.includes('<') || outputFolder.includes('>')) {
			errors.push('Output folder path contains invalid characters');
			this.showFieldError('outputFolder', 'Invalid characters in path');
			isValid = false;
		}

		// Validate filename pattern
		const filenamePattern = this.settings.templateVariables?.filenamePattern;
		if (filenamePattern && !filenamePattern.includes('{title}') && !filenamePattern.includes('{author}') && !filenamePattern.includes('{date}')) {
			errors.push('Filename pattern should include at least one variable');
			this.showFieldError('filenamePattern', 'Include {title}, {author}, or {date}');
			// This is a warning, not a blocking error
		}

		// Validate template variables
		if (this.settings.templateVariables) {
			const title = this.settings.templateVariables.title?.trim();
			if (title && title.length > 100) {
				errors.push('Document title is too long');
				this.showFieldError('title', 'Maximum 100 characters');
				isValid = false;
			}

			const author = this.settings.templateVariables.author?.trim();
			if (author && author.length > 50) {
				errors.push('Author name is too long');
				this.showFieldError('author', 'Maximum 50 characters');
				isValid = false;
			}

			// Validate date format if provided
			const date = this.settings.templateVariables.date?.trim();
			if (date && date !== '' && isNaN(Date.parse(date))) {
				errors.push('Invalid date format');
				this.showFieldError('date', 'Please use a valid date format');
				isValid = false;
			}
		}

		// Show validation summary
		this.showValidationSummary(isValid, errors);

		return isValid;
	}

	/**
	 * Clear all validation error styling
	 */
	private clearValidationErrors(): void {
		// Remove error classes from all form elements
		const errorElements = this.formContainer.querySelectorAll('.setting-item-control.error');
		errorElements.forEach(el => {
			el.removeClass('error');
			// Remove error message if it exists
			const errorMsg = el.querySelector('.validation-error');
			if (errorMsg) {
				errorMsg.remove();
			}
		});

		// Clear validation summary
		const existingSummary = this.formContainer.querySelector('.validation-summary');
		if (existingSummary) {
			existingSummary.remove();
		}
	}

	/**
	 * Show validation error for specific field
	 */
	private showFieldError(fieldName: string, message: string): void {
		// Find the setting control element for this field
		let targetElement: HTMLElement | null = null;
		
		// Map field names to their setting elements
		const fieldSelectors: Record<string, string> = {
			'template': '[data-field="template"]',
			'outputFolder': '[data-field="outputFolder"]', 
			'filenamePattern': '[data-field="filenamePattern"]',
			'title': '[data-field="title"]',
			'author': '[data-field="author"]',
			'date': '[data-field="date"]'
		};

		// Since we don't have data attributes yet, use a simpler approach
		// Find setting by content or use order-based selection
		const settings = this.formContainer.querySelectorAll('.setting-item-control');
		
		// For now, add error styling to the relevant input
		// This would be improved with proper field identification
		if (settings.length > 0) {
			// Add generic error styling to help user identify issues
			const errorContainer = this.formContainer.createDiv('field-error');
			errorContainer.style.color = 'var(--text-error)';
			errorContainer.style.fontSize = '0.9em';
			errorContainer.style.marginTop = '4px';
			errorContainer.textContent = `${fieldName}: ${message}`;
		}
	}

	/**
	 * Show validation summary with all errors
	 */
	private showValidationSummary(isValid: boolean, errors: string[]): void {
		// Remove existing summary
		const existingSummary = this.formContainer.querySelector('.validation-summary');
		if (existingSummary) {
			existingSummary.remove();
		}

		if (!isValid && errors.length > 0) {
			const summaryContainer = this.formContainer.createDiv('validation-summary');
			summaryContainer.style.backgroundColor = 'var(--background-modifier-error)';
			summaryContainer.style.border = '1px solid var(--background-modifier-error-border)';
			summaryContainer.style.borderRadius = '4px';
			summaryContainer.style.padding = '12px';
			summaryContainer.style.marginTop = '16px';

			const title = summaryContainer.createEl('h4', { 
				text: 'Please fix the following issues:',
				attr: { style: 'color: var(--text-error); margin: 0 0 8px 0;' }
			});

			const errorsList = summaryContainer.createEl('ul', {
				attr: { style: 'margin: 0; padding-left: 20px; color: var(--text-error);' }
			});

			errors.forEach(error => {
				errorsList.createEl('li', { text: error });
			});
		} else if (isValid) {
			// Show success state
			const successContainer = this.formContainer.createDiv('validation-summary');
			successContainer.style.backgroundColor = 'var(--background-modifier-success)';
			successContainer.style.border = '1px solid var(--background-modifier-success-border)';
			successContainer.style.borderRadius = '4px';
			successContainer.style.padding = '8px 12px';
			successContainer.style.marginTop = '16px';

			successContainer.createEl('span', { 
				text: '✓ Configuration is valid and ready for export',
				attr: { style: 'color: var(--text-success);' }
			});

			// Auto-hide success message after 3 seconds
			setTimeout(() => {
				if (successContainer.parentNode) {
					successContainer.remove();
				}
			}, 3000);
		}
	}

	/**
	 * Debounced validation trigger
	 * Prevents excessive validation calls during rapid input changes
	 */
	private debouncedValidation: (() => void) | null = null;
	
	/**
	 * Trigger validation with debouncing
	 */
	private triggerValidation(): void {
		if (this.debouncedValidation) {
			clearTimeout(this.debouncedValidation as any);
		}

		this.debouncedValidation = setTimeout(() => {
			this.validateSettings();
			this.updatePreview();
		}, 300) as any;
	}

	/**
	 * Save current settings to plugin configuration
	 * Placeholder for Task 7.4
	 */
	/**
	 * Save current export settings to plugin configuration
	 * Persists user preferences for future exports
	 */
	private async saveSettings(): Promise<void> {
		try {
			// Update plugin's export defaults with current settings
			if (this.settings.template) {
				this.plugin.settings.exportDefaults.template = this.settings.template;
			}
			
			if (this.settings.format) {
				this.plugin.settings.exportDefaults.format = this.settings.format;
			}
			
			if (this.settings.mode) {
				this.plugin.settings.exportDefaults.mode = this.settings.mode;
			}

			// Update output folder preference
			if (this.settings.outputFolder && this.settings.outputFolder !== this.plugin.settings.outputFolder) {
				this.plugin.settings.outputFolder = this.settings.outputFolder;
			}

			// Save recent export configurations to plugin settings
			const recentConfigs = this.plugin.settings as any;
			if (!recentConfigs.recentExportConfigs) {
				recentConfigs.recentExportConfigs = [];
			}

			// Create a recent config entry
			const recentConfig = {
				timestamp: Date.now(),
				notePath: this.settings.notePath,
				noteTitle: this.settings.noteTitle,
				config: {
					template: this.settings.template,
					format: this.settings.format,
					mode: this.settings.mode,
					outputFolder: this.settings.outputFolder,
					templateVariables: { ...this.settings.templateVariables }
				}
			};

			// Add to recent configs (keep only last 10)
			recentConfigs.recentExportConfigs.unshift(recentConfig);
			if (recentConfigs.recentExportConfigs.length > 10) {
				recentConfigs.recentExportConfigs = recentConfigs.recentExportConfigs.slice(0, 10);
			}

			// Persist to disk
			await this.plugin.saveSettings();

		} catch (error) {
			console.error('Failed to save export settings:', error);
			// Don't block export on settings save failure
		}
	}

	/**
	 * Load previous export configuration for this note
	 * Restores settings from the most recent export of the same note
	 */
	private loadPreviousConfig(): void {
		const recentConfigs = (this.plugin.settings as any).recentExportConfigs;
		if (!recentConfigs || !Array.isArray(recentConfigs)) {
			return;
		}

		// Find most recent config for this specific note
		const previousConfig = recentConfigs.find((config: any) => 
			config.notePath === this.settings.notePath
		);

		if (previousConfig && previousConfig.config) {
			const config = previousConfig.config;

			// Restore configuration
			if (config.template && this.settings.availableTemplates.includes(config.template)) {
				this.settings.template = config.template;
			}

			if (config.format) {
				this.settings.format = config.format;
			}

			if (config.mode) {
				this.settings.mode = config.mode;
			}

			if (config.outputFolder) {
				this.settings.outputFolder = config.outputFolder;
			}

			if (config.templateVariables) {
				this.settings.templateVariables = { ...config.templateVariables };
			}

			// Update form UI to reflect restored settings
			this.updateFormFromSettings();
		}
	}

	/**
	 * Get recent export configurations for quick access
	 */
	private getRecentConfigs(): any[] {
		const recentConfigs = (this.plugin.settings as any).recentExportConfigs;
		return recentConfigs && Array.isArray(recentConfigs) ? recentConfigs : [];
	}

	/**
	 * Update form controls to match current settings
	 * Called after loading previous configuration
	 */
	private updateFormFromSettings(): void {
		// Update template dropdown
		if (this.templateDropdown && this.settings.template) {
			this.templateDropdown.setValue(this.settings.template);
		}

		// Update other form controls
		// This would need to be enhanced with references to all form controls
		// For now, trigger a complete form regeneration
		setTimeout(() => {
			this.updatePreview();
		}, 100);
	}

	/**
	 * Reset settings to plugin defaults
	 */
	private resetToDefaults(): void {
		const defaults = this.plugin.settings.exportDefaults;
		
		this.settings.template = defaults.template;
		this.settings.format = defaults.format;
		this.settings.mode = defaults.mode;
		this.settings.outputFolder = this.plugin.settings.outputFolder;
		this.settings.templateVariables = {
			title: this.settings.noteTitle,
			author: '',
			date: new Date().toLocaleDateString(),
			filenamePattern: '{title}'
		};

		// Update form UI
		this.updateFormFromSettings();
	}

	/**
	 * Export current configuration as JSON for sharing or backup
	 */
	private exportConfiguration(): string {
		const exportData = {
			version: '1.0',
			template: this.settings.template,
			format: this.settings.format,
			mode: this.settings.mode,
			templateVariables: this.settings.templateVariables,
			// Don't include outputFolder (local path) or notePath (specific to this instance)
		};

		return JSON.stringify(exportData, null, 2);
	}

	/**
	 * Import configuration from JSON
	 */
	private importConfiguration(jsonData: string): boolean {
		try {
			const importData = JSON.parse(jsonData);

			// Validate imported data
			if (!importData.version) {
				throw new Error('Invalid configuration format');
			}

			// Apply imported settings
			if (importData.template && this.settings.availableTemplates.includes(importData.template)) {
				this.settings.template = importData.template;
			}

			if (importData.format && Object.values(ExportFormat).includes(importData.format)) {
				this.settings.format = importData.format;
			}

			if (importData.mode && Object.values(ExportMode).includes(importData.mode)) {
				this.settings.mode = importData.mode;
			}

			if (importData.templateVariables) {
				this.settings.templateVariables = { 
					...this.settings.templateVariables, 
					...importData.templateVariables 
				};
			}

			// Update form UI
			this.updateFormFromSettings();
			return true;

		} catch (error) {
			console.error('Failed to import configuration:', error);
			return false;
		}
	}

	/**
	 * Start export progress tracking
	 * Placeholder for Task 7.5
	 */
	/**
	 * Start export progress tracking
	 * Shows progress overlay and hides main form
	 */
	private showProgress(): void {
		// Hide form and show progress
		this.formContainer.style.display = 'none';
		this.previewContainer.style.display = 'none';
		this.progressContainer.style.display = 'block';

		// Clear and setup progress container
		this.progressContainer.empty();
		
		// Progress header
		const header = this.progressContainer.createDiv('progress-header');
		header.style.textAlign = 'center';
		header.style.marginBottom = '20px';
		
		const title = header.createEl('h3', { text: 'Exporting PDF...' });
		const subtitle = header.createEl('p', { 
			text: `Exporting "${this.settings.noteTitle}"`,
			attr: { style: 'color: var(--text-muted); margin: 8px 0;' }
		});

		// Progress indicator container
		const progressIndicator = this.progressContainer.createDiv('progress-indicator');
		progressIndicator.style.marginBottom = '20px';

		// Progress bar
		const progressWrapper = progressIndicator.createDiv('progress-wrapper');
		progressWrapper.style.width = '100%';
		progressWrapper.style.backgroundColor = 'var(--background-modifier-border)';
		progressWrapper.style.borderRadius = '4px';
		progressWrapper.style.height = '12px';
		progressWrapper.style.overflow = 'hidden';

		this.progressBar = progressWrapper.createDiv('progress-bar');
		this.progressBar.style.width = '0%';
		this.progressBar.style.height = '100%';
		this.progressBar.style.backgroundColor = 'var(--interactive-accent)';
		this.progressBar.style.transition = 'width 0.3s ease';

		// Progress text
		this.progressText = progressIndicator.createDiv('progress-text');
		this.progressText.style.textAlign = 'center';
		this.progressText.style.marginTop = '8px';
		this.progressText.style.fontSize = '0.9em';
		this.progressText.style.color = 'var(--text-muted)';
		this.progressText.textContent = 'Initializing export...';

		// Progress percentage
		const progressPercent = progressIndicator.createDiv('progress-percent');
		progressPercent.style.textAlign = 'center';
		progressPercent.style.marginTop = '4px';
		progressPercent.style.fontSize = '1.1em';
		progressPercent.style.fontWeight = 'bold';
		this.progressPercentElement = progressPercent;
		this.progressPercentElement.textContent = '0%';

		// Cancel button
		const cancelContainer = this.progressContainer.createDiv('cancel-container');
		cancelContainer.style.textAlign = 'center';
		cancelContainer.style.marginTop = '20px';

		this.cancelButton = cancelContainer.createEl('button', { 
			text: 'Cancel Export',
			attr: { 
				style: `
					padding: 8px 16px;
					background: var(--interactive-normal);
					border: 1px solid var(--background-modifier-border);
					border-radius: 4px;
					color: var(--text-normal);
					cursor: pointer;
				`
			}
		});

		this.cancelButton.addEventListener('click', () => this.cancelExport());

		// Set initial state
		this.settings.isExporting = true;
		this.settings.canCancel = true;
		this.settings.progressPercent = 0;
		this.settings.currentOperation = 'Initializing export...';
	}

	/**
	 * Update export progress
	 * Placeholder for Task 7.5
	 */
	/**
	 * Update export progress
	 * Updates progress bar, percentage, and current operation text
	 */
	private updateProgress(percent: number, operation: string): void {
		this.settings.progressPercent = Math.max(0, Math.min(100, percent));
		this.settings.currentOperation = operation;

		// Update progress bar
		if (this.progressBar) {
			this.progressBar.style.width = `${this.settings.progressPercent}%`;
		}

		// Update percentage display
		if (this.progressPercentElement) {
			this.progressPercentElement.textContent = `${Math.round(this.settings.progressPercent)}%`;
		}

		// Update operation text
		if (this.progressText) {
			this.progressText.textContent = operation;
		}

		// Disable cancel button in final stages
		if (this.settings.progressPercent > 90) {
			this.settings.canCancel = false;
			if (this.cancelButton) {
				this.cancelButton.disabled = true;
				this.cancelButton.style.opacity = '0.5';
				this.cancelButton.style.cursor = 'not-allowed';
			}
		}

		// Show completion state
		if (this.settings.progressPercent >= 100) {
			this.showCompletionState();
		}
	}

	/**
	 * Hide progress and reset modal state
	 * Placeholder for Task 7.5
	 */
	/**
	 * Hide progress and reset modal state
	 * Returns modal to form view or closes it
	 */
	private hideProgress(): void {
		this.settings.isExporting = false;
		this.settings.progressPercent = 0;
		this.settings.currentOperation = '';
		this.settings.canCancel = false;

		// Reset UI state
		if (this.progressContainer) {
			this.progressContainer.style.display = 'none';
		}

		if (this.formContainer) {
			this.formContainer.style.display = 'block';
		}

		if (this.previewContainer) {
			this.previewContainer.style.display = 'block';
		}

		// Clean up progress elements
		this.progressBar = null;
		this.progressText = null;
		this.progressPercentElement = null;
		this.cancelButton = null;
	}

	/**
	 * Handle export cancellation
	 * Placeholder for Task 7.5
	 */
	/**
	 * Handle export cancellation
	 * Cancels ongoing export and resets modal state
	 */
	private cancelExport(): void {
		if (!this.settings.canCancel) {
			return; // Cannot cancel at this stage
		}

		// Update UI to show cancellation in progress
		if (this.progressText) {
			this.progressText.textContent = 'Cancelling export...';
		}
		
		if (this.cancelButton) {
			this.cancelButton.disabled = true;
			this.cancelButton.textContent = 'Cancelling...';
			this.cancelButton.style.opacity = '0.5';
		}

		// Call cancellation callback if provided
		if (this.onCancel) {
			this.onCancel();
		}

		// Show cancellation feedback
		setTimeout(() => {
			this.showCancellationState();
		}, 1000); // Give time for cleanup
	}

	/**
	 * Show completion state when export is finished
	 */
	private showCompletionState(): void {
		if (this.progressText) {
			this.progressText.textContent = 'Export completed successfully!';
			this.progressText.style.color = 'var(--text-success)';
		}

		if (this.cancelButton) {
			this.cancelButton.style.display = 'none';
		}

		// Add completion actions
		const completionActions = this.progressContainer.createDiv('completion-actions');
		completionActions.style.textAlign = 'center';
		completionActions.style.marginTop = '20px';

		// Success message
		const successMsg = completionActions.createDiv('success-message');
		successMsg.style.padding = '12px';
		successMsg.style.backgroundColor = 'var(--background-modifier-success)';
		successMsg.style.border = '1px solid var(--background-modifier-success-border)';
		successMsg.style.borderRadius = '4px';
		successMsg.style.marginBottom = '16px';
		successMsg.style.color = 'var(--text-success)';
		successMsg.innerHTML = `
			<strong>✓ PDF exported successfully!</strong><br>
			<small>File saved to: ${this.settings.outputFolder}/${this.generatePreviewFilename()}.pdf</small>
		`;

		// Action buttons
		const actionButtons = completionActions.createDiv('action-buttons');
		actionButtons.style.display = 'flex';
		actionButtons.style.gap = '8px';
		actionButtons.style.justifyContent = 'center';

		// Open file button (if supported)
		const openButton = actionButtons.createEl('button', {
			text: 'Open PDF',
			attr: { 
				style: `
					padding: 8px 16px;
					background: var(--interactive-accent);
					border: none;
					border-radius: 4px;
					color: var(--text-on-accent);
					cursor: pointer;
				`
			}
		});

		openButton.addEventListener('click', () => {
			// TODO: Implement file opening logic
			// This would typically use Obsidian's shell.openPath or similar
			this.close();
		});

		// Close button
		const closeButton = actionButtons.createEl('button', {
			text: 'Close',
			attr: { 
				style: `
					padding: 8px 16px;
					background: var(--interactive-normal);
					border: 1px solid var(--background-modifier-border);
					border-radius: 4px;
					color: var(--text-normal);
					cursor: pointer;
				`
			}
		});

		closeButton.addEventListener('click', () => this.close());

		// Auto-close after delay
		setTimeout(() => {
			if (this.isOpen) {
				this.close();
			}
		}, 5000);
	}

	/**
	 * Show cancellation state when export is cancelled
	 */
	private showCancellationState(): void {
		if (this.progressText) {
			this.progressText.textContent = 'Export cancelled';
			this.progressText.style.color = 'var(--text-warning)';
		}

		if (this.progressBar) {
			this.progressBar.style.backgroundColor = 'var(--background-modifier-error)';
		}

		// Add cancellation message
		const cancellationMsg = this.progressContainer.createDiv('cancellation-message');
		cancellationMsg.style.textAlign = 'center';
		cancellationMsg.style.marginTop = '20px';
		cancellationMsg.style.padding = '12px';
		cancellationMsg.style.backgroundColor = 'var(--background-modifier-error)';
		cancellationMsg.style.border = '1px solid var(--background-modifier-error-border)';
		cancellationMsg.style.borderRadius = '4px';
		cancellationMsg.style.color = 'var(--text-error)';
		cancellationMsg.innerHTML = `
			<strong>Export cancelled</strong><br>
			<small>No files were created</small>
		`;

		// Action buttons
		const actionContainer = this.progressContainer.createDiv('cancellation-actions');
		actionContainer.style.textAlign = 'center';
		actionContainer.style.marginTop = '16px';

		const backButton = actionContainer.createEl('button', {
			text: 'Back to Settings',
			attr: { 
				style: `
					padding: 8px 16px;
					background: var(--interactive-normal);
					border: 1px solid var(--background-modifier-border);
					border-radius: 4px;
					color: var(--text-normal);
					cursor: pointer;
					margin-right: 8px;
				`
			}
		});

		backButton.addEventListener('click', () => this.hideProgress());

		const closeButton = actionContainer.createEl('button', {
			text: 'Close',
			attr: { 
				style: `
					padding: 8px 16px;
					background: var(--interactive-normal);
					border: 1px solid var(--background-modifier-border);
					border-radius: 4px;
					color: var(--text-normal);
					cursor: pointer;
				`
			}
		});

		closeButton.addEventListener('click', () => this.close());
	}

	/**
	 * Check if modal is currently open
	 */
	private get isOpen(): boolean {
		return this.containerEl.isConnected;
	}

	/**
	 * Add custom CSS styles for the export modal
	 */
	private addModalStyles(): void {
		const styleId = 'export-config-modal-styles';
		
		// Don't add styles if already present
		if (document.getElementById(styleId)) {
			return;
		}

		const style = document.createElement('style');
		style.id = styleId;
		style.textContent = `
			.export-config-container {
				width: 100%;
				max-width: 100%;
				min-height: 650px;
				max-height: 80vh;
				overflow-y: auto;
				overflow-x: hidden;
				box-sizing: border-box;
			}
			
			.export-section {
				margin-bottom: 24px;
				padding-bottom: 16px;
				border-bottom: 1px solid var(--background-modifier-border-hover);
			}
			
			.export-section:last-child {
				border-bottom: none;
			}
			
			.export-section h3 {
				margin: 0 0 12px 0;
				font-size: 1.1em;
				font-weight: 600;
				color: var(--text-normal);
			}
			
			.export-section h4 {
				margin: 16px 0 8px 0;
				font-size: 1em;
				font-weight: 500;
				color: var(--text-muted);
			}
			
			.export-config-preview {
				background: var(--background-secondary);
				padding: 16px;
				border-radius: 8px;
			}
			
			.export-config-preview h3 {
				margin: 0 0 12px 0;
				font-size: 1em;
				font-weight: 600;
			}
			
			.config-items .config-item {
				margin-bottom: 8px;
				font-size: 0.9em;
				line-height: 1.4;
			}
			
			.variables-list .var-item {
				margin-left: 16px;
				font-size: 0.85em;
				color: var(--text-muted);
			}
			
			.export-actions {
				display: flex;
				gap: 12px;
				justify-content: flex-end;
			}
			
			.progress-indicator {
				padding: 20px;
			}
			
			.progress-wrapper {
				box-shadow: inset 0 1px 3px rgba(0, 0, 0, 0.1);
			}
			
			.field-error {
				background: var(--background-modifier-error);
				padding: 8px 12px;
				border-radius: 4px;
				margin: 8px 0;
				border-left: 3px solid var(--text-error);
			}
			
			.margins-container .setting-item,
			.font-sizes .setting-item {
				border: none;
				padding: 8px 0;
			}
			
			.template-variables .setting-item {
				padding: 6px 0;
			}
			
			.completion-actions .success-message,
			.cancellation-message {
				animation: slideIn 0.3s ease-out;
			}
			
			@keyframes slideIn {
				from {
					opacity: 0;
					transform: translateY(-10px);
				}
				to {
					opacity: 1;
					transform: translateY(0);
				}
			}
			
			.export-config-container button:hover:not(:disabled) {
				opacity: 0.8;
			}
			
			.export-config-container button:disabled {
				cursor: not-allowed;
			}
		`;

		document.head.appendChild(style);
	}

	// Additional properties for progress tracking
	private progressPercentElement: HTMLElement | null = null;

	/**
	 * Submit current configuration for export
	 */
	private async submitExport(): Promise<void> {
		if (!this.validateSettings()) {
			return;
		}

		// Prepare export configuration
		const exportConfig: ExportConfig = {
			template: this.settings.template,
			format: this.settings.format,
			mode: this.settings.mode,
			outputFolder: this.settings.outputFolder,
			templateVariables: this.settings.templateVariables
		};

		try {
			// Save settings for future use
			await this.saveSettings();
			
			// Start export process
			this.settings.isExporting = true;
			this.showProgress();
			
			// Execute export via callback
			await this.onSubmit(exportConfig);
			
			// Success - close modal
			this.close();
		} catch (error) {
			// Handle export errors
			console.error('Export failed:', error);
			this.hideProgress();
			
			// TODO: Show user-friendly error message
		}
	}
}
