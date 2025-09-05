declare module 'template-embed:templates' {
    export const embeddedTemplates: Record<string, string>;
    export function extractTemplate(templateName: string, targetPath?: string): string;
    export function getAllTemplateNames(): string[];
}