/**
 * Executable checking utilities for Obsidian Typst PDF Export plugin
 * Handles path resolution, version detection, and availability checking for external executables
 */

import { DEPENDENCY_CONSTANTS } from './constants';

export interface DependencyInfo {
	name: string;
	version: string | null;
	isAvailable: boolean;
	executablePath: string;
}

/**
 * Utilities for checking executable availability and versions
 */
export class ExecutableChecker {
	
	/**
	 * Build an augmented PATH that includes common system paths and additional paths
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
	 * Build an augmented environment with extended PATH
	 */
	private static getAugmentedEnv(additionalPaths: string[] = []): NodeJS.ProcessEnv {
		return {
			...process.env,
			PATH: this.getAugmentedPath(additionalPaths)
		};
	}

	/**
	 * Try to find an executable using which command
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
	 * Resolve executable path - async version
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
	 * Resolve executable path - sync version
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
	 * Check if a dependency is available and get its version - async version
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
	 * Quick sync check if a dependency is available
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