/**
 * CSS Extraction and Style Preservation System
 * Captures Obsidian theme styles and maps them to equivalent Typst styling
 */

export interface ExtractedStyle {
	selector: string;
	property: string;
	value: string;
	computedValue?: string;
	priority?: string;
}

export interface ThemeInfo {
	name: string;
	isDark: boolean;
	isLight: boolean;
	customVariables: Record<string, string>;
}

export interface CSSExtractionOptions {
	includeInlineStyles?: boolean;
	includeComputedStyles?: boolean;
	filterSelectors?: string[];
	excludeSelectors?: string[];
	captureCustomProperties?: boolean;
}

/**
 * Core CSS extraction class that captures computed styles from Obsidian's DOM
 */
export class CSSExtractor {
	private app: any; // Obsidian App interface
	private extractedStyles: Map<string, ExtractedStyle[]> = new Map();
	private themeVariables: Map<string, string> = new Map();
	private currentTheme: ThemeInfo | null = null;

	constructor(app: any) {
		this.app = app;
	}

	/**
	 * Extract styles from the current document
	 */
	public async extractStyles(options: CSSExtractionOptions = {}): Promise<ExtractedStyle[]> {
		const styles: ExtractedStyle[] = [];

		// Clear previous extraction
		this.extractedStyles.clear();
		this.themeVariables.clear();

		// Detect current theme
		this.currentTheme = this.detectCurrentTheme();

		// Extract CSS custom properties (theme variables)
		if (options.captureCustomProperties !== false) {
			await this.extractCSSCustomProperties();
		}

		// Extract styles from stylesheets
		await this.extractFromStylesheets(options);

		// Extract computed styles from key elements
		if (options.includeComputedStyles) {
			await this.extractComputedStyles(options);
		}

		// Convert map to array
		for (const [selector, selectorStyles] of this.extractedStyles) {
			styles.push(...selectorStyles);
		}

		return styles;
	}

	/**
	 * Detect the current Obsidian theme
	 */
	private detectCurrentTheme(): ThemeInfo {
		const bodyEl = document.body;
		const isDark = bodyEl.classList.contains('theme-dark');
		const isLight = bodyEl.classList.contains('theme-light');
		
		// Try to get theme name from manifest or CSS
		let themeName = 'default';
		
		// Check for popular theme indicators
		if (bodyEl.classList.contains('minimal-theme')) {
			themeName = 'minimal';
		} else if (bodyEl.classList.contains('blue-topaz-theme')) {
			themeName = 'blue-topaz';
		} else if (bodyEl.querySelector('[data-theme]')) {
			themeName = bodyEl.querySelector('[data-theme]')?.getAttribute('data-theme') || 'default';
		}

		return {
			name: themeName,
			isDark,
			isLight,
			customVariables: {}
		};
	}

	/**
	 * Extract CSS custom properties (--variables) from the document
	 */
	private async extractCSSCustomProperties(): Promise<void> {
		const rootElement = document.documentElement;
		const computedStyle = getComputedStyle(rootElement);

		// Extract custom properties from :root
		const allProperties = Array.from(computedStyle);
		const customProperties = allProperties.filter(prop => prop.startsWith('--'));

		for (const property of customProperties) {
			const value = computedStyle.getPropertyValue(property).trim();
			if (value) {
				this.themeVariables.set(property, value);
			}
		}

		// Also check body element for theme-specific variables
		const bodyComputedStyle = getComputedStyle(document.body);
		const bodyProperties = Array.from(bodyComputedStyle);
		const bodyCustomProperties = bodyProperties.filter(prop => prop.startsWith('--'));

		for (const property of bodyCustomProperties) {
			const value = bodyComputedStyle.getPropertyValue(property).trim();
			if (value) {
				this.themeVariables.set(property, value);
			}
		}
	}

	/**
	 * Extract styles from document stylesheets
	 */
	private async extractFromStylesheets(options: CSSExtractionOptions): Promise<void> {
		const stylesheets = Array.from(document.styleSheets);

		for (const stylesheet of stylesheets) {
			try {
				// Skip cross-origin stylesheets unless we can access them
				if (!this.canAccessStylesheet(stylesheet)) {
					continue;
				}

				const rules = Array.from(stylesheet.cssRules || []);
				await this.processRules(rules, options);

			} catch (error) {
				console.warn('Could not access stylesheet:', stylesheet.href, error);
			}
		}
	}

	/**
	 * Check if we can access a stylesheet
	 */
	private canAccessStylesheet(stylesheet: CSSStyleSheet): boolean {
		try {
			// Try to access the cssRules property
			const _ = stylesheet.cssRules;
			return true;
		} catch (error) {
			return false;
		}
	}

	/**
	 * Process CSS rules recursively
	 */
	private async processRules(rules: CSSRule[], options: CSSExtractionOptions): Promise<void> {
		for (const rule of rules) {
			if (rule instanceof CSSStyleRule) {
				await this.processStyleRule(rule, options);
			} else if (rule instanceof CSSMediaRule) {
				// Process rules inside media queries
				const mediaRules = Array.from(rule.cssRules);
				await this.processRules(mediaRules, options);
			} else if (rule instanceof CSSSupportsRule) {
				// Process rules inside @supports
				const supportsRules = Array.from(rule.cssRules);
				await this.processRules(supportsRules, options);
			}
		}
	}

	/**
	 * Process individual style rule
	 */
	private async processStyleRule(rule: CSSStyleRule, options: CSSExtractionOptions): Promise<void> {
		const selector = rule.selectorText;
		
		// Apply selector filters
		if (options.filterSelectors?.length && 
			!options.filterSelectors.some(filter => selector.includes(filter))) {
			return;
		}

		if (options.excludeSelectors?.length && 
			options.excludeSelectors.some(exclude => selector.includes(exclude))) {
			return;
		}

		// Extract styles for this selector
		const styles: ExtractedStyle[] = [];
		const ruleStyle = rule.style;

		for (let i = 0; i < ruleStyle.length; i++) {
			const property = ruleStyle[i];
			const value = ruleStyle.getPropertyValue(property);
			const priority = ruleStyle.getPropertyPriority(property);

			styles.push({
				selector,
				property,
				value,
				priority
			});
		}

		// Store styles
		if (!this.extractedStyles.has(selector)) {
			this.extractedStyles.set(selector, []);
		}
		this.extractedStyles.get(selector)!.push(...styles);
	}

	/**
	 * Extract computed styles from key DOM elements
	 */
	private async extractComputedStyles(options: CSSExtractionOptions): Promise<void> {
		// Define key selectors to extract computed styles from
		const keySelectors = [
			'.markdown-preview-view',
			'.markdown-source-view',
			'.cm-editor',
			'body',
			'.workspace',
			'.view-header',
			'h1, h2, h3, h4, h5, h6',
			'p',
			'a',
			'strong',
			'em',
			'code',
			'.callout'
		];

		for (const selector of keySelectors) {
			const elements = document.querySelectorAll(selector);
			
			for (const element of Array.from(elements).slice(0, 5)) { // Limit to first 5 matches
				const computedStyle = getComputedStyle(element);
				
				// Extract key properties
				const keyProperties = [
					'color', 'background-color', 'font-family', 'font-size', 
					'font-weight', 'font-style', 'text-decoration', 'line-height',
					'margin', 'padding', 'border', 'border-radius'
				];

				for (const property of keyProperties) {
					const value = computedStyle.getPropertyValue(property);
					if (value && value !== 'initial' && value !== 'inherit') {
						const extractedStyle: ExtractedStyle = {
							selector: this.generateSelectorForElement(element),
							property,
							value,
							computedValue: value
						};

						if (!this.extractedStyles.has(extractedStyle.selector)) {
							this.extractedStyles.set(extractedStyle.selector, []);
						}
						this.extractedStyles.get(extractedStyle.selector)!.push(extractedStyle);
					}
				}
			}
		}
	}

	/**
	 * Generate a CSS selector for a DOM element
	 */
	private generateSelectorForElement(element: Element): string {
		if (element.id) {
			return `#${element.id}`;
		}

		if (element.classList.length > 0) {
			return `.${Array.from(element.classList).join('.')}`;
		}

		return element.tagName.toLowerCase();
	}

	/**
	 * Get extracted theme variables
	 */
	public getThemeVariables(): Map<string, string> {
		return this.themeVariables;
	}

	/**
	 * Get current theme information
	 */
	public getCurrentTheme(): ThemeInfo | null {
		return this.currentTheme;
	}

	/**
	 * Get styles by selector
	 */
	public getStylesBySelector(selector: string): ExtractedStyle[] {
		return this.extractedStyles.get(selector) || [];
	}

	/**
	 * Get all extracted styles
	 */
	public getAllStyles(): Map<string, ExtractedStyle[]> {
		return this.extractedStyles;
	}

	/**
	 * Listen for theme changes
	 */
	public registerThemeChangeListener(callback: (themeInfo: ThemeInfo) => void): void {
		this.app.workspace.on('css-change', () => {
			const newTheme = this.detectCurrentTheme();
			if (newTheme.name !== this.currentTheme?.name || 
				newTheme.isDark !== this.currentTheme?.isDark) {
				this.currentTheme = newTheme;
				callback(newTheme);
			}
		});
	}

	/**
	 * Get relevant styles for specific content types
	 */
	public getRelevantStyles(contentType: 'text' | 'heading' | 'link' | 'code' | 'callout'): ExtractedStyle[] {
		const relevantSelectors: Record<typeof contentType, string[]> = {
			text: ['body', 'p', '.markdown-preview-view', '.cm-line'],
			heading: ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', '.cm-header'],
			link: ['a', '.cm-link'],
			code: ['code', '.cm-inline-code', 'pre', '.cm-line'],
			callout: ['.callout', '.callout-title', '.callout-content']
		};

		const selectors = relevantSelectors[contentType] || [];
		const styles: ExtractedStyle[] = [];

		for (const selector of selectors) {
			// Find matching extracted styles
			for (const [extractedSelector, extractedStyles] of this.extractedStyles) {
				if (this.selectorMatches(extractedSelector, selector)) {
					styles.push(...extractedStyles);
				}
			}
		}

		return styles;
	}

	/**
	 * Check if selectors match (simple matching)
	 */
	private selectorMatches(extracted: string, target: string): boolean {
		return extracted.includes(target) || target.includes(extracted);
	}
}