// Template System Exports
export { TemplateManager } from './template-manager';
export { TemplateSubstitution } from './template-substitution';
export { TemplateValidator } from './template-validator';

// CSS Extraction and Style Preservation System Exports
export { CSSExtractor } from './CSSExtractor';
export { CSSToTypstMapper } from './CSSToTypstMapper';
export { ThemeManager } from './ThemeManager';
export { PopularThemeSupport } from './PopularThemeSupport';
export { PluginSpecificStyleHandler } from './PluginSpecificStyleHandler';
export { HybridExportMode } from './HybridExportMode';

// Type Exports
export type {
    Template,
    TemplateVariable,
    TemplateMetadata,
    TemplateValidationResult,
    SubstitutionContext
} from './types';

// CSS System Type Exports
export type {
    ExtractedStyle,
    ThemeInfo,
    CSSExtractionOptions,
    TypstStyleRule,
    MappingOptions,
    ColorFormat,
    ThemeVariableMapping,
    ThemeProfile,
    ThemeDetectionResult,
    EnhancedThemeProfile,
    ThemeCustomization,
    ThemeTestResult,
    PluginStyleProfile,
    PluginDetectionResult,
    HybridExportOptions,
    HybridStyleResult,
    StyleConflict,
    ConflictResolution
} from './CSSExtractor';