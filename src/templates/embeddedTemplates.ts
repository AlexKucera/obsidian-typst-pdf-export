import { extractTemplate, getAllTemplateNames } from 'template-embed:templates';
import { PathUtils } from '../core/PathUtils';
import type { App } from 'obsidian';

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
    private pathUtils: PathUtils;
    private app: App;

    constructor(pluginDir: string, app: App) {
        this.pluginDir = pluginDir;
        this.app = app;
        this.pathUtils = new PathUtils(app);
        this.templatesDir = this.pathUtils.joinPath(pluginDir, 'templates');
    }

    /**
     * Get information about all templates
     */
    async getTemplateInfo(): Promise<TemplateInfo[]> {
        const embeddedNames = getAllTemplateNames();
        const templateInfo: TemplateInfo[] = [];

        for (const name of embeddedNames) {
            const filePath = this.pathUtils.joinPath(this.templatesDir, name);
            const exists = await this.pathUtils.fileExists(filePath);

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
    async extractTemplateIfNeeded(templateName: string): Promise<boolean> {
        const filePath = this.pathUtils.joinPath(this.templatesDir, templateName);

        // Check if template already exists
        if (await this.pathUtils.fileExists(filePath)) {
            return false; // No extraction needed
        }

        try {
            // Ensure templates directory exists (convert absolute to vault-relative for vault.adapter)
            const vaultPath = this.pathUtils.getVaultPath();
            let relativeTemplatesDir = this.templatesDir;
            if (this.templatesDir.startsWith(vaultPath)) {
                relativeTemplatesDir = this.templatesDir.substring(vaultPath.length);
                if (relativeTemplatesDir.startsWith('/') || relativeTemplatesDir.startsWith('\\')) {
                    relativeTemplatesDir = relativeTemplatesDir.substring(1);
                }
            }
            await this.pathUtils.ensureDir(relativeTemplatesDir);

            // Extract template content
            const content = extractTemplate(templateName, filePath);

            // Write template to disk using vault.adapter
            await this.app.vault.adapter.write(filePath, content);

            return true; // Extraction successful
        } catch (error) {
            console.error(`Failed to extract template ${templateName}:`, error);
            return false;
        }
    }

    /**
     * Extract all missing templates
     */
    async extractAllMissingTemplates(): Promise<{ extracted: string[], failed: string[] }> {
        const extracted: string[] = [];
        const failed: string[] = [];

        const templateInfo = await this.getTemplateInfo();

        for (const info of templateInfo) {
            if (info.needsExtraction) {
                const success = await this.extractTemplateIfNeeded(info.name);
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
    async forceExtractAllTemplates(): Promise<{ extracted: string[], failed: string[] }> {
        const extracted: string[] = [];
        const failed: string[] = [];

        const embeddedNames = getAllTemplateNames();

        // Ensure templates directory exists (convert absolute to vault-relative for vault.adapter)
        const vaultPath = this.pathUtils.getVaultPath();
        let relativeTemplatesDir = this.templatesDir;
        if (this.templatesDir.startsWith(vaultPath)) {
            relativeTemplatesDir = this.templatesDir.substring(vaultPath.length);
            if (relativeTemplatesDir.startsWith('/') || relativeTemplatesDir.startsWith('\\')) {
                relativeTemplatesDir = relativeTemplatesDir.substring(1);
            }
        }
        await this.pathUtils.ensureDir(relativeTemplatesDir);

        for (const templateName of embeddedNames) {
            try {
                const filePath = this.pathUtils.joinPath(this.templatesDir, templateName);
                const content = extractTemplate(templateName, filePath);

                await this.app.vault.adapter.write(filePath, content);
                extracted.push(templateName);
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