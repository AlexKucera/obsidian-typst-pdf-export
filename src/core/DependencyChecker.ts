/**
 * Dependency checking utilities for Obsidian Typst PDF Export plugin.
 *
 * This module provides comprehensive dependency checking for the three external
 * tools required by the plugin:
 * - Pandoc: Converts Markdown to Typst markup
 * - Typst: Compiles Typst markup to PDF
 * - ImageMagick: Handles PDF-to-image conversion for embedded PDFs (optional)
 *
 * The module offers both async and sync checking methods, automatic startup
 * validation, and user-facing status display functionality.
 */

import { DEPENDENCY_CONSTANTS } from './constants';
import { ExportErrorHandler } from './ExportErrorHandler';
import { ExecutableChecker, DependencyInfo } from './ExecutableChecker';

/**
 * Complete result of a dependency check operation.
 *
 * @property pandoc - Detailed information about Pandoc installation
 * @property typst - Detailed information about Typst installation
 * @property imagemagick - Detailed information about ImageMagick installation
 * @property allAvailable - True if all dependencies are available
 * @property missingDependencies - Array of names of missing dependencies
 * @property outdatedDependencies - Array of names of dependencies with versions below minimum
 */
export interface DependencyCheckResult {
	pandoc: DependencyInfo;
	typst: DependencyInfo;
	imagemagick: DependencyInfo;
	allAvailable: boolean;
	missingDependencies: string[];
	outdatedDependencies: string[];
}

/**
 * Utilities for checking external dependency availability and versions.
 *
 * This class provides static methods for validating that Pandoc, Typst, and
 * ImageMagick are properly installed and accessible. It supports both async
 * and sync operations, configurable executable paths, and user notifications.
 *
 * Key features:
 * - Comprehensive async checking with version detection
 * - Fast sync checking for startup validation
 * - User-facing status display with formatted output
 * - Silent background checking with error notifications
 * - Support for custom executable paths and search directories
 *
 * @example
 * ```typescript
 * // Comprehensive check with version information
 * const result = await DependencyChecker.checkAllDependencies(
 *   settings.pandocPath,
 *   settings.typstPath,
 *   settings.imagemagickPath,
 *   settings.additionalPaths
 * );
 *
 * if (!result.allAvailable) {
 *   console.error('Missing:', result.missingDependencies);
 * } else {
 *   console.log(`Pandoc ${result.pandoc.version} found`);
 * }
 *
 * // Quick startup check
 * const missing = DependencyChecker.checkDependenciesSync(
 *   settings.pandocPath,
 *   settings.typstPath
 * );
 * if (missing.length > 0) {
 *   console.error('Missing dependencies:', missing);
 * }
 * ```
 */
export class DependencyChecker {







	/**
	 * Performs comprehensive dependency checking with version detection (async).
	 *
	 * This method checks all three required external tools (Pandoc, Typst, and
	 * ImageMagick) in parallel for maximum efficiency. It resolves executable
	 * paths, verifies availability, and extracts version information using regex
	 * patterns.
	 *
	 * The method supports custom executable paths from user settings and falls
	 * back to searching system PATH if paths are not specified. Additional search
	 * directories can be provided to help locate tools in non-standard locations.
	 *
	 * @param pandocPath - Optional custom path to Pandoc executable
	 * @param typstPath - Optional custom path to Typst executable
	 * @param imagemagickPath - Optional custom path to ImageMagick convert executable
	 * @param additionalPaths - Additional directories to search for executables
	 * @returns Detailed dependency check result including version information
	 *
	 * @example
	 * ```typescript
	 * // Check with default paths (searches system PATH)
	 * const result = await DependencyChecker.checkAllDependencies();
	 * if (result.allAvailable) {
	 *   console.log('All dependencies found!');
	 *   console.log(`Pandoc: ${result.pandoc.version}`);
	 *   console.log(`Typst: ${result.typst.version}`);
	 * }
	 *
	 * // Check with custom paths and additional search directories
	 * const result = await DependencyChecker.checkAllDependencies(
	 *   '/usr/local/bin/pandoc',
	 *   '/opt/typst/bin/typst',
	 *   '/usr/bin/convert',
	 *   ['/opt/local/bin', '/usr/local/opt/bin']
	 * );
	 *
	 * // Handle missing dependencies
	 * if (!result.allAvailable) {
	 *   console.error('Missing:', result.missingDependencies.join(', '));
	 *   result.missingDependencies.forEach(name => {
	 *     const dep = name === 'Pandoc' ? result.pandoc :
	 *                 name === 'Typst' ? result.typst : result.imagemagick;
	 *     console.error(`${name} not found at: ${dep.executablePath}`);
	 *   });
	 * }
	 * ```
	 */
	public static async checkAllDependencies(
		pandocPath?: string,
		typstPath?: string,
		imagemagickPath?: string,
		additionalPaths: string[] = []
	): Promise<DependencyCheckResult> {
		// Resolve actual executable paths, handling empty settings
		const [pandocExec, typstExec, imagemagickExec] = await Promise.all([
			ExecutableChecker.resolveExecutablePath(pandocPath, DEPENDENCY_CONSTANTS.DEFAULT_EXECUTABLES.pandoc, additionalPaths),
			ExecutableChecker.resolveExecutablePath(typstPath, DEPENDENCY_CONSTANTS.DEFAULT_EXECUTABLES.typst, additionalPaths),
			ExecutableChecker.resolveExecutablePath(imagemagickPath, DEPENDENCY_CONSTANTS.DEFAULT_EXECUTABLES.imagemagick, additionalPaths)
		]);

		const [pandocInfo, typstInfo, imagemagickInfo] = await Promise.all([
			ExecutableChecker.checkDependency('Pandoc', pandocExec, '--version', /pandoc\s+([\d.]+)/, DEPENDENCY_CONSTANTS.MINIMUM_VERSIONS.pandoc),
			ExecutableChecker.checkDependency('Typst', typstExec, '--version', /typst\s+([\d.]+)/, DEPENDENCY_CONSTANTS.MINIMUM_VERSIONS.typst),
			ExecutableChecker.checkDependency('ImageMagick', imagemagickExec, '--version', /ImageMagick\s+([\d.-]+)/, DEPENDENCY_CONSTANTS.MINIMUM_VERSIONS.imagemagick)
		]);

		const missingDependencies = [pandocInfo, typstInfo, imagemagickInfo]
			.filter(dep => !dep.isAvailable)
			.map(dep => dep.name);

		const outdatedDependencies = [pandocInfo, typstInfo, imagemagickInfo]
			.filter(dep => dep.isAvailable && !dep.meetsMinimumVersion)
			.map(dep => dep.name);

		return {
			pandoc: pandocInfo,
			typst: typstInfo,
			imagemagick: imagemagickInfo,
			allAvailable: missingDependencies.length === 0,
			missingDependencies,
			outdatedDependencies
		};
	}

	/**
	 * Performs fast synchronous dependency checking without version detection.
	 *
	 * This is a simplified version of checkAllDependencies that only checks if
	 * executables can be run successfully (exit code 0), without extracting version
	 * information. It's designed for scenarios where async operations are not
	 * possible (e.g., plugin initialization) or when only availability matters.
	 *
	 * The method checks all three tools sequentially and returns a list of missing
	 * dependency names. Empty array indicates all dependencies are available.
	 *
	 * @param pandocPath - Optional custom path to Pandoc executable
	 * @param typstPath - Optional custom path to Typst executable
	 * @param imagemagickPath - Optional custom path to ImageMagick convert executable
	 * @param additionalPaths - Additional directories to search for executables
	 * @returns Array of missing dependency names (empty if all available)
	 *
	 * @example
	 * ```typescript
	 * // Quick startup check in plugin onload()
	 * const missing = DependencyChecker.checkDependenciesSync(
	 *   this.settings.pandocPath,
	 *   this.settings.typstPath,
	 *   this.settings.imagemagickPath
	 * );
	 *
	 * if (missing.length > 0) {
	 *   new Notice(`Missing dependencies: ${missing.join(', ')}`);
	 *   return;
	 * }
	 *
	 * // Check with additional search paths
	 * const missing = DependencyChecker.checkDependenciesSync(
	 *   undefined,  // Use default Pandoc
	 *   undefined,  // Use default Typst
	 *   undefined,  // Use default ImageMagick
	 *   ['/opt/local/bin', '~/.local/bin']
	 * );
	 *
	 * // React based on specific missing tools
	 * if (missing.includes('Pandoc')) {
	 *   console.error('Pandoc is required for Markdown conversion');
	 * }
	 * if (missing.includes('Typst')) {
	 *   console.error('Typst is required for PDF generation');
	 * }
	 * ```
	 */
	public static checkDependenciesSync(
		pandocPath?: string,
		typstPath?: string,
		imagemagickPath?: string,
		additionalPaths: string[] = []
	): string[] {
		// Resolve actual executable paths, handling empty settings
		const pandocExec = ExecutableChecker.resolveExecutablePathSync(pandocPath, DEPENDENCY_CONSTANTS.DEFAULT_EXECUTABLES.pandoc, additionalPaths);
		const typstExec = ExecutableChecker.resolveExecutablePathSync(typstPath, DEPENDENCY_CONSTANTS.DEFAULT_EXECUTABLES.typst, additionalPaths);
		const imagemagickExec = ExecutableChecker.resolveExecutablePathSync(imagemagickPath, DEPENDENCY_CONSTANTS.DEFAULT_EXECUTABLES.imagemagick, additionalPaths);

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
	 * Displays dependency status in a user-facing notice with version information.
	 *
	 * This method performs a comprehensive dependency check and displays the results
	 * in an Obsidian notice modal. The notice includes:
	 * - Status of each dependency (version or "Not found")
	 * - Overall availability message
	 * - Installation instructions if dependencies are missing
	 *
	 * The notice is displayed for 12 seconds to give users time to read the detailed
	 * information. This method is typically called from the plugin's settings or via
	 * a command palette action.
	 *
	 * @param pandocPath - Optional custom path to Pandoc executable
	 * @param typstPath - Optional custom path to Typst executable
	 * @param imagemagickPath - Optional custom path to ImageMagick convert executable
	 * @param additionalPaths - Additional directories to search for executables
	 * @returns Promise that resolves when the status has been displayed
	 *
	 * @example
	 * ```typescript
	 * // Display status from settings panel
	 * await DependencyChecker.showDependencyStatus(
	 *   this.plugin.settings.pandocPath,
	 *   this.plugin.settings.typstPath,
	 *   this.plugin.settings.imagemagickPath
	 * );
	 *
	 * // Display status via command palette
	 * this.addCommand({
	 *   id: 'check-dependencies',
	 *   name: 'Check Dependencies',
	 *   callback: async () => {
	 *     await DependencyChecker.showDependencyStatus(
	 *       this.settings.pandocPath,
	 *       this.settings.typstPath,
	 *       this.settings.imagemagickPath,
	 *       this.settings.additionalPaths
	 *     );
	 *   }
	 * });
	 * ```
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
		
		const formatVersion = (dep: DependencyInfo) => {
			if (!dep.isAvailable) return 'Not found';
			if (!dep.meetsMinimumVersion) return `${dep.version} (minimum: ${dep.minimumVersion})`;
			return dep.version || 'Available';
		};

		const statusLines: string[] = [];

		// Build status messages
		if (!dependencyResult.allAvailable) {
			statusLines.push(`Missing dependencies: ${dependencyResult.missingDependencies.join(', ')}. Please install them and check the paths in settings.`);
		} else if (dependencyResult.outdatedDependencies.length > 0) {
			statusLines.push(`⚠️ Outdated versions detected: ${dependencyResult.outdatedDependencies.join(', ')}.`);
			statusLines.push(`Please update to avoid compatibility issues.`);
		} else {
			statusLines.push('✓ All dependencies found and up to date!');
		}

		const message = `Dependency Status:
Pandoc: ${formatVersion(dependencyResult.pandoc)}
Typst: ${formatVersion(dependencyResult.typst)}
ImageMagick: ${formatVersion(dependencyResult.imagemagick)}

${statusLines.join('\n')}`;

		ExportErrorHandler.showProgressNotice(message, 15000); // Show for 15 seconds (longer due to version info)
	}

	/**
	 * Performs silent dependency checking on plugin startup with error notifications.
	 *
	 * This method is designed for plugin initialization and performs a fast synchronous
	 * check of all dependencies. It only displays a notice if dependencies are missing,
	 * keeping the user experience clean when everything is working correctly.
	 *
	 * If dependencies are missing, a notice is shown for 8 seconds directing the user
	 * to run the full "Check Dependencies" command for detailed information. If an
	 * error occurs during checking, it's handled gracefully via ExportErrorHandler.
	 *
	 * This method should be called early in the plugin lifecycle (typically in onload)
	 * to ensure users are aware of missing dependencies before attempting exports.
	 *
	 * @param pandocPath - Optional custom path to Pandoc executable
	 * @param typstPath - Optional custom path to Typst executable
	 * @param imagemagickPath - Optional custom path to ImageMagick convert executable
	 * @param additionalPaths - Additional directories to search for executables
	 *
	 * @example
	 * ```typescript
	 * // Call during plugin initialization
	 * export default class MyPlugin extends Plugin {
	 *   async onload() {
	 *     await this.loadSettings();
	 *
	 *     // Silent startup check - only shows notice if problems exist
	 *     DependencyChecker.checkDependenciesOnStartup(
	 *       this.settings.pandocPath,
	 *       this.settings.typstPath,
	 *       this.settings.imagemagickPath,
	 *       this.settings.additionalPaths
	 *     );
	 *
	 *     // Continue with plugin initialization
	 *     this.registerCommands();
	 *   }
	 * }
	 *
	 * // User will see a notice only if dependencies are missing:
	 * // "Typst PDF Export: Missing dependencies: Pandoc, Typst.
	 * //  Run 'Check Dependencies' command for details."
	 * ```
	 */
	public static checkDependenciesOnStartup(
		pandocPath?: string,
		typstPath?: string,
		imagemagickPath?: string,
		additionalPaths: string[] = []
	): void {
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
				ExportErrorHandler.showProgressNotice(
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