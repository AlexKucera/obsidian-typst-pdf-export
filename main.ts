import { App, Notice, Plugin, PluginSettingTab, Setting, Modal, MarkdownRenderer } from 'obsidian';
import { DependencyChecker } from './src/DependencyChecker';
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

		// Set PDF engine to Typst
		args.push('--pdf-engine=typst');

		// Add template if specified
		if (this.pandocOptions.template) {
			args.push('--template', this.pandocOptions.template);
		}

		// Add variables
		if (this.pandocOptions.variables) {
			for (const [key, value] of Object.entries(this.pandocOptions.variables)) {
				args.push('-V', `${key}=${value}`);
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

			progressCallback?.('Starting Pandoc process...', 40);

			// Spawn pandoc process
			const pandocProcess: ChildProcess = spawn(pandocPath, args, {
				stdio: ['pipe', 'pipe', 'pipe'],
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
		preserveFolderStructure: true
	}
}

export default class obsidianTypstPDFExport extends Plugin {
	settings: obsidianTypstPDFExportSettings;
	dependencyChecker: DependencyChecker;

	async onload() {
		await this.loadSettings();

		// Initialize dependency checker
		this.dependencyChecker = new DependencyChecker();

		// Check dependencies on startup (non-blocking)
		this.checkDependenciesAsync();

		// Add ribbon icon for quick export access
		this.addRibbonIcon('file-text', 'Export to PDF with Typst', () => {
			this.handleExportWithDependencyCheck();
		});

		// Add basic export command
		this.addCommand({
			id: 'export-current-note',
			name: 'Export current note to Typst PDF',
			callback: () => {
				this.handleExportWithDependencyCheck();
			}
		});

		// Add dependency check command
		this.addCommand({
			id: 'check-dependencies',
			name: 'Check Pandoc and Typst dependencies',
			callback: () => {
				this.showDependencyStatus();
			}
		});

		// This adds a settings tab so the user can configure various aspects of the plugin
		this.addSettingTab(new TypstPDFExportSettingTab(this.app, this));
	}

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
	 * Handle export with dependency checking
	 */
	private async handleExportWithDependencyCheck(): Promise<void> {
		const result = await this.dependencyChecker.checkAllDependencies(
			{ customPath: this.settings.pandocPath },
			{ customPath: this.settings.typstPath }
		);

		if (!result.allAvailable) {
			this.showDependencyErrorDialog(result);
			return;
		}

		// Dependencies are available, proceed with export
		new Notice('Typst PDF Export: Dependencies verified! Export functionality will be implemented in future versions.');
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

		containerEl.createEl('h2', {text: 'Typst PDF Export Settings'});

		// Dependency Status Section
		new Setting(containerEl)
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
			.setHeading();

		new Setting(containerEl)
			.setName('External Tools')
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
				}));

		// Export Defaults Section
		new Setting(containerEl)
			.setHeading();

		new Setting(containerEl)
			.setName('Export Defaults')
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
			.setHeading();

		new Setting(containerEl)
			.setName('Typography')
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
			.setHeading();

		new Setting(containerEl)
			.setName('Page Setup')
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

		// Behavior Section
		new Setting(containerEl)
			.setHeading();

		new Setting(containerEl)
			.setName('Behavior')
			.setDesc('Plugin behavior and automation settings');

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
	}
}
