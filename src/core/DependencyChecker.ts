/**
 * Dependency checking utilities for Obsidian Typst PDF Export plugin
 */

import { Notice } from 'obsidian';
import { DEPENDENCY_CONSTANTS } from './constants';
import { ExportErrorHandler } from './ExportErrorHandler';
import { ExecutableChecker, DependencyInfo } from './ExecutableChecker';

export interface DependencyCheckResult {
	pandoc: DependencyInfo;
	typst: DependencyInfo;
	imagemagick: DependencyInfo;
	allAvailable: boolean;
	missingDependencies: string[];
}

export class DependencyChecker {







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
			ExecutableChecker.resolveExecutablePath(pandocPath, DEPENDENCY_CONSTANTS.DEFAULT_EXECUTABLES.pandoc, additionalPaths),
			ExecutableChecker.resolveExecutablePath(typstPath, DEPENDENCY_CONSTANTS.DEFAULT_EXECUTABLES.typst, additionalPaths),
			ExecutableChecker.resolveExecutablePath(imagemagickPath, DEPENDENCY_CONSTANTS.DEFAULT_EXECUTABLES.imagemagick, additionalPaths)
		]);
		
		console.log(`[DependencyChecker] Resolved paths:`, { pandocExec, typstExec, imagemagickExec });

		const [pandocInfo, typstInfo, imagemagickInfo] = await Promise.all([
			ExecutableChecker.checkDependency('Pandoc', pandocExec, '--version', /pandoc\s+([\d.]+)/),
			ExecutableChecker.checkDependency('Typst', typstExec, '--version', /typst\s+([\d.]+)/),
			ExecutableChecker.checkDependency('ImageMagick', imagemagickExec, '--version', /ImageMagick\s+([\d.-]+)/)
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
		const pandocExec = ExecutableChecker.resolveExecutablePathSync(pandocPath, DEPENDENCY_CONSTANTS.DEFAULT_EXECUTABLES.pandoc, additionalPaths);
		const typstExec = ExecutableChecker.resolveExecutablePathSync(typstPath, DEPENDENCY_CONSTANTS.DEFAULT_EXECUTABLES.typst, additionalPaths);
		const imagemagickExec = ExecutableChecker.resolveExecutablePathSync(imagemagickPath, DEPENDENCY_CONSTANTS.DEFAULT_EXECUTABLES.imagemagick, additionalPaths);
		
		console.log(`[DependencyChecker] Resolved paths SYNC:`, { pandocExec, typstExec, imagemagickExec });

		const missingDeps: string[] = [];

		if (!ExecutableChecker.checkDependencySync(pandocExec, '--version')) {
			missingDeps.push('Pandoc');
		}
		if (!ExecutableChecker.checkDependencySync(typstExec, '--version')) {
			missingDeps.push('Typst');
		}
		if (!ExecutableChecker.checkDependencySync(imagemagickExec, '--version')) {
			missingDeps.push('ImageMagick');
		}

		return missingDeps;
	}

	/**
	 * Show dependency status modal
	 */
	public static async showDependencyStatus(
		pandocPath?: string,
		typstPath?: string,
		imagemagickPath?: string,
		additionalPaths: string[] = []
	): Promise<void> {
		const dependencyResult = await this.checkAllDependencies(
			pandocPath,
			typstPath,
			imagemagickPath,
			additionalPaths
		);
		
		const formatVersion = (dep: DependencyInfo) => dep.isAvailable ? (dep.version || 'Available') : 'Not found';
		
		const message = `Dependency Status:
Pandoc: ${formatVersion(dependencyResult.pandoc)}
Typst: ${formatVersion(dependencyResult.typst)}
ImageMagick: ${formatVersion(dependencyResult.imagemagick)}

${dependencyResult.allAvailable 
			? 'All dependencies found!' 
			: `Missing dependencies: ${dependencyResult.missingDependencies.join(', ')}. Please install them and check the paths in settings.`}`;
		
		new Notice(message, 12000); // Show for 12 seconds (longer due to more content)
	}

	/**
	 * Check dependencies silently on startup and show notice if missing
	 */
	public static async checkDependenciesAsync(
		pandocPath?: string,
		typstPath?: string,
		imagemagickPath?: string,
		additionalPaths: string[] = []
	): Promise<void> {
		// Check dependencies silently on startup
		try {
			const missingDeps = this.checkDependenciesSync(
				pandocPath,
				typstPath,
				imagemagickPath,
				additionalPaths
			);
			
			// Only show notice if dependencies are missing
			if (missingDeps.length > 0) {
				new Notice(
					`Typst PDF Export: Missing dependencies: ${missingDeps.join(', ')}. ` +
					`Run "Check Dependencies" command for details.`,
					8000
				);
			}
		} catch (error) {
			ExportErrorHandler.handleDependencyError('Dependencies', error, false);
		}
	}
}