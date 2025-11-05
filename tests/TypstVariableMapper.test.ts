import { describe, it, expect, vi } from 'vitest';
import { TypstVariableMapper } from '../src/converters/pandoc/TypstVariableMapper';
import { PandocOptions } from '../src/converters/converterTypes';
import { ExportFormat, obsidianTypstPDFExportSettings } from '../src/core/settings';

const createMockPlugin = (settings: Partial<obsidianTypstPDFExportSettings> = {}) => ({
	settings: {
		pandocPath: '/usr/bin/pandoc',
		typstPath: '/usr/bin/typst',
		outputFolder: 'exports',
		executablePaths: { imagemagickPath: '', additionalPaths: [] },
		customEnvironmentVariables: {},
		exportDefaults: {
			template: 'default',
			format: ExportFormat.Standard,
			pageSize: 'a4',
			orientation: 'portrait' as const,
			marginTop: '2.5cm',
			marginBottom: '2.5cm',
			marginLeft: '2.5cm',
			marginRight: '2.5cm',
			bodyFont: 'Georgia',
			headingFont: 'Helvetica',
			monospaceFont: 'Courier',
			bodyFontSize: '11pt',
		},
		typography: {
			fonts: { body: 'Georgia', heading: 'Helvetica', monospace: 'Courier' },
			fontSizes: { body: 11, heading: 16, small: 9 },
		},
		pageSetup: {
			size: 'a4',
			orientation: 'portrait' as const,
			margins: { top: 71, right: 71, bottom: 71, left: 71 },
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
		...settings,
	},
} as any);

describe('TypstVariableMapper', () => {
	describe('transformExportConfigVariable', () => {
		it('should map bodyFont to font', () => {
			const mapper = new TypstVariableMapper(createMockPlugin());
			const options: PandocOptions = {
				variables: { bodyFont: 'Arial' },
			};

			const vars = mapper.mapAllVariablesToTypst(options);
			const fontVar = vars.find(v => v.name === 'font');

			expect(fontVar).toBeDefined();
			expect(fontVar?.value).toBe('Arial');
		});

		it('should map headingFont to heading_font', () => {
			const mapper = new TypstVariableMapper(createMockPlugin());
			const options: PandocOptions = {
				variables: { headingFont: 'Helvetica' },
			};

			const vars = mapper.mapAllVariablesToTypst(options);
			const headingVar = vars.find(v => v.name === 'heading_font');

			expect(headingVar).toBeDefined();
			expect(headingVar?.value).toBe('Helvetica');
		});

		it('should map bodyFontSize to fontsize with pt unit', () => {
			const mapper = new TypstVariableMapper(createMockPlugin());
			const options: PandocOptions = {
				variables: { bodyFontSize: 12 },
			};

			const vars = mapper.mapAllVariablesToTypst(options);
			const sizeVar = vars.find(v => v.name === 'fontsize');

			expect(sizeVar).toBeDefined();
			expect(sizeVar?.value).toBe('12pt');
		});

		it('should map pageSize to paper with Typst value', () => {
			const mapper = new TypstVariableMapper(createMockPlugin());
			const options: PandocOptions = {
				variables: { pageSize: 'a4' },
			};

			const vars = mapper.mapAllVariablesToTypst(options);
			const paperVar = vars.find(v => v.name === 'paper');

			expect(paperVar).toBeDefined();
			expect(paperVar?.value).toBe('a4');
		});

		it('should map margin variables with cm unit', () => {
			const mapper = new TypstVariableMapper(createMockPlugin());
			const options: PandocOptions = {
				variables: {
					marginTop: 2,
					marginBottom: 3,
					marginLeft: 2.5,
					marginRight: 2.5,
				},
			};

			const vars = mapper.mapAllVariablesToTypst(options);

			expect(vars.find(v => v.name === 'margin_top')?.value).toBe('2cm');
			expect(vars.find(v => v.name === 'margin_bottom')?.value).toBe('3cm');
			expect(vars.find(v => v.name === 'margin_left')?.value).toBe('2.5cm');
			expect(vars.find(v => v.name === 'margin_right')?.value).toBe('2.5cm');
		});

		it('should preserve unmapped variables', () => {
			const mapper = new TypstVariableMapper(createMockPlugin());
			const options: PandocOptions = {
				variables: {
					orientation: 'landscape',
					flipped: true,
					customVar: 'value',
				},
			};

			const vars = mapper.mapAllVariablesToTypst(options);

			expect(vars.find(v => v.name === 'orientation')?.value).toBe('landscape');
			expect(vars.find(v => v.name === 'flipped')?.value).toBe('true');
			expect(vars.find(v => v.name === 'customVar')?.value).toBe('value');
		});
	});

	describe('mapPluginSettingsVariables', () => {
		it('should add typography variables from settings', () => {
			const mapper = new TypstVariableMapper(createMockPlugin());
			const options: PandocOptions = { variables: {} };

			const vars = mapper.mapAllVariablesToTypst(options);

			expect(vars.find(v => v.name === 'font')?.value).toBe('Georgia');
			expect(vars.find(v => v.name === 'heading_font')?.value).toBe('Helvetica');
			expect(vars.find(v => v.name === 'fontsize')?.value).toBe('11pt');
		});

		it('should not override export config variables', () => {
			const mapper = new TypstVariableMapper(createMockPlugin());
			const options: PandocOptions = {
				variables: { bodyFont: 'Arial' },
			};

			const vars = mapper.mapAllVariablesToTypst(options);
			const fontVars = vars.filter(v => v.name === 'font');

			// Should only have one font variable from export config
			expect(fontVars).toHaveLength(1);
			expect(fontVars[0].value).toBe('Arial');
		});

		it('should add page setup variables from settings', () => {
			const mapper = new TypstVariableMapper(createMockPlugin());
			const options: PandocOptions = { variables: {} };

			const vars = mapper.mapAllVariablesToTypst(options);

			expect(vars.find(v => v.name === 'paper')?.value).toBe('a4');
			expect(vars.find(v => v.name === 'orientation')?.value).toBe('portrait');
		});
	});

	describe('convertVariablesToPandocArgs', () => {
		it('should convert variables to pandoc -V arguments', () => {
			const mapper = new TypstVariableMapper(createMockPlugin());
			const variables = [
				{ name: 'font', value: 'Arial' },
				{ name: 'fontsize', value: '12pt' },
				{ name: 'paper', value: 'a4' },
			];

			const args = mapper.convertVariablesToPandocArgs(variables);

			expect(args).toEqual([
				'-V', 'font=Arial',
				'-V', 'fontsize=12pt',
				'-V', 'paper=a4',
			]);
		});

		it('should handle empty variables array', () => {
			const mapper = new TypstVariableMapper(createMockPlugin());
			const args = mapper.convertVariablesToPandocArgs([]);

			expect(args).toEqual([]);
		});
	});

	describe('getExportConfigVariableNames', () => {
		it('should return set of variable names including mappings', () => {
			const mapper = new TypstVariableMapper(createMockPlugin());
			const options: PandocOptions = {
				variables: {
					bodyFont: 'Arial',
					pageSize: 'a4',
					marginTop: 2,
				},
			};

			const names = mapper.getExportConfigVariableNames(options);

			expect(names.has('bodyFont')).toBe(true);
			expect(names.has('font')).toBe(true);
			expect(names.has('pageSize')).toBe(true);
			expect(names.has('paper')).toBe(true);
			expect(names.has('marginTop')).toBe(true);
			expect(names.has('margin_top')).toBe(true);
		});

		it('should handle empty variables', () => {
			const mapper = new TypstVariableMapper(createMockPlugin());
			const options: PandocOptions = { variables: {} };

			const names = mapper.getExportConfigVariableNames(options);

			expect(names.size).toBe(0);
		});
	});
});
