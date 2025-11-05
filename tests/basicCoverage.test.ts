/**
 * Basic coverage tests for simpler modules
 * These tests ensure basic functionality and increase overall coverage
 */
import { describe, it, expect } from 'vitest';

// Import type files and constants
import {  FALLBACK_FONTS, PLUGIN_DIRS, EXPORT_CONSTANTS, DEPENDENCY_CONSTANTS } from '../src/core/constants';
import { ExportFormat } from '../src/core/settings';

// Import utilities
import { SUPPORTED_PAPER_SIZES, DEFAULT_PAPER_SIZE, mapToTypstPaperSize, isSupportedPaperSize } from '../src/utils/paperSizeMapper';

describe('Constants and Types Coverage', () => {
	describe('FALLBACK_FONTS', () => {
		it('should have defined fallback fonts', () => {
			expect(FALLBACK_FONTS.length).toBeGreaterThan(0);
			expect(FALLBACK_FONTS).toContain('Times New Roman');
		});
	});

	describe('PLUGIN_DIRS', () => {
		it('should have temp directory names', () => {
			expect(PLUGIN_DIRS.TEMP_IMAGES).toBe('temp-images');
			expect(PLUGIN_DIRS.TEMP_PANDOC).toBe('temp-pandoc');
		});
	});

	describe('EXPORT_CONSTANTS', () => {
		it('should have timeout constants', () => {
			expect(EXPORT_CONSTANTS.DEFAULT_TIMEOUT).toBe(120000);
			expect(EXPORT_CONSTANTS.NOTICE_DURATION.SHORT).toBe(5000);
		});
	});

	describe('DEPENDENCY_CONSTANTS', () => {
		it('should have default executables', () => {
			expect(DEPENDENCY_CONSTANTS.DEFAULT_EXECUTABLES.pandoc).toBe('pandoc');
			expect(DEPENDENCY_CONSTANTS.DEFAULT_EXECUTABLES.typst).toBe('typst');
		});

		it('should have common paths', () => {
			expect(DEPENDENCY_CONSTANTS.COMMON_PATHS.HOME_RELATIVE).toContain('/.local/bin');
			expect(DEPENDENCY_CONSTANTS.COMMON_PATHS.ABSOLUTE).toContain('/usr/local/bin');
		});
	});

	describe('ExportFormat enum', () => {
		it('should have standard and single-page formats', () => {
			expect(ExportFormat.Standard).toBe('standard');
			expect(ExportFormat.SinglePage).toBe('single-page');
		});
	});

	describe('Paper size utilities', () => {
		it('should have multiple paper sizes', () => {
			expect(SUPPORTED_PAPER_SIZES.length).toBeGreaterThan(5);
		});

		it('should map known sizes', () => {
			expect(mapToTypstPaperSize('a4')).toBe('a4');
			expect(mapToTypstPaperSize('us-letter')).toBe('us-letter');
		});

		it('should validate paper sizes', () => {
			expect(isSupportedPaperSize('a4')).toBe(true);
			expect(isSupportedPaperSize('invalid')).toBe(false);
		});

		it('should have a default paper size', () => {
			expect(DEFAULT_PAPER_SIZE).toBe('a4');
		});
	});
});
