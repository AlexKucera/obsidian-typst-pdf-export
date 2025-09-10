/**
 * Environment utilities for setting up CLI tool execution environment.
 * Handles PATH augmentation and environment variable setup for external tools.
 */

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
		settings?: any,
		options: EnvironmentSetupOptions = {}
	): NodeJS.ProcessEnv {
		// Set environment variables to ensure node can be found
		// Use configured additional paths or fall back to defaults
		const additionalPaths = options.additionalPaths || 
			settings?.executablePaths?.additionalPaths || 
			['/opt/homebrew/bin', '/usr/local/bin', '/usr/bin'];
		
		// Ensure Node.js paths are included for pdf2img execution
		const nodePaths = this.getNodePaths();
		
		const env = {
			...(options.baseEnvironment || process.env),
			PATH: this.mergePathVariables([
				process.env.PATH,
				...nodePaths,
				...additionalPaths
			])
		};

		return env;
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
	public static createCliEnvironment(settings?: any, timeout?: number) {
		const env = this.getAugmentedEnvironment(settings);
		
		return {
			env,
			timeout: timeout || 30000, // 30 second default timeout
			stdio: ['pipe', 'pipe', 'pipe'] as const
		};
	}
}