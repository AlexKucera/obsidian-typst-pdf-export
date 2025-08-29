/**
 * Hybrid Export Mode Integration System
 * Combines extracted CSS styles with Typst's typography system for style-preserving exports
 */

import { CSSExtractor, ExtractedStyle } from './CSSExtractor';
import { CSSToTypstMapper, TypstStyleRule } from './CSSToTypstMapper';
import { ThemeManager, ThemeDetectionResult } from './ThemeManager';
import { PopularThemeSupport, EnhancedThemeProfile } from './PopularThemeSupport';
import { PluginSpecificStyleHandler, PluginDetectionResult } from './PluginSpecificStyleHandler';

export interface HybridExportOptions {
	preserveThemeColors?: boolean;
	preservePluginStyles?: boolean;
	optimizeForReadability?: boolean;
	useTypstDefaults?: boolean;
	styleIntensity?: 'minimal' | 'moderate' | 'full';
	conflictResolution?: 'css-priority' | 'typst-priority' | 'balanced';
	includeCustomProperties?: boolean;
	fontFallback?: boolean;
}

export interface StyleConflict {
	property: string;
	cssValue: string;
	typstDefault: string;
	resolution: 'css' | 'typst' | 'hybrid';
	reason: string;
}

export interface HybridStyleResult {
	typstTemplate: string;
	extractedStyles: ExtractedStyle[];
	appliedRules: TypstStyleRule[];
	conflicts: StyleConflict[];
	themeInfo?: ThemeDetectionResult;
	pluginInfo: PluginDetectionResult[];
	optimizations: string[];
	warnings: string[];
}

/**
 * Main hybrid export mode class that orchestrates style extraction and Typst integration
 */
export class HybridExportMode {
	private app: any;
	private cssExtractor: CSSExtractor;
	private cssMapper: CSSToTypstMapper;
	private themeManager: ThemeManager;
	private themeSupport: PopularThemeSupport;
	private pluginHandler: PluginSpecificStyleHandler;

	constructor(app: any) {
		this.app = app;
		this.cssExtractor = new CSSExtractor(app);
		this.cssMapper = new CSSToTypstMapper();
		this.themeManager = new ThemeManager(app);
		this.themeSupport = new PopularThemeSupport(app);
		this.pluginHandler = new PluginSpecificStyleHandler(app);
	}

	/**
	 * Generate a hybrid Typst template with extracted styles
	 */
	public async generateHybridTemplate(options: HybridExportOptions = {}): Promise<HybridStyleResult> {
		const result: HybridStyleResult = {
			typstTemplate: '',
			extractedStyles: [],
			appliedRules: [],
			conflicts: [],
			pluginInfo: [],
			optimizations: [],
			warnings: []
		};

		try {
			// Step 1: Extract styles from current Obsidian state
			result.extractedStyles = await this.cssExtractor.extractStyles({
				includeComputedStyles: true,
				captureCustomProperties: options.includeCustomProperties !== false
			});

			// Step 2: Detect and extract theme-specific styles
			if (options.preserveThemeColors !== false) {
				result.themeInfo = await this.themeManager.detectCurrentTheme();
				
				if (result.themeInfo) {
					const enhancedTheme = await this.themeSupport.getEnhancedThemeProfile(result.themeInfo.theme.name);
					if (enhancedTheme) {
						const themeStyles = await this.themeSupport.extractThemeStyles(enhancedTheme);
						result.extractedStyles.push(...themeStyles);
					}
				}
			}

			// Step 3: Detect and extract plugin-specific styles
			if (options.preservePluginStyles !== false) {
				result.pluginInfo = await this.pluginHandler.detectActivePlugins();
				
				for (const pluginResult of result.pluginInfo) {
					if (pluginResult.isActive) {
						result.extractedStyles.push(...pluginResult.extractedStyles);
					}
				}
			}

			// Step 4: Convert CSS to Typst rules
			result.appliedRules = await this.convertStylesToTypstRules(
				result.extractedStyles,
				options
			);

			// Step 5: Resolve style conflicts
			result.conflicts = this.resolveStyleConflicts(result.appliedRules, options);

			// Step 6: Generate optimizations
			result.optimizations = this.generateOptimizations(result.appliedRules, options);

			// Step 7: Build the final Typst template
			result.typstTemplate = this.buildTypstTemplate(result, options);

			// Step 8: Generate warnings for potential issues
			result.warnings = this.generateWarnings(result);

		} catch (error) {
			result.warnings.push(`Error during hybrid template generation: ${error.message}`);
			console.error('HybridExportMode error:', error);
			
			// Fallback to minimal template
			result.typstTemplate = this.buildFallbackTemplate(options);
		}

		return result;
	}

	/**
	 * Convert extracted styles to Typst rules
	 */
	private async convertStylesToTypstRules(
		styles: ExtractedStyle[],
		options: HybridExportOptions
	): Promise<TypstStyleRule[]> {
		const rules: TypstStyleRule[] = [];
		const processedSelectors = new Set<string>();

		// Group styles by selector for efficient processing
		const stylesBySelector = this.groupStylesBySelector(styles);

		for (const [selector, selectorStyles] of stylesBySelector) {
			if (processedSelectors.has(selector)) continue;
			
			// Determine the appropriate Typst target for this selector
			const typstTarget = this.mapSelectorToTypstTarget(selector);
			if (!typstTarget) continue;

			// Convert CSS properties to Typst properties
			const typstProperties: Record<string, string> = {};
			let hasValidProperties = false;

			for (const style of selectorStyles) {
				const mappedProperty = this.cssMapper.mapCSSProperty(
					style.property,
					style.value,
					{ simplifyColors: true, optimizeForPrint: options.optimizeForReadability }
				);

				if (mappedProperty && Object.keys(mappedProperty).length > 0) {
					Object.assign(typstProperties, mappedProperty);
					hasValidProperties = true;
				}
			}

			if (hasValidProperties) {
				// Create Typst rule based on intensity setting
				const rule = this.createTypstRule(
					typstTarget,
					typstProperties,
					selector,
					options.styleIntensity || 'moderate'
				);

				if (rule) {
					rules.push(rule);
					processedSelectors.add(selector);
				}
			}
		}

		// Add theme-specific rules
		if (options.preserveThemeColors !== false) {
			const themeRules = await this.themeManager.generateThemeStyleRules(this.cssMapper);
			rules.push(...themeRules);
		}

		// Add plugin-specific rules
		if (options.preservePluginStyles !== false) {
			const pluginRules = this.pluginHandler.generatePluginTypstRules();
			rules.push(...pluginRules);
		}

		return rules;
	}

	/**
	 * Group styles by CSS selector
	 */
	private groupStylesBySelector(styles: ExtractedStyle[]): Map<string, ExtractedStyle[]> {
		const grouped = new Map<string, ExtractedStyle[]>();

		for (const style of styles) {
			const existing = grouped.get(style.selector) || [];
			existing.push(style);
			grouped.set(style.selector, existing);
		}

		return grouped;
	}

	/**
	 * Map CSS selector to appropriate Typst target
	 */
	private mapSelectorToTypstTarget(selector: string): string | null {
		// Handle heading selectors
		if (selector.match(/^h[1-6]$/) || selector.includes('heading')) {
			return 'heading';
		}

		// Handle paragraph selectors
		if (selector === 'p' || selector.includes('markdown-preview-view') || 
			selector.includes('cm-line')) {
			return 'text';
		}

		// Handle link selectors
		if (selector === 'a' || selector.includes('cm-link')) {
			return 'link';
		}

		// Handle code selectors
		if (selector === 'code' || selector.includes('cm-inline-code') || 
			selector.includes('HyperMD-codeblock')) {
			return 'raw';
		}

		// Handle strong/bold selectors
		if (selector === 'strong' || selector === 'b' || selector.includes('bold')) {
			return 'strong';
		}

		// Handle emphasis/italic selectors
		if (selector === 'em' || selector === 'i' || selector.includes('italic')) {
			return 'emph';
		}

		// Handle list selectors
		if (selector.includes('list') || selector === 'ul' || selector === 'ol') {
			return 'list';
		}

		// Handle table selectors
		if (selector.includes('table') || selector === 'table') {
			return 'table';
		}

		// Handle blockquote selectors
		if (selector.includes('blockquote') || selector.includes('quote')) {
			return 'quote';
		}

		// Handle general text elements
		if (selector === 'body' || selector.includes('markdown')) {
			return 'text';
		}

		// Plugin-specific selectors
		if (selector.includes('dataview')) {
			return 'table'; // Most dataview content is tabular
		}

		if (selector.includes('callout')) {
			return 'quote'; // Treat callouts as quote-like elements
		}

		// Return null for unrecognized selectors
		return null;
	}

	/**
	 * Create a Typst rule from CSS properties
	 */
	private createTypstRule(
		target: string,
		properties: Record<string, string>,
		originalSelector: string,
		intensity: 'minimal' | 'moderate' | 'full'
	): TypstStyleRule | null {
		// Filter properties based on intensity
		const filteredProperties = this.filterPropertiesByIntensity(properties, intensity);
		
		if (Object.keys(filteredProperties).length === 0) {
			return null;
		}

		// Determine rule type based on target
		const ruleType = this.determineRuleType(target, originalSelector);

		return {
			type: ruleType,
			target,
			properties: filteredProperties,
			condition: this.generateCondition(target, originalSelector)
		};
	}

	/**
	 * Filter properties based on style intensity setting
	 */
	private filterPropertiesByIntensity(
		properties: Record<string, string>,
		intensity: 'minimal' | 'moderate' | 'full'
	): Record<string, string> {
		const filtered: Record<string, string> = {};

		// Always include essential properties
		const essentialProperties = ['fill', 'font', 'size'];
		
		// Moderate adds layout and spacing
		const moderateProperties = [...essentialProperties, 'weight', 'style', 'stroke', 'align'];
		
		// Full includes all properties
		const allowedProperties = intensity === 'minimal' ? essentialProperties :
								 intensity === 'moderate' ? moderateProperties :
								 Object.keys(properties);

		for (const [key, value] of Object.entries(properties)) {
			if (allowedProperties.includes(key) && value && value.trim()) {
				filtered[key] = value;
			}
		}

		return filtered;
	}

	/**
	 * Determine whether to use 'set' or 'show' rule
	 */
	private determineRuleType(target: string, originalSelector: string): 'set' | 'show' {
		// Use 'show' for conditional styling
		if (originalSelector.includes('.') || originalSelector.includes('[') ||
			originalSelector.includes(':')) {
			return 'show';
		}

		// Use 'set' for general element styling
		return 'set';
	}

	/**
	 * Generate condition for show rules
	 */
	private generateCondition(target: string, originalSelector: string): string | undefined {
		// Generate conditions for heading levels
		if (target === 'heading' && originalSelector.match(/^h([1-6])$/)) {
			const level = originalSelector.match(/^h([1-6])$/)?.[1];
			return `heading.where(level: ${level})`;
		}

		// For other complex selectors, return undefined to use simple set rule
		return undefined;
	}

	/**
	 * Resolve conflicts between CSS and Typst defaults
	 */
	private resolveStyleConflicts(
		rules: TypstStyleRule[],
		options: HybridExportOptions
	): StyleConflict[] {
		const conflicts: StyleConflict[] = [];
		const conflictResolution = options.conflictResolution || 'balanced';

		// Define Typst default values
		const typstDefaults: Record<string, string> = {
			'font': 'Linux Libertine',
			'size': '11pt',
			'fill': 'black',
			'weight': 'regular',
			'style': 'normal'
		};

		for (const rule of rules) {
			for (const [property, value] of Object.entries(rule.properties)) {
				const typstDefault = typstDefaults[property];
				
				if (typstDefault && value !== typstDefault) {
					let resolution: 'css' | 'typst' | 'hybrid';
					let reason: string;

					switch (conflictResolution) {
						case 'css-priority':
							resolution = 'css';
							reason = 'CSS values take precedence';
							break;
						case 'typst-priority':
							resolution = 'typst';
							reason = 'Typst defaults preferred for consistency';
							// Remove the conflicting property
							delete rule.properties[property];
							break;
						case 'balanced':
						default:
							resolution = this.balancedConflictResolution(property, value, typstDefault);
							reason = 'Balanced approach based on readability';
							if (resolution === 'typst') {
								delete rule.properties[property];
							}
							break;
					}

					conflicts.push({
						property,
						cssValue: value,
						typstDefault,
						resolution,
						reason
					});
				}
			}
		}

		return conflicts;
	}

	/**
	 * Apply balanced conflict resolution
	 */
	private balancedConflictResolution(
		property: string,
		cssValue: string,
		typstDefault: string
	): 'css' | 'typst' | 'hybrid' {
		// For font sizes, prefer CSS if within reasonable range
		if (property === 'size') {
			const size = parseFloat(cssValue);
			if (size >= 8 && size <= 24) {
				return 'css';
			}
			return 'typst';
		}

		// For colors, prefer CSS for better theme preservation
		if (property === 'fill') {
			return 'css';
		}

		// For fonts, prefer Typst defaults for consistency
		if (property === 'font') {
			// But allow CSS if it's a common web font
			const webFonts = ['Arial', 'Helvetica', 'Times', 'Georgia', 'Verdana'];
			const fontFamily = cssValue.toLowerCase();
			
			if (webFonts.some(font => fontFamily.includes(font.toLowerCase()))) {
				return 'css';
			}
			return 'typst';
		}

		// Default to CSS for other properties
		return 'css';
	}

	/**
	 * Generate style optimizations
	 */
	private generateOptimizations(
		rules: TypstStyleRule[],
		options: HybridExportOptions
	): string[] {
		const optimizations: string[] = [];

		// Check for redundant rules
		const rulesByTarget = new Map<string, TypstStyleRule[]>();
		for (const rule of rules) {
			const existing = rulesByTarget.get(rule.target) || [];
			existing.push(rule);
			rulesByTarget.set(rule.target, existing);
		}

		for (const [target, targetRules] of rulesByTarget) {
			if (targetRules.length > 3) {
				optimizations.push(`Consider consolidating ${targetRules.length} rules for ${target}`);
			}
		}

		// Check for readability optimizations
		if (options.optimizeForReadability) {
			const textRules = rules.filter(r => r.target === 'text');
			if (textRules.length > 0) {
				optimizations.push('Applied readability optimizations to text elements');
			}
		}

		// Check for font fallbacks
		if (options.fontFallback !== false) {
			const fontRules = rules.filter(r => r.properties.font);
			if (fontRules.length > 0) {
				optimizations.push('Consider adding font fallback options');
			}
		}

		return optimizations;
	}

	/**
	 * Build the final Typst template
	 */
	private buildTypstTemplate(result: HybridStyleResult, options: HybridExportOptions): string {
		const lines: string[] = [];

		// Template header
		lines.push('// Hybrid Typst Template Generated from Obsidian Styles');
		lines.push('// Generated by obsidian-typst-pdf-export plugin');
		lines.push('');

		// Theme information
		if (result.themeInfo) {
			lines.push(`// Theme: ${result.themeInfo.theme.displayName}`);
			lines.push(`// Confidence: ${Math.round(result.themeInfo.confidence * 100)}%`);
			lines.push('');
		}

		// Plugin information
		if (result.pluginInfo.length > 0) {
			lines.push('// Active plugins with style support:');
			for (const plugin of result.pluginInfo) {
				if (plugin.isActive) {
					lines.push(`// - ${plugin.plugin.displayName}`);
				}
			}
			lines.push('');
		}

		// Template configuration function
		lines.push('#let hybrid-conf(doc) = {');
		
		// Add set rules
		const setRules = result.appliedRules.filter(r => r.type === 'set');
		if (setRules.length > 0) {
			lines.push('  // Set rules for global styling');
			for (const rule of setRules) {
				const properties = this.formatTypstProperties(rule.properties);
				if (properties) {
					lines.push(`  set ${rule.target}(${properties})`);
				}
			}
			lines.push('');
		}

		// Add show rules
		const showRules = result.appliedRules.filter(r => r.type === 'show');
		if (showRules.length > 0) {
			lines.push('  // Show rules for conditional styling');
			for (const rule of showRules) {
				const properties = this.formatTypstProperties(rule.properties);
				const target = rule.condition ? `${rule.target}.where(${rule.condition})` : rule.target;
				if (properties) {
					lines.push(`  show ${target}: set ${rule.target}(${properties})`);
				}
			}
			lines.push('');
		}

		// Page setup
		lines.push('  // Page configuration');
		lines.push('  set page(');
		lines.push('    paper: "us-letter",');
		lines.push('    margin: (x: 1in, y: 1in),');
		if (options.optimizeForReadability) {
			lines.push('    numbering: "1",');
		}
		lines.push('  )');
		lines.push('');

		// Paragraph setup
		lines.push('  // Paragraph configuration');
		lines.push('  set par(');
		lines.push('    justify: true,');
		if (options.optimizeForReadability) {
			lines.push('    leading: 0.65em,');
		}
		lines.push('  )');
		lines.push('');

		// Document content
		lines.push('  doc');
		lines.push('}');
		lines.push('');

		// Apply the template
		lines.push('#show: hybrid-conf');
		lines.push('');

		// Usage instructions
		lines.push('// Usage: Add your content below this line');
		lines.push('// The template will automatically apply the extracted styles');

		return lines.join('\n');
	}

	/**
	 * Format Typst properties for output
	 */
	private formatTypstProperties(properties: Record<string, string>): string {
		const formatted: string[] = [];

		for (const [key, value] of Object.entries(properties)) {
			if (value && value.trim()) {
				// Quote string values that aren't already quoted
				const formattedValue = this.formatPropertyValue(key, value);
				formatted.push(`${key}: ${formattedValue}`);
			}
		}

		return formatted.join(', ');
	}

	/**
	 * Format individual property values
	 */
	private formatPropertyValue(property: string, value: string): string {
		// Don't double-quote already quoted values
		if (value.startsWith('"') && value.endsWith('"')) {
			return value;
		}

		// Quote font names
		if (property === 'font' && !value.match(/^[a-z-]+$/)) {
			return `"${value}"`;
		}

		// Quote color names that aren't standard colors
		if (property === 'fill' && !value.startsWith('rgb(') && 
			!value.startsWith('#') && !['black', 'white', 'red', 'blue', 'green'].includes(value)) {
			return `"${value}"`;
		}

		return value;
	}

	/**
	 * Build fallback template for errors
	 */
	private buildFallbackTemplate(options: HybridExportOptions): string {
		return `// Fallback Typst Template
// Generated due to error in style extraction

#let fallback-conf(doc) = {
  set text(
    font: "Linux Libertine",
    size: 11pt,
    fill: black,
  )
  
  set par(
    justify: true,
    leading: 0.65em,
  )
  
  set page(
    paper: "us-letter",
    margin: (x: 1in, y: 1in),
    numbering: "1",
  )
  
  doc
}

#show: fallback-conf

// Your content here
`;
	}

	/**
	 * Generate warnings about potential issues
	 */
	private generateWarnings(result: HybridStyleResult): string[] {
		const warnings: string[] = [];

		// Check for high number of conflicts
		if (result.conflicts.length > 10) {
			warnings.push(`High number of style conflicts (${result.conflicts.length}). Consider adjusting conflict resolution strategy.`);
		}

		// Check for missing theme detection
		if (!result.themeInfo && result.extractedStyles.length > 0) {
			warnings.push('Theme detection failed. Using fallback styling.');
		}

		// Check for plugin compatibility
		const activePlugins = result.pluginInfo.filter(p => p.isActive);
		const unsupportedPlugins = result.pluginInfo.filter(p => p.isActive && p.extractedStyles.length === 0);
		
		if (unsupportedPlugins.length > 0) {
			warnings.push(`Some active plugins may not be fully supported: ${unsupportedPlugins.map(p => p.plugin.displayName).join(', ')}`);
		}

		// Check for empty style extraction
		if (result.extractedStyles.length === 0) {
			warnings.push('No styles extracted. Using default Typst styling.');
		}

		return warnings;
	}

	/**
	 * Preview the hybrid template output
	 */
	public async previewHybridTemplate(
		content: string,
		options: HybridExportOptions = {}
	): Promise<{ template: string; preview: string }> {
		const result = await this.generateHybridTemplate(options);
		
		const preview = `${result.typstTemplate}

// Preview Content
${content}

// Generated with ${result.appliedRules.length} style rules
// Theme: ${result.themeInfo?.theme.displayName || 'Default'}
// Active plugins: ${result.pluginInfo.filter(p => p.isActive).length}
`;

		return {
			template: result.typstTemplate,
			preview
		};
	}

	/**
	 * Get default hybrid export options
	 */
	public getDefaultOptions(): HybridExportOptions {
		return {
			preserveThemeColors: true,
			preservePluginStyles: true,
			optimizeForReadability: true,
			useTypstDefaults: false,
			styleIntensity: 'moderate',
			conflictResolution: 'balanced',
			includeCustomProperties: true,
			fontFallback: true
		};
	}

	/**
	 * Validate hybrid export options
	 */
	public validateOptions(options: HybridExportOptions): { valid: boolean; errors: string[] } {
		const errors: string[] = [];

		if (options.styleIntensity && !['minimal', 'moderate', 'full'].includes(options.styleIntensity)) {
			errors.push('Invalid styleIntensity. Must be "minimal", "moderate", or "full"');
		}

		if (options.conflictResolution && !['css-priority', 'typst-priority', 'balanced'].includes(options.conflictResolution)) {
			errors.push('Invalid conflictResolution. Must be "css-priority", "typst-priority", or "balanced"');
		}

		return {
			valid: errors.length === 0,
			errors
		};
	}
}