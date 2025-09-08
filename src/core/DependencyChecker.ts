/**
 * Dependency checking utilities for Obsidian Typst PDF Export plugin
 */

import { DEPENDENCY_CONSTANTS } from './constants';

export interface DependencyInfo {
	name: string;
	version: string | null;
	isAvailable: boolean;
	executablePath: string;
}

export interface DependencyCheckResult {
	pandoc: DependencyInfo;
	typst: DependencyInfo;
	imagemagick: DependencyInfo;
	allAvailable: boolean;
	missingDependencies: string[];
}

export class DependencyChecker {
	/**
	 * Get augmented PATH with common binary locations and additional paths
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
	 * Get augmented environment with extended PATH
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
		console.log(`[DependencyChecker] findExecutableWithWhich: searching for "${executableName}"`);
		const { spawn } = require('child_process');
		
		try {
			const stdout = await new Promise<string>((resolve, reject) => {
				const env = this.getAugmentedEnv(additionalPaths);
				console.log(`[DependencyChecker] findExecutableWithWhich: using PATH="${env.PATH}"`);
				
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
					console.log(`[DependencyChecker] which ${executableName} exited with code ${code}, stdout: "${output.trim()}", stderr: "${error.trim()}"`);
					if (code === 0) {
						resolve(output);
					} else {
						reject(new Error(`which command failed with code ${code}: ${error}`));
					}
				});
				
				whichProcess.on('error', (err: Error) => {
					console.log(`[DependencyChecker] which ${executableName} spawn error:`, err.message);
					reject(new Error(`Failed to spawn which process: ${err.message}`));
				});
			});
			
			const foundPath = stdout.trim();
			console.log(`[DependencyChecker] findExecutableWithWhich result: "${foundPath}"`);
			return foundPath || null;
		} catch (error) {
			console.log(`[DependencyChecker] findExecutableWithWhich caught error:`, error.message);
			return null;
		}
	}

	/**
	 * Resolve the actual executable path, handling empty/undefined settings
	 */
	private static async resolveExecutablePath(userPath: string | undefined, defaultName: string, additionalPaths: string[] = []): Promise<string> {
		console.log(`[DependencyChecker] ASYNC Resolving path for ${defaultName}: userPath="${userPath}"`);
		
		// If user provided a full path (contains /), use it as-is
		if (userPath && userPath.trim() !== '' && userPath.includes('/')) {
			console.log(`[DependencyChecker] ASYNC Using user-provided full path: ${userPath}`);
			return userPath;
		}
		
		// If user provided just an executable name or empty path, resolve it
		const searchName = (userPath && userPath.trim() !== '') ? userPath.trim() : defaultName;
		console.log(`[DependencyChecker] ASYNC Searching for: ${searchName}`);
		
		// Try to find the executable using which command
		const foundPath = await this.findExecutableWithWhich(searchName, additionalPaths);
		if (foundPath) {
			console.log(`[DependencyChecker] ASYNC Found via which: ${foundPath}`);
			return foundPath;
		}
		
		// Fall back to the search name (will be found via PATH if available)
		console.log(`[DependencyChecker] ASYNC Falling back to search name: ${searchName}`);
		return searchName;
	}

	/**
	 * Check if a dependency is available and get its version
	 */
	private static async checkDependency(
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
	} catch (error) {
		return {
			name,
			version: null,
			isAvailable: false,
			executablePath
		};
	}
}

	/**
	 * Synchronous version of resolving executable path
	 */
	private static resolveExecutablePathSync(userPath: string | undefined, defaultName: string, additionalPaths: string[] = []): string {
		console.log(`[DependencyChecker] SYNC Resolving path for ${defaultName}: userPath="${userPath}"`);
		
		// If user provided a full path (contains /), use it as-is
		if (userPath && userPath.trim() !== '' && userPath.includes('/')) {
			console.log(`[DependencyChecker] SYNC Using user-provided full path: ${userPath}`);
			return userPath;
		}
		
		// If user provided just an executable name or empty path, resolve it
		const searchName = (userPath && userPath.trim() !== '') ? userPath.trim() : defaultName;
		console.log(`[DependencyChecker] SYNC Searching for: ${searchName}`);
		
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
					console.log(`[DependencyChecker] SYNC Found via which: ${foundPath}`);
					return foundPath;
				}
			}
		} catch {
			// Ignore errors from which command
		}
		
		// Fall back to the search name (will be found via PATH if available)
		console.log(`[DependencyChecker] SYNC Falling back to search name: ${searchName}`);
		return searchName;
	}

	/**
	 * Check if a dependency is available (synchronous version for startup)
	 */
	private static checkDependencySync(executablePath: string, versionCommand: string): boolean {
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

	/**
	 * Comprehensive dependency check (async) - returns detailed information
	 */
	public static async checkAllDependencies(
		pandocPath?: string,
		typstPath?: string,
		imagemagickPath?: string,
		additionalPaths: string[] = []
	): Promise<DependencyCheckResult> {
		console.log(`[DependencyChecker] checkAllDependencies called with:`, { pandocPath, typstPath, imagemagickPath, additionalPaths });
		
		// Resolve actual executable paths, handling empty settings
		const [pandocExec, typstExec, imagemagickExec] = await Promise.all([
			this.resolveExecutablePath(pandocPath, DEPENDENCY_CONSTANTS.DEFAULT_EXECUTABLES.pandoc, additionalPaths),
			this.resolveExecutablePath(typstPath, DEPENDENCY_CONSTANTS.DEFAULT_EXECUTABLES.typst, additionalPaths),
			this.resolveExecutablePath(imagemagickPath, DEPENDENCY_CONSTANTS.DEFAULT_EXECUTABLES.imagemagick, additionalPaths)
		]);
		
		console.log(`[DependencyChecker] Resolved paths:`, { pandocExec, typstExec, imagemagickExec });

		const [pandocInfo, typstInfo, imagemagickInfo] = await Promise.all([
			this.checkDependency('Pandoc', pandocExec, '--version', /pandoc\s+([\d.]+)/),
			this.checkDependency('Typst', typstExec, '--version', /typst\s+([\d.]+)/),
			this.checkDependency('ImageMagick', imagemagickExec, '--version', /ImageMagick\s+([\d.-]+)/)
		]);

		const missingDependencies = [pandocInfo, typstInfo, imagemagickInfo]
			.filter(dep => !dep.isAvailable)
			.map(dep => dep.name);

		return {
			pandoc: pandocInfo,
			typst: typstInfo,
			imagemagick: imagemagickInfo,
			allAvailable: missingDependencies.length === 0,
			missingDependencies
		};
	}

	/**
	 * Quick dependency check (synchronous) - returns list of missing dependencies
	 */
	public static checkDependenciesSync(
		pandocPath?: string,
		typstPath?: string,
		imagemagickPath?: string,
		additionalPaths: string[] = []
	): string[] {
		console.log(`[DependencyChecker] checkDependenciesSync called with:`, { pandocPath, typstPath, imagemagickPath, additionalPaths });
		
		// Resolve actual executable paths, handling empty settings
		const pandocExec = this.resolveExecutablePathSync(pandocPath, DEPENDENCY_CONSTANTS.DEFAULT_EXECUTABLES.pandoc, additionalPaths);
		const typstExec = this.resolveExecutablePathSync(typstPath, DEPENDENCY_CONSTANTS.DEFAULT_EXECUTABLES.typst, additionalPaths);
		const imagemagickExec = this.resolveExecutablePathSync(imagemagickPath, DEPENDENCY_CONSTANTS.DEFAULT_EXECUTABLES.imagemagick, additionalPaths);
		
		console.log(`[DependencyChecker] Resolved paths SYNC:`, { pandocExec, typstExec, imagemagickExec });

		const missingDeps: string[] = [];

		if (!this.checkDependencySync(pandocExec, '--version')) {
			missingDeps.push('Pandoc');
		}
		if (!this.checkDependencySync(typstExec, '--version')) {
			missingDeps.push('Typst');
		}
		if (!this.checkDependencySync(imagemagickExec, '--version')) {
			missingDeps.push('ImageMagick');
		}

		return missingDeps;
	}
}