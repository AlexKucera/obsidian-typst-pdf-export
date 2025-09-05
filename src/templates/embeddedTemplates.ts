import { extractTemplate, getAllTemplateNames } from 'template-embed:templates';
import * as fs from 'fs';
import * as path from 'path';

export interface TemplateInfo {
    name: string;
    exists: boolean;
    needsExtraction: boolean;
}

/**
 * Template manager that handles embedded templates and extraction
 */
export class EmbeddedTemplateManager {
    private pluginDir: string;
    private templatesDir: string;

    constructor(pluginDir: string) {
        this.pluginDir = pluginDir;
        this.templatesDir = path.join(pluginDir, 'templates');
    }

    /**
     * Get information about all templates
     */
    getTemplateInfo(): TemplateInfo[] {
        const embeddedNames = getAllTemplateNames();
        const templateInfo: TemplateInfo[] = [];

        for (const name of embeddedNames) {
            const filePath = path.join(this.templatesDir, name);
            const exists = fs.existsSync(filePath);
            
            templateInfo.push({
                name,
                exists,
                needsExtraction: !exists
            });
        }

        return templateInfo;
    }

    /**
     * Extract a single template if it doesn't exist
     */
    extractTemplateIfNeeded(templateName: string): boolean {
        const filePath = path.join(this.templatesDir, templateName);
        
        // Check if template already exists
        if (fs.existsSync(filePath)) {
            return false; // No extraction needed
        }

        try {
            // Ensure templates directory exists
            if (!fs.existsSync(this.templatesDir)) {
                fs.mkdirSync(this.templatesDir, { recursive: true });
            }

            // Extract template content
            const content = extractTemplate(templateName, filePath);
            
            // Write template to disk
            fs.writeFileSync(filePath, content, 'utf8');
            
            console.log(`Extracted embedded template: ${templateName}`);
            return true; // Extraction successful
        } catch (error) {
            console.error(`Failed to extract template ${templateName}:`, error);
            return false;
        }
    }

    /**
     * Extract all missing templates
     */
    extractAllMissingTemplates(): { extracted: string[], failed: string[] } {
        const extracted: string[] = [];
        const failed: string[] = [];
        
        const templateInfo = this.getTemplateInfo();
        
        for (const info of templateInfo) {
            if (info.needsExtraction) {
                const success = this.extractTemplateIfNeeded(info.name);
                if (success) {
                    extracted.push(info.name);
                } else {
                    failed.push(info.name);
                }
            }
        }

        return { extracted, failed };
    }

    /**
     * Force extract all templates (overwrites existing ones)
     */
    forceExtractAllTemplates(): { extracted: string[], failed: string[] } {
        const extracted: string[] = [];
        const failed: string[] = [];
        
        const embeddedNames = getAllTemplateNames();
        
        // Ensure templates directory exists
        if (!fs.existsSync(this.templatesDir)) {
            fs.mkdirSync(this.templatesDir, { recursive: true });
        }

        for (const templateName of embeddedNames) {
            try {
                const filePath = path.join(this.templatesDir, templateName);
                const content = extractTemplate(templateName, filePath);
                
                fs.writeFileSync(filePath, content, 'utf8');
                extracted.push(templateName);
                console.log(`Force extracted template: ${templateName}`);
            } catch (error) {
                console.error(`Failed to force extract template ${templateName}:`, error);
                failed.push(templateName);
            }
        }

        return { extracted, failed };
    }

    /**
     * Check if all templates are available (either on disk or embedded)
     */
    areAllTemplatesAvailable(): boolean {
        const embeddedNames = getAllTemplateNames();
        return embeddedNames.length > 0;
    }

    /**
     * Get the list of all available template names
     */
    getAvailableTemplateNames(): string[] {
        return getAllTemplateNames();
    }
}