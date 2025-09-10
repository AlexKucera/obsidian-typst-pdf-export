/**
 * Typst Variable Mapper
 * Handles mapping of ExportConfig and plugin settings to Typst template variables
 */

import { mapToTypstPaperSize } from '../../utils/paperSizeMapper';
import { PandocOptions } from '../converterTypes';
import type { obsidianTypstPDFExportSettings } from '../../core/settings';
import type { obsidianTypstPDFExport } from '../../../main';

export interface TypstVariable {
	name: string;
	value: string;
}

export class TypstVariableMapper {
	private plugin: obsidianTypstPDFExport;

	constructor(plugin: obsidianTypstPDFExport) {
		this.plugin = plugin;
	}

	/**
	 * Map all variables from ExportConfig and plugin settings to Typst variables
	 * ExportConfig variables take priority over plugin settings
	 */
	mapAllVariablesToTypst(pandocOptions: PandocOptions): TypstVariable[] {
		const variables: TypstVariable[] = [];

		// Add variables from ExportConfig (these take priority)
		const exportConfigVariables = this.mapExportConfigVariables(pandocOptions);
		variables.push(...exportConfigVariables);

		// Add fallback variables from plugin settings (only if not already present)
		const pluginSettingsVariables = this.mapPluginSettingsVariables(pandocOptions);
		variables.push(...pluginSettingsVariables);

		return variables;
	}

	/**
	 * Map ExportConfig variables to Typst variables with transformations
	 */
	private mapExportConfigVariables(pandocOptions: PandocOptions): TypstVariable[] {
		const variables: TypstVariable[] = [];

		if (!pandocOptions.variables) {
			return variables;
		}

		for (const [key, value] of Object.entries(pandocOptions.variables)) {
			if (value !== null && value !== undefined && value.toString().trim() !== '') {
				const mappedVariable = this.transformExportConfigVariable(key, value);
				if (mappedVariable) {
					variables.push(mappedVariable);
				}
			}
		}

		return variables;
	}

	/**
	 * Transform a single ExportConfig variable to Typst variable with name mapping and unit conversion
	 */
	private transformExportConfigVariable(key: string, value: string | number | boolean): TypstVariable | null {
		// Handle special variable name mappings for Typst compatibility
		let variableName = key;
		let processedValue = value;

		switch (key) {
			case 'bodyFont':
				variableName = 'font';
				break;
			case 'headingFont':
				variableName = 'heading_font';
				break;
			case 'monospaceFont':
				variableName = 'monospace_font';
				break;
			case 'bodyFontSize':
				variableName = 'fontsize';
				processedValue = value + 'pt';
				break;
			case 'pageSize':
				variableName = 'paper';
				// Convert to Typst-compatible paper size
				processedValue = mapToTypstPaperSize(value.toString());
				break;
			case 'marginTop':
				variableName = 'margin_top';
				processedValue = value + 'cm';
				break;
			case 'marginBottom':
				variableName = 'margin_bottom';
				processedValue = value + 'cm';
				break;
			case 'marginLeft':
				variableName = 'margin_left';
				processedValue = value + 'cm';
				break;
			case 'marginRight':
				variableName = 'margin_right';
				processedValue = value + 'cm';
				break;
			// Keep other variables as-is (orientation, flipped, width, etc.)
		}

		return {
			name: variableName,
			value: processedValue.toString()
		};
	}

	/**
	 * Map plugin settings to Typst variables as fallbacks (only if not already present in ExportConfig)
	 */
	private mapPluginSettingsVariables(pandocOptions: PandocOptions): TypstVariable[] {
		const variables: TypstVariable[] = [];

		if (!this.plugin || !this.plugin.settings) {
			return variables;
		}

		const settings: obsidianTypstPDFExportSettings = this.plugin.settings;
		const existingVars = pandocOptions.variables || {};

		// Add typography variables only if not already present in variables
		variables.push(...this.mapTypographyVariables(settings, existingVars));

		// Add page setup variables only if not already present
		variables.push(...this.mapPageSetupVariables(settings, existingVars));

		// Add export format variable - only use settings default if not already provided
		if (!existingVars.export_format && settings.exportDefaults && settings.exportDefaults.format) {
			variables.push({
				name: 'export_format',
				value: settings.exportDefaults.format
			});
		}

		return variables;
	}

	/**
	 * Map typography settings to Typst variables
	 */
	private mapTypographyVariables(settings: obsidianTypstPDFExportSettings, existingVars: Record<string, string | number | boolean>): TypstVariable[] {
		const variables: TypstVariable[] = [];

		if (!settings.typography) {
			return variables;
		}

		// Font variables
		if (settings.typography.fonts) {
			// Only add if not already in variables from ExportConfig
			if (!existingVars.bodyFont && !existingVars.font && settings.typography.fonts.body) {
				variables.push({
					name: 'font',
					value: settings.typography.fonts.body
				});
			}
			if (!existingVars.headingFont && !existingVars.heading_font && settings.typography.fonts.heading) {
				variables.push({
					name: 'heading_font',
					value: settings.typography.fonts.heading
				});
			}
			if (!existingVars.monospaceFont && !existingVars.monospace_font && settings.typography.fonts.monospace) {
				variables.push({
					name: 'monospace_font',
					value: settings.typography.fonts.monospace
				});
			}
		}

		// Font size variables
		if (settings.typography.fontSizes) {
			if (!existingVars.bodyFontSize && !existingVars.fontsize && settings.typography.fontSizes.body) {
				variables.push({
					name: 'fontsize',
					value: `${settings.typography.fontSizes.body}pt`
				});
			}
		}

		return variables;
	}

	/**
	 * Map page setup settings to Typst variables
	 */
	private mapPageSetupVariables(settings: obsidianTypstPDFExportSettings, existingVars: Record<string, string | number | boolean>): TypstVariable[] {
		const variables: TypstVariable[] = [];

		if (!settings.pageSetup) {
			return variables;
		}

		// Paper size variable
		if (!existingVars.pageSize && !existingVars.paper && settings.pageSetup.size) {
			const typstPaperSize = mapToTypstPaperSize(settings.pageSetup.size);
			variables.push({
				name: 'paper',
				value: typstPaperSize
			});
		}

		// Orientation variable
		if (!existingVars.orientation && settings.pageSetup.orientation) {
			variables.push({
				name: 'orientation',
				value: settings.pageSetup.orientation
			});
		}

		// Margin variables - only add if not already specified
		if (settings.pageSetup.margins) {
			variables.push(...this.mapMarginVariables(settings.pageSetup.margins, existingVars));
		}

		return variables;
	}

	/**
	 * Map margin settings to Typst variables
	 */
	private mapMarginVariables(margins: {top: number; right: number; bottom: number; left: number;}, existingVars: Record<string, string | number | boolean>): TypstVariable[] {
		const variables: TypstVariable[] = [];

		if (!existingVars.marginTop && !existingVars.margin_top && margins.top !== undefined) {
			variables.push({
				name: 'margin_top',
				value: `${margins.top}cm`
			});
		}
		if (!existingVars.marginRight && !existingVars.margin_right && margins.right !== undefined) {
			variables.push({
				name: 'margin_right',
				value: `${margins.right}cm`
			});
		}
		if (!existingVars.marginBottom && !existingVars.margin_bottom && margins.bottom !== undefined) {
			variables.push({
				name: 'margin_bottom',
				value: `${margins.bottom}cm`
			});
		}
		if (!existingVars.marginLeft && !existingVars.margin_left && margins.left !== undefined) {
			variables.push({
				name: 'margin_left',
				value: `${margins.left}cm`
			});
		}

		return variables;
	}

	/**
	 * Get a set of variable names that are already defined in ExportConfig
	 * Used for priority checking between ExportConfig and plugin settings
	 */
	getExportConfigVariableNames(pandocOptions: PandocOptions): Set<string> {
		const names = new Set<string>();

		if (!pandocOptions.variables) {
			return names;
		}

		for (const [key, value] of Object.entries(pandocOptions.variables)) {
			if (value !== null && value !== undefined && value.toString().trim() !== '') {
				// Add both original key and mapped name
				names.add(key);
				
				// Add mapped names for priority checking
				switch (key) {
					case 'bodyFont':
						names.add('font');
						break;
					case 'headingFont':
						names.add('heading_font');
						break;
					case 'monospaceFont':
						names.add('monospace_font');
						break;
					case 'bodyFontSize':
						names.add('fontsize');
						break;
					case 'pageSize':
						names.add('paper');
						break;
					case 'marginTop':
						names.add('margin_top');
						break;
					case 'marginBottom':
						names.add('margin_bottom');
						break;
					case 'marginLeft':
						names.add('margin_left');
						break;
					case 'marginRight':
						names.add('margin_right');
						break;
				}
			}
		}

		return names;
	}

	/**
	 * Convert TypstVariable array to pandoc argument format
	 */
	convertVariablesToPandocArgs(variables: TypstVariable[]): string[] {
		const args: string[] = [];

		for (const variable of variables) {
			args.push('-V', `${variable.name}=${variable.value}`);
		}

		return args;
	}
}