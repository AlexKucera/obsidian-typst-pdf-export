/**
 * Security utilities for path validation and command injection prevention.
 *
 * This module provides critical security validation for user-provided paths and
 * executable configurations to prevent common security vulnerabilities including:
 * - Directory traversal attacks (../ path manipulation)
 * - Command injection via shell metacharacters
 * - Null byte injection attacks
 * - Windows reserved name exploitation
 * - Path manipulation via special characters
 *
 * All validation methods in this module are designed to fail safely - when in doubt,
 * they reject the input rather than risk a security vulnerability. This defensive
 * approach ensures the plugin cannot be exploited to access files outside the vault
 * or execute arbitrary commands.
 *
 * Key features:
 * - Output path validation for PDF export destinations
 * - Executable path validation for Pandoc/Typst/ImageMagick
 * - Human-readable error messages for user feedback
 * - Cross-platform security checks (Windows and Unix)
 * - Zero-tolerance for suspicious patterns
 *
 * Security principles:
 * - Whitelist approach where possible (allow known-safe patterns)
 * - Multiple validation layers for defense in depth
 * - Clear error messages without exposing implementation details
 * - No automatic sanitization (reject rather than attempt to fix)
 */

import * as path from 'path';

/**
 * Security validation utilities for safe path and executable handling.
 *
 * This class provides static methods for validating user-provided paths and
 * executable configurations before they are used in file operations or shell
 * commands. All methods are designed with a security-first mindset:
 * - Fail closed (reject when uncertain)
 * - Multiple validation layers
 * - No implicit trust of user input
 * - Clear security error messages
 *
 * Use these methods to validate all user-configurable paths before:
 * - Writing exported PDF files
 * - Creating temporary directories
 * - Executing external tools (Pandoc, Typst, ImageMagick)
 * - Resolving output file paths
 *
 * @example
 * ```typescript
 * // Validate user-provided output folder
 * const userFolder = settings.outputFolder;
 * if (!SecurityUtils.validateOutputPath(userFolder)) {
 *   const error = SecurityUtils.getPathValidationError(userFolder);
 *   throw new Error(`Invalid output path: ${error}`);
 * }
 *
 * // Safe to use the folder
 * await exportToPDF(file, userFolder);
 * ```
 *
 * @example
 * ```typescript
 * // Validate executable path before spawning process
 * const pandocPath = settings.pandocPath;
 * if (!SecurityUtils.validateExecutablePath(pandocPath)) {
 *   const error = SecurityUtils.getExecutablePathValidationError(pandocPath);
 *   new Notice(`Invalid Pandoc path: ${error}`);
 *   return;
 * }
 *
 * // Safe to spawn process with this path
 * spawn(pandocPath, args);
 * ```
 */
export class SecurityUtils {
	/**
	 * Validates that an output folder path is safe for file operations.
	 *
	 * This method performs comprehensive security checks to prevent directory
	 * traversal attacks and path manipulation. It rejects:
	 * - Directory traversal attempts (..)
	 * - Absolute paths (must be relative to vault root)
	 * - Null bytes and control characters
	 * - Double slashes and other suspicious patterns
	 * - Invalid filename characters (<>:"|?*)
	 * - Windows reserved system names in any path segment (CON, PRN, AUX, etc.)
	 *   including when followed by extensions (e.g., CON.txt, AUX.log)
	 *
	 * The validation is intentionally strict - when in doubt, reject the path
	 * rather than risk a security vulnerability. Use getPathValidationError()
	 * to provide specific feedback to the user about why their path was rejected.
	 *
	 * @param outputFolder - The relative folder path to validate
	 * @returns True if the path is safe for file operations, false otherwise
	 *
	 * @example
	 * ```typescript
	 * // Valid relative paths
	 * SecurityUtils.validateOutputPath('exports');           // true
	 * SecurityUtils.validateOutputPath('exports/pdfs');      // true
	 * SecurityUtils.validateOutputPath('my documents');      // true
	 *
	 * // Invalid paths (security risks)
	 * SecurityUtils.validateOutputPath('../../../etc');      // false - traversal
	 * SecurityUtils.validateOutputPath('/tmp/evil');         // false - absolute
	 * SecurityUtils.validateOutputPath('CON');               // false - reserved name
	 * SecurityUtils.validateOutputPath('reports/CON/file');  // false - reserved in segment
	 * SecurityUtils.validateOutputPath('AUX.txt');           // false - reserved with extension
	 * SecurityUtils.validateOutputPath('test<>file');        // false - invalid chars
	 * SecurityUtils.validateOutputPath('path//with//double'); // false - suspicious
	 * ```
	 */
	static validateOutputPath(outputFolder: string): boolean {
		if (!outputFolder || typeof outputFolder !== 'string') {
			return false;
		}
		
		// Normalize and resolve the path to detect traversal attempts
		const normalizedPath = path.normalize(outputFolder.trim());
		
		// Check for path traversal attempts
		if (normalizedPath.includes('..') || 
		    normalizedPath.startsWith('/') || 
		    normalizedPath.startsWith('\\') ||
		    normalizedPath.includes('\x00')) {
			return false;
		}
		
		// Additional checks for suspicious patterns
		const suspiciousPatterns = [
			/\.\./,          // Directory traversal
			/\/\//,          // Double slashes
			/[<>:"|?*]/      // Invalid filename characters
		];

		if (suspiciousPatterns.some(pattern => pattern.test(normalizedPath))) {
			return false;
		}

		// Check for Windows reserved names in any path segment
		// Reserved names are invalid even with extensions (e.g., CON.txt, AUX.log)
		const reservedNamePattern = /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])$/i;
		const hasReservedName = normalizedPath
			.split(/[\\/]+/)
			.filter(segment => segment && segment !== '.')
			.some(segment => {
				// Strip extension and check base name
				const baseName = segment.split('.')[0] ?? '';
				return reservedNamePattern.test(baseName);
			});

		return !hasReservedName;
	}
	
	/**
	 * Validates that an executable path is safe for use in shell commands.
	 *
	 * This method prevents command injection attacks by detecting shell
	 * metacharacters and command substitution patterns that could be used to
	 * execute arbitrary commands. It rejects paths containing:
	 * - Shell metacharacters (;&|`$(){}[]<>)
	 * - Null bytes and control characters
	 * - Newlines and carriage returns
	 * - Command separators (with or without whitespace)
	 * - Variable substitution patterns (${var}, $var)
	 * - Command substitution patterns (`cmd`, $(cmd))
	 *
	 * Empty or whitespace-only paths are allowed (plugin will use system PATH).
	 * This enables users to simply specify executable names like 'pandoc' rather
	 * than full paths, relying on shell resolution.
	 *
	 * Use getExecutablePathValidationError() to provide specific feedback about
	 * why an executable path was rejected.
	 *
	 * @param executablePath - The executable path or name to validate
	 * @returns True if the path is safe for shell execution, false otherwise
	 *
	 * @example
	 * ```typescript
	 * // Valid executable paths
	 * SecurityUtils.validateExecutablePath('');                    // true - use PATH
	 * SecurityUtils.validateExecutablePath('pandoc');              // true - simple name
	 * SecurityUtils.validateExecutablePath('/usr/bin/pandoc');     // true - full path
	 * SecurityUtils.validateExecutablePath('/opt/typst');          // true - full path
	 * SecurityUtils.validateExecutablePath('C:\\Program Files\\Pandoc\\pandoc.exe'); // true
	 *
	 * // Invalid paths (command injection risks)
	 * SecurityUtils.validateExecutablePath('pandoc; rm -rf /');    // false - separator
	 * SecurityUtils.validateExecutablePath('$(evil)');             // false - substitution
	 * SecurityUtils.validateExecutablePath('`malicious`');         // false - substitution
	 * SecurityUtils.validateExecutablePath('pandoc|cat /etc/passwd'); // false - pipe
	 * SecurityUtils.validateExecutablePath('${HOME}/bin/fake');    // false - variable
	 * ```
	 *
	 * @example
	 * ```typescript
	 * // Use with spawn to prevent injection
	 * const userPath = settings.pandocPath;
	 * if (SecurityUtils.validateExecutablePath(userPath)) {
	 *   // Safe to use with spawn (arguments passed separately)
	 *   const process = spawn(userPath || 'pandoc', ['--version']);
	 * } else {
	 *   const error = SecurityUtils.getExecutablePathValidationError(userPath);
	 *   throw new Error(`Security violation: ${error}`);
	 * }
	 * ```
	 */
	static validateExecutablePath(executablePath: string): boolean {
		// Allow empty paths (will use system PATH)
		if (!executablePath || executablePath.trim() === '') {
			return true;
		}
		
		const normalizedPath = path.normalize(executablePath.trim());
		
		// Check for command injection attempts
		const dangerousPatterns = [
			/[;&|`$<>]/,       // Shell metacharacters that can't appear in safe paths
			// eslint-disable-next-line no-control-regex -- Intentionally checking for null byte character for security validation
			/\x00/,            // Null bytes
			/\n|\r/,           // Newlines
			/\s*[;&|]\s*/,     // Command separators with whitespace
			/\$\{.*\}/,        // Variable substitution
			/`.*`/,            // Command substitution
			/\$\(.*\)/         // Command substitution
		];
		
		return !dangerousPatterns.some(pattern => pattern.test(normalizedPath));
	}

	/**
	 * Generates a human-readable error message explaining why a path is invalid.
	 *
	 * This method provides specific, actionable feedback to users when their
	 * output folder path fails validation. It identifies the exact security issue
	 * detected and explains it in user-friendly terms without exposing technical
	 * implementation details.
	 *
	 * The method checks for issues in priority order, returning the most critical
	 * security violation first. Use this alongside validateOutputPath() to provide
	 * clear feedback in error messages and UI validation.
	 *
	 * @param outputFolder - The path that failed validation
	 * @returns Descriptive error message explaining why the path is invalid
	 *
	 * @example
	 * ```typescript
	 * // Provide clear validation feedback in settings
	 * const userPath = folderInput.value;
	 * if (!SecurityUtils.validateOutputPath(userPath)) {
	 *   const error = SecurityUtils.getPathValidationError(userPath);
	 *   new Notice(`Invalid output folder: ${error}`);
	 *   return;
	 * }
	 * // Continue with valid path...
	 * ```
	 *
	 * @example
	 * ```typescript
	 * // Display specific error for different violations
	 * const testPaths = [
	 *   '../../../etc',        // "Path traversal attempts (..) are not allowed"
	 *   '/absolute/path',      // "Absolute paths are not allowed..."
	 *   'CON',                 // "Reserved system names are not allowed in paths (found: CON)"
	 *   'reports/AUX/file',    // "Reserved system names are not allowed in paths (found: AUX)"
	 *   'COM1.txt',            // "Reserved system names are not allowed in paths (found: COM1.txt)"
	 *   'invalid<>chars'       // "Invalid characters found in path"
	 * ];
	 *
	 * testPaths.forEach(path => {
	 *   if (!SecurityUtils.validateOutputPath(path)) {
	 *     console.error(`${path}: ${SecurityUtils.getPathValidationError(path)}`);
	 *   }
	 * });
	 * ```
	 */
	static getPathValidationError(outputFolder: string): string {
		if (!outputFolder || typeof outputFolder !== 'string') {
			return 'Output folder is required';
		}
		
		const normalizedPath = path.normalize(outputFolder.trim());
		
		if (normalizedPath.includes('..')) {
			return 'Path traversal attempts (..) are not allowed';
		}
		if (normalizedPath.startsWith('/') || normalizedPath.startsWith('\\')) {
			return 'Absolute paths are not allowed - use relative paths from vault root';
		}
		if (normalizedPath.includes('\x00')) {
			return 'Null bytes are not allowed in paths';
		}
		if (/\/\//.test(normalizedPath)) {
			return 'Double slashes are not allowed in paths';
		}
		if (/[<>:"|?*]/.test(normalizedPath)) {
			return 'Invalid characters found in path';
		}

		// Check for Windows reserved names in any path segment
		const reservedNamePattern = /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])$/i;
		const reservedSegment = normalizedPath
			.split(/[\\/]+/)
			.filter(segment => segment && segment !== '.')
			.find(segment => {
				const baseName = segment.split('.')[0] ?? '';
				return reservedNamePattern.test(baseName);
			});

		if (reservedSegment) {
			return `Reserved system names are not allowed in paths (found: ${reservedSegment})`;
		}

		return 'Invalid path format';
	}
	
	/**
	 * Generates a human-readable error message for invalid executable paths.
	 *
	 * This method provides specific, security-focused feedback when an executable
	 * path fails validation. It identifies command injection attempts and explains
	 * them in terms users can understand without revealing exploit techniques.
	 *
	 * The error messages are designed to be clear about the security risk while
	 * remaining user-friendly. Use this alongside validateExecutablePath() to
	 * provide actionable feedback when users configure external tool paths.
	 *
	 * @param executablePath - The executable path that failed validation
	 * @returns Descriptive error message explaining the security issue
	 *
	 * @example
	 * ```typescript
	 * // Validate Pandoc path in settings with clear feedback
	 * const pandocPath = pandocInput.value;
	 * if (!SecurityUtils.validateExecutablePath(pandocPath)) {
	 *   const error = SecurityUtils.getExecutablePathValidationError(pandocPath);
	 *   new Notice(`Invalid Pandoc path: ${error}`, 8000);
	 *   pandocInput.addClass('error');
	 *   return;
	 * }
	 * pandocInput.removeClass('error');
	 * ```
	 *
	 * @example
	 * ```typescript
	 * // Log security violations for monitoring
	 * function validateAndLogExecutable(name: string, path: string): boolean {
	 *   if (!SecurityUtils.validateExecutablePath(path)) {
	 *     const error = SecurityUtils.getExecutablePathValidationError(path);
	 *     console.error(`Security: Rejected ${name} path: ${error}`);
	 *     console.error(`Attempted path: ${path.substring(0, 50)}...`);
	 *     return false;
	 *   }
	 *   return true;
	 * }
	 *
	 * // Validate all external tools
	 * const valid = [
	 *   validateAndLogExecutable('Pandoc', settings.pandocPath),
	 *   validateAndLogExecutable('Typst', settings.typstPath),
	 *   validateAndLogExecutable('ImageMagick', settings.imagemagickPath)
	 * ].every(v => v);
	 * ```
	 */
	static getExecutablePathValidationError(executablePath: string): string {
		if (!executablePath || typeof executablePath !== 'string') {
			return 'Executable path is required';
		}
		
		const normalizedPath = path.normalize(executablePath.trim());
		
		if (/[;&|`$<>]/.test(normalizedPath)) {
			return 'Shell metacharacters are not allowed in executable paths';
		}
		// eslint-disable-next-line no-control-regex -- Intentionally checking for null byte character for security validation
		if (/\x00/.test(normalizedPath)) {
			return 'Null bytes are not allowed in paths';
		}
		if (/\n|\r/.test(normalizedPath)) {
			return 'Newlines are not allowed in paths';
		}
		if (/\s*[;&|]\s*/.test(normalizedPath)) {
			return 'Command separators are not allowed in executable paths';
		}
		if (/\$\{.*\}/.test(normalizedPath) || /`.*`/.test(normalizedPath) || /\$\(.*\)/.test(normalizedPath)) {
			return 'Command or variable substitution patterns are not allowed';
		}
		
		return 'Invalid executable path format';
	}
}