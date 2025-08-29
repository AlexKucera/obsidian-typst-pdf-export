import { SubstitutionContext, TemplateValidationResult } from './types';

/**
 * Handles variable substitution in Typst templates
 */
export class TemplateSubstitution {
    
    /**
     * Substitute variables in template content
     */
    static substitute(templateContent: string, context: SubstitutionContext): string {
        let result = templateContent;
        
        // Extract all variables from template
        const variables = this.extractVariables(templateContent);
        
        // Process each variable
        for (const variable of variables) {
            const value = context[variable] || this.getDefaultValue(variable);
            const escapedValue = this.escapeTypstValue(value);
            
            // Replace all instances of the variable
            const variablePattern = new RegExp(`\\$${variable}\\$`, 'g');
            result = result.replace(variablePattern, escapedValue);
        }
        
        return result;
    }

    /**
     * Extract all variables from template content
     */
    static extractVariables(templateContent: string): string[] {
        const variables: string[] = [];
        const variablePattern = /\$(\w+)\$/g;
        let match;

        while ((match = variablePattern.exec(templateContent)) !== null) {
            const varName = match[1];
            if (!variables.includes(varName)) {
                variables.push(varName);
            }
        }

        return variables;
    }

    /**
     * Validate template and check for missing variables
     */
    static validate(templateContent: string, context: SubstitutionContext): TemplateValidationResult {
        const result: TemplateValidationResult = {
            isValid: true,
            errors: [],
            warnings: [],
            variables: []
        };

        // Extract variables from template
        const templateVariables = this.extractVariables(templateContent);
        result.variables = templateVariables;

        // Check for required variables
        const requiredVariables = ['body']; // body is always required
        
        for (const variable of requiredVariables) {
            if (templateVariables.includes(variable) && !context[variable]) {
                result.errors.push(`Required variable '${variable}' is missing`);
                result.isValid = false;
            }
        }

        // Check for undefined variables
        for (const variable of templateVariables) {
            if (!context[variable] && !this.hasDefaultValue(variable)) {
                result.warnings.push(`Variable '${variable}' is undefined and has no default value`);
            }
        }

        // Basic syntax validation
        try {
            this.validateTypstSyntax(templateContent);
        } catch (error) {
            result.errors.push(`Template syntax error: ${error.message}`);
            result.isValid = false;
        }

        return result;
    }

    /**
     * Get default value for common variables
     */
    private static getDefaultValue(variable: string): string {
        const defaults: Record<string, string> = {
            'title': '',
            'author': '',
            'date': new Date().toLocaleDateString(),
            'font': 'Liberation Serif',
            'fontSize': '12pt',
            'pageSize': 'a4',
            'margins': '2.5cm',
            'body': ''
        };

        return defaults[variable] || '';
    }

    /**
     * Check if variable has a default value
     */
    private static hasDefaultValue(variable: string): boolean {
        const defaults = ['title', 'author', 'date', 'font', 'fontSize', 'pageSize', 'margins'];
        return defaults.includes(variable);
    }

    /**
     * Escape special characters for Typst
     */
    private static escapeTypstValue(value: string): string {
        if (!value) return '';
        
        // Escape special Typst characters
        return value
            .replace(/\\/g, '\\\\')  // Escape backslashes
            .replace(/\$/g, '\\$')   // Escape dollar signs
            .replace(/#/g, '\\#')    // Escape hash symbols
            .replace(/\[/g, '\\[')   // Escape square brackets
            .replace(/\]/g, '\\]')
            .replace(/\{/g, '\\{')   // Escape curly braces
            .replace(/\}/g, '\\}')
            .replace(/</g, '\\<')    // Escape angle brackets
            .replace(/>/g, '\\>');
    }

    /**
     * Basic Typst syntax validation
     */
    private static validateTypstSyntax(templateContent: string): void {
        const errors: string[] = [];

        // Check for balanced brackets
        const brackets = [
            { open: '{', close: '}', name: 'curly braces' },
            { open: '[', close: ']', name: 'square brackets' },
            { open: '(', close: ')', name: 'parentheses' }
        ];

        for (const bracket of brackets) {
            const openCount = (templateContent.match(new RegExp(`\\${bracket.open}`, 'g')) || []).length;
            const closeCount = (templateContent.match(new RegExp(`\\${bracket.close}`, 'g')) || []).length;
            
            if (openCount !== closeCount) {
                errors.push(`Unbalanced ${bracket.name}: ${openCount} opening, ${closeCount} closing`);
            }
        }

        // Check for malformed function calls
        const malformedFunctionPattern = /#\w+\s*\(/g;
        let match;
        while ((match = malformedFunctionPattern.exec(templateContent)) !== null) {
            // This is a basic check - in practice, we'd need a more sophisticated parser
            const functionCall = match[0];
            if (!this.isValidTypstFunction(functionCall)) {
                errors.push(`Potentially malformed function call: ${functionCall}`);
            }
        }

        if (errors.length > 0) {
            throw new Error(errors.join('; '));
        }
    }

    /**
     * Check if a function call looks valid (basic heuristic)
     */
    private static isValidTypstFunction(functionCall: string): boolean {
        const knownFunctions = [
            'set', 'show', 'let', 'if', 'for', 'while', 'import', 'include',
            'text', 'page', 'par', 'heading', 'align', 'block', 'box', 'grid',
            'table', 'image', 'link', 'counter', 'context', 'place', 'lorem'
        ];

        const functionName = functionCall.replace('#', '').replace(/\s*\($/, '');
        return knownFunctions.includes(functionName);
    }

    /**
     * Preview substitution without applying it
     */
    static previewSubstitution(templateContent: string, context: SubstitutionContext): {
        preview: string;
        substitutions: { variable: string; value: string }[];
    } {
        const variables = this.extractVariables(templateContent);
        const substitutions = variables.map(variable => ({
            variable,
            value: context[variable] || this.getDefaultValue(variable)
        }));

        const preview = this.substitute(templateContent, context);

        return { preview, substitutions };
    }

    /**
     * Get variable usage statistics from template
     */
    static analyzeTemplate(templateContent: string): {
        totalVariables: number;
        uniqueVariables: string[];
        requiredVariables: string[];
        optionalVariables: string[];
        variableFrequency: Record<string, number>;
    } {
        const allVariables = [];
        const variablePattern = /\$(\w+)\$/g;
        let match;

        // Count all variable occurrences
        while ((match = variablePattern.exec(templateContent)) !== null) {
            allVariables.push(match[1]);
        }

        const uniqueVariables = [...new Set(allVariables)];
        const requiredVariables = ['body'];
        const optionalVariables = uniqueVariables.filter(v => !requiredVariables.includes(v));
        
        // Count frequency
        const variableFrequency: Record<string, number> = {};
        for (const variable of allVariables) {
            variableFrequency[variable] = (variableFrequency[variable] || 0) + 1;
        }

        return {
            totalVariables: allVariables.length,
            uniqueVariables,
            requiredVariables: requiredVariables.filter(v => uniqueVariables.includes(v)),
            optionalVariables,
            variableFrequency
        };
    }
}