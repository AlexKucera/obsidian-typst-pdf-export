/**
 * Security utilities for path validation and sanitization
 */

import * as path from 'path';

export class SecurityUtils {
	/**
	 * Validates that an output folder path is safe and doesn't contain traversal attempts
	 * @param outputFolder The folder path to validate
	 * @returns true if the path is safe, false otherwise
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
			/[<>:"|?*]/,     // Invalid filename characters
			/^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])$/i  // Windows reserved names
		];
		
		return !suspiciousPatterns.some(pattern => pattern.test(normalizedPath));
	}
	
	/**
	 * Validates that an executable path is safe for use in shell commands
	 * @param executablePath The executable path to validate
	 * @returns true if the path is safe, false otherwise
	 */
	static validateExecutablePath(executablePath: string): boolean {
		// Allow empty paths (will use system PATH)
		if (!executablePath || executablePath.trim() === '') {
			return true;
		}
		
		const normalizedPath = path.normalize(executablePath.trim());
		
		// Check for command injection attempts
		const dangerousPatterns = [
			/[;&|`$(){}[\]]/,  // Shell metacharacters
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
	 * Gets a human-readable error message for invalid paths
	 * @param outputFolder The invalid path
	 * @returns Description of why the path is invalid
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
		if (/^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])$/i.test(normalizedPath)) {
			return 'Reserved system names are not allowed as folder names';
		}
		
		return 'Invalid path format';
	}
	
	/**
	 * Gets a human-readable error message for invalid executable paths
	 * @param executablePath The invalid executable path
	 * @returns Description of why the path is invalid
	 */
	static getExecutablePathValidationError(executablePath: string): string {
		if (!executablePath || typeof executablePath !== 'string') {
			return 'Executable path is required';
		}
		
		const normalizedPath = path.normalize(executablePath.trim());
		
		if (/[;&|`$(){}[\]]/.test(normalizedPath)) {
			return 'Shell metacharacters are not allowed in executable paths';
		}
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