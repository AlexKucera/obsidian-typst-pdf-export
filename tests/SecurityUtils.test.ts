import { describe, it, expect } from 'vitest';
import { SecurityUtils } from '../src/core/SecurityUtils';

describe('SecurityUtils', () => {
	describe('validateOutputPath', () => {
		it('should accept valid relative paths', () => {
			expect(SecurityUtils.validateOutputPath('exports')).toBe(true);
			expect(SecurityUtils.validateOutputPath('my-exports')).toBe(true);
			expect(SecurityUtils.validateOutputPath('exports/pdfs')).toBe(true);
			expect(SecurityUtils.validateOutputPath('folder_name')).toBe(true);
		});

		it('should reject empty or invalid input', () => {
			expect(SecurityUtils.validateOutputPath('')).toBe(false);
			expect(SecurityUtils.validateOutputPath(null as any)).toBe(false);
			expect(SecurityUtils.validateOutputPath(undefined as any)).toBe(false);
			expect(SecurityUtils.validateOutputPath(123 as any)).toBe(false);
		});

		it('should reject path traversal attempts', () => {
			expect(SecurityUtils.validateOutputPath('..')).toBe(false);
			expect(SecurityUtils.validateOutputPath('../')).toBe(false);
			expect(SecurityUtils.validateOutputPath('../../secret')).toBe(false);
			expect(SecurityUtils.validateOutputPath('exports/../../../etc')).toBe(false);
		});

		it('should reject absolute paths', () => {
			expect(SecurityUtils.validateOutputPath('/etc/passwd')).toBe(false);
			expect(SecurityUtils.validateOutputPath('/usr/local')).toBe(false);
			expect(SecurityUtils.validateOutputPath('\\Windows\\System32')).toBe(false);
			expect(SecurityUtils.validateOutputPath('\\etc\\hosts')).toBe(false);
		});

		it('should reject null bytes', () => {
			expect(SecurityUtils.validateOutputPath('exports\x00malicious')).toBe(false);
			expect(SecurityUtils.validateOutputPath('\x00')).toBe(false);
		});

		it('should reject double slashes', () => {
			// Note: path.normalize() resolves double slashes in the middle, so we test edge cases
			// that remain problematic even after normalization
			expect(SecurityUtils.validateOutputPath('//exports')).toBe(false); // Starts with //
		});

		it('should reject invalid filename characters', () => {
			expect(SecurityUtils.validateOutputPath('exports<test')).toBe(false);
			expect(SecurityUtils.validateOutputPath('exports>test')).toBe(false);
			expect(SecurityUtils.validateOutputPath('exports:test')).toBe(false);
			expect(SecurityUtils.validateOutputPath('exports"test')).toBe(false);
			expect(SecurityUtils.validateOutputPath('exports|test')).toBe(false);
			expect(SecurityUtils.validateOutputPath('exports?test')).toBe(false);
			expect(SecurityUtils.validateOutputPath('exports*test')).toBe(false);
		});

		it('should reject Windows reserved names', () => {
			expect(SecurityUtils.validateOutputPath('CON')).toBe(false);
			expect(SecurityUtils.validateOutputPath('PRN')).toBe(false);
			expect(SecurityUtils.validateOutputPath('AUX')).toBe(false);
			expect(SecurityUtils.validateOutputPath('NUL')).toBe(false);
			expect(SecurityUtils.validateOutputPath('COM1')).toBe(false);
			expect(SecurityUtils.validateOutputPath('COM9')).toBe(false);
			expect(SecurityUtils.validateOutputPath('LPT1')).toBe(false);
			expect(SecurityUtils.validateOutputPath('lpt9')).toBe(false); // Case insensitive
		});

		it('should handle whitespace correctly', () => {
			expect(SecurityUtils.validateOutputPath('  exports  ')).toBe(true);
			expect(SecurityUtils.validateOutputPath('  ..  ')).toBe(false);
		});
	});

	describe('validateExecutablePath', () => {
		it('should accept empty paths (system PATH)', () => {
			expect(SecurityUtils.validateExecutablePath('')).toBe(true);
			expect(SecurityUtils.validateExecutablePath('   ')).toBe(true);
		});

		it('should accept valid executable paths', () => {
			expect(SecurityUtils.validateExecutablePath('/usr/bin/pandoc')).toBe(true);
			expect(SecurityUtils.validateExecutablePath('/opt/typst/typst')).toBe(true);
			expect(SecurityUtils.validateExecutablePath('C:\\Program Files\\Pandoc\\pandoc.exe')).toBe(true);
			expect(SecurityUtils.validateExecutablePath('pandoc')).toBe(true);
		});

		it('should reject shell metacharacters', () => {
			expect(SecurityUtils.validateExecutablePath('pandoc;rm -rf /')).toBe(false);
			expect(SecurityUtils.validateExecutablePath('pandoc&whoami')).toBe(false);
			expect(SecurityUtils.validateExecutablePath('pandoc|cat /etc/passwd')).toBe(false);
			expect(SecurityUtils.validateExecutablePath('pandoc`whoami`')).toBe(false);
			expect(SecurityUtils.validateExecutablePath('pandoc$(whoami)')).toBe(false);
			expect(SecurityUtils.validateExecutablePath('pandoc{}')).toBe(false);
			expect(SecurityUtils.validateExecutablePath('pandoc[]')).toBe(false);
		});

		it('should reject null bytes', () => {
			expect(SecurityUtils.validateExecutablePath('pandoc\x00malicious')).toBe(false);
			expect(SecurityUtils.validateExecutablePath('\x00')).toBe(false);
		});

		it('should reject newlines', () => {
			expect(SecurityUtils.validateExecutablePath('pandoc\nrm -rf /')).toBe(false);
			expect(SecurityUtils.validateExecutablePath('pandoc\r\nmalicious')).toBe(false);
		});

		it('should reject command separators with whitespace', () => {
			expect(SecurityUtils.validateExecutablePath('pandoc ; whoami')).toBe(false);
			expect(SecurityUtils.validateExecutablePath('pandoc & whoami')).toBe(false);
			expect(SecurityUtils.validateExecutablePath('pandoc | whoami')).toBe(false);
		});

		it('should reject variable and command substitution', () => {
			expect(SecurityUtils.validateExecutablePath('${MALICIOUS}')).toBe(false);
			expect(SecurityUtils.validateExecutablePath('`whoami`')).toBe(false);
			expect(SecurityUtils.validateExecutablePath('$(malicious)')).toBe(false);
		});

		it('should handle whitespace in paths', () => {
			expect(SecurityUtils.validateExecutablePath('  /usr/bin/pandoc  ')).toBe(true);
		});
	});

	describe('getPathValidationError', () => {
		it('should return appropriate error for empty path', () => {
			expect(SecurityUtils.getPathValidationError('')).toBe('Output folder is required');
			expect(SecurityUtils.getPathValidationError(null as any)).toBe('Output folder is required');
			expect(SecurityUtils.getPathValidationError(undefined as any)).toBe('Output folder is required');
		});

		it('should return appropriate error for path traversal', () => {
			const error = SecurityUtils.getPathValidationError('..');
			expect(error).toBe('Path traversal attempts (..) are not allowed');
		});

		it('should return appropriate error for absolute paths', () => {
			const error = SecurityUtils.getPathValidationError('/etc/passwd');
			expect(error).toBe('Absolute paths are not allowed - use relative paths from vault root');
		});

		it('should return appropriate error for null bytes', () => {
			const error = SecurityUtils.getPathValidationError('exports\x00');
			expect(error).toBe('Null bytes are not allowed in paths');
		});

		it('should return appropriate error for double slashes', () => {
			// Test with leading // which should fail the absolute path check
			const error = SecurityUtils.getPathValidationError('//exports');
			expect(error).toBe('Absolute paths are not allowed - use relative paths from vault root');
		});

		it('should return appropriate error for invalid characters', () => {
			const error = SecurityUtils.getPathValidationError('exports<test');
			expect(error).toBe('Invalid characters found in path');
		});

		it('should return appropriate error for reserved names', () => {
			const error = SecurityUtils.getPathValidationError('CON');
			expect(error).toBe('Reserved system names are not allowed as folder names');
		});

		it('should return generic error for unknown issues', () => {
			// For a valid path, it would still return 'Invalid path format' if called
			// (though normally you wouldn't call this for valid paths)
			const validPath = 'exports';
			// This is a bit contrived since we wouldn't normally call this on valid paths
			// but it tests the fallback case
			expect(SecurityUtils.getPathValidationError(validPath)).toBe('Invalid path format');
		});
	});

	describe('getExecutablePathValidationError', () => {
		it('should return appropriate error for empty path', () => {
			expect(SecurityUtils.getExecutablePathValidationError(null as any))
				.toBe('Executable path is required');
		});

		it('should return appropriate error for shell metacharacters', () => {
			const error = SecurityUtils.getExecutablePathValidationError('pandoc;whoami');
			expect(error).toBe('Shell metacharacters are not allowed in executable paths');
		});

		it('should return appropriate error for null bytes', () => {
			const error = SecurityUtils.getExecutablePathValidationError('pandoc\x00');
			expect(error).toBe('Null bytes are not allowed in paths');
		});

		it('should return appropriate error for newlines', () => {
			const error = SecurityUtils.getExecutablePathValidationError('pandoc\nrm');
			expect(error).toBe('Newlines are not allowed in paths');
		});

		it('should return appropriate error for command separators', () => {
			// The semicolon is caught by shell metacharacters check first
			const error = SecurityUtils.getExecutablePathValidationError('pandoc ; whoami');
			expect(error).toBe('Shell metacharacters are not allowed in executable paths');
		});

		it('should return appropriate error for substitution patterns', () => {
			// These contain shell metacharacters, which are checked first
			const error = SecurityUtils.getExecutablePathValidationError('${VAR}');
			expect(error).toBe('Shell metacharacters are not allowed in executable paths');

			const error2 = SecurityUtils.getExecutablePathValidationError('`cmd`');
			expect(error2).toBe('Shell metacharacters are not allowed in executable paths');

			const error3 = SecurityUtils.getExecutablePathValidationError('$(cmd)');
			expect(error3).toBe('Shell metacharacters are not allowed in executable paths');
		});

		it('should return generic error for valid paths when forced', () => {
			const validPath = '/usr/bin/pandoc';
			// Again, contrived - but tests the fallback
			expect(SecurityUtils.getExecutablePathValidationError(validPath))
				.toBe('Invalid executable path format');
		});
	});
});
