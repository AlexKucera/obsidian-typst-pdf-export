/**
 * Popular Theme Support System
 * Enhanced support for specific popular Obsidian themes with detailed style profiles
 */

import { ThemeManager, ThemeProfile, ThemeDetectionResult } from './ThemeManager';
import { CSSExtractor } from './CSSExtractor';
import { CSSToTypstMapper, TypstStyleRule } from './CSSToTypstMapper';

export interface EnhancedThemeProfile extends ThemeProfile {
	version?: string;
	author?: string;
	repository?: string;
	enhancedExtraction?: (extractor: CSSExtractor) => Promise<TypstStyleRule[]>;
	testSelectors?: string[]; // Selectors to test for theme detection
	compatibilityNotes?: string;
}

export interface ThemeTestResult {
	theme: string;
	detected: boolean;
	confidence: number;
	missingElements: string[];
	extractedRules: TypstStyleRule[];
}

/**
 * Enhanced support for popular Obsidian themes
 */
export class PopularThemeSupport {
	private themeManager: ThemeManager;
	private enhancedProfiles: Map<string, EnhancedThemeProfile> = new Map();

	constructor(themeManager: ThemeManager) {
		this.themeManager = themeManager;
		this.registerEnhancedThemes();
	}

	/**
	 * Register enhanced theme profiles for popular themes
	 */
	private registerEnhancedThemes(): void {
		// Minimal Theme - Enhanced Profile
		this.registerEnhancedTheme({
			name: 'minimal',
			displayName: 'Minimal',
			version: '6.x+',
			author: 'kepano',
			repository: 'kepano/obsidian-minimal',
			identifiers: ['minimal-theme', 'theme-minimal', 'is-minimal-theme'],
			variableMappings: [
				{
					cssVariable: '--text-normal',
					typstProperty: 'fill',
					fallbackValue: 'rgb(25, 25, 25)',
					transform: (value) => this.adjustMinimalTextColor(value)
				},
				{
					cssVariable: '--text-muted',
					typstProperty: 'fill',
					fallbackValue: 'rgb(100, 100, 100)'
				},
				{
					cssVariable: '--text-accent',
					typstProperty: 'fill',
					fallbackValue: 'blue'
				},
				{
					cssVariable: '--background-primary',
					typstProperty: 'fill',
					fallbackValue: 'white'
				},
				{
					cssVariable: '--background-secondary',
					typstProperty: 'fill',
					fallbackValue: 'rgb(250, 250, 250)'
				},
				{
					cssVariable: '--minimal-text-size',
					typstProperty: 'size',
					fallbackValue: '16px',
					transform: (value) => this.convertMinimalFontSize(value)
				},
				{
					cssVariable: '--default-font',
					typstProperty: 'font',
					fallbackValue: '"Inter"',
					transform: (value) => this.normalizeMinimalFont(value)
				}
			],
			testSelectors: [
				'.minimal-theme .workspace',
				'.is-minimal-theme .view-content',
				'.theme-minimal .markdown-preview-view'
			],
			enhancedExtraction: async (extractor: CSSExtractor) => {
				return await this.extractMinimalThemeStyles(extractor);
			},
			compatibilityNotes: 'Best with Minimal v6.0+. Supports color schemes, typography scaling, and custom accents.',
			priority: 15
		});

		// Blue Topaz Theme - Enhanced Profile
		this.registerEnhancedTheme({
			name: 'blue-topaz',
			displayName: 'Blue Topaz',
			version: '0.2.x+',
			author: '3F',
			repository: '3F/Blue-topaz-obsidian',
			identifiers: ['blue-topaz-theme', 'bt', 'theme-blue-topaz'],
			variableMappings: [
				{
					cssVariable: '--text-normal',
					typstProperty: 'fill',
					fallbackValue: 'rgb(47, 52, 55)'
				},
				{
					cssVariable: '--text-accent',
					typstProperty: 'fill',
					fallbackValue: 'rgb(8, 109, 221)'
				},
				{
					cssVariable: '--bt-accent',
					typstProperty: 'fill',
					fallbackValue: 'rgb(8, 109, 221)'
				},
				{
					cssVariable: '--h1-color',
					typstProperty: 'fill',
					fallbackValue: 'rgb(8, 109, 221)'
				},
				{
					cssVariable: '--h2-color',
					typstProperty: 'fill',
					fallbackValue: 'rgb(8, 109, 221)'
				},
				{
					cssVariable: '--h3-color',
					typstProperty: 'fill',
					fallbackValue: 'rgb(8, 109, 221)'
				}
			],
			testSelectors: [
				'.blue-topaz-theme .workspace',
				'.bt .markdown-preview-view h1',
				'[data-theme="blue-topaz"] .view-content'
			],
			enhancedExtraction: async (extractor: CSSExtractor) => {
				return await this.extractBlueTopazStyles(extractor);
			},
			compatibilityNotes: 'Excellent heading color support. Custom callout styles included.',
			priority: 15
		});

		// Sanctum Theme - Enhanced Profile  
		this.registerEnhancedTheme({
			name: 'sanctum',
			displayName: 'Sanctum',
			version: '1.x+',
			author: 'jdanielmourao',
			repository: 'jdanielmourao/obsidian-sanctum',
			identifiers: ['sanctum', 'theme-sanctum'],
			variableMappings: [
				{
					cssVariable: '--text-normal',
					typstProperty: 'fill',
					fallbackValue: 'rgb(220, 220, 220)'
				},
				{
					cssVariable: '--accent',
					typstProperty: 'fill',
					fallbackValue: 'rgb(126, 208, 255)'
				},
				{
					cssVariable: '--background-primary',
					typstProperty: 'fill',
					fallbackValue: 'rgb(16, 20, 24)'
				},
				{
					cssVariable: '--background-secondary',
					typstProperty: 'fill',
					fallbackValue: 'rgb(22, 27, 32)'
				}
			],
			testSelectors: [
				'.sanctum .workspace',
				'.theme-sanctum .markdown-preview-view'
			],
			enhancedExtraction: async (extractor: CSSExtractor) => {
				return await this.extractSanctumStyles(extractor);
			},
			compatibilityNotes: 'Dark theme optimized. Great for code blocks and syntax highlighting.',
			priority: 10
		});

		// Things Theme - Enhanced Profile
		this.registerEnhancedTheme({
			name: 'things',
			displayName: 'Things',
			version: '2.x+',
			author: 'colineckert',
			repository: 'colineckert/obsidian-things',
			identifiers: ['things-theme', 'theme-things'],
			variableMappings: [
				{
					cssVariable: '--text-normal',
					typstProperty: 'fill',
					fallbackValue: 'rgb(51, 51, 51)'
				},
				{
					cssVariable: '--things-accent',
					typstProperty: 'fill',
					fallbackValue: 'rgb(0, 122, 255)'
				},
				{
					cssVariable: '--things-green',
					typstProperty: 'fill',
					fallbackValue: 'rgb(40, 205, 65)'
				}
			],
			testSelectors: [
				'.things-theme .workspace',
				'.theme-things .markdown-preview-view'
			],
			enhancedExtraction: async (extractor: CSSExtractor) => {
				return await this.extractThingsStyles(extractor);
			},
			compatibilityNotes: 'iOS-inspired design. Clean typography and spacing.',
			priority: 10
		});

		// Atom Theme - Enhanced Profile
		this.registerEnhancedTheme({
			name: 'atom',
			displayName: 'Atom',
			version: '2.x+',
			author: 'kognise',
			repository: 'kognise/obsidian-atom',
			identifiers: ['atom-theme', 'theme-atom'],
			variableMappings: [
				{
					cssVariable: '--text-normal',
					typstProperty: 'fill',
					fallbackValue: 'rgb(171, 178, 191)'
				},
				{
					cssVariable: '--accent',
					typstProperty: 'fill',
					fallbackValue: 'rgb(86, 182, 194)'
				},
				{
					cssVariable: '--background-primary',
					typstProperty: 'fill',
					fallbackValue: 'rgb(40, 44, 52)'
				}
			],
			testSelectors: [
				'.atom-theme .workspace',
				'.theme-atom .markdown-preview-view'
			],
			enhancedExtraction: async (extractor: CSSExtractor) => {
				return await this.extractAtomStyles(extractor);
			},
			compatibilityNotes: 'Dark coding theme. Excellent syntax highlighting colors.',
			priority: 8
		});

		// Register enhanced profiles with ThemeManager
		for (const [name, profile] of this.enhancedProfiles) {
			this.themeManager.registerTheme(profile);
		}
	}

	/**
	 * Register an enhanced theme profile
	 */
	private registerEnhancedTheme(profile: EnhancedThemeProfile): void {
		this.enhancedProfiles.set(profile.name, profile);
	}

	/**
	 * Extract Minimal theme styles with enhanced logic
	 */
	private async extractMinimalThemeStyles(extractor: CSSExtractor): Promise<TypstStyleRule[]> {
		const rules: TypstStyleRule[] = [];

		// Minimal theme typography rules
		rules.push({
			type: 'set',
			target: 'text',
			properties: {
				font: '"Inter"',
				size: '16pt'
			}
		});

		// Minimal heading styles
		for (let level = 1; level <= 6; level++) {
			const headingColor = this.getCssVariable(`--h${level}-color`) || 
				this.getCssVariable('--text-accent') || 
				'blue';
			
			rules.push({
				type: 'show',
				target: 'heading',
				properties: {
					fill: headingColor,
					weight: level <= 2 ? '"bold"' : '"semibold"'
				},
				condition: `heading.where(level: ${level})`
			});
		}

		// Minimal callout styles
		const calloutTypes = ['note', 'abstract', 'info', 'tip', 'success', 'question', 'warning', 'failure', 'danger', 'bug', 'example', 'quote'];
		for (const type of calloutTypes) {
			const color = this.getMinimalCalloutColor(type);
			if (color) {
				rules.push({
					type: 'show',
					target: 'block',
					properties: {
						stroke: `1pt + ${color}`,
						inset: '12pt'
					},
					condition: `block.where(type: "${type}")`
				});
			}
		}

		return rules;
	}

	/**
	 * Extract Blue Topaz theme styles  
	 */
	private async extractBlueTopazStyles(extractor: CSSExtractor): Promise<TypstStyleRule[]> {
		const rules: TypstStyleRule[] = [];

		// Blue Topaz heading colors
		const headingColors = {
			1: this.getCssVariable('--h1-color') || 'rgb(8, 109, 221)',
			2: this.getCssVariable('--h2-color') || 'rgb(8, 109, 221)',
			3: this.getCssVariable('--h3-color') || 'rgb(8, 109, 221)',
			4: this.getCssVariable('--text-accent') || 'rgb(8, 109, 221)',
			5: this.getCssVariable('--text-accent') || 'rgb(8, 109, 221)',
			6: this.getCssVariable('--text-accent') || 'rgb(8, 109, 221)'
		};

		for (const [level, color] of Object.entries(headingColors)) {
			rules.push({
				type: 'show',
				target: 'heading',
				properties: {
					fill: color,
					weight: level === '1' ? '"bold"' : '"semibold"'
				},
				condition: `heading.where(level: ${level})`
			});
		}

		// Blue Topaz accent elements
		const accentColor = this.getCssVariable('--bt-accent') || 'rgb(8, 109, 221)';
		rules.push({
			type: 'show',
			target: 'link',
			properties: {
				fill: accentColor
			}
		});

		return rules;
	}

	/**
	 * Extract Sanctum theme styles (dark theme)
	 */
	private async extractSanctumStyles(extractor: CSSExtractor): Promise<TypstStyleRule[]> {
		const rules: TypstStyleRule[] = [];

		// Sanctum dark theme base styles
		const textColor = this.getCssVariable('--text-normal') || 'rgb(220, 220, 220)';
		const accentColor = this.getCssVariable('--accent') || 'rgb(126, 208, 255)';

		rules.push({
			type: 'set',
			target: 'text',
			properties: {
				fill: textColor
			}
		});

		// Sanctum heading styles with accent color
		for (let level = 1; level <= 6; level++) {
			rules.push({
				type: 'show',
				target: 'heading',
				properties: {
					fill: accentColor,
					weight: level <= 2 ? '"bold"' : '"semibold"'
				},
				condition: `heading.where(level: ${level})`
			});
		}

		// Code block styling
		rules.push({
			type: 'show',
			target: 'raw',
			properties: {
				fill: 'rgb(200, 200, 200)',
				font: '"Fira Code"'
			}
		});

		return rules;
	}

	/**
	 * Extract Things theme styles
	 */
	private async extractThingsStyles(extractor: CSSExtractor): Promise<TypstStyleRule[]> {
		const rules: TypstStyleRule[] = [];

		const thingsBlue = this.getCssVariable('--things-accent') || 'rgb(0, 122, 255)';
		const thingsGreen = this.getCssVariable('--things-green') || 'rgb(40, 205, 65)';

		// Things-style headings
		rules.push({
			type: 'show',
			target: 'heading',
			properties: {
				fill: thingsBlue,
				weight: '"semibold"'
			},
			condition: 'heading.where(level: 1)'
		});

		// Success/completion styling
		rules.push({
			type: 'show',
			target: 'text',
			properties: {
				fill: thingsGreen
			},
			condition: 'text.where(content: regex("✓|✅|☑"))'
		});

		return rules;
	}

	/**
	 * Extract Atom theme styles
	 */
	private async extractAtomStyles(extractor: CSSExtractor): Promise<TypstStyleRule[]> {
		const rules: TypstStyleRule[] = [];

		const atomAccent = this.getCssVariable('--accent') || 'rgb(86, 182, 194)';
		const atomText = this.getCssVariable('--text-normal') || 'rgb(171, 178, 191)';

		rules.push({
			type: 'set',
			target: 'text',
			properties: {
				fill: atomText,
				font: '"Fira Code"'
			}
		});

		// Atom heading colors
		rules.push({
			type: 'show',
			target: 'heading',
			properties: {
				fill: atomAccent
			}
		});

		return rules;
	}

	/**
	 * Test theme detection and style extraction
	 */
	public async testThemeSupport(themeName: string): Promise<ThemeTestResult> {
		const profile = this.enhancedProfiles.get(themeName);
		if (!profile) {
			return {
				theme: themeName,
				detected: false,
				confidence: 0,
				missingElements: ['Theme profile not found'],
				extractedRules: []
			};
		}

		// Test theme detection
		const detectionResult = await this.themeManager.detectCurrentTheme();
		const detected = detectionResult?.theme.name === themeName;
		const confidence = detectionResult?.confidence || 0;

		// Test selectors
		const missingElements: string[] = [];
		if (profile.testSelectors) {
			for (const selector of profile.testSelectors) {
				const elements = document.querySelectorAll(selector);
				if (elements.length === 0) {
					missingElements.push(selector);
				}
			}
		}

		// Extract rules
		let extractedRules: TypstStyleRule[] = [];
		if (profile.enhancedExtraction) {
			const extractor = new CSSExtractor(this.themeManager['app']);
			extractedRules = await profile.enhancedExtraction(extractor);
		}

		return {
			theme: themeName,
			detected,
			confidence,
			missingElements,
			extractedRules
		};
	}

	/**
	 * Get all enhanced theme profiles
	 */
	public getEnhancedProfiles(): Map<string, EnhancedThemeProfile> {
		return this.enhancedProfiles;
	}

	/**
	 * Get enhanced theme profile for a specific theme
	 */
	public getEnhancedThemeProfile(themeName: string): EnhancedThemeProfile | null {
		return this.enhancedProfiles.get(themeName) || null;
	}

	/**
	 * Extract theme-specific styles
	 */
	public extractThemeStyles(themeName: string): any {
		const profile = this.enhancedProfiles.get(themeName);
		if (!profile) {
			return [];
		}

		// Use the appropriate extraction method based on theme
		// These methods don't actually need the CSSExtractor parameter for their current implementation
		switch (themeName) {
			case 'minimal':
				return this.extractMinimalThemeStylesInternal();
			case 'blue-topaz':
				return this.extractBlueTopazStylesInternal();
			case 'sanctum':
				return this.extractSanctumStylesInternal();
			case 'things':
				return this.extractThingsStylesInternal();
			case 'atom':
				return this.extractAtomStylesInternal();
			default:
				return [];
		}
	}

	/**
	 * Internal method for extracting minimal theme styles without CSSExtractor dependency
	 */
	private extractMinimalThemeStylesInternal(): any[] {
		const rules: any[] = [];

		// Minimal theme typography rules
		rules.push({
			type: 'set',
			target: 'text',
			properties: {
				font: '"Inter"',
				size: '16pt'
			}
		});

		// Minimal heading styles
		for (let level = 1; level <= 6; level++) {
			const headingColor = this.getCssVariable(`--h${level}-color`) || 
				this.getCssVariable('--text-accent') || 
				'blue';
			
			rules.push({
				type: 'show',
				target: 'heading',
				properties: {
					fill: headingColor,
					weight: level <= 2 ? '"bold"' : '"semibold"'
				},
				condition: `heading.where(level: ${level})`
			});
		}

		return rules;
	}

	private extractBlueTopazStylesInternal(): any[] { return []; }
	private extractSanctumStylesInternal(): any[] { return []; }
	private extractThingsStylesInternal(): any[] { return []; }
	private extractAtomStylesInternal(): any[] { return []; }

	/**
	 * Utility: Get CSS variable value
	 */
	private getCssVariable(name: string): string | null {
		const value = getComputedStyle(document.documentElement).getPropertyValue(name)?.trim();
		return value && value !== 'initial' && value !== 'inherit' ? value : null;
	}

	/**
	 * Minimal theme specific transformations
	 */
	private adjustMinimalTextColor(color: string): string {
		// Minimal theme may need color adjustments for print
		if (color.includes('rgb')) {
			// Darken text slightly for better print contrast
			return color.replace(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/, (match, r, g, b) => {
				const newR = Math.max(0, parseInt(r) - 20);
				const newG = Math.max(0, parseInt(g) - 20);
				const newB = Math.max(0, parseInt(b) - 20);
				return `rgb(${newR}, ${newG}, ${newB})`;
			});
		}
		return color;
	}

	private convertMinimalFontSize(size: string): string {
		// Convert Minimal's font sizes to appropriate Typst sizes
		const pxMatch = size.match(/(\d+)px/);
		if (pxMatch) {
			const px = parseInt(pxMatch[1]);
			const pt = Math.round(px * 0.75);
			return `${pt}pt`;
		}
		return size;
	}

	private normalizeMinimalFont(font: string): string {
		// Minimal theme font family normalization
		if (font.includes('Inter')) return '"Inter"';
		if (font.includes('system-ui') || font.includes('-apple-system')) return '"Inter"';
		return font.replace(/['"]/g, '').split(',')[0].trim();
	}

	private getMinimalCalloutColor(type: string): string | null {
		const calloutColors: Record<string, string> = {
			'note': 'rgb(8, 109, 221)',
			'abstract': 'rgb(0, 176, 255)',
			'info': 'rgb(8, 109, 221)',
			'tip': 'rgb(0, 191, 165)',
			'success': 'rgb(8, 185, 78)',
			'question': 'rgb(236, 117, 0)',
			'warning': 'rgb(236, 117, 0)',
			'failure': 'rgb(233, 49, 71)',
			'danger': 'rgb(233, 49, 71)',
			'bug': 'rgb(233, 49, 71)',
			'example': 'rgb(124, 77, 255)',
			'quote': 'rgb(158, 158, 158)'
		};
		return calloutColors[type] || null;
	}

	/**
	 * Generate compatibility report for current theme
	 */
	public async generateCompatibilityReport(): Promise<{
		currentTheme: string | null;
		isEnhanced: boolean;
		compatibilityScore: number;
		supportedFeatures: string[];
		unsupportedFeatures: string[];
		recommendations: string[];
	}> {
		const current = await this.themeManager.detectCurrentTheme();
		const currentThemeName = current?.theme.name || null;
		const isEnhanced = currentThemeName ? this.enhancedProfiles.has(currentThemeName) : false;
		
		let compatibilityScore = 0;
		const supportedFeatures: string[] = [];
		const unsupportedFeatures: string[] = [];
		const recommendations: string[] = [];

		if (isEnhanced && currentThemeName) {
			const profile = this.enhancedProfiles.get(currentThemeName)!;
			compatibilityScore = 90; // High score for enhanced themes
			
			supportedFeatures.push(
				'Theme detection',
				'Color extraction',
				'Typography mapping',
				'Enhanced style rules'
			);

			if (profile.enhancedExtraction) {
				supportedFeatures.push('Custom extraction logic');
				compatibilityScore += 10;
			}

			recommendations.push(`Using enhanced support for ${profile.displayName} theme`);
			if (profile.compatibilityNotes) {
				recommendations.push(profile.compatibilityNotes);
			}
		} else if (currentThemeName) {
			compatibilityScore = 60; // Medium score for detected but not enhanced themes
			supportedFeatures.push('Basic theme detection', 'Standard color extraction');
			unsupportedFeatures.push('Advanced style rules', 'Theme-specific optimizations');
			recommendations.push(`Consider using an enhanced theme like Minimal or Blue Topaz for better export quality`);
		} else {
			compatibilityScore = 40; // Lower score for unknown themes
			supportedFeatures.push('Default styling');
			unsupportedFeatures.push('Theme detection', 'Custom colors', 'Enhanced typography');
			recommendations.push('Switch to a supported theme for better PDF export styling');
		}

		return {
			currentTheme: currentThemeName,
			isEnhanced,
			compatibilityScore: Math.min(100, compatibilityScore),
			supportedFeatures,
			unsupportedFeatures,
			recommendations
		};
	}
}