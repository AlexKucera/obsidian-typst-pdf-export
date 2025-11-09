/**
 * Path Resolution Utilities
 * Handles executable path resolution and output path preparation
 */

import { spawnSync } from 'child_process';
import { TFile } from 'obsidian';
import type { obsidianTypstPDFExport } from '../../main';
import { SecurityUtils } from '../core/SecurityUtils';
import { PathUtils } from '../core/PathUtils';
import * as path from 'path';

export class PathResolver {
	private readonly pathUtils: PathUtils;

	constructor(private plugin: obsidianTypstPDFExport) {
		this.pathUtils = new PathUtils(plugin.app);
	}
	
	/**
	 * Resolve an executable path, handling empty settings by falling back to system search
	 */
	resolveExecutablePath(userPath: string | undefined, defaultName: string): string {
		// If user provided a path and it's not empty, use it
		if (userPath && userPath.trim() !== '') {
			return userPath;
		}
		
		// Try to find the executable using which command
		// Use platform-specific command: 'where' on Windows, 'which' on Unix
		const whichCommand = process.platform === 'win32' ? 'where' : 'which';

		try {
			const augmentedEnv = {
				...process.env,
				PATH: `/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:${process.env.PATH || ''}`
			};

			const result = spawnSync(whichCommand, [defaultName], {
				encoding: 'utf8',
				env: augmentedEnv
			});
			
			if (result.status === 0 && result.stdout) {
				const foundPath = result.stdout.trim();
				if (foundPath) {
					return foundPath;
				}
			}
		} catch {
			// Ignore errors from which command
		}
		
		// Fall back to the default name (will be found via PATH if available)
		return defaultName;
	}

	/**
	 * Prepare the output path for a file
	 */
	async prepareOutputPath(file: TFile, outputFolder: string): Promise<string> {
		// Check if output folder is set
		if (!outputFolder || outputFolder.trim() === '') {
			throw new Error('Output folder is not set. Please configure the output folder in plugin settings.');
		}

		// Validate output folder for security
		if (!SecurityUtils.validateOutputPath(outputFolder)) {
			throw new Error(`Invalid output folder path: "${outputFolder}". Path contains invalid characters or traversal attempts.`);
		}

		const vaultPath = this.pathUtils.getVaultPath();
		const outputDir = this.pathUtils.joinPath(vaultPath, outputFolder);

		// Create output directory if it doesn't exist (use vault-relative path for vault adapter)
		await this.pathUtils.ensureDir(outputFolder);

		// Preserve folder structure if configured
		let relativePath = '';
		if (this.plugin.settings.behavior.preserveFolderStructure) {
			const folderPath = path.dirname(file.path);
			if (folderPath !== '.') {
				relativePath = folderPath;
				// Use vault-relative path for vault adapter
				const vaultRelativeOutputDir = this.pathUtils.joinPath(outputFolder, relativePath);
				await this.pathUtils.ensureDir(vaultRelativeOutputDir);
			}
		}

		// Generate output filename (just use the note name without timestamp)
		const baseName = file.basename;
		const outputFileName = `${baseName}.pdf`;

		return this.pathUtils.joinPath(outputDir, relativePath, outputFileName);
	}
}