/**
 * Path Resolution Utilities
 * Handles executable path resolution and output path preparation
 */

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
		const { spawnSync } = require('child_process');

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
		// Validate output folder for security
		if (!SecurityUtils.validateOutputPath(outputFolder)) {
			throw new Error(`Invalid output folder path: ${outputFolder}. Path contains invalid characters or traversal attempts.`);
		}

		const vaultPath = this.pathUtils.getVaultPath();
		const outputDir = this.pathUtils.joinPath(vaultPath, outputFolder);

		// Create output directory if it doesn't exist
		await this.pathUtils.ensureDir(outputDir);

		// Preserve folder structure if configured
		let relativePath = '';
		if (this.plugin.settings.behavior.preserveFolderStructure) {
			const folderPath = path.dirname(file.path);
			if (folderPath !== '.') {
				relativePath = folderPath;
				const fullOutputDir = this.pathUtils.joinPath(outputDir, relativePath);
				await this.pathUtils.ensureDir(fullOutputDir);
			}
		}

		// Generate output filename (just use the note name without timestamp)
		const baseName = file.basename;
		const outputFileName = `${baseName}.pdf`;

		return this.pathUtils.joinPath(outputDir, relativePath, outputFileName);
	}
}