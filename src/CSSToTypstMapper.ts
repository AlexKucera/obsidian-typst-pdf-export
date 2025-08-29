/**
 * CSS to Typst Property Mapping System
 * Converts CSS properties to equivalent Typst styling commands
 */

import { ExtractedStyle } from './CSSExtractor';

export interface TypstStyleRule {
	type: 'set' | 'show' | 'function';
	target: string; // e.g., 'text', 'heading', 'par'
	properties: Record<string, string>;
	content?: string;
	condition?: string;
}

export interface ColorRgb {
	r: number;
	g: number;
	b: number;
	a?: number;
}

export interface MappingOptions {
	preserveFallbacks?: boolean;
	useSetRules?: boolean;
	useShowRules?: boolean;
	simplifyColors?: boolean;
}

/**
 * Maps CSS properties to equivalent Typst styling commands
 */
export class CSSToTypstMapper {
	private colorCache = new Map<string, ColorRgb>();

	constructor() {}

	/**
	 * Map extracted styles to Typst style rules
	 */
	public mapToTypst(styles: ExtractedStyle[], options: MappingOptions = {}): TypstStyleRule[] {
		const rules: TypstStyleRule[] = [];
		const processedSelectors = new Set<string>();

		// Group styles by selector
		const groupedStyles = this.groupStylesBySelector(styles);

		for (const [selector, selectorStyles] of groupedStyles) {
			if (processedSelectors.has(selector)) continue;
			processedSelectors.add(selector);

			// Determine the target element type
			const target = this.getTypstTarget(selector);
			if (!target) continue;

			// Convert CSS properties to Typst properties
			const typstProperties: Record<string, string> = {};
			let hasValidProperties = false;

			for (const style of selectorStyles) {
				const mappedProperty = this.mapCSSProperty(style.property, style.value, options);
				if (mappedProperty) {
					Object.assign(typstProperties, mappedProperty);
					hasValidProperties = true;
				}
			}

			if (hasValidProperties) {
				const rule: TypstStyleRule = {
					type: options.useShowRules ? 'show' : 'set',
					target,
					properties: typstProperties
				};

				// Add conditions for show rules
				if (options.useShowRules) {
					rule.condition = this.generateShowCondition(selector);
				}

				rules.push(rule);
			}
		}

		return rules;
	}

	/**
	 * Group styles by selector
	 */
	private groupStylesBySelector(styles: ExtractedStyle[]): Map<string, ExtractedStyle[]> {
		const grouped = new Map<string, ExtractedStyle[]>();

		for (const style of styles) {
			if (!grouped.has(style.selector)) {
				grouped.set(style.selector, []);
			}
			grouped.get(style.selector)!.push(style);
		}

		return grouped;
	}

	/**
	 * Determine Typst target element from CSS selector
	 */
	private getTypstTarget(selector: string): string | null {
		// Heading selectors
		if (selector.match(/h[1-6]/) || selector.includes('heading') || selector.includes('cm-header')) {
			return 'heading';
		}

		// Text content selectors
		if (selector.includes('body') || selector.includes('markdown-preview') || selector.includes('cm-line')) {
			return 'text';
		}

		// Paragraph selectors
		if (selector.includes('p') || selector.includes('par')) {
			return 'par';
		}

		// Link selectors
		if (selector.includes('a') || selector.includes('link')) {
			return 'link';
		}

		// Code selectors
		if (selector.includes('code') || selector.includes('cm-inline-code') || selector.includes('pre')) {
			return 'raw';
		}

		// List selectors
		if (selector.includes('ul') || selector.includes('ol') || selector.includes('li')) {
			return 'list';
		}

		// Block elements
		if (selector.includes('div') || selector.includes('block') || selector.includes('callout')) {
			return 'block';
		}

		// Default to text for unknown selectors
		return 'text';
	}

	/**
	 * Map individual CSS property to Typst equivalent
	 */
	private mapCSSProperty(property: string, value: string, options: MappingOptions): Record<string, string> | null {
		const result: Record<string, string> = {};

		switch (property) {
			case 'color':
				const textColor = this.convertColor(value, options.simplifyColors);
				if (textColor) {
					result.fill = textColor;
				}
				break;

			case 'background-color':
			case 'background':
				const bgColor = this.convertColor(value, options.simplifyColors);
				if (bgColor && bgColor !== 'transparent' && bgColor !== 'none') {
					// Background color typically maps to fill in box or block contexts
					result.fill = bgColor;
				}
				break;

			case 'font-family':
				const fontFamily = this.convertFontFamily(value);
				if (fontFamily) {
					result.font = fontFamily;
				}
				break;

			case 'font-size':
				const fontSize = this.convertSize(value);
				if (fontSize) {
					result.size = fontSize;
				}
				break;

			case 'font-weight':
				const weight = this.convertFontWeight(value);
				if (weight) {
					result.weight = weight;
				}
				break;

			case 'font-style':
				const style = this.convertFontStyle(value);
				if (style) {
					result.style = style;
				}
				break;

			case 'text-align':
				const align = this.convertTextAlign(value);
				if (align) {
					result.align = align;
				}
				break;

			case 'line-height':
				const leading = this.convertLineHeight(value);
				if (leading) {
					result.leading = leading;
				}
				break;

			case 'letter-spacing':
				const spacing = this.convertLetterSpacing(value);
				if (spacing) {
					result.spacing = spacing;
				}
				break;

			case 'text-decoration':
				const decoration = this.convertTextDecoration(value);
				if (decoration) {
					Object.assign(result, decoration);
				}
				break;

			case 'border':
			case 'border-color':
			case 'border-width':
			case 'border-style':
				const stroke = this.convertBorder(property, value);
				if (stroke) {
					result.stroke = stroke;
				}
				break;

			case 'border-radius':
				const radius = this.convertBorderRadius(value);
				if (radius) {
					result.radius = radius;
				}
				break;

			case 'margin':
			case 'margin-top':
			case 'margin-bottom':
			case 'margin-left':
			case 'margin-right':
				const margin = this.convertMargin(property, value);
				if (margin) {
					Object.assign(result, margin);
				}
				break;

			case 'padding':
			case 'padding-top':
			case 'padding-bottom':
			case 'padding-left':
			case 'padding-right':
				const inset = this.convertPadding(property, value);
				if (inset) {
					result.inset = inset;
				}
				break;

			default:
				// Return null for unsupported properties
				return null;
		}

		return Object.keys(result).length > 0 ? result : null;
	}

	/**
	 * Convert CSS color to Typst color
	 */
	private convertColor(cssColor: string, simplify: boolean = false): string | null {
		if (!cssColor || cssColor === 'transparent' || cssColor === 'inherit' || cssColor === 'initial') {
			return null;
		}

		// Check cache first
		if (this.colorCache.has(cssColor)) {
			const rgb = this.colorCache.get(cssColor)!;
			return this.formatTypstColor(rgb, simplify);
		}

		let rgb: ColorRgb | null = null;

		// Parse different color formats
		if (cssColor.startsWith('#')) {
			rgb = this.parseHexColor(cssColor);
		} else if (cssColor.startsWith('rgb')) {
			rgb = this.parseRgbColor(cssColor);
		} else if (cssColor.startsWith('hsl')) {
			rgb = this.parseHslColor(cssColor);
		} else {
			// Try to parse named colors
			rgb = this.parseNamedColor(cssColor);
		}

		if (rgb) {
			this.colorCache.set(cssColor, rgb);
			return this.formatTypstColor(rgb, simplify);
		}

		return null;
	}

	/**
	 * Parse hex color
	 */
	private parseHexColor(hex: string): ColorRgb | null {
		const match = hex.match(/^#([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i);
		if (!match) {
			// Try short format
			const shortMatch = hex.match(/^#([a-f\d])([a-f\d])([a-f\d])$/i);
			if (shortMatch) {
				return {
					r: parseInt(shortMatch[1] + shortMatch[1], 16),
					g: parseInt(shortMatch[2] + shortMatch[2], 16),
					b: parseInt(shortMatch[3] + shortMatch[3], 16)
				};
			}
			return null;
		}

		return {
			r: parseInt(match[1], 16),
			g: parseInt(match[2], 16),
			b: parseInt(match[3], 16)
		};
	}

	/**
	 * Parse RGB/RGBA color
	 */
	private parseRgbColor(rgb: string): ColorRgb | null {
		const match = rgb.match(/rgba?\(([^)]+)\)/);
		if (!match) return null;

		const values = match[1].split(',').map(v => parseFloat(v.trim()));
		if (values.length < 3) return null;

		return {
			r: Math.round(values[0]),
			g: Math.round(values[1]),
			b: Math.round(values[2]),
			a: values[3] !== undefined ? values[3] : undefined
		};
	}

	/**
	 * Parse HSL color (basic implementation)
	 */
	private parseHslColor(hsl: string): ColorRgb | null {
		const match = hsl.match(/hsla?\(([^)]+)\)/);
		if (!match) return null;

		const values = match[1].split(',').map(v => parseFloat(v.trim()));
		if (values.length < 3) return null;

		// Convert HSL to RGB
		const h = values[0] / 360;
		const s = values[1] / 100;
		const l = values[2] / 100;

		let r, g, b;

		if (s === 0) {
			r = g = b = l; // achromatic
		} else {
			const hue2rgb = (p: number, q: number, t: number) => {
				if (t < 0) t += 1;
				if (t > 1) t -= 1;
				if (t < 1/6) return p + (q - p) * 6 * t;
				if (t < 1/2) return q;
				if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
				return p;
			};

			const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
			const p = 2 * l - q;
			r = hue2rgb(p, q, h + 1/3);
			g = hue2rgb(p, q, h);
			b = hue2rgb(p, q, h - 1/3);
		}

		return {
			r: Math.round(r * 255),
			g: Math.round(g * 255),
			b: Math.round(b * 255),
			a: values[3] !== undefined ? values[3] : undefined
		};
	}

	/**
	 * Parse named colors (basic set)
	 */
	private parseNamedColor(color: string): ColorRgb | null {
		const namedColors: Record<string, ColorRgb> = {
			'black': { r: 0, g: 0, b: 0 },
			'white': { r: 255, g: 255, b: 255 },
			'red': { r: 255, g: 0, b: 0 },
			'green': { r: 0, g: 128, b: 0 },
			'blue': { r: 0, g: 0, b: 255 },
			'yellow': { r: 255, g: 255, b: 0 },
			'cyan': { r: 0, g: 255, b: 255 },
			'magenta': { r: 255, g: 0, b: 255 },
			'gray': { r: 128, g: 128, b: 128 },
			'grey': { r: 128, g: 128, b: 128 },
			'silver': { r: 192, g: 192, b: 192 },
			'maroon': { r: 128, g: 0, b: 0 },
			'olive': { r: 128, g: 128, b: 0 },
			'lime': { r: 0, g: 255, b: 0 },
			'aqua': { r: 0, g: 255, b: 255 },
			'teal': { r: 0, g: 128, b: 128 },
			'navy': { r: 0, g: 0, b: 128 },
			'fuchsia': { r: 255, g: 0, b: 255 },
			'purple': { r: 128, g: 0, b: 128 }
		};

		return namedColors[color.toLowerCase()] || null;
	}

	/**
	 * Format color for Typst
	 */
	private formatTypstColor(rgb: ColorRgb, simplify: boolean): string {
		if (simplify) {
			// Use named colors when possible for readability
			if (rgb.r === 0 && rgb.g === 0 && rgb.b === 0) return 'black';
			if (rgb.r === 255 && rgb.g === 255 && rgb.b === 255) return 'white';
			if (rgb.r === 255 && rgb.g === 0 && rgb.b === 0) return 'red';
			if (rgb.r === 0 && rgb.g === 128 && rgb.b === 0) return 'green';
			if (rgb.r === 0 && rgb.g === 0 && rgb.b === 255) return 'blue';
		}

		// Use rgb() function for Typst
		if (rgb.a !== undefined && rgb.a < 1) {
			return `rgb(${rgb.r}, ${rgb.g}, ${rgb.b}, ${Math.round(rgb.a * 100)}%)`;
		} else {
			return `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`;
		}
	}

	/**
	 * Convert CSS font-family to Typst font
	 */
	private convertFontFamily(fontFamily: string): string | null {
		if (!fontFamily) return null;

		// Clean up font family string
		const cleaned = fontFamily
			.replace(/['"]/g, '')
			.split(',')[0] // Take first font
			.trim();

		// Map common system fonts
		const fontMap: Record<string, string> = {
			'serif': '"Linux Libertine"',
			'sans-serif': '"Lato"',
			'monospace': '"Fira Mono"',
			'system-ui': '"Inter"',
			'-apple-system': '"Inter"',
			'BlinkMacSystemFont': '"Inter"',
			'Segoe UI': '"Inter"',
			'Roboto': '"Roboto"',
			'Helvetica Neue': '"Helvetica Neue"',
			'Arial': '"Arial"',
			'Times New Roman': '"Times New Roman"',
			'Georgia': '"Georgia"',
			'Verdana': '"Verdana"',
			'Courier New': '"Courier New"',
		};

		return fontMap[cleaned] || `"${cleaned}"`;
	}

	/**
	 * Convert CSS size to Typst size
	 */
	private convertSize(size: string): string | null {
		if (!size || size === 'inherit' || size === 'initial') return null;

		// Handle pixel values
		if (size.endsWith('px')) {
			const px = parseFloat(size);
			const pt = px * 0.75; // Convert px to pt
			return `${Math.round(pt * 100) / 100}pt`;
		}

		// Handle point values
		if (size.endsWith('pt')) {
			return size;
		}

		// Handle em values
		if (size.endsWith('em')) {
			const em = parseFloat(size);
			const pt = em * 12; // Assume base of 12pt
			return `${Math.round(pt * 100) / 100}pt`;
		}

		// Handle rem values
		if (size.endsWith('rem')) {
			const rem = parseFloat(size);
			const pt = rem * 12; // Assume root font size of 12pt
			return `${Math.round(pt * 100) / 100}pt`;
		}

		// Handle percentage
		if (size.endsWith('%')) {
			const percent = parseFloat(size) / 100;
			return `${percent}em`;
		}

		return null;
	}

	/**
	 * Convert font weight
	 */
	private convertFontWeight(weight: string): string | null {
		if (!weight || weight === 'normal' || weight === 'inherit') return null;

		const weightMap: Record<string, string> = {
			'bold': '"bold"',
			'bolder': '"bold"',
			'lighter': '"regular"',
			'100': '"thin"',
			'200': '"extralight"',
			'300': '"light"',
			'400': '"regular"',
			'500': '"medium"',
			'600': '"semibold"',
			'700': '"bold"',
			'800': '"extrabold"',
			'900': '"black"'
		};

		return weightMap[weight] || null;
	}

	/**
	 * Convert font style
	 */
	private convertFontStyle(style: string): string | null {
		if (!style || style === 'normal' || style === 'inherit') return null;

		const styleMap: Record<string, string> = {
			'italic': '"italic"',
			'oblique': '"oblique"'
		};

		return styleMap[style] || null;
	}

	/**
	 * Convert text alignment
	 */
	private convertTextAlign(align: string): string | null {
		if (!align || align === 'inherit') return null;

		const alignMap: Record<string, string> = {
			'left': 'start',
			'right': 'end',
			'center': 'center',
			'justify': 'justify'
		};

		return alignMap[align] || null;
	}

	/**
	 * Convert line height to leading
	 */
	private convertLineHeight(lineHeight: string): string | null {
		if (!lineHeight || lineHeight === 'normal' || lineHeight === 'inherit') return null;

		// Handle unitless values (relative to font size)
		if (/^[\d.]+$/.test(lineHeight)) {
			const multiplier = parseFloat(lineHeight);
			return `${multiplier}em`;
		}

		// Handle length values
		const size = this.convertSize(lineHeight);
		return size;
	}

	/**
	 * Convert letter spacing
	 */
	private convertLetterSpacing(spacing: string): string | null {
		if (!spacing || spacing === 'normal' || spacing === 'inherit') return null;

		return this.convertSize(spacing);
	}

	/**
	 * Convert text decoration
	 */
	private convertTextDecoration(decoration: string): Record<string, string> | null {
		if (!decoration || decoration === 'none' || decoration === 'inherit') return null;

		const result: Record<string, string> = {};

		if (decoration.includes('underline')) {
			result.underline = 'true';
		}
		if (decoration.includes('overline')) {
			result.overline = 'true';
		}
		if (decoration.includes('line-through')) {
			result.strike = 'true';
		}

		return Object.keys(result).length > 0 ? result : null;
	}

	/**
	 * Convert border properties
	 */
	private convertBorder(property: string, value: string): string | null {
		if (!value || value === 'none' || value === 'inherit') return null;

		// Parse border shorthand or specific property
		if (property === 'border') {
			// Parse shorthand: "1px solid red"
			const parts = value.split(/\s+/);
			const width = parts.find(p => p.match(/[\d.]+(px|pt|em)/));
			const color = parts.find(p => this.convertColor(p, true));

			if (width) {
				const typstWidth = this.convertSize(width);
				const typstColor = color ? this.convertColor(color, true) : null;
				
				if (typstColor) {
					return `${typstWidth} + ${typstColor}`;
				} else {
					return typstWidth;
				}
			}
		}

		return null;
	}

	/**
	 * Convert border radius
	 */
	private convertBorderRadius(radius: string): string | null {
		if (!radius || radius === '0' || radius === 'inherit') return null;

		return this.convertSize(radius);
	}

	/**
	 * Convert margin properties
	 */
	private convertMargin(property: string, value: string): Record<string, string> | null {
		if (!value || value === '0' || value === 'inherit') return null;

		// For block elements, margins translate to above/below spacing
		const result: Record<string, string> = {};
		
		if (property === 'margin-top') {
			const size = this.convertSize(value);
			if (size) result.above = size;
		} else if (property === 'margin-bottom') {
			const size = this.convertSize(value);
			if (size) result.below = size;
		}

		return Object.keys(result).length > 0 ? result : null;
	}

	/**
	 * Convert padding to inset
	 */
	private convertPadding(property: string, value: string): string | null {
		if (!value || value === '0' || value === 'inherit') return null;

		if (property === 'padding') {
			// Handle shorthand
			const sizes = value.split(/\s+/).map(s => this.convertSize(s)).filter(Boolean);
			if (sizes.length === 1) {
				return sizes[0]!;
			} else if (sizes.length === 2) {
				return `(y: ${sizes[0]}, x: ${sizes[1]})`;
			} else if (sizes.length >= 4) {
				return `(top: ${sizes[0]}, right: ${sizes[1]}, bottom: ${sizes[2]}, left: ${sizes[3]})`;
			}
		}

		return this.convertSize(value);
	}

	/**
	 * Generate show condition for selector
	 */
	private generateShowCondition(selector: string): string | null {
		if (selector.includes('h1')) return 'heading.where(level: 1)';
		if (selector.includes('h2')) return 'heading.where(level: 2)';
		if (selector.includes('h3')) return 'heading.where(level: 3)';
		if (selector.includes('h4')) return 'heading.where(level: 4)';
		if (selector.includes('h5')) return 'heading.where(level: 5)';
		if (selector.includes('h6')) return 'heading.where(level: 6)';
		
		return null;
	}

	/**
	 * Generate Typst code from style rules
	 */
	public generateTypstCode(rules: TypstStyleRule[]): string {
		const lines: string[] = [];

		for (const rule of rules) {
			const properties = Object.entries(rule.properties)
				.map(([key, value]) => `${key}: ${value}`)
				.join(', ');

			if (rule.type === 'set') {
				if (rule.condition) {
					lines.push(`#show ${rule.condition}: set ${rule.target}(${properties})`);
				} else {
					lines.push(`#set ${rule.target}(${properties})`);
				}
			} else if (rule.type === 'show' && rule.condition) {
				lines.push(`#show ${rule.condition}: it => [${rule.content || '#it'}]`);
			}
		}

		return lines.join('\n');
	}
}