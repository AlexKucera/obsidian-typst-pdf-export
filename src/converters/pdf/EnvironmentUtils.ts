/**
 * Environment utilities for setting up CLI tool execution environment.
 * Handles PATH augmentation and environment variable setup for external tools.
 */

import type { obsidianTypstPDFExportSettings } from '../../core/settings';

export interface EnvironmentSetupOptions {
	/** Additional paths to include in PATH */
	additionalPaths?: string[];
	/** Base environment to extend */
	baseEnvironment?: NodeJS.ProcessEnv;
}

export class EnvironmentUtils {
	/**
	 * Get augmented environment with extended PATH for CLI tool execution.
	 * Ensures Node.js and other common tool paths are available.
	 * @param settings Plugin settings containing additional paths
	 * @param options Additional environment setup options
	 * @returns Augmented environment with extended PATH
	 */
	public static getAugmentedEnvironment(
		settings?: obsidianTypstPDFExportSettings,
		options: EnvironmentSetupOptions = {}
	): NodeJS.ProcessEnv {
		// Common tool paths where CLI tools might be installed
		const commonToolPaths = [
			'/opt/homebrew/bin',        // Homebrew on Apple Silicon
			'/usr/local/bin',           // Homebrew on Intel Mac, standard Unix tools
			'/usr/bin',                 // System binaries
			'/bin',                     // Core system binaries
			'/usr/local/texlive/bin',   // TeX Live installation
			'/Library/TeX/texbin',      // MacTeX installation
			...(options.additionalPaths || [])
		];

		// Get base environment
		const baseEnv = options.baseEnvironment || process.env;
		
		// Build augmented PATH
		const existingPath = baseEnv.PATH || '';
		const augmentedPath = [
			...commonToolPaths,
			existingPath
		].filter(Boolean).join(':');

		// Create augmented environment
		const augmentedEnv = {
			...baseEnv,
			PATH: augmentedPath,
			// Ensure locale is set for proper tool operation
			LC_ALL: baseEnv.LC_ALL || 'en_US.UTF-8',
			LANG: baseEnv.LANG || 'en_US.UTF-8'
		};

		// Add any custom environment variables from settings if available
		if (settings?.customEnvironmentVariables) {
			Object.assign(augmentedEnv, settings.customEnvironmentVariables);
		}

		return augmentedEnv;
	}

	/**
	 * Get common Node.js installation paths.
	 * @returns Array of common Node.js binary paths
	 */
	private static getNodePaths(): string[] {
		return [
			'/usr/local/bin',     // Common Node.js installation
			'/opt/homebrew/bin',  // Homebrew on macOS
			'/usr/bin',           // System Node.js
			'/usr/local/node/bin' // Alternative Node.js location
		];
	}

	/**
	 * Merge multiple PATH variables into a single PATH string.
	 * @param paths Array of path strings to merge
	 * @returns Merged PATH string
	 */
	private static mergePathVariables(paths: (string | undefined)[]): string {
		return paths
			.filter(Boolean) // Remove undefined/empty paths
			.join(':');
	}

	/**
	 * Create environment for executing CLI commands with timeout.
	 * @param settings Plugin settings
	 * @param timeout Command timeout in milliseconds
	 * @returns Environment configuration object
	 */
	public static createCliEnvironment(settings?: obsidianTypstPDFExportSettings, timeout?: number) {
		const env = this.getAugmentedEnvironment(settings);
		
		return {
			env,
			timeout: timeout || 60000, // Default 60 second timeout
			stdio: ['pipe', 'pipe', 'pipe'] as const,
			shell: false // Use direct process spawning for better control
		};
	}
}