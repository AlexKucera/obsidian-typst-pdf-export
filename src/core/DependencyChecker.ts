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
	 * Get augmented PATH with common binary locations
	 */
	private static getAugmentedPath(): string {
		const homeDir = process.env.HOME || process.env.USERPROFILE || '';
		const commonPaths = DEPENDENCY_CONSTANTS.COMMON_PATHS.map(p => homeDir + p);
		return `${process.env.PATH}:${commonPaths.join(':')}`;
	}

	/**
	 * Get augmented environment with extended PATH
	 */
	private static getAugmentedEnv(): NodeJS.ProcessEnv {
		return {
			...process.env,
			PATH: this.getAugmentedPath()
		};
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
		const { exec } = require('child_process');
		const { promisify } = require('util');
		const execAsync = promisify(exec);

		try {
			const { stdout } = await execAsync(`${executablePath} ${versionCommand}`, {
				env: this.getAugmentedEnv()
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
	 * Check if a dependency is available (synchronous version for startup)
	 */
	private static checkDependencySync(executablePath: string, versionCommand: string): boolean {
		const { execSync } = require('child_process');
		
		try {
			execSync(`${executablePath} ${versionCommand}`, {
				encoding: 'utf8',
				env: this.getAugmentedEnv()
			});
			return true;
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
		imagemagickPath?: string
	): Promise<DependencyCheckResult> {
		const pandocExec = pandocPath || DEPENDENCY_CONSTANTS.DEFAULT_EXECUTABLES.pandoc;
		const typstExec = typstPath || DEPENDENCY_CONSTANTS.DEFAULT_EXECUTABLES.typst;
		const imagemagickExec = imagemagickPath || DEPENDENCY_CONSTANTS.DEFAULT_EXECUTABLES.imagemagick;

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
		imagemagickPath?: string
	): string[] {
		const pandocExec = pandocPath || DEPENDENCY_CONSTANTS.DEFAULT_EXECUTABLES.pandoc;
		const typstExec = typstPath || DEPENDENCY_CONSTANTS.DEFAULT_EXECUTABLES.typst;
		const imagemagickExec = imagemagickPath || DEPENDENCY_CONSTANTS.DEFAULT_EXECUTABLES.imagemagick;

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