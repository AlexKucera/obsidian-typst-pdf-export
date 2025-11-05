import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
	SUPPORTED_PAPER_SIZES,
	DEFAULT_PAPER_SIZE,
	mapToTypstPaperSize,
	getValidTypstPaperSizes,
	isSupportedPaperSize,
} from '../src/utils/paperSizeMapper';

describe('paperSizeMapper', () => {
	describe('SUPPORTED_PAPER_SIZES', () => {
		it('should have all required paper sizes', () => {
			expect(SUPPORTED_PAPER_SIZES).toHaveLength(8);

			const keys = SUPPORTED_PAPER_SIZES.map(size => size.key);
			expect(keys).toContain('a3');
			expect(keys).toContain('a4');
			expect(keys).toContain('a5');
			expect(keys).toContain('a6');
			expect(keys).toContain('eu-business-card');
			expect(keys).toContain('us-letter');
			expect(keys).toContain('us-legal');
			expect(keys).toContain('us-business-card');
		});

		it('should have correct structure for each paper size', () => {
			SUPPORTED_PAPER_SIZES.forEach(size => {
				expect(size).toHaveProperty('key');
				expect(size).toHaveProperty('displayName');
				expect(size).toHaveProperty('typstValue');

				expect(typeof size.key).toBe('string');
				expect(typeof size.displayName).toBe('string');
				expect(typeof size.typstValue).toBe('string');

				expect(size.key.length).toBeGreaterThan(0);
				expect(size.displayName.length).toBeGreaterThan(0);
				expect(size.typstValue.length).toBeGreaterThan(0);
			});
		});

		it('should have unique keys', () => {
			const keys = SUPPORTED_PAPER_SIZES.map(size => size.key);
			const uniqueKeys = new Set(keys);
			expect(uniqueKeys.size).toBe(keys.length);
		});

		it('should have display names with dimensions', () => {
			SUPPORTED_PAPER_SIZES.forEach(size => {
				// Display names should contain either 'mm' or 'in'
				expect(size.displayName).toMatch(/\d+\s*×\s*\d+\s*(mm|in)/);
			});
		});
	});

	describe('DEFAULT_PAPER_SIZE', () => {
		it('should be a4', () => {
			expect(DEFAULT_PAPER_SIZE).toBe('a4');
		});

		it('should be a valid supported paper size', () => {
			expect(isSupportedPaperSize(DEFAULT_PAPER_SIZE)).toBe(true);
		});
	});

	describe('mapToTypstPaperSize', () => {
		it('should map supported paper sizes correctly', () => {
			expect(mapToTypstPaperSize('a3')).toBe('a3');
			expect(mapToTypstPaperSize('a4')).toBe('a4');
			expect(mapToTypstPaperSize('a5')).toBe('a5');
			expect(mapToTypstPaperSize('a6')).toBe('a6');
			expect(mapToTypstPaperSize('us-letter')).toBe('us-letter');
			expect(mapToTypstPaperSize('us-legal')).toBe('us-legal');
			expect(mapToTypstPaperSize('eu-business-card')).toBe('eu-business-card');
			expect(mapToTypstPaperSize('us-business-card')).toBe('us-business-card');
		});

		it('should return default for unsupported paper sizes', () => {
			const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

			expect(mapToTypstPaperSize('invalid-size')).toBe('a4');
			expect(mapToTypstPaperSize('unknown')).toBe('a4');
			expect(mapToTypstPaperSize('')).toBe('a4');

			expect(consoleWarnSpy).toHaveBeenCalledTimes(3);
			consoleWarnSpy.mockRestore();
		});

		it('should log warning for unsupported sizes', () => {
			const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

			mapToTypstPaperSize('invalid-size');

			expect(consoleWarnSpy).toHaveBeenCalledWith(
				expect.stringContaining('Unknown paper size: invalid-size')
			);
			expect(consoleWarnSpy).toHaveBeenCalledWith(
				expect.stringContaining('Using default: a4')
			);

			consoleWarnSpy.mockRestore();
		});

		it('should handle case-sensitive keys', () => {
			const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

			// Keys are case-sensitive
			expect(mapToTypstPaperSize('A4')).toBe('a4'); // Should fall back to default
			expect(consoleWarnSpy).toHaveBeenCalled();

			consoleWarnSpy.mockRestore();
		});
	});

	describe('getValidTypstPaperSizes', () => {
		it('should return all Typst paper size values', () => {
			const validSizes = getValidTypstPaperSizes();

			expect(validSizes).toHaveLength(8);
			expect(validSizes).toContain('a3');
			expect(validSizes).toContain('a4');
			expect(validSizes).toContain('a5');
			expect(validSizes).toContain('a6');
			expect(validSizes).toContain('eu-business-card');
			expect(validSizes).toContain('us-letter');
			expect(validSizes).toContain('us-legal');
			expect(validSizes).toContain('us-business-card');
		});

		it('should return a new array each time', () => {
			const sizes1 = getValidTypstPaperSizes();
			const sizes2 = getValidTypstPaperSizes();

			// Should return different array instances
			expect(sizes1).not.toBe(sizes2);

			// But with same content
			expect(sizes1).toEqual(sizes2);
		});

		it('should not include duplicate values', () => {
			const validSizes = getValidTypstPaperSizes();
			const uniqueSizes = new Set(validSizes);

			expect(uniqueSizes.size).toBe(validSizes.length);
		});
	});

	describe('isSupportedPaperSize', () => {
		it('should return true for supported sizes', () => {
			expect(isSupportedPaperSize('a3')).toBe(true);
			expect(isSupportedPaperSize('a4')).toBe(true);
			expect(isSupportedPaperSize('a5')).toBe(true);
			expect(isSupportedPaperSize('a6')).toBe(true);
			expect(isSupportedPaperSize('us-letter')).toBe(true);
			expect(isSupportedPaperSize('us-legal')).toBe(true);
			expect(isSupportedPaperSize('eu-business-card')).toBe(true);
			expect(isSupportedPaperSize('us-business-card')).toBe(true);
		});

		it('should return false for unsupported sizes', () => {
			expect(isSupportedPaperSize('invalid')).toBe(false);
			expect(isSupportedPaperSize('unknown')).toBe(false);
			expect(isSupportedPaperSize('')).toBe(false);
			expect(isSupportedPaperSize('A4')).toBe(false); // Case-sensitive
			expect(isSupportedPaperSize('letter')).toBe(false); // Missing 'us-' prefix
		});

		it('should handle edge cases', () => {
			expect(isSupportedPaperSize(null as any)).toBe(false);
			expect(isSupportedPaperSize(undefined as any)).toBe(false);
			expect(isSupportedPaperSize(123 as any)).toBe(false);
		});
	});
});
