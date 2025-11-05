import { describe, it, expect } from 'vitest';
import { ExportFormat } from '../src/core/settings';

// Type definition file - basic import test to ensure types compile
describe('converterTypes', () => {
	it('should export ExportFormat enum', () => {
		expect(ExportFormat.Standard).toBe('standard');
		expect(ExportFormat.SinglePage).toBe('single-page');
	});
});
