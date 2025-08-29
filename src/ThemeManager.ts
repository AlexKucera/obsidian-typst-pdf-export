/**
 * Theme-Specific Variable Handling System
 * Detects and processes theme-specific CSS variables and computed styles
 */

import { CSSExtractor, ThemeInfo } from './CSSExtractor';
import { CSSToTypstMapper, TypstStyleRule } from './CSSToTypstMapper';

export interface ThemeVariableMapping {
	cssVariable: string;
	typstProperty: string;
	fallbackValue?: string;
	transform?: (value: string) => string;
}

export interface ThemeProfile {
	name: string;
	displayName: string;
	identifiers: string[]; // CSS classes or attributes to identify theme
	variableMappings: ThemeVariableMapping[];
	customExtraction?: (extractor: CSSExtractor) => Promise<Map<string, string>>;
	priority?: number; // Higher priority themes override lower ones
}

export interface ThemeDetectionResult {
	theme: ThemeProfile;
	confidence: number; // 0-1 score of detection confidence
	variables: Map<string, string>;
}

/**
 * Manages theme-specific variable handling and detection
 */
export class ThemeManager {
	private app: any;
	private registeredThemes: Map<string, ThemeProfile> = new Map();
	private variableCache: Map<string, string> = new Map();
	private currentTheme: ThemeDetectionResult | null = null;

	constructor(app: any) {
		this.app = app;
		this.registerBuiltinThemes();
	}

	/**
	 * Register built-in theme profiles
	 */
	private registerBuiltinThemes(): void {
		// Default Obsidian theme
		this.registerTheme({
			name: 'default',
			displayName: 'Default',
			identifiers: ['theme-dark', 'theme-light'],
			variableMappings: [
				{
					cssVariable: '--text-normal',
					typstProperty: 'fill',
					fallbackValue: 'black'
				},
				{
					cssVariable: '--text-muted',
					typstProperty: 'fill',
					fallbackValue: 'gray'
				},
				{
					cssVariable: '--text-faint',
					typstProperty: 'fill',
					fallbackValue: 'rgb(120, 120, 120)'
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
					cssVariable: '--font-text-size',
					typstProperty: 'size',
					fallbackValue: '16px',
					transform: (value) => value.replace('px', 'pt')
				},
				{
					cssVariable: '--font-text',
					typstProperty: 'font',
					fallbackValue: '"Inter"'
				},
				{
					cssVariable: '--font-monospace',
					typstProperty: 'font',
					fallbackValue: '"Fira Code"'
				}
			],
			priority: 1
		});

		// Minimal theme
		this.registerTheme({
			name: 'minimal',
			displayName: 'Minimal',
			identifiers: ['minimal-theme', 'theme-minimal'],
			variableMappings: [
				{
					cssVariable: '--text-normal',
					typstProperty: 'fill',
					fallbackValue: 'rgb(25, 25, 25)'
				},
				{
					cssVariable: '--text-muted',
					typstProperty: 'fill',
					fallbackValue: 'rgb(100, 100, 100)'
				},
				{
					cssVariable: '--background-primary',
					typstProperty: 'fill',
					fallbackValue: 'white'
				},
				{
					cssVariable: '--minimal-text-size',
					typstProperty: 'size',
					fallbackValue: '17px',
					transform: (value) => value.replace('px', 'pt')
				},
				{
					cssVariable: '--default-font',
					typstProperty: 'font',
					fallbackValue: '"Inter"'
				},
				{
					cssVariable: '--font-ui-small',
					typstProperty: 'size',
					fallbackValue: '12px',
					transform: (value) => value.replace('px', 'pt')
				}
			],
			customExtraction: async (extractor: CSSExtractor) => {
				const variables = new Map<string, string>();
				
				// Minimal theme uses specific CSS variables
				const minimalVars = [
					'--accent',
					'--accent-hover',
					'--minimal-bright',
					'--minimal-dark',
					'--ui1', '--ui2', '--ui3'
				];

				for (const varName of minimalVars) {
					const value = getComputedStyle(document.documentElement).getPropertyValue(varName);
					if (value.trim()) {
						variables.set(varName, value.trim());
					}
				}

				return variables;
			},
			priority: 10
		});

		// Blue Topaz theme
		this.registerTheme({
			name: 'blue-topaz',
			displayName: 'Blue Topaz',
			identifiers: ['blue-topaz-theme', 'bt'],
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
					cssVariable: '--background-primary',
					typstProperty: 'fill',
					fallbackValue: 'rgb(248, 249, 250)'
				},
				{
					cssVariable: '--bt-accent',
					typstProperty: 'fill',
					fallbackValue: 'blue'
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
				}
			],
			customExtraction: async (extractor: CSSExtractor) => {
				const variables = new Map<string, string>();
				
				// Blue Topaz specific variables
				const btVars = [
					'--bt-accent', '--bt-accent-2',
					'--bt-blue', '--bt-green', '--bt-orange', '--bt-red',
					'--bt-yellow', '--bt-purple'
				];

				for (const varName of btVars) {
					const value = getComputedStyle(document.documentElement).getPropertyValue(varName);
					if (value.trim()) {
						variables.set(varName, value.trim());
					}
				}

				return variables;
			},
			priority: 10
		});

		// Sanctum theme
		this.registerTheme({
			name: 'sanctum',
			displayName: 'Sanctum',
			identifiers: ['sanctum'],
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
				}
			],
			priority: 5
		});

		// Things theme
		this.registerTheme({
			name: 'things',
			displayName: 'Things',
			identifiers: ['things-theme'],
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
				}
			],
			priority: 5
		});
	}

	/**
	 * Register a theme profile
	 */
	public registerTheme(profile: ThemeProfile): void {
		this.registeredThemes.set(profile.name, profile);
	}

	/**
	 * Detect the current active theme
	 */
	public async detectCurrentTheme(): Promise<ThemeDetectionResult | null> {
		const detectionResults: ThemeDetectionResult[] = [];

		// Check each registered theme
		for (const [name, theme] of this.registeredThemes) {
			const confidence = this.calculateThemeConfidence(theme);
			if (confidence > 0) {
				const variables = await this.extractThemeVariables(theme);
				detectionResults.push({
					theme,
					confidence,
					variables
				});
			}
		}

		// Sort by priority and confidence
		detectionResults.sort((a, b) => {
			const priorityDiff = (b.theme.priority || 0) - (a.theme.priority || 0);
			if (priorityDiff !== 0) return priorityDiff;
			return b.confidence - a.confidence;
		});

		const result = detectionResults[0] || null;
		this.currentTheme = result;
		return result;
	}

	/**
	 * Calculate confidence score for theme detection
	 */
	private calculateThemeConfidence(theme: ThemeProfile): number {
		let score = 0;
		let checks = 0;

		const body = document.body;
		const html = document.documentElement;

		for (const identifier of theme.identifiers) {
			checks++;
			
			// Check for CSS class
			if (identifier.startsWith('.')) {
				const className = identifier.substring(1);
				if (body.classList.contains(className) || html.classList.contains(className)) {
					score += 1;
				}
			}
			// Check for CSS class without dot
			else if (body.classList.contains(identifier) || html.classList.contains(identifier)) {
				score += 1;
			}
			// Check for data attribute
			else if (identifier.includes('=')) {
				const [attr, value] = identifier.split('=');
				if (body.getAttribute(attr) === value || html.getAttribute(attr) === value) {
					score += 1;
				}
			}
		}

		// Check for theme-specific CSS variables
		let variableChecks = 0;
		let variableMatches = 0;

		for (const mapping of theme.variableMappings) {
			variableChecks++;
			const value = getComputedStyle(document.documentElement).getPropertyValue(mapping.cssVariable);
			if (value && value.trim() && value !== 'initial' && value !== 'inherit') {
				variableMatches++;
			}
		}

		// Combine identifier and variable confidence
		const identifierConfidence = checks > 0 ? score / checks : 0;
		const variableConfidence = variableChecks > 0 ? variableMatches / variableChecks : 0;
		
		// Weight identifier confidence more heavily
		return (identifierConfidence * 0.7) + (variableConfidence * 0.3);
	}

	/**
	 * Extract theme variables for a specific theme
	 */
	private async extractThemeVariables(theme: ThemeProfile): Promise<Map<string, string>> {
		const variables = new Map<string, string>();

		// Extract standard mapped variables
		for (const mapping of theme.variableMappings) {
			const value = getComputedStyle(document.documentElement).getPropertyValue(mapping.cssVariable);
			let processedValue = value?.trim();

			if (processedValue && processedValue !== 'initial' && processedValue !== 'inherit') {
				// Apply transformation if available
				if (mapping.transform) {
					processedValue = mapping.transform(processedValue);
				}
				variables.set(mapping.cssVariable, processedValue);
			} else if (mapping.fallbackValue) {
				variables.set(mapping.cssVariable, mapping.fallbackValue);
			}
		}

		// Run custom extraction if available
		if (theme.customExtraction) {
			const extractor = new CSSExtractor(this.app);
			const customVariables = await theme.customExtraction(extractor);
			
			for (const [key, value] of customVariables) {
				variables.set(key, value);
			}
		}

		return variables;
	}

	/**
	 * Get current theme detection result
	 */
	public getCurrentTheme(): ThemeDetectionResult | null {
		return this.currentTheme;
	}

	/**
	 * Get theme-specific Typst style rules
	 */
	public async generateThemeStyleRules(mapper: CSSToTypstMapper): Promise<TypstStyleRule[]> {
		const currentTheme = await this.detectCurrentTheme();
		if (!currentTheme) return [];

		const rules: TypstStyleRule[] = [];

		// Convert theme variables to Typst properties
		for (const mapping of currentTheme.theme.variableMappings) {
			const cssValue = currentTheme.variables.get(mapping.cssVariable);
			if (cssValue) {
				// Map CSS property to Typst
				const mappedProperty = mapper['mapCSSProperty']?.call(
					mapper, 
					mapping.typstProperty === 'fill' ? 'color' : mapping.typstProperty,
					cssValue,
					{ simplifyColors: true }
				);

				if (mappedProperty) {
					rules.push({
						type: 'set',
						target: 'text',
						properties: mappedProperty
					});
				}
			}
		}

		// Add theme-specific rules
		const themeRules = this.getThemeSpecificRules(currentTheme.theme.name);
		rules.push(...themeRules);

		return rules;
	}

	/**
	 * Get theme-specific style rules
	 */
	private getThemeSpecificRules(themeName: string): TypstStyleRule[] {
		const rules: TypstStyleRule[] = [];

		switch (themeName) {
			case 'minimal':
				// Minimal theme tends to use clean typography
				rules.push({
					type: 'set',
					target: 'heading',
					properties: {
						weight: '"regular"'
					}
				});
				break;

			case 'blue-topaz':
				// Blue Topaz uses distinctive heading colors
				rules.push({
					type: 'show',
					target: 'heading',
					properties: {
						fill: 'rgb(8, 109, 221)'
					},
					condition: 'heading.where(level: 1)'
				});
				break;

			case 'sanctum':
				// Dark theme adjustments
				rules.push({
					type: 'set',
					target: 'text',
					properties: {
						fill: 'rgb(220, 220, 220)'
					}
				});
				break;
		}

		return rules;
	}

	/**
	 * Watch for theme changes
	 */
	public watchThemeChanges(callback: (theme: ThemeDetectionResult | null) => void): void {
		// Listen for CSS changes that might indicate theme switch
		this.app.workspace.on('css-change', async () => {
			const newTheme = await this.detectCurrentTheme();
			
			// Check if theme actually changed
			if (!this.currentTheme && !newTheme) return;
			if (this.currentTheme && newTheme && this.currentTheme.theme.name === newTheme.theme.name) return;
			
			this.currentTheme = newTheme;
			callback(newTheme);
		});

		// Listen for setting changes that might affect theme
		if (this.app.setting) {
			this.app.setting.on('change', async () => {
				// Debounce theme detection
				setTimeout(async () => {
					const newTheme = await this.detectCurrentTheme();
					if (!this.currentTheme || !newTheme || this.currentTheme.theme.name !== newTheme.theme.name) {
						this.currentTheme = newTheme;
						callback(newTheme);
					}
				}, 100);
			});
		}
	}

	/**
	 * Get all registered themes
	 */
	public getRegisteredThemes(): ThemeProfile[] {
		return Array.from(this.registeredThemes.values());
	}

	/**
	 * Get theme by name
	 */
	public getTheme(name: string): ThemeProfile | null {
		return this.registeredThemes.get(name) || null;
	}

	/**
	 * Clear variable cache
	 */
	public clearCache(): void {
		this.variableCache.clear();
	}

	/**
	 * Force refresh current theme detection
	 */
	public async refreshCurrentTheme(): Promise<ThemeDetectionResult | null> {
		this.clearCache();
		return await this.detectCurrentTheme();
	}

	/**
	 * Get variable value with caching
	 */
	public getCachedVariable(name: string): string | null {
		if (this.variableCache.has(name)) {
			return this.variableCache.get(name)!;
		}

		const value = getComputedStyle(document.documentElement).getPropertyValue(name)?.trim();
		if (value && value !== 'initial' && value !== 'inherit') {
			this.variableCache.set(name, value);
			return value;
		}

		return null;
	}

	/**
	 * Generate theme-aware Typst template header
	 */
	public generateThemeHeader(): string {
		const currentTheme = this.getCurrentTheme();
		if (!currentTheme) {
			return '// Default Obsidian styling\n';
		}

		const lines: string[] = [
			`// Theme: ${currentTheme.theme.displayName}`,
			`// Detected with confidence: ${Math.round(currentTheme.confidence * 100)}%`,
			''
		];

		// Add key theme variables as comments
		for (const [variable, value] of currentTheme.variables) {
			if (variable.startsWith('--text-') || variable.startsWith('--background-')) {
				lines.push(`// ${variable}: ${value}`);
			}
		}

		return lines.join('\n') + '\n';
	}
}