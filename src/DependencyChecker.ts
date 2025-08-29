import { spawn, ChildProcess } from 'child_process';
import { access } from 'fs/promises';
import { join, resolve, dirname } from 'path';
import { Platform } from 'obsidian';

/**
 * Result of a dependency check operation
 */
interface DependencyCheckResult {
	/** Whether the dependency was found and is valid */
	isAvailable: boolean;
	/** Path to the executable (if found) */
	executablePath?: string;
	/** Detected version (if available) */
	version?: string;
	/** Error message if dependency is not available */
	error?: string;
	/** Warning message for issues that don't prevent usage */
	warning?: string;
}

/**
 * Installation guidance for specific platforms and tools
 */
interface InstallationGuide {
	/** Tool name */
	tool: 'pandoc' | 'typst';
	/** Installation instructions by platform */
	instructions: {
		windows: {
			description: string;
			links: string[];
			commands?: string[];
		};
		mac: {
			description: string;
			links: string[];
			commands?: string[];
		};
		linux: {
			description: string;
			links: string[];
			commands?: string[];
		};
	};
	/** Troubleshooting tips */
	troubleshooting: string[];
}

/**
 * Configuration for dependency checking
 */
interface DependencyConfig {
	/** Custom path to executable (empty string means use PATH) */
	customPath: string;
	/** Minimum required version */
	minVersion: string;
	/** Timeout for version checks in milliseconds */
	timeout: number;
}

/**
 * Checks for external tool dependencies (Pandoc and Typst) with cross-platform support
 */
export class DependencyChecker {
	private static readonly DEFAULT_TIMEOUT = 5000; // 5 seconds
	private static readonly PANDOC_MIN_VERSION = '3.0.0';
	private static readonly TYPST_MIN_VERSION = '0.11.0';

	/**
	 * Check if Pandoc is available and meets version requirements
	 */
	async checkPandoc(config: Partial<DependencyConfig> = {}): Promise<DependencyCheckResult> {
		const fullConfig: DependencyConfig = {
			customPath: config.customPath || '',
			minVersion: config.minVersion || DependencyChecker.PANDOC_MIN_VERSION,
			timeout: config.timeout || DependencyChecker.DEFAULT_TIMEOUT
		};

		return this.checkDependency('pandoc', fullConfig);
	}

	/**
	 * Check if Typst is available and meets version requirements
	 */
	async checkTypst(config: Partial<DependencyConfig> = {}): Promise<DependencyCheckResult> {
		const fullConfig: DependencyConfig = {
			customPath: config.customPath || '',
			minVersion: config.minVersion || DependencyChecker.TYPST_MIN_VERSION,
			timeout: config.timeout || DependencyChecker.DEFAULT_TIMEOUT
		};

		return this.checkDependency('typst', fullConfig);
	}

	/**
	 * Check both Pandoc and Typst dependencies
	 */
	async checkAllDependencies(pandocConfig: Partial<DependencyConfig> = {}, typstConfig: Partial<DependencyConfig> = {}): Promise<{
		pandoc: DependencyCheckResult;
		typst: DependencyCheckResult;
		allAvailable: boolean;
	}> {
		const [pandoc, typst] = await Promise.all([
			this.checkPandoc(pandocConfig),
			this.checkTypst(typstConfig)
		]);

		return {
			pandoc,
			typst,
			allAvailable: pandoc.isAvailable && typst.isAvailable
		};
	}

	/**
	 * Core dependency checking logic
	 */
	private async checkDependency(toolName: 'pandoc' | 'typst', config: DependencyConfig): Promise<DependencyCheckResult> {
		try {
			// Step 1: Find the executable
			const executablePath = await this.findExecutable(toolName, config.customPath);
			if (!executablePath) {
				return {
					isAvailable: false,
					error: `${toolName} executable not found. ${this.getInstallationMessage(toolName)}`
				};
			}

			// Step 2: Check version
			const versionResult = await this.checkVersion(executablePath, config.minVersion, config.timeout);
			if (!versionResult.isValid) {
				return {
					isAvailable: false,
					executablePath,
					version: versionResult.version,
					error: versionResult.error || `${toolName} version ${versionResult.version} does not meet minimum requirement ${config.minVersion}`
				};
			}

			// Step 3: Success
			return {
				isAvailable: true,
				executablePath,
				version: versionResult.version,
				warning: versionResult.warning
			};

		} catch (error) {
			return {
				isAvailable: false,
				error: `Error checking ${toolName}: ${error instanceof Error ? error.message : String(error)}`
			};
		}
	}

	/**
	 * Find executable path using custom path or system PATH
	 */
	private async findExecutable(toolName: string, customPath: string): Promise<string | null> {
		// If custom path is provided, validate it
		if (customPath) {
			const resolvedPath = resolve(customPath);
			if (await this.isExecutableFile(resolvedPath)) {
				return resolvedPath;
			}
			return null;
		}

		// Search in system PATH
		return this.findInPath(toolName);
	}

	/**
	 * Search for executable in system PATH
	 */
	private async findInPath(toolName: string): Promise<string | null> {
		const pathEnv = process.env.PATH || '';
		const pathSeparator = Platform.isWin ? ';' : ':';
		const paths = pathEnv.split(pathSeparator);

		// Add common executable extensions on Windows
		const extensions = Platform.isWin ? ['.exe', '.cmd', '.bat'] : [''];
		
		for (const dir of paths) {
			if (!dir.trim()) continue;

			for (const ext of extensions) {
				const fullPath = join(dir, toolName + ext);
				if (await this.isExecutableFile(fullPath)) {
					return fullPath;
				}
			}
		}

		return null;
	}

	/**
	 * Check if a file exists and is executable
	 */
	private async isExecutableFile(filePath: string): Promise<boolean> {
		try {
			await access(filePath);
			return true;
		} catch {
			return false;
		}
	}

	/**
	 * Check version of an executable and validate against minimum requirement
	 */
	private async checkVersion(executablePath: string, minVersion: string, timeout: number): Promise<{
		isValid: boolean;
		version?: string;
		error?: string;
		warning?: string;
	}> {
		try {
			const version = await this.getVersion(executablePath, timeout);
			if (!version) {
				return {
					isValid: false,
					error: 'Could not determine version'
				};
			}

			const isValid = this.compareVersions(version, minVersion) >= 0;
			return {
				isValid,
				version,
				error: isValid ? undefined : `Version ${version} is below required ${minVersion}`,
				warning: isValid ? undefined : this.getUpgradeMessage(executablePath, version, minVersion)
			};

		} catch (error) {
			return {
				isValid: false,
				error: error instanceof Error ? error.message : String(error)
			};
		}
	}

	/**
	 * Get version string from executable
	 */
	private async getVersion(executablePath: string, timeout: number): Promise<string | null> {
		return new Promise((resolve, reject) => {
			const process = spawn(executablePath, ['--version'], {
				stdio: ['ignore', 'pipe', 'pipe']
			});

			let stdout = '';
			let stderr = '';

			const timeoutHandle = setTimeout(() => {
				process.kill();
				reject(new Error(`Version check timed out after ${timeout}ms`));
			}, timeout);

			process.stdout?.on('data', (data) => {
				stdout += data.toString();
			});

			process.stderr?.on('data', (data) => {
				stderr += data.toString();
			});

			process.on('close', (code) => {
				clearTimeout(timeoutHandle);
				
				if (code !== 0) {
					reject(new Error(`Process exited with code ${code}: ${stderr}`));
					return;
				}

				const version = this.extractVersion(stdout);
				resolve(version);
			});

			process.on('error', (error) => {
				clearTimeout(timeoutHandle);
				reject(error);
			});
		});
	}

	/**
	 * Extract version number from version command output
	 */
	private extractVersion(output: string): string | null {
		// Common patterns for version output
		const patterns = [
			/version\s+(\d+\.\d+\.\d+)/i,
			/v?(\d+\.\d+\.\d+)/,
			/(\d+\.\d+\.\d+)/
		];

		for (const pattern of patterns) {
			const match = output.match(pattern);
			if (match) {
				return match[1];
			}
		}

		return null;
	}

	/**
	 * Compare two semantic version strings
	 * Returns: -1 if a < b, 0 if a == b, 1 if a > b
	 */
	private compareVersions(a: string, b: string): number {
		const parseVersion = (version: string) => {
			return version.split('.').map(num => parseInt(num, 10));
		};

		const aParts = parseVersion(a);
		const bParts = parseVersion(b);
		const maxLength = Math.max(aParts.length, bParts.length);

		for (let i = 0; i < maxLength; i++) {
			const aPart = aParts[i] || 0;
			const bPart = bParts[i] || 0;

			if (aPart < bPart) return -1;
			if (aPart > bPart) return 1;
		}

		return 0;
	}

	/**
	 * Get installation instructions for a tool
	 */
	getInstallationGuide(toolName: 'pandoc' | 'typst'): InstallationGuide {
		if (toolName === 'pandoc') {
			return {
				tool: 'pandoc',
				instructions: {
					windows: {
						description: 'Install Pandoc using the Windows installer or package manager',
						links: [
							'https://pandoc.org/installing.html',
							'https://github.com/jgm/pandoc/releases'
						],
						commands: [
							'winget install --id JohnMacFarlane.Pandoc',
							'choco install pandoc'
						]
					},
					mac: {
						description: 'Install Pandoc using Homebrew or the macOS installer',
						links: [
							'https://pandoc.org/installing.html',
							'https://github.com/jgm/pandoc/releases'
						],
						commands: [
							'brew install pandoc',
							'sudo port install pandoc'
						]
					},
					linux: {
						description: 'Install Pandoc using your distribution\'s package manager',
						links: [
							'https://pandoc.org/installing.html',
							'https://github.com/jgm/pandoc/releases'
						],
						commands: [
							'sudo apt install pandoc  # Ubuntu/Debian',
							'sudo dnf install pandoc  # Fedora',
							'sudo pacman -S pandoc    # Arch Linux'
						]
					}
				},
				troubleshooting: [
					'Ensure Pandoc is in your system PATH',
					'Restart Obsidian after installation',
					'For manual installations, specify the full path in plugin settings',
					'Check that you have the latest version from the official website'
				]
			};
		} else {
			return {
				tool: 'typst',
				instructions: {
					windows: {
						description: 'Install Typst using the Windows installer or package manager',
						links: [
							'https://github.com/typst/typst#installation',
							'https://github.com/typst/typst/releases'
						],
						commands: [
							'winget install --id Typst.Typst',
							'cargo install --locked typst-cli'
						]
					},
					mac: {
						description: 'Install Typst using Homebrew or Rust',
						links: [
							'https://github.com/typst/typst#installation',
							'https://github.com/typst/typst/releases'
						],
						commands: [
							'brew install typst',
							'cargo install --locked typst-cli'
						]
					},
					linux: {
						description: 'Install Typst using your package manager or Rust',
						links: [
							'https://github.com/typst/typst#installation',
							'https://github.com/typst/typst/releases'
						],
						commands: [
							'cargo install --locked typst-cli',
							'Download from releases page for your distribution'
						]
					}
				},
				troubleshooting: [
					'Ensure Typst is in your system PATH',
					'Restart Obsidian after installation',
					'For manual installations, specify the full path in plugin settings',
					'Install Rust first if using cargo install method',
					'Check that you have version 0.11.0 or higher'
				]
			};
		}
	}

	/**
	 * Get a brief installation message for error display
	 */
	private getInstallationMessage(toolName: 'pandoc' | 'typst'): string {
		if (toolName === 'pandoc') {
			return 'Install from https://pandoc.org/installing.html or specify custom path in settings.';
		} else {
			return 'Install from https://github.com/typst/typst#installation or specify custom path in settings.';
		}
	}

	/**
	 * Get upgrade message for outdated versions
	 */
	private getUpgradeMessage(executablePath: string, currentVersion: string, requiredVersion: string): string {
		return `Found ${executablePath} v${currentVersion}, but v${requiredVersion}+ is required. Please upgrade.`;
	}

	/**
	 * Get current platform information
	 */
	getCurrentPlatform(): 'windows' | 'mac' | 'linux' {
		if (Platform.isWin) return 'windows';
		if (Platform.isMacOS) return 'mac';
		return 'linux';
	}

	/**
	 * Format installation guide as user-friendly text
	 */
	formatInstallationGuide(guide: InstallationGuide): string {
		const platform = this.getCurrentPlatform();
		const platformInstructions = guide.instructions[platform];

		let text = `## Installing ${guide.tool.charAt(0).toUpperCase() + guide.tool.slice(1)}\n\n`;
		text += `${platformInstructions.description}\n\n`;

		if (platformInstructions.commands && platformInstructions.commands.length > 0) {
			text += '**Installation commands:**\n';
			platformInstructions.commands.forEach(cmd => {
				text += `\`${cmd}\`\n`;
			});
			text += '\n';
		}

		text += '**Useful links:**\n';
		platformInstructions.links.forEach(link => {
			text += `- ${link}\n`;
		});
		text += '\n';

		if (guide.troubleshooting.length > 0) {
			text += '**Troubleshooting:**\n';
			guide.troubleshooting.forEach(tip => {
				text += `- ${tip}\n`;
			});
		}

		return text;
	}
}