/**
 * Template Manager
 * Handles template discovery, loading, and validation
 */

import { obsidianTypstPDFExport } from '../../main';
import { PathUtils } from '../core/PathUtils';
import * as path from 'path';

export class TemplateManager {
	private plugin: obsidianTypstPDFExport;
	private templatesPath: string;
	private pathUtils: PathUtils;

	constructor(plugin: obsidianTypstPDFExport) {
		this.plugin = plugin;
		this.pathUtils = new PathUtils(plugin.app);
		// Templates are stored in the plugin directory
		this.templatesPath = this.pathUtils.joinPath(
			this.pathUtils.getVaultPath(),
			this.pathUtils.getPluginDir(this.plugin.manifest),
			'templates'
		);
	}
	
	/**
	 * Get list of available template files
	 */
	async getAvailableTemplates(): Promise<string[]> {
		try {
			// Check if templates directory exists
			const exists = await this.pathUtils.fileExists(this.templatesPath);
			if (!exists) {
				console.warn('Templates directory does not exist:', this.templatesPath);
				return ['default.typ'];
			}

			// Read directory contents
			const list = await this.plugin.app.vault.adapter.list(this.templatesPath);
			const files = list.files.map(filePath => path.basename(filePath));

			// Filter for .typ and .pandoc.typ files
			const templates = files.filter(file => {
				return file.endsWith('.typ') || file.endsWith('.pandoc.typ');
			});

			// Always include default if not present
			if (!templates.includes('default.typ')) {
				templates.unshift('default.typ');
			}

			return templates;
		} catch (error) {
			console.error('Error loading templates:', error);
			return ['default.typ'];
		}
	}
	
	/**
	 * Get the full path to a template file
	 */
	getTemplatePath(templateName: string): string {
		return this.pathUtils.joinPath(this.templatesPath, templateName);
	}
	
	/**
	 * Check if a template exists
	 */
	async templateExists(templateName: string): Promise<boolean> {
		const templatePath = this.getTemplatePath(templateName);
		return await this.pathUtils.fileExists(templatePath);
	}
	
	/**
	 * Load template content
	 */
	async loadTemplate(templateName: string): Promise<string | null> {
		const templatePath = this.getTemplatePath(templateName);
		try {
			const exists = await this.pathUtils.fileExists(templatePath);
			if (exists) {
				return await this.plugin.app.vault.adapter.read(templatePath);
			}
		} catch (error) {
			console.error('Error loading template:', error);
		}
		return null;
	}
	
	/**
	 * Get template metadata (if available in template comments)
	 */
	async getTemplateMetadata(templateName: string): Promise<TemplateMetadata | null> {
		const content = await this.loadTemplate(templateName);
		if (!content) return null;
		
		// Parse template header comments for metadata
		const metadataRegex = /^\/\/\s*@(\w+):\s*(.+)$/gm;
		const metadata: TemplateMetadata = {
			name: templateName,
			description: '',
			author: '',
			version: '',
			variables: []
		};
		
		let match;
		while ((match = metadataRegex.exec(content)) !== null) {
			const [, key, value] = match;
			switch (key) {
				case 'description':
					metadata.description = value;
					break;
				case 'author':
					metadata.author = value;
					break;
				case 'version':
					metadata.version = value;
					break;
				case 'variable':
					// Parse variable definition (e.g., @variable: font:string:Body font family)
					const [name, type, description] = value.split(':');
					metadata.variables.push({ name, type, description });
					break;
			}
		}
		
		return metadata;
	}
}

export interface TemplateMetadata {
	name: string;
	description: string;
	author: string;
	version: string;
	variables: TemplateVariable[];
}

export interface TemplateVariable {
	name: string;
	type: string;
	description: string;
}