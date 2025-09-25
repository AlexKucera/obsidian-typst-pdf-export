import { PathUtils } from '../../core/PathUtils';
import type { obsidianTypstPDFExport } from '../../../main';

/**
 * Handles resource path resolution and caching for Pandoc conversions.
 * Discovers and caches attachment directories to help Pandoc find embedded resources.
 */
export class ResourcePathResolver {
	private plugin: obsidianTypstPDFExport | undefined;
	private resourcePathCache: string[] = [];
	private resourcePathCacheTimestamp: number = 0;
	private resourcePathCacheVaultPath: string = '';
	private readonly CACHE_EXPIRY_MS = 5 * 60 * 1000; // 5 minutes

	constructor(plugin?: obsidianTypstPDFExport) {
		this.plugin = plugin;
	}

	/**
	 * Get all resource paths for the given vault, using cache when possible
	 * @param vaultBasePath The base path of the vault
	 * @returns Array of resource paths for Pandoc to search
	 */
	async getResourcePaths(vaultBasePath: string): Promise<string[]> {
		if (!vaultBasePath || !this.plugin?.app) {
			return [];
		}

		const pathUtils = new PathUtils(this.plugin.app);
		const resourcePaths: string[] = [];

		// Add vault root as primary resource path
		resourcePaths.push(vaultBasePath);

		// Add common attachment directories
		const commonPaths = this.getCommonAttachmentPaths(vaultBasePath, pathUtils);
		for (const attachPath of commonPaths) {
			if (await pathUtils.fileExists(attachPath)) {
				resourcePaths.push(attachPath);
			}
		}

		// Add cached or freshly scanned resource paths
		const now = Date.now();
		if (this.isCacheValid(vaultBasePath, now)) {
			// Use cached resource paths
			resourcePaths.push(...this.resourcePathCache);
		} else {
			// Cache is invalid or expired, perform fresh scan
			const scannedPaths = await this.scanForResourcePaths(vaultBasePath, pathUtils, now);
			resourcePaths.push(...scannedPaths);
		}

		return resourcePaths;
	}

	/**
	 * Get common attachment directory paths that Obsidian users typically use
	 * @param vaultBasePath The base path of the vault
	 * @param pathUtils PathUtils instance for path operations
	 * @returns Array of common attachment directory paths
	 */
	private getCommonAttachmentPaths(vaultBasePath: string, pathUtils: PathUtils): string[] {
		return [
			pathUtils.joinPath(vaultBasePath, 'attachments'),
			pathUtils.joinPath(vaultBasePath, 'assets'),
			pathUtils.joinPath(vaultBasePath, 'files'),
			pathUtils.joinPath(vaultBasePath, 'images'),
			pathUtils.joinPath(vaultBasePath, '.attachments')
		];
	}

	/**
	 * Check if the resource path cache is still valid
	 * @param vaultBasePath The vault path to check against
	 * @param now Current timestamp
	 * @returns True if cache is valid and can be used
	 */
	private isCacheValid(vaultBasePath: string, now: number): boolean {
		return this.resourcePathCacheVaultPath === vaultBasePath &&
			(now - this.resourcePathCacheTimestamp) < this.CACHE_EXPIRY_MS &&
			this.resourcePathCache.length > 0;
	}

	/**
	 * Scan the vault for directories containing images and cache the results
	 * @param vaultBasePath The base path of the vault
	 * @param pathUtils PathUtils instance for path operations
	 * @param now Current timestamp
	 * @returns Array of resource paths found during scan
	 */
	private async scanForResourcePaths(vaultBasePath: string, pathUtils: PathUtils, now: number): Promise<string[]> {
		const foundResourcePaths: string[] = [];

		try {
			if (!this.plugin?.app) {
				return foundResourcePaths;
			}

			// Use vault root (empty string) for adapter.list() to get vault-relative paths
			const vaultContents = await this.plugin.app.vault.adapter.list('');
			for (const item of vaultContents.folders) {
				const itemName = item.split('/').pop() || item;

				if (!itemName.startsWith('.') && !itemName.startsWith('_')) {
					// Check if this directory contains images
					try {
						const dirContents = await this.plugin.app.vault.adapter.list(item);
						const hasImages = dirContents.files.some((file: string) =>
							/\.(png|jpg|jpeg|gif|svg|webp|bmp|ico|tiff)$/i.test(file)
						);
						if (hasImages) {
							// Convert vault-relative path to absolute path for external tools
							const absolutePath = pathUtils.joinPath(vaultBasePath, item);
							foundResourcePaths.push(absolutePath);
						}
					} catch {
						// Ignore directories we can't read
					}
				}
			}
			
			// Update cache with fresh results
			this.resourcePathCache = foundResourcePaths;
			this.resourcePathCacheTimestamp = now;
			this.resourcePathCacheVaultPath = vaultBasePath;
		} catch (e) {
			console.warn('Could not scan vault for attachment directories:', e);
		}

		return foundResourcePaths;
	}

	/**
	 * Clear the resource path cache
	 */
	clearCache(): void {
		this.resourcePathCache = [];
		this.resourcePathCacheTimestamp = 0;
		this.resourcePathCacheVaultPath = '';
	}
}