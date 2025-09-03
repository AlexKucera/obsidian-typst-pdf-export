import { TemplateValidationResult, SubstitutionContext } from './types';
import { TemplateSubstitution } from './template-substitution';
import { getValidTypstPaperSizes } from './utils/paperSizeMapper';

/**
 * Comprehensive template validation system
 */
export class TemplateValidator {
    
    /**
     * Validate template content comprehensively
     */
    static validateTemplate(templateContent: string, context?: SubstitutionContext): TemplateValidationResult {
        const result: TemplateValidationResult = {
            isValid: true,
            errors: [],
            warnings: [],
            variables: []
        };

        // Extract variables
        result.variables = TemplateSubstitution.extractVariables(templateContent);

        // Perform various validation checks
        this.validateSyntax(templateContent, result);
        this.validateStructure(templateContent, result);
        this.validateVariables(templateContent, result, context);
        this.validateTypstFeatures(templateContent, result);
        this.validatePageSetup(templateContent, result);

        // Set overall validity
        result.isValid = result.errors.length === 0;

        return result;
    }

    /**
     * Validate basic Typst syntax
     */
    private static validateSyntax(templateContent: string, result: TemplateValidationResult): void {
        // Check for balanced brackets and parentheses
        this.validateBrackets(templateContent, result);
        
        // Check for malformed function calls
        this.validateFunctionCalls(templateContent, result);
        
        // Check for invalid characters in variable names
        this.validateVariableNames(templateContent, result);
        
        // Check for unclosed strings
        this.validateStrings(templateContent, result);
    }

    /**
     * Validate bracket balance
     */
    private static validateBrackets(templateContent: string, result: TemplateValidationResult): void {
        const brackets = [
            { open: '{', close: '}', name: 'curly braces', stack: [] as number[] },
            { open: '[', close: ']', name: 'square brackets', stack: [] as number[] },
            { open: '(', close: ')', name: 'parentheses', stack: [] as number[] }
        ];

        const lines = templateContent.split('\n');
        
        for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
            const line = lines[lineIndex];
            
            for (let charIndex = 0; charIndex < line.length; charIndex++) {
                const char = line[charIndex];
                
                for (const bracket of brackets) {
                    if (char === bracket.open) {
                        bracket.stack.push(lineIndex + 1);
                    } else if (char === bracket.close) {
                        if (bracket.stack.length === 0) {
                            result.errors.push(
                                `Unmatched closing ${bracket.name} at line ${lineIndex + 1}, column ${charIndex + 1}`
                            );
                        } else {
                            bracket.stack.pop();
                        }
                    }
                }
            }
        }

        // Check for unclosed brackets
        for (const bracket of brackets) {
            for (const lineNum of bracket.stack) {
                result.errors.push(`Unclosed ${bracket.name} starting at line ${lineNum}`);
            }
        }
    }

    /**
     * Validate function calls
     */
    private static validateFunctionCalls(templateContent: string, result: TemplateValidationResult): void {
        const functionPattern = /#(\w+)\s*\(/g;
        const knownFunctions = [
            'set', 'show', 'let', 'if', 'for', 'while', 'import', 'include',
            'text', 'page', 'par', 'heading', 'align', 'block', 'box', 'grid',
            'table', 'image', 'link', 'counter', 'context', 'place', 'lorem',
            'v', 'h', 'linebreak', 'pagebreak', 'smallcaps', 'emph', 'strong'
        ];

        let match;
        while ((match = functionPattern.exec(templateContent)) !== null) {
            const functionName = match[1];
            
            if (!knownFunctions.includes(functionName)) {
                const lineNum = templateContent.substring(0, match.index).split('\n').length;
                result.warnings.push(
                    `Unknown function '${functionName}' at line ${lineNum}. This may be a custom function or newer Typst feature.`
                );
            }
        }
    }

    /**
     * Validate variable names
     */
    private static validateVariableNames(templateContent: string, result: TemplateValidationResult): void {
        const variablePattern = /\$(\w*[^a-zA-Z0-9_]\w*|\d+\w*)\$/g;
        let match;

        while ((match = variablePattern.exec(templateContent)) !== null) {
            const varName = match[1];
            const lineNum = templateContent.substring(0, match.index).split('\n').length;
            
            if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(varName)) {
                result.errors.push(
                    `Invalid variable name '${varName}' at line ${lineNum}. Variable names must start with a letter or underscore and contain only letters, numbers, and underscores.`
                );
            }
        }
    }

    /**
     * Validate string literals
     */
    private static validateStrings(templateContent: string, result: TemplateValidationResult): void {
        // Check for unclosed string literals
        const stringPattern = /"([^"\\]|\\.)*"/g;
        const allQuotes = templateContent.match(/"/g);
        
        if (allQuotes && allQuotes.length % 2 !== 0) {
            result.errors.push('Unclosed string literal detected');
        }

        // Check for unclosed content blocks
        let bracketCount = 0;
        let inString = false;
        let escaped = false;
        
        for (let i = 0; i < templateContent.length; i++) {
            const char = templateContent[i];
            
            if (escaped) {
                escaped = false;
                continue;
            }
            
            if (char === '\\') {
                escaped = true;
                continue;
            }
            
            if (char === '"') {
                inString = !inString;
                continue;
            }
            
            if (!inString) {
                if (char === '[') bracketCount++;
                else if (char === ']') bracketCount--;
            }
        }
        
        if (bracketCount !== 0) {
            result.errors.push(`Unbalanced content blocks: ${Math.abs(bracketCount)} ${bracketCount > 0 ? 'unclosed' : 'extra closing'} bracket(s)`);
        }
    }

    /**
     * Validate template structure
     */
    private static validateStructure(templateContent: string, result: TemplateValidationResult): void {
        // Check for body variable (required for all templates)
        if (!templateContent.includes('$body$')) {
            result.errors.push("Template must contain a '$body$' variable to include the main content");
        }

        // Warn about missing common structural elements
        const commonElements = ['#set page', '#set text', '#set par'];
        const missingElements = commonElements.filter(element => !templateContent.includes(element));
        
        if (missingElements.length > 0) {
            result.warnings.push(
                `Template may be missing common setup: ${missingElements.join(', ')}. This is not an error but may result in default formatting.`
            );
        }

        // Check for potentially problematic patterns
        this.validateProblematicPatterns(templateContent, result);
    }

    /**
     * Validate potentially problematic patterns
     */
    private static validateProblematicPatterns(templateContent: string, result: TemplateValidationResult): void {
        const problematicPatterns = [
            {
                pattern: /#set\s+page\s*\([^)]*height:\s*auto[^)]*\)/,
                message: "Templates with 'height: auto' may not work well with multi-page documents",
                type: 'warning' as const
            },
            {
                pattern: /#pagebreak\(\s*weak:\s*false\s*\)/,
                message: "Hard page breaks may cause layout issues in generated documents",
                type: 'warning' as const
            },
            {
                pattern: /#import\s+[^:]*:/,
                message: "Import statements may fail if the imported module is not available",
                type: 'warning' as const
            },
            {
                pattern: /\$\w+\$\s*\$\w+\$/,
                message: "Adjacent variables without spacing may cause formatting issues",
                type: 'warning' as const
            }
        ];

        for (const { pattern, message, type } of problematicPatterns) {
            if (pattern.test(templateContent)) {
                if (type === 'warning') {
                    result.warnings.push(message);
                }
            }
        }
    }

    /**
     * Validate variables and their usage
     */
    private static validateVariables(templateContent: string, result: TemplateValidationResult, context?: SubstitutionContext): void {
        const variables = result.variables;

        // Check for empty variables
        if (variables.length === 0) {
            result.warnings.push('Template contains no variables. This may be intentional for static templates.');
        }

        // Check for duplicate variables (not an error, just inefficient)
        const variableCounts = new Map<string, number>();
        const variablePattern = /\$(\w+)\$/g;
        let match;

        while ((match = variablePattern.exec(templateContent)) !== null) {
            const varName = match[1];
            variableCounts.set(varName, (variableCounts.get(varName) || 0) + 1);
        }

        // Warn about variables used only once (might be typos)
        for (const [varName, count] of variableCounts) {
            if (count === 1 && varName !== 'body') {
                result.warnings.push(`Variable '${varName}' is used only once. Verify this is intentional.`);
            }
        }

        // If context is provided, validate against it
        if (context) {
            this.validateAgainstContext(variables, context, result);
        }

        // Check for common variable name typos
        this.validateCommonVariables(variables, result);
    }

    /**
     * Validate variables against substitution context
     */
    private static validateAgainstContext(variables: string[], context: SubstitutionContext, result: TemplateValidationResult): void {
        const requiredVars = variables.filter(v => v === 'body');
        const optionalVars = variables.filter(v => v !== 'body');

        // Check required variables
        for (const varName of requiredVars) {
            if (!context[varName]) {
                result.errors.push(`Required variable '${varName}' is missing from context`);
            }
        }

        // Warn about missing optional variables
        for (const varName of optionalVars) {
            if (!context[varName] && !this.hasImplicitDefault(varName)) {
                result.warnings.push(`Optional variable '${varName}' is not provided and has no default value`);
            }
        }
    }

    /**
     * Check if variable has an implicit default
     */
    private static hasImplicitDefault(varName: string): boolean {
        const defaultVars = ['title', 'author', 'date', 'font', 'fontSize', 'pageSize', 'margins'];
        return defaultVars.includes(varName);
    }

    /**
     * Validate common variable names for typos
     */
    private static validateCommonVariables(variables: string[], result: TemplateValidationResult): void {
        const commonVars = ['title', 'author', 'date', 'body', 'font', 'fontSize', 'pageSize', 'margins'];
        const typoMap = {
            'titel': 'title',
            'autor': 'author',
            'authur': 'author',
            'dat': 'date',
            'boby': 'body',
            'bdy': 'body',
            'fontsize': 'fontSize',
            'font_size': 'fontSize',
            'pagesize': 'pageSize',
            'page_size': 'pageSize',
            'margin': 'margins'
        };

        for (const variable of variables) {
            if (variable in typoMap) {
                result.warnings.push(
                    `Variable '${variable}' might be a typo. Did you mean '${typoMap[variable as keyof typeof typoMap]}'?`
                );
            }
        }
    }

    /**
     * Validate Typst-specific features
     */
    private static validateTypstFeatures(templateContent: string, result: TemplateValidationResult): void {
        // Check for version-specific features
        this.validateVersionFeatures(templateContent, result);
        
        // Check for proper page setup
        this.validatePageFeatures(templateContent, result);
        
        // Check for text formatting
        this.validateTextFeatures(templateContent, result);
    }

    /**
     * Validate version-specific features
     */
    private static validateVersionFeatures(templateContent: string, result: TemplateValidationResult): void {
        const v011Features = [
            { pattern: /height:\s*auto/, feature: 'height: auto (Typst 0.11+)' },
            { pattern: /#context/, feature: 'context blocks (Typst 0.11+)' },
            { pattern: /scope:\s*"parent"/, feature: 'scope: "parent" (Typst 0.11+)' }
        ];

        for (const { pattern, feature } of v011Features) {
            if (pattern.test(templateContent)) {
                result.warnings.push(`Template uses ${feature}. Ensure Typst version 0.11+ is available.`);
            }
        }
    }

    /**
     * Validate page setup features
     */
    private static validatePageFeatures(templateContent: string, result: TemplateValidationResult): void {
        // Check for conflicting page settings
        if (templateContent.includes('height: auto') && templateContent.includes('columns:')) {
            result.warnings.push('Using both "height: auto" and columns may cause unexpected layout behavior');
        }

        // Check for invalid paper sizes
        const paperSizePattern = /paper:\s*"([^"]+)"/g;
        const validPaperSizes = getValidTypstPaperSizes();
        let match;

        while ((match = paperSizePattern.exec(templateContent)) !== null) {
            const paperSize = match[1];
            if (!validPaperSizes.includes(paperSize)) {
                result.warnings.push(`Unknown paper size '${paperSize}'. Valid sizes: ${validPaperSizes.join(', ')}`);
            }
        }
    }

    /**
     * Validate text formatting features
     */
    private static validateTextFeatures(templateContent: string, result: TemplateValidationResult): void {
        // Check for deprecated font syntax
        if (templateContent.match(/font:\s*\([^)]*\)/)) {
            result.warnings.push('Using tuple syntax for fonts. Consider using string syntax for better compatibility.');
        }

        // Check for missing language setting
        if (!templateContent.includes('lang:') && !templateContent.includes('language:')) {
            result.warnings.push('Template does not specify language. Consider adding "lang: \\"en\\"" or appropriate language code.');
        }
    }

    /**
     * Validate page setup comprehensively
     */
    private static validatePageSetup(templateContent: string, result: TemplateValidationResult): void {
        // Check for margin specification
        if (templateContent.includes('#set page') && !templateContent.match(/margin:\s*[^,\)]+/)) {
            result.warnings.push('Page setup found but no margins specified. Consider setting margins for better layout control.');
        }

        // Check for header/footer balance
        const hasHeader = templateContent.includes('header:');
        const hasFooter = templateContent.includes('footer:');
        const hasNumbering = templateContent.includes('numbering:');

        if ((hasHeader || hasFooter) && !hasNumbering) {
            result.warnings.push('Template has header/footer but no page numbering. Consider adding numbering for better navigation.');
        }
    }

    /**
     * Quick validation for basic template structure
     */
    static quickValidate(templateContent: string): boolean {
        // Basic checks for template usability
        if (!templateContent.trim()) return false;
        if (!templateContent.includes('$body$')) return false;
        
        // Check for basic syntax errors
        const openBraces = (templateContent.match(/\{/g) || []).length;
        const closeBraces = (templateContent.match(/\}/g) || []).length;
        const openBrackets = (templateContent.match(/\[/g) || []).length;
        const closeBrackets = (templateContent.match(/\]/g) || []).length;
        
        return openBraces === closeBraces && openBrackets === closeBrackets;
    }

    /**
     * Get validation summary
     */
    static getValidationSummary(result: TemplateValidationResult): string {
        const { isValid, errors, warnings, variables } = result;
        
        let summary = `Template validation ${isValid ? 'passed' : 'failed'}\n`;
        summary += `Found ${variables.length} variables: ${variables.join(', ')}\n`;
        
        if (errors.length > 0) {
            summary += `\nErrors (${errors.length}):\n${errors.map(e => `• ${e}`).join('\n')}`;
        }
        
        if (warnings.length > 0) {
            summary += `\nWarnings (${warnings.length}):\n${warnings.map(w => `• ${w}`).join('\n')}`;
        }
        
        return summary;
    }
}