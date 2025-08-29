/**
 * Plugin-Specific Style Handling System
 * Detects and extracts styles from popular Obsidian plugins that add custom CSS and UI elements
 */

import { CSSExtractor, ExtractedStyle } from './CSSExtractor';
import { TypstStyleRule } from './CSSToTypstMapper';

export interface PluginStyleProfile {
	id: string;
	name: string;
	displayName: string;
	selectors: string[]; // CSS selectors specific to this plugin
	detectionIdentifiers: string[]; // CSS classes, data attributes, or DOM elements to detect plugin presence
	customExtraction?: (extractor: CSSExtractor) => Promise<ExtractedStyle[]>;
	typstMapping?: (styles: ExtractedStyle[]) => TypstStyleRule[];
	priority?: number;
}

export interface PluginDetectionResult {
	plugin: PluginStyleProfile;
	isActive: boolean;
	confidence: number; // 0-1 score of detection confidence
	extractedStyles: ExtractedStyle[];
}

/**
 * Handles style extraction for popular Obsidian plugins
 */
export class PluginSpecificStyleHandler {
	private app: any;
	private registeredPlugins: Map<string, PluginStyleProfile> = new Map();
	private activePlugins: Set<string> = new Set();

	constructor(app: any) {
		this.app = app;
		this.registerBuiltinProfiles();
	}

	/**
	 * Register built-in plugin style profiles
	 */
	private registerBuiltinProfiles(): void {
		// Dataview plugin
		this.registerPlugin({
			id: 'dataview',
			name: 'dataview',
			displayName: 'Dataview',
			selectors: [
				'.dataview.result-group',
				'.dataview.table-view-table',
				'.dataview.list-view-ul',
				'.dataview.inline-field',
				'.dataview.inline-field-key',
				'.dataview.inline-field-value',
				'.block-language-dataview',
				'.dataview-error-box'
			],
			detectionIdentifiers: [
				'.dataview',
				'.block-language-dataview',
				'[data-dataview]',
				'.dataview-plugin'
			],
			customExtraction: async (extractor: CSSExtractor) => {
				const styles: ExtractedStyle[] = [];
				
				// Extract Dataview table styles
				const dataviewTables = document.querySelectorAll('.dataview.table-view-table');
				for (const table of dataviewTables) {
					const computedStyle = getComputedStyle(table);
					styles.push({
						selector: '.dataview.table-view-table',
						property: 'border-collapse',
						value: computedStyle.borderCollapse,
						computedValue: computedStyle.borderCollapse
					});
					styles.push({
						selector: '.dataview.table-view-table',
						property: 'font-size',
						value: computedStyle.fontSize,
						computedValue: computedStyle.fontSize
					});
				}

				// Extract inline field styles
				const inlineFields = document.querySelectorAll('.dataview.inline-field');
				for (const field of Array.from(inlineFields).slice(0, 3)) {
					const computedStyle = getComputedStyle(field);
					styles.push({
						selector: '.dataview.inline-field',
						property: 'color',
						value: computedStyle.color,
						computedValue: computedStyle.color
					});
					styles.push({
						selector: '.dataview.inline-field',
						property: 'font-weight',
						value: computedStyle.fontWeight,
						computedValue: computedStyle.fontWeight
					});
				}

				return styles;
			},
			typstMapping: (styles: ExtractedStyle[]) => {
				const rules: TypstStyleRule[] = [];
				
				// Map table styles to Typst table formatting
				const tableStyles = styles.filter(s => s.selector.includes('table-view-table'));
				if (tableStyles.length > 0) {
					rules.push({
						type: 'show',
						target: 'table',
						properties: {
							stroke: '0.5pt',
							'align': 'left'
						},
						condition: 'table'
					});
				}

				// Map inline field styles
				const fieldStyles = styles.filter(s => s.selector.includes('inline-field'));
				if (fieldStyles.length > 0) {
					const colorStyle = fieldStyles.find(s => s.property === 'color');
					if (colorStyle) {
						rules.push({
							type: 'show',
							target: 'strong',
							properties: {
								fill: colorStyle.value
							},
							condition: 'regex(".*:.*")'
						});
					}
				}

				return rules;
			},
			priority: 10
		});

		// Templater plugin
		this.registerPlugin({
			id: 'templater',
			name: 'templater-obsidian',
			displayName: 'Templater',
			selectors: [
				'.templater-command',
				'.templater-inline-command',
				'.cm-templater-command',
				'.cm-templater-bracket'
			],
			detectionIdentifiers: [
				'.templater-command',
				'.cm-templater-command',
				'[data-templater]'
			],
			customExtraction: async (extractor: CSSExtractor) => {
				const styles: ExtractedStyle[] = [];
				
				// Extract Templater command styles
				const templaterCommands = document.querySelectorAll('.cm-templater-command, .templater-command');
				for (const command of templaterCommands) {
					const computedStyle = getComputedStyle(command);
					styles.push({
						selector: '.templater-command',
						property: 'color',
						value: computedStyle.color,
						computedValue: computedStyle.color
					});
					styles.push({
						selector: '.templater-command',
						property: 'background-color',
						value: computedStyle.backgroundColor,
						computedValue: computedStyle.backgroundColor
					});
					styles.push({
						selector: '.templater-command',
						property: 'font-style',
						value: computedStyle.fontStyle,
						computedValue: computedStyle.fontStyle
					});
				}

				return styles;
			},
			typstMapping: (styles: ExtractedStyle[]) => {
				const rules: TypstStyleRule[] = [];
				
				const commandStyles = styles.filter(s => s.selector.includes('templater-command'));
				if (commandStyles.length > 0) {
					const colorStyle = commandStyles.find(s => s.property === 'color');
					const bgStyle = commandStyles.find(s => s.property === 'background-color');
					
					if (colorStyle || bgStyle) {
						const properties: Record<string, string> = {};
						if (colorStyle) properties.fill = colorStyle.value;
						if (bgStyle && bgStyle.value !== 'rgba(0, 0, 0, 0)') {
							properties.highlight = bgStyle.value;
						}
						
						rules.push({
							type: 'show',
							target: 'raw',
							properties,
							condition: 'regex("<%.+%>")'
						});
					}
				}

				return rules;
			},
			priority: 8
		});

		// Calendar plugin
		this.registerPlugin({
			id: 'calendar',
			name: 'calendar',
			displayName: 'Calendar',
			selectors: [
				'.calendar-container',
				'.calendar-month',
				'.calendar-day',
				'.calendar-today',
				'.has-note'
			],
			detectionIdentifiers: [
				'.calendar-container',
				'.calendar-month',
				'.workspace-leaf-content[data-type="calendar"]'
			],
			priority: 5
		});

		// Kanban plugin
		this.registerPlugin({
			id: 'obsidian-kanban',
			name: 'obsidian-kanban',
			displayName: 'Kanban',
			selectors: [
				'.kanban-plugin',
				'.kanban-plugin__board',
				'.kanban-plugin__lane',
				'.kanban-plugin__item',
				'.kanban-plugin__item-title'
			],
			detectionIdentifiers: [
				'.kanban-plugin',
				'[data-type="kanban"]',
				'.kanban-plugin__board'
			],
			priority: 7
		});

		// Tasks plugin
		this.registerPlugin({
			id: 'obsidian-tasks',
			name: 'obsidian-tasks-plugin',
			displayName: 'Tasks',
			selectors: [
				'.tasks-list-text',
				'.task-list-item',
				'.tasks-backlink',
				'.task-due-date',
				'.task-priority'
			],
			detectionIdentifiers: [
				'.tasks-list-text',
				'.task-list-item.plugin-tasks-list-item',
				'.tasks-backlink'
			],
			priority: 6
		});

		// Excalidraw plugin
		this.registerPlugin({
			id: 'obsidian-excalidraw',
			name: 'obsidian-excalidraw-plugin',
			displayName: 'Excalidraw',
			selectors: [
				'.excalidraw-wrapper',
				'.excalidraw-svg',
				'.excalidraw-embedded-img'
			],
			detectionIdentifiers: [
				'.excalidraw-wrapper',
				'[data-type="excalidraw"]',
				'.excalidraw-svg'
			],
			priority: 4
		});

		// Advanced Tables plugin
		this.registerPlugin({
			id: 'table-editor-obsidian',
			name: 'table-editor-obsidian',
			displayName: 'Advanced Tables',
			selectors: [
				'.advanced-tables-toolbar',
				'.table-editor-button',
				'.cm-table-widget'
			],
			detectionIdentifiers: [
				'.advanced-tables-toolbar',
				'.table-editor-button',
				'.cm-table-widget'
			],
			priority: 5
		});

		// Tag Wrangler plugin
		this.registerPlugin({
			id: 'tag-wrangler',
			name: 'tag-wrangler',
			displayName: 'Tag Wrangler',
			selectors: [
				'.tag-wrangler-contextmenu',
				'.tag-wrangler-rename',
				'.tag-container.mod-tag-wrangler'
			],
			detectionIdentifiers: [
				'.tag-wrangler-contextmenu',
				'[data-tag-wrangler]'
			],
			priority: 3
		});

		// Outliner plugin
		this.registerPlugin({
			id: 'obsidian-outliner',
			name: 'obsidian-outliner',
			displayName: 'Outliner',
			selectors: [
				'.outliner-plugin-list',
				'.outliner-plugin-better-list',
				'.cm-fold-indicator.outliner-plugin'
			],
			detectionIdentifiers: [
				'.outliner-plugin-list',
				'.outliner-plugin-better-list',
				'[data-outliner-plugin]'
			],
			priority: 4
		});
	}

	/**
	 * Register a plugin style profile
	 */
	public registerPlugin(profile: PluginStyleProfile): void {
		this.registeredPlugins.set(profile.id, profile);
	}

	/**
	 * Detect active plugins and their styles
	 */
	public async detectActivePlugins(): Promise<PluginDetectionResult[]> {
		const results: PluginDetectionResult[] = [];
		
		for (const [id, plugin] of this.registeredPlugins) {
			const detection = await this.detectPlugin(plugin);
			if (detection.isActive) {
				results.push(detection);
				this.activePlugins.add(id);
			}
		}

		// Sort by priority and confidence
		results.sort((a, b) => {
			const priorityDiff = (b.plugin.priority || 0) - (a.plugin.priority || 0);
			if (priorityDiff !== 0) return priorityDiff;
			return b.confidence - a.confidence;
		});

		return results;
	}

	/**
	 * Detect if a specific plugin is active
	 */
	private async detectPlugin(plugin: PluginStyleProfile): Promise<PluginDetectionResult> {
		let confidence = 0;
		let detectionCount = 0;

		// Check detection identifiers
		for (const identifier of plugin.detectionIdentifiers) {
			detectionCount++;
			
			if (identifier.startsWith('.')) {
				// CSS class check
				const className = identifier.substring(1);
				if (document.querySelector(`.${className}`)) {
					confidence += 1;
				}
			} else if (identifier.startsWith('[') && identifier.endsWith(']')) {
				// Attribute selector check
				if (document.querySelector(identifier)) {
					confidence += 1;
				}
			} else {
				// General selector check
				if (document.querySelector(identifier)) {
					confidence += 1;
				}
			}
		}

		// Check for plugin in Obsidian's loaded plugins
		if (this.app.plugins?.enabledPlugins?.has?.(plugin.name)) {
			confidence += 2;
			detectionCount += 2;
		}

		// Check plugin-specific selectors exist in DOM
		let selectorMatches = 0;
		for (const selector of plugin.selectors) {
			if (document.querySelector(selector)) {
				selectorMatches += 1;
			}
		}

		if (selectorMatches > 0) {
			confidence += selectorMatches * 0.5;
			detectionCount += plugin.selectors.length;
		}

		const finalConfidence = detectionCount > 0 ? confidence / detectionCount : 0;
		const isActive = finalConfidence > 0.3; // Threshold for considering plugin active

		// Extract styles if plugin is detected as active
		let extractedStyles: ExtractedStyle[] = [];
		if (isActive) {
			extractedStyles = await this.extractPluginStyles(plugin);
		}

		return {
			plugin,
			isActive,
			confidence: finalConfidence,
			extractedStyles
		};
	}

	/**
	 * Extract styles for a specific plugin
	 */
	private async extractPluginStyles(plugin: PluginStyleProfile): Promise<ExtractedStyle[]> {
		const extractor = new CSSExtractor(this.app);
		let styles: ExtractedStyle[] = [];

		// Use custom extraction if available
		if (plugin.customExtraction) {
			try {
				styles = await plugin.customExtraction(extractor);
			} catch (error) {
				console.warn(`Custom extraction failed for plugin ${plugin.name}:`, error);
			}
		}

		// Fallback to standard selector-based extraction
		if (styles.length === 0) {
			for (const selector of plugin.selectors) {
				const elements = document.querySelectorAll(selector);
				
				for (const element of Array.from(elements).slice(0, 3)) { // Limit to first 3 matches per selector
					const computedStyle = getComputedStyle(element);
					
					// Extract key visual properties
					const keyProperties = [
						'color', 'background-color', 'border-color', 'font-family', 
						'font-size', 'font-weight', 'font-style', 'text-decoration',
						'margin', 'padding', 'border', 'border-radius'
					];

					for (const property of keyProperties) {
						const value = computedStyle.getPropertyValue(property);
						if (value && value !== 'initial' && value !== 'inherit' && value.trim()) {
							styles.push({
								selector,
								property,
								value: value.trim(),
								computedValue: value.trim()
							});
						}
					}
				}
			}
		}

		return styles;
	}

	/**
	 * Generate Typst rules for detected plugins
	 */
	public generatePluginTypstRules(): TypstStyleRule[] {
		const rules: TypstStyleRule[] = [];

		for (const pluginId of this.activePlugins) {
			const plugin = this.registeredPlugins.get(pluginId);
			if (!plugin) continue;

			// Use custom mapping if available
			if (plugin.typstMapping) {
				try {
					const pluginStyles = this.getPluginStyles(pluginId);
					const pluginRules = plugin.typstMapping(pluginStyles);
					rules.push(...pluginRules);
				} catch (error) {
					console.warn(`Typst mapping failed for plugin ${plugin.name}:`, error);
				}
			}
		}

		return rules;
	}

	/**
	 * Get extracted styles for a specific plugin
	 */
	private getPluginStyles(pluginId: string): ExtractedStyle[] {
		// This would be populated during detection - for now return empty array
		// In a full implementation, we'd cache the results from detectActivePlugins()
		return [];
	}

	/**
	 * Get all registered plugins
	 */
	public getRegisteredPlugins(): PluginStyleProfile[] {
		return Array.from(this.registeredPlugins.values());
	}

	/**
	 * Get active plugin IDs
	 */
	public getActivePlugins(): string[] {
		return Array.from(this.activePlugins);
	}

	/**
	 * Check if specific plugin is active
	 */
	public isPluginActive(pluginId: string): boolean {
		return this.activePlugins.has(pluginId);
	}

	/**
	 * Get plugin by ID
	 */
	public getPlugin(pluginId: string): PluginStyleProfile | null {
		return this.registeredPlugins.get(pluginId) || null;
	}

	/**
	 * Clear plugin detection cache
	 */
	public clearCache(): void {
		this.activePlugins.clear();
	}

	/**
	 * Generate plugin compatibility report
	 */
	public async generateCompatibilityReport(): Promise<{
		totalPlugins: number;
		activePlugins: number;
		supportedPlugins: string[];
		unsupportedPlugins: string[];
		styleExtractionResults: Record<string, number>;
	}> {
		const detectionResults = await this.detectActivePlugins();
		const supportedPlugins: string[] = [];
		const unsupportedPlugins: string[] = [];
		const styleExtractionResults: Record<string, number> = {};

		// Check all enabled plugins against our profiles
		const enabledPlugins = this.app.plugins?.enabledPlugins || new Set();
		
		for (const pluginName of enabledPlugins) {
			const profile = Array.from(this.registeredPlugins.values())
				.find(p => p.name === pluginName || p.id === pluginName);
			
			if (profile) {
				supportedPlugins.push(pluginName);
				const detection = detectionResults.find(r => r.plugin.id === profile.id);
				styleExtractionResults[pluginName] = detection?.extractedStyles.length || 0;
			} else {
				unsupportedPlugins.push(pluginName);
			}
		}

		return {
			totalPlugins: this.registeredPlugins.size,
			activePlugins: detectionResults.filter(r => r.isActive).length,
			supportedPlugins,
			unsupportedPlugins,
			styleExtractionResults
		};
	}

	/**
	 * Watch for plugin changes
	 */
	public watchPluginChanges(callback: (activePlugins: string[]) => void): void {
		// Listen for plugin enable/disable events
		if (this.app.plugins?.on) {
			this.app.plugins.on('plugin-enabled', async (pluginName: string) => {
				await this.detectActivePlugins();
				callback(Array.from(this.activePlugins));
			});

			this.app.plugins.on('plugin-disabled', async (pluginName: string) => {
				// Remove from active plugins
				const profile = Array.from(this.registeredPlugins.values())
					.find(p => p.name === pluginName);
				if (profile) {
					this.activePlugins.delete(profile.id);
				}
				callback(Array.from(this.activePlugins));
			});
		}

		// Listen for DOM changes that might indicate plugin activity
		const observer = new MutationObserver(async (mutations) => {
			let shouldRedetect = false;
			
			for (const mutation of mutations) {
				if (mutation.type === 'childList') {
					for (const node of mutation.addedNodes) {
						if (node instanceof Element) {
							// Check if added element contains plugin-specific classes
							for (const [_, plugin] of this.registeredPlugins) {
								for (const identifier of plugin.detectionIdentifiers) {
									if (identifier.startsWith('.')) {
										const className = identifier.substring(1);
										if (node.classList?.contains(className) || 
											node.querySelector?.(`.${className}`)) {
											shouldRedetect = true;
											break;
										}
									}
								}
								if (shouldRedetect) break;
							}
						}
						if (shouldRedetect) break;
					}
				}
				if (shouldRedetect) break;
			}

			if (shouldRedetect) {
				// Debounce detection
				setTimeout(async () => {
					await this.detectActivePlugins();
					callback(Array.from(this.activePlugins));
				}, 500);
			}
		});

		// Observe changes in the workspace
		observer.observe(document.body, {
			childList: true,
			subtree: true
		});
	}
}