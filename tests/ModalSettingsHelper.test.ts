import { describe, it, expect } from 'vitest';
import { ModalSettingsHelper } from '../src/core/ModalSettingsHelper';
import { obsidianTypstPDFExportSettings, ExportFormat } from '../src/core/settings';
import { TFile } from 'obsidian';

// Mock TFile
const createMockFile = (path: string, basename: string): TFile => ({
	path,
	basename,
	extension: 'md',
} as TFile);

// Create mock settings
const createMockSettings = (overrides?: Partial<obsidianTypstPDFExportSettings>): obsidianTypstPDFExportSettings => ({
	pandocPath: '/usr/bin/pandoc',
	typstPath: '/usr/bin/typst',
	outputFolder: 'exports',
	executablePaths: {
		imagemagickPath: '',
		additionalPaths: [],
	},
	customEnvironmentVariables: {},
	exportDefaults: {
		template: 'default',
		format: ExportFormat.Standard,
		pageSize: 'a4',
		orientation: 'portrait',
		marginTop: '2.5cm',
		marginBottom: '2.5cm',
		marginLeft: '2.5cm',
		marginRight: '2.5cm',
		bodyFont: 'Georgia',
		headingFont: 'Helvetica',
		monospaceFont: 'Courier New',
		bodyFontSize: '11pt',
	},
	typography: {
		fonts: {
			body: 'Georgia',
			heading: 'Helvetica',
			monospace: 'Courier New',
		},
		fontSizes: {
			body: 11,
			heading: 16,
			small: 9,
		},
	},
	pageSetup: {
		size: 'a4',
		orientation: 'portrait',
		margins: {
			top: 71,
			right: 71,
			bottom: 71,
			left: 71,
		},
	},
	behavior: {
		openAfterExport: true,
		preserveFolderStructure: false,
		exportConcurrency: 3,
		debugMode: false,
		embedPdfFiles: false,
		embedAllFiles: false,
		printFrontmatter: false,
	},
	...overrides,
});

describe('ModalSettingsHelper', () => {
	describe('prepareModalSettings', () => {
		it('should prepare settings for single file', () => {
			const file = createMockFile('notes/test.md', 'test');
			const templates = ['default', 'modern'];
			const settings = createMockSettings();

			const result = ModalSettingsHelper.prepareModalSettings({
				file,
				availableTemplates: templates,
				settings,
			});

			expect(result.notePath).toBe('notes/test.md');
			expect(result.noteTitle).toBe('test');
			expect(result.files).toBeUndefined();
			expect(result.template).toBe('default');
			expect(result.format).toBe(ExportFormat.Standard);
			expect(result.outputFolder).toBe('exports');
			expect(result.availableTemplates).toEqual(templates);
		});

		it('should prepare settings for multi-file export', () => {
			const file1 = createMockFile('notes/test1.md', 'test1');
			const file2 = createMockFile('notes/test2.md', 'test2');
			const file3 = createMockFile('notes/test3.md', 'test3');
			const templates = ['default'];
			const settings = createMockSettings();

			const result = ModalSettingsHelper.prepareModalSettings({
				file: file1,
				additionalFiles: [file2, file3],
				availableTemplates: templates,
				settings,
			});

			expect(result.noteTitle).toBe('3 files');
			expect(result.files).toHaveLength(3);
			expect(result.files).toContain(file1);
			expect(result.files).toContain(file2);
			expect(result.files).toContain(file3);
		});

		it('should include template variables from settings', () => {
			const file = createMockFile('notes/test.md', 'test');
			const settings = createMockSettings();

			const result = ModalSettingsHelper.prepareModalSettings({
				file,
				availableTemplates: ['default'],
				settings,
			});

			expect(result.templateVariables).toBeDefined();
			expect(result.templateVariables?.pageSize).toBe('a4');
			expect(result.templateVariables?.orientation).toBe('portrait');
			expect(result.templateVariables?.flipped).toBe(false);
			expect(result.templateVariables?.marginTop).toBe('71');
			expect(result.templateVariables?.bodyFont).toBe('Georgia');
			expect(result.templateVariables?.headingFont).toBe('Helvetica');
			expect(result.templateVariables?.monospaceFont).toBe('Courier New');
			expect(result.templateVariables?.bodyFontSize).toBe(11);
		});

		it('should set flipped to true for landscape orientation', () => {
			const file = createMockFile('notes/test.md', 'test');
			const settings = createMockSettings({
				pageSetup: {
					size: 'a4',
					orientation: 'landscape',
					margins: { top: 71, right: 71, bottom: 71, left: 71 },
				},
			});

			const result = ModalSettingsHelper.prepareModalSettings({
				file,
				availableTemplates: ['default'],
				settings,
			});

			expect(result.templateVariables?.orientation).toBe('landscape');
			expect(result.templateVariables?.flipped).toBe(true);
		});

		it('should add width:auto for landscape single-page format', () => {
			const file = createMockFile('notes/test.md', 'test');
			const settings = createMockSettings({
				pageSetup: {
					size: 'a4',
					orientation: 'landscape',
					margins: { top: 71, right: 71, bottom: 71, left: 71 },
				},
				exportDefaults: {
					template: 'default',
					format: ExportFormat.SinglePage,
					pageSize: 'a4',
					orientation: 'landscape',
					marginTop: '2.5cm',
					marginBottom: '2.5cm',
					marginLeft: '2.5cm',
					marginRight: '2.5cm',
					bodyFont: 'Georgia',
					headingFont: 'Helvetica',
					monospaceFont: 'Courier New',
					bodyFontSize: '11pt',
				},
			});

			const result = ModalSettingsHelper.prepareModalSettings({
				file,
				availableTemplates: ['default'],
				settings,
			});

			expect(result.templateVariables?.width).toBe('auto');
		});

		it('should not add width:auto for portrait or standard format', () => {
			const file = createMockFile('notes/test.md', 'test');

			// Test portrait orientation
			const settingsPortrait = createMockSettings();
			const resultPortrait = ModalSettingsHelper.prepareModalSettings({
				file,
				availableTemplates: ['default'],
				settings: settingsPortrait,
			});
			expect(resultPortrait.templateVariables?.width).toBeUndefined();

			// Test landscape with standard format
			const settingsLandscapeStandard = createMockSettings({
				pageSetup: {
					size: 'a4',
					orientation: 'landscape',
					margins: { top: 71, right: 71, bottom: 71, left: 71 },
				},
				exportDefaults: {
					template: 'default',
					format: ExportFormat.Standard,
					pageSize: 'a4',
					orientation: 'landscape',
					marginTop: '2.5cm',
					marginBottom: '2.5cm',
					marginLeft: '2.5cm',
					marginRight: '2.5cm',
					bodyFont: 'Georgia',
					headingFont: 'Helvetica',
					monospaceFont: 'Courier New',
					bodyFontSize: '11pt',
				},
			});
			const resultLandscapeStandard = ModalSettingsHelper.prepareModalSettings({
				file,
				availableTemplates: ['default'],
				settings: settingsLandscapeStandard,
			});
			expect(resultLandscapeStandard.templateVariables?.width).toBeUndefined();
		});

		it('should use settings behavior options', () => {
			const file = createMockFile('notes/test.md', 'test');
			const settings = createMockSettings({
				behavior: {
					openAfterExport: false,
					preserveFolderStructure: true,
					exportConcurrency: 3,
					debugMode: false,
					embedPdfFiles: false,
					embedAllFiles: false,
					printFrontmatter: false,
				},
			});

			const result = ModalSettingsHelper.prepareModalSettings({
				file,
				availableTemplates: ['default'],
				settings,
			});

			expect(result.openAfterExport).toBe(false);
			expect(result.preserveFolderStructure).toBe(true);
		});
	});

	describe('prepareForSingleFile', () => {
		it('should be a convenience wrapper for single file', () => {
			const file = createMockFile('notes/test.md', 'test');
			const templates = ['default', 'modern'];
			const settings = createMockSettings();

			const result = ModalSettingsHelper.prepareForSingleFile(
				file,
				templates,
				settings
			);

			expect(result.notePath).toBe('notes/test.md');
			expect(result.noteTitle).toBe('test');
			expect(result.files).toBeUndefined();
			expect(result.availableTemplates).toEqual(templates);
		});
	});

	describe('prepareForMultiFile', () => {
		it('should be a convenience wrapper for multiple files', () => {
			const files = [
				createMockFile('notes/test1.md', 'test1'),
				createMockFile('notes/test2.md', 'test2'),
			];
			const templates = ['default'];
			const settings = createMockSettings();

			const result = ModalSettingsHelper.prepareForMultiFile(
				files,
				templates,
				settings
			);

			expect(result.noteTitle).toBe('2 files');
			expect(result.files).toEqual(files);
			expect(result.notePath).toBe('notes/test1.md');
		});

		it('should handle single file array', () => {
			const files = [createMockFile('notes/test.md', 'test')];
			const settings = createMockSettings();

			const result = ModalSettingsHelper.prepareForMultiFile(
				files,
				['default'],
				settings
			);

			// Single file should still show as single file
			expect(result.noteTitle).toBe('test');
			expect(result.files).toBeUndefined();
		});
	});
});
