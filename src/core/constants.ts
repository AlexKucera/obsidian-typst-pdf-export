/**
 * Global constants for Obsidian Typst PDF Export plugin.
 *
 * This module defines all constant values used throughout the plugin, including:
 * - Fallback fonts for cross-platform compatibility
 * - Plugin directory structure and file names
 * - Export operation timeouts and durations
 * - Dependency checking paths and executables
 *
 * All constants are defined using `as const` for maximum type safety, ensuring
 * they cannot be modified at runtime and TypeScript can infer literal types.
 * This prevents accidental mutations and catches typos at compile time.
 *
 * These constants are imported and used across:
 * - Font management and caching
 * - Temporary directory management
 * - Export pipeline timeouts
 * - Dependency resolution and validation
 * - User notifications and feedback
 */

/**
 * Fallback fonts used when Typst cannot detect system fonts.
 *
 * This array provides a curated list of widely-available fonts that work across
 * Windows, macOS, and Linux systems. When Typst's automatic font detection fails
 * or specific fonts aren't found, the plugin will offer these fonts to users as
 * safe alternatives.
 *
 * The list is organized by category:
 * - Serif: Times New Roman, Georgia
 * - Sans-serif: Arial, Helvetica, SF Pro Text
 * - Monospace: Courier New, Monaco, SF Mono, Source Code Pro
 * - Special: Concourse OT, UbuntuMono Nerd Font Mono
 *
 * These fonts are chosen for their:
 * - Wide platform availability
 * - Good readability in PDFs
 * - Professional appearance
 * - Comprehensive character coverage
 *
 * @example
 * ```typescript
 * // Use fallback fonts when system font detection fails
 * let availableFonts = await detectSystemFonts();
 * if (availableFonts.length === 0) {
 *   availableFonts = [...FALLBACK_FONTS];
 *   console.warn('Using fallback fonts - system font detection failed');
 * }
 * ```
 */
export const FALLBACK_FONTS = [
	'Times New Roman',
	'Arial',
	'Helvetica',
	'Georgia',
	'Courier New',
	'Monaco',
	'SF Pro Text',
	'SF Mono',
	'Concourse OT',
	'UbuntuMono Nerd Font Mono',
	'Source Code Pro'
] as const;

/**
 * Plugin-specific directory and file names.
 *
 * Defines the structure of plugin-managed directories within the vault's
 * .obsidian/plugins/typst-pdf-export folder. These directories are used for:
 * - Temporary file storage during export operations
 * - Font cache persistence for faster initialization
 *
 * Directory structure:
 * ```
 * .obsidian/plugins/typst-pdf-export/
 * ├── temp-images/        # Converted images from embedded PDFs
 * ├── temp-pandoc/        # Intermediate Pandoc/Typst processing files
 * └── fonts-cache.json    # Cached system font list
 * ```
 *
 * All paths are managed by TempDirectoryManager and automatically cleaned up
 * to prevent disk space accumulation.
 *
 * @property TEMP_IMAGES - Directory for converted PDF images
 * @property TEMP_PANDOC - Directory for Pandoc intermediate files
 * @property FONTS_CACHE - JSON file storing cached font information
 */
export const PLUGIN_DIRS = {
	TEMP_IMAGES: 'temp-images',
	TEMP_PANDOC: 'temp-pandoc',
	FONTS_CACHE: 'fonts-cache.json'
} as const;

/**
 * Export operation timeouts and notification durations.
 *
 * Configures timing parameters for export operations and user feedback:
 * - Process timeouts prevent hanging exports from blocking the UI
 * - Notice durations ensure users have time to read important messages
 *
 * @property DEFAULT_TIMEOUT - Maximum time (ms) for export operations (2 minutes)
 * @property NOTICE_DURATION - Standard durations for Obsidian notices
 * @property NOTICE_DURATION.SHORT - Brief notices for status updates (5 seconds)
 * @property NOTICE_DURATION.LONG - Extended notices for detailed info (12 seconds)
 *
 * @example
 * ```typescript
 * // Use timeout for export process
 * const result = await Promise.race([
 *   exportToPDF(file),
 *   new Promise((_, reject) =>
 *     setTimeout(() => reject(new Error('Timeout')),
 *       EXPORT_CONSTANTS.DEFAULT_TIMEOUT)
 *   )
 * ]);
 *
 * // Show success notice with short duration
 * new Notice('PDF exported successfully', EXPORT_CONSTANTS.NOTICE_DURATION.SHORT);
 * ```
 */
export const EXPORT_CONSTANTS = {
	DEFAULT_TIMEOUT: 120000, // 2 minutes
	NOTICE_DURATION: {
		SHORT: 5000,
		LONG: 12000
	}
} as const;

/**
 * Dependency checking configuration and common paths.
 *
 * Defines default executable names and search paths for external tools required
 * by the plugin (Pandoc, Typst, and ImageMagick). The plugin searches these
 * paths in addition to the system PATH to handle various installation methods:
 * - Package managers (brew, apt, snap, cargo)
 * - User-local installations (~/.local/bin)
 * - Language-specific package managers (cargo, npm, go)
 * - System standard locations (/usr/bin, /usr/local/bin)
 *
 * These paths are always checked regardless of user settings, ensuring the plugin
 * can find executables even when they're not in the user's shell PATH (common
 * with GUI applications on macOS).
 *
 * @property DEFAULT_EXECUTABLES - Default command names for each dependency
 * @property DEFAULT_EXECUTABLES.pandoc - Pandoc markdown converter (v2.0+)
 * @property DEFAULT_EXECUTABLES.typst - Typst PDF compiler (v0.11+)
 * @property DEFAULT_EXECUTABLES.imagemagick - ImageMagick convert utility (v7+)
 * @property COMMON_PATHS - Standard installation locations to search
 * @property COMMON_PATHS.HOME_RELATIVE - Paths relative to user home directory
 * @property COMMON_PATHS.ABSOLUTE - System-wide absolute paths
 *
 * @example
 * ```typescript
 * // Build augmented PATH for dependency checking
 * const homeDir = process.env.HOME || process.env.USERPROFILE;
 * const homePaths = DEPENDENCY_CONSTANTS.COMMON_PATHS.HOME_RELATIVE
 *   .map(p => homeDir + p);
 * const allPaths = [
 *   ...process.env.PATH.split(':'),
 *   ...homePaths,
 *   ...DEPENDENCY_CONSTANTS.COMMON_PATHS.ABSOLUTE
 * ];
 *
 * // Search for pandoc in augmented PATH
 * const pandocPath = findInPaths(
 *   DEPENDENCY_CONSTANTS.DEFAULT_EXECUTABLES.pandoc,
 *   allPaths
 * );
 * ```
 *
 * @example
 * ```typescript
 * // Resolve executable with fallback to default name
 * const executablePath = settings.pandocPath ||
 *   DEPENDENCY_CONSTANTS.DEFAULT_EXECUTABLES.pandoc;
 *
 * // Check if executable exists in common paths
 * const resolved = await resolveExecutable(
 *   executablePath,
 *   DEPENDENCY_CONSTANTS.COMMON_PATHS.HOME_RELATIVE.concat(
 *     DEPENDENCY_CONSTANTS.COMMON_PATHS.ABSOLUTE
 *   )
 * );
 * ```
 */
export const DEPENDENCY_CONSTANTS = {
	/**
	 * Default executable names for external dependencies.
	 *
	 * These are the command names used when users haven't configured custom paths.
	 * The plugin will search for these in the augmented PATH.
	 *
	 * @property pandoc - Pandoc executable (markdown → typst converter)
	 * @property typst - Typst executable (typst → PDF compiler)
	 * @property imagemagick - ImageMagick executable (PDF → image converter)
	 */
	DEFAULT_EXECUTABLES: {
		pandoc: 'pandoc',
		typst: 'typst',
		imagemagick: 'magick'
	},

	/**
	 * Common installation paths to search for executables.
	 *
	 * These paths are checked in addition to the system PATH to handle tools
	 * installed via various methods. The plugin automatically augments PATH
	 * with these locations during dependency checking.
	 */
	COMMON_PATHS: {
		/**
		 * Paths relative to the user's home directory.
		 *
		 * These paths will have HOME or USERPROFILE prepended before searching:
		 * - .local/bin: Local user installations (Linux standard)
		 * - .cargo/bin: Rust/Cargo package installations
		 * - go/bin: Go package installations
		 * - .npm-global/bin: Global npm package installations
		 *
		 * @example ['~/.local/bin', '~/.cargo/bin', '~/go/bin', '~/.npm-global/bin']
		 */
		HOME_RELATIVE: [
			'/.local/bin',
			'/.cargo/bin',
			'/go/bin',
			'/.npm-global/bin'
		],
		/**
		 * System-wide absolute paths used as-is.
		 *
		 * Standard Unix/Linux system directories where executables are commonly
		 * installed by package managers:
		 * - /usr/local/bin: Homebrew (macOS), local installs
		 * - /opt/homebrew/bin: Homebrew on Apple Silicon
		 * - /usr/bin: System package manager installs
		 * - /bin: Essential system commands
		 * - /opt/local/bin: MacPorts installations
		 * - /snap/bin: Snap package installations (Linux)
		 *
		 * @example ['/usr/local/bin', '/opt/homebrew/bin', '/usr/bin', '/bin', '/opt/local/bin', '/snap/bin']
		 */
		ABSOLUTE: [
			'/usr/local/bin',
			'/opt/homebrew/bin',
			'/usr/bin',
			'/bin',
			'/opt/local/bin',
			'/snap/bin'
		]
	}
} as const;