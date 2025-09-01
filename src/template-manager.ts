import { App, normalizePath, TFile, TFolder, Notice } from 'obsidian';
import { Template, TemplateVariable, TemplateMetadata, TemplateValidationResult, SubstitutionContext } from './types';
import { TemplateSubstitution } from './template-substitution';
import { TemplateValidator } from './template-validator';
import * as path from 'path';

/**
 * Manages Typst templates, including built-in and custom user templates
 */
export class TemplateManager {
    private app: App;
    private pluginDir: string;
    private builtInTemplateNames: string[] = ['default.typ', 'article.typ', 'report.typ', 'modern.typ'];
    private customTemplates: Map<string, Template> = new Map();
    private customTemplateDirectory: string = 'Typst Templates';
    
    constructor(app: App, pluginDir: string, customTemplateDirectory?: string) {
        this.app = app;
        this.pluginDir = pluginDir;
        if (customTemplateDirectory) {
            this.customTemplateDirectory = customTemplateDirectory;
        }
    }

    /**
     * Get the absolute path to a built-in template file
     */
    private getBuiltInTemplatePath(templateName: string): string {
        return path.join(this.pluginDir, 'templates', templateName);
    }

    /**
     * Check if a file exists using Node.js fs (for built-in templates)
     */
    private async fileExists(filePath: string): Promise<boolean> {
        try {
            const fs = require('fs').promises;
            await fs.access(filePath);
            return true;
        } catch {
            return false;
        }
    }

    /**
     * Read a file using Node.js fs (for built-in templates)
     */
    private async readFile(filePath: string): Promise<string> {
        const fs = require('fs').promises;
        return await fs.readFile(filePath, 'utf8');
    }

    /**
     * Initialize built-in Typst templates (now reads from disk)
     */
    private async initializeBuiltInTemplates(): Promise<void> {
        // Built-in templates are now stored as files in templates/ directory
        // This method verifies they exist and are accessible
    }

    /**
     * Get available template names
     */
    async getAvailableTemplates(): Promise<string[]> {
        const builtIn: string[] = [];
        
        console.log('TemplateManager: Getting available templates...');
        console.log('Plugin dir:', this.pluginDir);
        
        // Check which built-in templates exist
        for (const templateName of this.builtInTemplateNames) {
            const templatePath = this.getBuiltInTemplatePath(templateName);
            console.log(`Checking template: ${templateName} at path: ${templatePath}`);
            const exists = await this.fileExists(templatePath);
            console.log(`Template ${templateName} exists: ${exists}`);
            if (exists) {
                builtIn.push(templateName);
            }
        }
        
        const custom = Array.from(this.customTemplates.keys()).map(name => `${name}.typ`);
        console.log('Built-in templates found:', builtIn);
        console.log('Custom templates found:', custom);
        return [...builtIn, ...custom];
    }

    /**
     * Get template file path by name (for use with Pandoc)
     */
    getTemplatePath(templateName: string): string | null {
        // Check built-in templates first
        if (this.builtInTemplateNames.includes(templateName)) {
            // Return relative path for Typst templates (not absolute)
            // This is because Pandoc + Typst expects relative paths
            return `templates/${templateName}`;
        }

        // Check custom templates
        const customKey = templateName.replace('.typ', '');
        if (this.customTemplates.has(customKey)) {
            const template = this.customTemplates.get(customKey);
            return template?.filePath || null;
        }

        return null;
    }

    /**
     * Check if a template exists
     */
    async hasTemplate(templateName: string): Promise<boolean> {
        // Check built-in templates
        if (this.builtInTemplateNames.includes(templateName)) {
            const templatePath = this.getBuiltInTemplatePath(templateName);
            return await this.fileExists(templatePath);
        }
        
        // Check custom templates
        return this.customTemplates.has(templateName.replace('.typ', ''));
    }

    /**
     * Get template metadata
     */
    async getTemplateInfo(templateName: string): Promise<Partial<Template> | null> {
        if (this.builtInTemplateNames.includes(templateName)) {
            try {
                const templatePath = this.getBuiltInTemplatePath(templateName);
                const content = await this.readFile(templatePath);
                return {
                    name: templateName.replace('.typ', ''),
                    variables: this.extractVariables(content),
                    metadata: {
                        author: 'Obsidian Typst PDF Export',
                        version: '1.0.0',
                        description: this.getBuiltInDescription(templateName),
                        compatibility: ['0.11.0', '0.12.0']
                    }
                };
            } catch (error) {
                console.error(`Error reading built-in template ${templateName}:`, error);
                return null;
            }
        }

        const customKey = templateName.replace('.typ', '');
        if (this.customTemplates.has(customKey)) {
            return this.customTemplates.get(customKey) || null;
        }

        return null;
    }

    /**
     * Extract variables from template content
     */
    private extractVariables(templateContent: string): Record<string, any> {
        const variables: Record<string, any> = {};
        const variablePattern = /\$(\w+)\$/g;
        let match;

        while ((match = variablePattern.exec(templateContent)) !== null) {
            const varName = match[1];
            variables[varName] = {
                type: 'string',
                defaultValue: '',
                description: this.getVariableDescription(varName),
                required: this.isVariableRequired(varName, templateContent)
            };
        }

        return variables;
    }

    /**
     * Get description for common template variables
     */
    private getVariableDescription(varName: string): string {
        const descriptions: Record<string, string> = {
            'title': 'Document title',
            'author': 'Document author',
            'date': 'Document date',
            'body': 'Main document content',
            'font': 'Font family',
            'fontSize': 'Font size',
            'pageSize': 'Page size (e.g., a4, us-letter)',
            'margins': 'Page margins'
        };

        return descriptions[varName] || `Template variable: ${varName}`;
    }

    /**
     * Check if a variable is required based on template usage
     */
    private isVariableRequired(varName: string, templateContent: string): boolean {
        // Body is always required
        if (varName === 'body') return true;
        
        // Check if variable is used in conditional blocks
        const conditionalPattern = new RegExp(`#if.*\\$${varName}\\$.*!=.*""`, 'g');
        return !conditionalPattern.test(templateContent);
    }

    /**
     * Get built-in template descriptions
     */
    private getBuiltInDescription(templateName: string): string {
        const descriptions: Record<string, string> = {
            'default.typ': 'Basic document template with title, author, and date',
            'article.typ': 'Academic article template with proper formatting',
            'report.typ': 'Formal report template with title page and headers',
            'single-page.typ': 'Single page template with auto-adjusting height'
        };

        return descriptions[templateName] || 'Built-in Typst template';
    }

    /**
     * Discover and load custom templates from the configured directory
     */
    async discoverCustomTemplates(): Promise<void> {
        try {
            const templateFolder = this.app.vault.getAbstractFileByPath(this.customTemplateDirectory);
            
            if (!templateFolder || !(templateFolder instanceof TFolder)) {
                // Create the template directory if it doesn't exist
                await this.createTemplateDirectory();
                return;
            }

            // Clear existing custom templates
            this.customTemplates.clear();

            // Process all .typ files in the directory
            const typFiles = templateFolder.children.filter(
                (file): file is TFile => file instanceof TFile && file.extension === 'typ'
            );

            for (const file of typFiles) {
                await this.loadCustomTemplate(file);
            }

        } catch (error) {
            console.error('Error discovering custom templates:', error);
            new Notice('Failed to discover custom templates');
        }
    }

    /**
     * Load a custom template from a file
     */
    private async loadCustomTemplate(file: TFile): Promise<void> {
        try {
            const content = await this.app.vault.read(file);
            const templateName = file.basename;
            
            // Extract metadata from template comments
            const metadata = this.extractTemplateMetadata(content, file);
            
            // Extract variables from template
            const variables = this.extractTemplateVariables(content);

            const template: Template = {
                name: templateName,
                filePath: file.path,
                variables,
                metadata
            };

            this.customTemplates.set(templateName, template);
            
        } catch (error) {
            console.error(`Error loading custom template ${file.path}:`, error);
        }
    }

    /**
     * Extract metadata from template comments
     */
    private extractTemplateMetadata(content: string, file: TFile): TemplateMetadata {
        const metadata: TemplateMetadata = {
            compatibility: ['0.11.0', '0.12.0']
        };

        // Look for metadata in comments at the top of the file
        const lines = content.split('\n');
        let inMetadataBlock = false;

        for (const line of lines) {
            const trimmed = line.trim();
            
            // Check for metadata block start
            if (trimmed.startsWith('/*') && trimmed.includes('@template-meta')) {
                inMetadataBlock = true;
                continue;
            }

            // Check for metadata block end
            if (trimmed.includes('*/')) {
                inMetadataBlock = false;
                continue;
            }

            if (inMetadataBlock) {
                // Parse metadata lines
                const metaMatch = trimmed.match(/^\s*\*?\s*@(\w+):\s*(.+)$/);
                if (metaMatch) {
                    const [, key, value] = metaMatch;
                    switch (key) {
                        case 'author':
                            metadata.author = value.trim();
                            break;
                        case 'version':
                            metadata.version = value.trim();
                            break;
                        case 'description':
                            metadata.description = value.trim();
                            break;
                        case 'compatibility':
                            metadata.compatibility = value.split(',').map(v => v.trim());
                            break;
                    }
                }
            }
        }

        // Set defaults if not found
        if (!metadata.description) {
            metadata.description = `Custom template: ${file.basename}`;
        }
        if (!metadata.author) {
            metadata.author = 'Custom';
        }
        if (!metadata.version) {
            metadata.version = '1.0.0';
        }

        return metadata;
    }

    /**
     * Extract variables from template with enhanced detection
     */
    private extractTemplateVariables(content: string): Record<string, TemplateVariable> {
        const variables: Record<string, TemplateVariable> = {};
        const foundVariables = TemplateSubstitution.extractVariables(content);

        for (const varName of foundVariables) {
            variables[varName] = {
                type: this.inferVariableType(varName),
                defaultValue: this.getDefaultValueForVariable(varName),
                description: this.getVariableDescription(varName),
                required: this.isVariableRequired(varName, content)
            };
        }

        return variables;
    }

    /**
     * Infer variable type based on name patterns
     */
    private inferVariableType(varName: string): 'string' | 'number' | 'boolean' {
        const numberPatterns = /^(size|width|height|margin|count|number|page)/i;
        const booleanPatterns = /^(show|hide|enable|disable|is|has)/i;

        if (numberPatterns.test(varName)) return 'number';
        if (booleanPatterns.test(varName)) return 'boolean';
        return 'string';
    }

    /**
     * Get default value based on variable type and name
     */
    private getDefaultValueForVariable(varName: string): any {
        const type = this.inferVariableType(varName);
        
        if (type === 'boolean') return false;
        if (type === 'number') {
            if (varName.includes('size')) return 12;
            if (varName.includes('margin')) return 2.5;
            return 0;
        }

        // String defaults
        const stringDefaults: Record<string, string> = {
            'title': '',
            'author': '',
            'date': new Date().toLocaleDateString(),
            'font': 'Liberation Serif',
            'fontSize': '12pt',
            'pageSize': 'a4',
            'margins': '2.5cm',
            'body': ''
        };

        return stringDefaults[varName] || '';
    }

    /**
     * Create the template directory if it doesn't exist
     */
    private async createTemplateDirectory(): Promise<void> {
        try {
            await this.app.vault.createFolder(this.customTemplateDirectory);
            
            // Create a sample template
            const sampleTemplate = `/*
@template-meta
@author: Your Name
@version: 1.0.0
@description: Sample custom template
@compatibility: 0.11.0, 0.12.0
*/

#set page(
  paper: "a4",
  margin: (x: 2.5cm, y: 2cm)
)
#set text(
  font: "$font$",
  size: 12pt,
  lang: "en"
)
#set par(justify: true)

#if "$title$" != "" [
  #align(center, text(16pt, weight: "bold")[$title$])
  #v(1em)
]

$body$`;

            const samplePath = normalizePath(`${this.customTemplateDirectory}/sample.typ`);
            await this.app.vault.create(samplePath, sampleTemplate);
            
            new Notice(`Created template directory at: ${this.customTemplateDirectory}`);
            
        } catch (error) {
            console.error('Error creating template directory:', error);
        }
    }

    /**
     * Get custom template directory path
     */
    getCustomTemplateDirectory(): string {
        return this.customTemplateDirectory;
    }

    /**
     * Set custom template directory and refresh templates
     */
    async setCustomTemplateDirectory(directory: string): Promise<void> {
        this.customTemplateDirectory = directory;
        await this.discoverCustomTemplates();
    }

    /**
     * Refresh custom templates (re-scan directory)
     */
    async refreshCustomTemplates(): Promise<void> {
        await this.discoverCustomTemplates();
        new Notice('Custom templates refreshed');
    }

    /**
     * Get template content by name (enhanced to handle custom templates)
     */
    async getTemplateContent(templateName: string): Promise<string | null> {
        // Check built-in templates first
        if (this.builtInTemplateNames.includes(templateName)) {
            try {
                const templatePath = this.getBuiltInTemplatePath(templateName);
                return await this.readFile(templatePath);
            } catch (error) {
                console.error(`Error reading built-in template ${templateName}:`, error);
                return null;
            }
        }

        // Check custom templates
        const customKey = templateName.replace('.typ', '');
        if (this.customTemplates.has(customKey)) {
            const template = this.customTemplates.get(customKey);
            if (template) {
                try {
                    const file = this.app.vault.getAbstractFileByPath(template.filePath) as TFile;
                    if (file) {
                        return await this.app.vault.read(file);
                    }
                } catch (error) {
                    console.error(`Error reading custom template ${template.filePath}:`, error);
                }
            }
        }

        return null;
    }

    /**
     * Check if custom templates directory exists
     */
    customTemplateDirectoryExists(): boolean {
        const folder = this.app.vault.getAbstractFileByPath(this.customTemplateDirectory);
        return folder instanceof TFolder;
    }

    /**
     * Validate a template by name
     */
    async validateTemplate(templateName: string, context?: SubstitutionContext): Promise<TemplateValidationResult> {
        const templateContent = await this.getTemplateContent(templateName);
        
        if (!templateContent) {
            return {
                isValid: false,
                errors: [`Template '${templateName}' not found`],
                warnings: [],
                variables: []
            };
        }

        return TemplateValidator.validateTemplate(templateContent, context);
    }

    /**
     * Validate all templates and return a summary
     */
    async validateAllTemplates(): Promise<{
        builtInResults: Map<string, TemplateValidationResult>;
        customResults: Map<string, TemplateValidationResult>;
        summary: {
            totalTemplates: number;
            validTemplates: number;
            invalidTemplates: number;
            templatesWithWarnings: number;
        };
    }> {
        const builtInResults = new Map<string, TemplateValidationResult>();
        const customResults = new Map<string, TemplateValidationResult>();

        // Validate built-in templates
        for (const templateName of this.builtInTemplateNames) {
            try {
                const templatePath = this.getBuiltInTemplatePath(templateName);
                const content = await this.readFile(templatePath);
                const result = TemplateValidator.validateTemplate(content);
                builtInResults.set(templateName, result);
            } catch (error) {
                builtInResults.set(templateName, {
                    isValid: false,
                    errors: [`Error loading template: ${error.message}`],
                    warnings: [],
                    variables: []
                });
            }
        }

        // Validate custom templates
        for (const [templateName, template] of this.customTemplates) {
            try {
                const content = await this.getTemplateContent(templateName + '.typ');
                if (content) {
                    const result = TemplateValidator.validateTemplate(content);
                    customResults.set(templateName, result);
                }
            } catch (error) {
                customResults.set(templateName, {
                    isValid: false,
                    errors: [`Error loading template: ${error.message}`],
                    warnings: [],
                    variables: []
                });
            }
        }

        // Calculate summary
        const allResults = [...builtInResults.values(), ...customResults.values()];
        const summary = {
            totalTemplates: allResults.length,
            validTemplates: allResults.filter(r => r.isValid).length,
            invalidTemplates: allResults.filter(r => !r.isValid).length,
            templatesWithWarnings: allResults.filter(r => r.warnings.length > 0).length
        };

        return { builtInResults, customResults, summary };
    }

    /**
     * Process template with variable substitution and validation
     */
    async processTemplate(templateName: string, context: SubstitutionContext): Promise<{
        content: string;
        validation: TemplateValidationResult;
    }> {
        const templateContent = await this.getTemplateContent(templateName);
        
        if (!templateContent) {
            throw new Error(`Template '${templateName}' not found`);
        }

        // Validate template with context
        const validation = TemplateValidator.validateTemplate(templateContent, context);
        
        if (!validation.isValid) {
            const errorMsg = `Template validation failed: ${validation.errors.join(', ')}`;
            throw new Error(errorMsg);
        }

        // Substitute variables
        const processedContent = TemplateSubstitution.substitute(templateContent, context);

        return {
            content: processedContent,
            validation
        };
    }

    /**
     * Preview template processing without throwing errors
     */
    async previewTemplate(templateName: string, context: SubstitutionContext): Promise<{
        content: string;
        validation: TemplateValidationResult;
        substitutions: { variable: string; value: string }[];
    }> {
        const templateContent = await this.getTemplateContent(templateName);
        
        if (!templateContent) {
            return {
                content: '',
                validation: {
                    isValid: false,
                    errors: [`Template '${templateName}' not found`],
                    warnings: [],
                    variables: []
                },
                substitutions: []
            };
        }

        // Validate template
        const validation = TemplateValidator.validateTemplate(templateContent, context);
        
        // Preview substitution
        const { preview, substitutions } = TemplateSubstitution.previewSubstitution(templateContent, context);

        return {
            content: preview,
            validation,
            substitutions
        };
    }

    /**
     * Get detailed template analysis
     */
    async analyzeTemplate(templateName: string): Promise<{
        info: Partial<Template>;
        analysis: {
            totalVariables: number;
            uniqueVariables: string[];
            requiredVariables: string[];
            optionalVariables: string[];
            variableFrequency: Record<string, number>;
        };
        validation: TemplateValidationResult;
    }> {
        const templateContent = await this.getTemplateContent(templateName);
        const info = await this.getTemplateInfo(templateName);
        
        if (!templateContent) {
            throw new Error(`Template '${templateName}' not found`);
        }

        const analysis = TemplateSubstitution.analyzeTemplate(templateContent);
        const validation = TemplateValidator.validateTemplate(templateContent);

        return {
            info: info || {},
            analysis,
            validation
        };
    }

    /**
     * Check template health and compatibility
     */
    async checkTemplateHealth(templateName: string): Promise<{
        isHealthy: boolean;
        issues: string[];
        recommendations: string[];
        compatibility: {
            typstVersion: string[];
            features: string[];
        };
    }> {
        const templateContent = await this.getTemplateContent(templateName);
        
        if (!templateContent) {
            return {
                isHealthy: false,
                issues: [`Template '${templateName}' not found`],
                recommendations: [],
                compatibility: { typstVersion: [], features: [] }
            };
        }

        const validation = TemplateValidator.validateTemplate(templateContent);
        const issues: string[] = [...validation.errors, ...validation.warnings];
        const recommendations: string[] = [];

        // Add specific recommendations based on analysis
        if (!templateContent.includes('#set page')) {
            recommendations.push('Consider adding page setup (#set page) for better layout control');
        }

        if (!templateContent.includes('#set text')) {
            recommendations.push('Consider adding text configuration (#set text) for consistent typography');
        }

        if (validation.variables.length === 1 && validation.variables[0] === 'body') {
            recommendations.push('Template only uses body variable. Consider adding title, author, or date variables for more flexibility');
        }

        // Detect compatibility requirements
        const typstVersions = ['0.11.0', '0.12.0'];
        const features: string[] = [];

        if (templateContent.includes('height: auto')) {
            features.push('Dynamic page height');
        }
        if (templateContent.includes('#context')) {
            features.push('Context blocks');
        }
        if (templateContent.includes('scope: "parent"')) {
            features.push('Parent scope placement');
        }

        return {
            isHealthy: validation.isValid && validation.warnings.length === 0,
            issues,
            recommendations,
            compatibility: {
                typstVersion: typstVersions,
                features
            }
        };
    }
}