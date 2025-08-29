import { App, normalizePath, TFile, TFolder, Notice } from 'obsidian';
import { Template, TemplateVariable, TemplateMetadata, TemplateValidationResult, SubstitutionContext } from './types';
import { TemplateSubstitution } from './template-substitution';
import { TemplateValidator } from './template-validator';

/**
 * Manages Typst templates, including built-in and custom user templates
 */
export class TemplateManager {
    private app: App;
    private builtInTemplates: Map<string, string> = new Map();
    private customTemplates: Map<string, Template> = new Map();
    private customTemplateDirectory: string = 'Typst Templates';
    
    constructor(app: App, customTemplateDirectory?: string) {
        this.app = app;
        if (customTemplateDirectory) {
            this.customTemplateDirectory = customTemplateDirectory;
        }
        this.initializeBuiltInTemplates();
    }

    /**
     * Initialize built-in Typst templates with modern 0.11+ syntax
     */
    private initializeBuiltInTemplates(): void {
        // Default template - basic document
        this.builtInTemplates.set('default.typ', `#set page(
  paper: "a4",
  margin: (x: 2.5cm, y: 2cm)
)
#set text(
  font: "Liberation Serif",
  size: 12pt,
  lang: "en"
)
#set par(justify: true, leading: 0.65em)
#set heading(numbering: "1.")

#if "$title$" != "" [
  #align(center, text(18pt, weight: "bold")[$title$])
  #v(1em)
]

#if "$author$" != "" [
  #align(center, text(14pt)[$author$])
  #v(0.5em)
]

#if "$date$" != "" [
  #align(center, text(12pt)[$date$])
  #v(2em)
]

$body$`);

        // Article template - academic paper style
        this.builtInTemplates.set('article.typ', `#set page(
  paper: "a4",
  margin: (x: 2.5cm, y: 2cm),
  numbering: "1"
)
#set text(
  font: "Liberation Serif",
  size: 11pt,
  lang: "en"
)
#set par(justify: true, leading: 0.65em, first-line-indent: 1.2em)
#set heading(numbering: "1.")

#show heading.where(level: 1): it => block(
  width: 100%,
  below: 1.5em,
  above: 2em,
)[
  #set align(center)
  #set text(16pt, weight: "bold")
  #it.body
]

#show heading.where(level: 2): it => block(
  width: 100%,
  below: 1em,
  above: 1.5em,
)[
  #set text(13pt, weight: "bold")
  #it
]

#if "$title$" != "" [
  #align(center, text(20pt, weight: "bold")[$title$])
  #v(1em)
]

#if "$author$" != "" [
  #align(center, text(14pt)[$author$])
  #v(0.5em)
]

#if "$date$" != "" [
  #align(center, text(12pt)[$date$])
  #v(2em)
]

$body$`);

        // Report template - formal report style
        this.builtInTemplates.set('report.typ', `#set page(
  paper: "a4",
  margin: (x: 2.5cm, y: 2.5cm),
  numbering: "1",
  header: context {
    if counter(page).get().first() > 1 [
      #align(right)[$title$]
      #line(length: 100%)
    ]
  }
)
#set text(
  font: "Liberation Serif",
  size: 12pt,
  lang: "en"
)
#set par(justify: true, leading: 0.65em)
#set heading(numbering: "1.")

#show heading.where(level: 1): it => pagebreak(weak: true) + block(
  width: 100%,
  below: 2em,
  above: 0pt,
)[
  #set align(center)
  #set text(18pt, weight: "bold")
  #counter(heading).display()
  #h(0.5em)
  #it.body
]

#show heading.where(level: 2): it => block(
  width: 100%,
  below: 1em,
  above: 1.5em,
)[
  #set text(14pt, weight: "bold")
  #it
]

// Title page
#page()[
  #align(center + horizon)[
    #if "$title$" != "" [
      #text(24pt, weight: "bold")[$title$]
      #v(2em)
    ]
    
    #if "$author$" != "" [
      #text(16pt)[$author$]
      #v(1em)
    ]
    
    #if "$date$" != "" [
      #text(14pt)[$date$]
    ]
  ]
]

$body$`);

        // Single-page template - auto-adjusting height
        this.builtInTemplates.set('single-page.typ', `#set page(
  paper: "a4",
  margin: (x: 2.5cm, y: 2cm),
  height: auto
)
#set text(
  font: "Liberation Serif",
  size: 12pt,
  lang: "en"
)
#set par(justify: true, leading: 0.65em)
#set heading(numbering: "1.")

#show heading.where(level: 1): it => block(
  width: 100%,
  below: 1.5em,
  above: 1.5em,
)[
  #set text(16pt, weight: "bold")
  #it
]

#show heading.where(level: 2): it => block(
  width: 100%,
  below: 1em,
  above: 1em,
)[
  #set text(14pt, weight: "bold")
  #it
]

#if "$title$" != "" [
  #align(center, text(18pt, weight: "bold")[$title$])
  #v(1em)
]

#if "$author$" != "" [
  #align(center, text(14pt)[$author$])
  #v(0.5em)
]

#if "$date$" != "" [
  #align(center, text(12pt)[$date$])
  #v(2em)
]

$body$`);
    }

    /**
     * Get available template names
     */
    getAvailableTemplates(): string[] {
        const builtIn = Array.from(this.builtInTemplates.keys());
        const custom = Array.from(this.customTemplates.keys()).map(name => `${name}.typ`);
        return [...builtIn, ...custom];
    }

    /**
     * Get template content by name
     */
    getTemplate(templateName: string): string | null {
        // Check built-in templates first
        if (this.builtInTemplates.has(templateName)) {
            return this.builtInTemplates.get(templateName) || null;
        }

        // Check custom templates
        const customKey = templateName.replace('.typ', '');
        if (this.customTemplates.has(customKey)) {
            const template = this.customTemplates.get(customKey);
            // For custom templates, we'll need to load the file content
            // This will be implemented in the next subtask
            return template?.filePath || null;
        }

        return null;
    }

    /**
     * Check if a template exists
     */
    hasTemplate(templateName: string): boolean {
        return this.builtInTemplates.has(templateName) || 
               this.customTemplates.has(templateName.replace('.typ', ''));
    }

    /**
     * Get template metadata
     */
    getTemplateInfo(templateName: string): Partial<Template> | null {
        if (this.builtInTemplates.has(templateName)) {
            return {
                name: templateName.replace('.typ', ''),
                variables: this.extractVariables(this.builtInTemplates.get(templateName) || ''),
                metadata: {
                    author: 'Obsidian Typst PDF Export',
                    version: '1.0.0',
                    description: this.getBuiltInDescription(templateName),
                    compatibility: ['0.11.0', '0.12.0']
                }
            };
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
        if (this.builtInTemplates.has(templateName)) {
            return this.builtInTemplates.get(templateName) || null;
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
        for (const [templateName, content] of this.builtInTemplates) {
            const result = TemplateValidator.validateTemplate(content);
            builtInResults.set(templateName, result);
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
        const info = this.getTemplateInfo(templateName);
        
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