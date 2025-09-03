/**
 * Template variable configuration
 */
export interface TemplateVariable {
    type: 'string' | 'number' | 'boolean';
    defaultValue: any;
    description?: string;
    required: boolean;
}

/**
 * Template metadata
 */
export interface TemplateMetadata {
    author?: string;
    version?: string;
    description?: string;
    compatibility: string[];
}

/**
 * Typst template definition
 */
export interface Template {
    /** Display name of the template */
    name: string;
    /** File path to the template */
    filePath: string;
    /** Template variables and their types */
    variables: Record<string, TemplateVariable>;
    /** Template metadata */
    metadata: TemplateMetadata;
}

/**
 * Template validation result
 */
export interface TemplateValidationResult {
    isValid: boolean;
    errors: string[];
    warnings: string[];
    variables: string[];
}

/**
 * Variable substitution context
 */
export interface SubstitutionContext {
    title?: string;
    author?: string;
    date?: string;
    body: string;
    font?: string;
    fontSize?: string;
    pageSize?: string;
    margins?: string;
    [key: string]: string | undefined;
}