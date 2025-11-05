/**
 * Executable checking utilities for Obsidian Typst PDF Export plugin.
 *
 * This module provides comprehensive utilities for checking external executable
 * availability and versions. It handles:
 * - Path resolution with support for system PATH and additional paths
 * - Version detection using configurable regex patterns
 * - Both async and sync operations for different use cases
 * - Cross-platform path handling (Unix and Windows)
 */

import { DEPENDENCY_CONSTANTS } from './constants';

/**
 * Information about a checked dependency executable.
 *
 * @property name - Human-readable name of the dependency (e.g., "Pandoc")
 * @property version - Detected version string, or null if unavailable
 * @property isAvailable - Whether the executable was found and executed successfully
 * @property executablePath - The resolved path to the executable
 */
export interface DependencyInfo {
	name: string;
	version: string | null;
	isAvailable: boolean;
	executablePath: string;
}

/**
 * Utilities for checking executable availability and versions.
 *
 * This class provides static methods for:
 * - Resolving executable paths from user input or system PATH
 * - Augmenting PATH with common system directories
 * - Checking if executables are available
 * - Detecting executable versions using regex patterns
 *
 * All methods support additional search paths to extend the default system PATH,
 * ensuring executables can be found in non-standard locations.
 *
 * @example
 * ```typescript
 * // Resolve path to pandoc executable
 * const pandocPath = await ExecutableChecker.resolveExecutablePath(
 *   settings.pandocPath,
 *   'pandoc',
 *   settings.additionalPaths
 * );
 *
 * // Check if pandoc is available and get version
 * const info = await ExecutableChecker.checkDependency(
 *   'Pandoc',
 *   pandocPath,
 *   '--version',
 *   /pandoc (\d+\.\d+(?:\.\d+)?)/
 * );
 *
 * if (info.isAvailable) {
 *   console.log(`Pandoc ${info.version} found at ${info.executablePath}`);
 * }
 * ```
 */
export class ExecutableChecker {
	
	/**
	 * Builds an augmented PATH string that includes common system paths and additional paths.
	 *
	 * This method combines the current process PATH with:
	 * 1. Home-relative paths (e.g., ~/.local/bin, ~/.cargo/bin)
	 * 2. Common absolute paths (e.g., /usr/local/bin, /opt/homebrew/bin)
	 * 3. User-provided additional paths
	 *
	 * The resulting PATH helps find executables in non-standard locations that
	 * might not be in the user's shell PATH when running from Obsidian.
	 *
	 * @param additionalPaths - Optional array of additional paths to include
	 * @returns The augmented PATH string with all paths separated by colons
	 * @private
	 */
	private static getAugmentedPath(additionalPaths: string[] = []): string {
		const homeDir = process.env.HOME || process.env.USERPROFILE || '';
		
		// Build default system paths - always included regardless of user settings
		const homeRelativePaths = DEPENDENCY_CONSTANTS.COMMON_PATHS.HOME_RELATIVE.map(p => homeDir + p);
		const absolutePaths = DEPENDENCY_CONSTANTS.COMMON_PATHS.ABSOLUTE;
		const defaultSystemPaths = [...homeRelativePaths, ...absolutePaths];
		
		// Combine default system paths with user-provided additional paths
		const allAdditionalPaths = [...defaultSystemPaths, ...additionalPaths];
		
		return `${process.env.PATH}:${allAdditionalPaths.join(':')}`;
	}

	/**
	 * Builds an augmented environment object with extended PATH.
	 *
	 * Creates a new environment object that inherits all current process environment
	 * variables but with an augmented PATH that includes common system directories
	 * and any additional paths specified.
	 *
	 * @param additionalPaths - Optional array of additional paths to include in PATH
	 * @returns Environment object suitable for child_process spawn/exec
	 * @private
	 */
	private static getAugmentedEnv(additionalPaths: string[] = []): NodeJS.ProcessEnv {
		return {
			...process.env,
			PATH: this.getAugmentedPath(additionalPaths)
		};
	}

	/**
	 * Attempts to find an executable's full path using the `which` command.
	 *
	 * This method spawns a `which` subprocess with an augmented PATH to locate
	 * the executable. It's more reliable than simple PATH searches as it uses
	 * the system's own executable resolution logic.
	 *
	 * @param executableName - Name of the executable to find (e.g., 'pandoc')
	 * @param additionalPaths - Optional additional paths to search
	 * @returns The full path to the executable, or null if not found
	 * @private
	 *
	 * @example
	 * ```typescript
	 * const pandocPath = await findExecutableWithWhich('pandoc', ['/opt/local/bin']);
	 * // Returns: '/usr/local/bin/pandoc' or null
	 * ```
	 */
	private static async findExecutableWithWhich(executableName: string, additionalPaths: string[] = []): Promise<string | null> {
		const { spawn } = require('child_process');
		
		try {
			const stdout = await new Promise<string>((resolve, reject) => {
				const env = this.getAugmentedEnv(additionalPaths);
				
				const whichProcess = spawn('which', [executableName], {
					stdio: ['pipe', 'pipe', 'pipe'],
					env: env
				});
				
				let output = '';
				let error = '';
				
				whichProcess.stdout?.on('data', (data: Buffer) => {
					output += data.toString();
				});
				
				whichProcess.stderr?.on('data', (data: Buffer) => {
					error += data.toString();
				});
				
				whichProcess.on('close', (code: number | null) => {
					if (code === 0) {
						resolve(output);
					} else {
						reject(new Error(`which command failed with code ${code}: ${error}`));
					}
				});
				
				whichProcess.on('error', (err: Error) => {
					reject(new Error(`Failed to spawn which process: ${err.message}`));
				});
			});
			
			const foundPath = stdout.trim();
			return foundPath || null;
		} catch {
			return null;
		}
	}

	/**
	 * Resolves an executable path from user input or system PATH (async version).
	 *
	 * Resolution logic:
	 * 1. If userPath contains a '/', treat it as an absolute/relative path and use as-is
	 * 2. If userPath is just a name or empty, search for the executable using `which`
	 * 3. If `which` fails, fall back to the executable name (relies on runtime PATH)
	 *
	 * This method is useful for allowing users to specify either full paths or just
	 * executable names in plugin settings.
	 *
	 * @param userPath - User-provided path or executable name (can be undefined/empty)
	 * @param defaultName - Default executable name to use if userPath is empty
	 * @param additionalPaths - Additional directories to search for the executable
	 * @returns Resolved path to use for spawning the executable
	 *
	 * @example
	 * ```typescript
	 * // User provided full path
	 * const path1 = await resolveExecutablePath('/usr/local/bin/pandoc', 'pandoc');
	 * // Returns: '/usr/local/bin/pandoc'
	 *
	 * // User provided just name
	 * const path2 = await resolveExecutablePath('pandoc', 'pandoc');
	 * // Returns: '/usr/bin/pandoc' (found via which)
	 *
	 * // User provided nothing
	 * const path3 = await resolveExecutablePath('', 'typst', ['/opt/bin']);
	 * // Returns: '/opt/bin/typst' (found via which with additional path)
	 * ```
	 */
	public static async resolveExecutablePath(userPath: string | undefined, defaultName: string, additionalPaths: string[] = []): Promise<string> {
		// If user provided a full path (contains /), use it as-is
		if (userPath && userPath.trim() !== '' && userPath.includes('/')) {
			return userPath;
		}
		
		// If user provided just an executable name or empty path, resolve it
		const searchName = (userPath && userPath.trim() !== '') ? userPath.trim() : defaultName;
		
		// Try to find the executable using which command
		const foundPath = await this.findExecutableWithWhich(searchName, additionalPaths);
		if (foundPath) {
			return foundPath;
		}
		
		// Fall back to the search name (will be found via PATH if available)
		return searchName;
	}

	/**
	 * Resolves an executable path from user input or system PATH (synchronous version).
	 *
	 * This is the synchronous counterpart to `resolveExecutablePath`. Use this when
	 * async operations are not possible (e.g., in constructors or sync initialization).
	 * The resolution logic is identical to the async version.
	 *
	 * @param userPath - User-provided path or executable name (can be undefined/empty)
	 * @param defaultName - Default executable name to use if userPath is empty
	 * @param additionalPaths - Additional directories to search for the executable
	 * @returns Resolved path to use for spawning the executable
	 *
	 * @see {@link resolveExecutablePath} for detailed resolution logic and examples
	 */
	public static resolveExecutablePathSync(userPath: string | undefined, defaultName: string, additionalPaths: string[] = []): string {
		// If user provided a full path (contains /), use it as-is
		if (userPath && userPath.trim() !== '' && userPath.includes('/')) {
			return userPath;
		}
		
		// If user provided just an executable name or empty path, resolve it
		const searchName = (userPath && userPath.trim() !== '') ? userPath.trim() : defaultName;
		
		// Try to find the executable using which command synchronously
		const { spawnSync } = require('child_process');
		try {
			const result = spawnSync('which', [searchName], {
				encoding: 'utf8',
				env: this.getAugmentedEnv(additionalPaths)
			});
			
			if (result.status === 0 && result.stdout) {
				const foundPath = result.stdout.trim();
				if (foundPath) {
					return foundPath;
				}
			}
		} catch {
			// Ignore errors from which command
		}
		
		// Fall back to the search name (will be found via PATH if available)
		return searchName;
	}

	/**
	 * Checks if a dependency executable is available and extracts its version (async version).
	 *
	 * This method:
	 * 1. Spawns the executable with the version command (e.g., '--version')
	 * 2. Captures stdout and parses version using the provided regex
	 * 3. Returns comprehensive dependency information
	 *
	 * Security: Uses spawn instead of exec to prevent command injection. Arguments
	 * are passed separately from the command.
	 *
	 * @param name - Human-readable name for the dependency (e.g., "Pandoc")
	 * @param executablePath - Path to the executable to check
	 * @param versionCommand - Command argument for version (e.g., '--version')
	 * @param versionRegex - Regex with capture group for version number
	 * @returns DependencyInfo object with availability and version information
	 *
	 * @example
	 * ```typescript
	 * const info = await ExecutableChecker.checkDependency(
	 *   'Pandoc',
	 *   '/usr/bin/pandoc',
	 *   '--version',
	 *   /pandoc (\d+\.\d+(?:\.\d+)?)/
	 * );
	 *
	 * if (info.isAvailable) {
	 *   console.log(`Found ${info.name} version ${info.version}`);
	 * } else {
	 *   console.error(`${info.name} not available at ${info.executablePath}`);
	 * }
	 * ```
	 */
	public static async checkDependency(
		name: string,
		executablePath: string,
		versionCommand: string,
		versionRegex: RegExp
	): Promise<DependencyInfo> {
		const { spawn } = require('child_process');

		try {
			// Use spawn instead of exec for security - arguments passed separately
			const stdout = await new Promise<string>((resolve, reject) => {
				const checkProcess = spawn(executablePath, versionCommand.split(' '), {
					stdio: ['pipe', 'pipe', 'pipe'],
					env: this.getAugmentedEnv()
				});
				
				let output = '';
				let error = '';
				
				checkProcess.stdout?.on('data', (data: Buffer) => {
					output += data.toString();
				});
				
				checkProcess.stderr?.on('data', (data: Buffer) => {
					error += data.toString();
				});
				
				checkProcess.on('close', (code: number | null) => {
					if (code === 0) {
						resolve(output);
					} else {
						reject(new Error(`Command failed with code ${code}: ${error}`));
					}
				});
				
				checkProcess.on('error', (err: Error) => {
					reject(new Error(`Failed to spawn process: ${err.message}`));
				});
			});
			
			const match = stdout.match(versionRegex);
			const version = match ? match[1] : null;
			
			return {
				name,
				version,
				isAvailable: true,
				executablePath
			};
		} catch {
			return {
				name,
				version: null,
				isAvailable: false,
				executablePath
			};
		}
	}

	/**
	 * Performs a quick synchronous check if a dependency is available.
	 *
	 * This is a simplified version of `checkDependency` that only checks if the
	 * executable can be run successfully (exit code 0), without parsing version
	 * information. Useful for fast availability checks during initialization.
	 *
	 * @param executablePath - Path to the executable to check
	 * @param versionCommand - Command argument to test (e.g., '--version')
	 * @returns True if the executable runs successfully, false otherwise
	 *
	 * @example
	 * ```typescript
	 * const pandocAvailable = ExecutableChecker.checkDependencySync('/usr/bin/pandoc', '--version');
	 * if (!pandocAvailable) {
	 *   console.error('Pandoc not available');
	 * }
	 * ```
	 */
	public static checkDependencySync(executablePath: string, versionCommand: string): boolean {
		const { spawnSync } = require('child_process');
		
		try {
			const result = spawnSync(executablePath, versionCommand.split(' '), {
				encoding: 'utf8',
				env: this.getAugmentedEnv()
			});
			return result.status === 0;
		} catch {
			return false;
		}
	}
}