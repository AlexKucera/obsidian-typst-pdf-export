/**
 * Path Resolution Utilities
 * Handles executable path resolution and output path preparation
 */

import { TFile } from 'obsidian';
import type { obsidianTypstPDFExport } from '../../main';
import { SecurityUtils } from '../core/SecurityUtils';
import * as path from 'path';
import * as fs from 'fs';

export class PathResolver {
	constructor(private plugin: obsidianTypstPDFExport) {}
	
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
		try {
			const augmentedEnv = {
				...process.env,
				PATH: `/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:${process.env.PATH || ''}`
			};
			
			const result = spawnSync('which', [defaultName], {
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
		
		const vaultPath = (this.plugin.app.vault.adapter as any).basePath;
		const outputDir = path.join(vaultPath, outputFolder);
		
		// Create output directory if it doesn't exist
		try {
			await fs.promises.access(outputDir);
		} catch {
			// Directory doesn't exist, create it
			try {
				await fs.promises.mkdir(outputDir, { recursive: true });
			} catch (error) {
				throw new Error(`Failed to create output directory ${outputDir}: ${error.message}`);
			}
		}
		
		// Preserve folder structure if configured
		let relativePath = '';
		if (this.plugin.settings.behavior.preserveFolderStructure) {
			const folderPath = path.dirname(file.path);
			if (folderPath !== '.') {
				relativePath = folderPath;
				const fullOutputDir = path.join(outputDir, relativePath);
				try {
					await fs.promises.access(fullOutputDir);
				} catch {
					// Directory doesn't exist, create it
					try {
						await fs.promises.mkdir(fullOutputDir, { recursive: true });
					} catch (error) {
						throw new Error(`Failed to create nested output directory ${fullOutputDir}: ${error.message}`);
					}
				}
			}
		}
		
		// Generate output filename (just use the note name without timestamp)
		const baseName = file.basename;
		const outputFileName = `${baseName}.pdf`;
		
		return path.join(outputDir, relativePath, outputFileName);
	}
}