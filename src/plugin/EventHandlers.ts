/**
 * Event Handler Registration
 * Handles registration of all plugin event handlers and menu items
 */

import { Menu, Editor, MarkdownView, TFile, TAbstractFile } from 'obsidian';
import type { obsidianTypstPDFExport } from '../../main';
import { ExportErrorHandler } from '../core/ExportErrorHandler';

export class EventHandlers {
	constructor(private plugin: obsidianTypstPDFExport) {}
	
	/**
	 * Register all plugin event handlers
	 */
	registerEventHandlers(): void {
		// Add context menu item
		this.plugin.registerEvent(
			this.plugin.app.workspace.on('file-menu', (menu: Menu, file: TFile) => {
				if (file.extension === 'md') {
					menu.addItem((item) => {
						item
							.setTitle('Export to PDF')
							.setIcon('file-output')
							.onClick(() => {
								this.plugin.exportFile(file).catch(error => {
									console.error('Failed to export file:', error);
								});
							});
					});
				}
			})
		);
		
		// Add editor menu item
		this.plugin.registerEvent(
			this.plugin.app.workspace.on('editor-menu', (menu: Menu, editor: Editor, view: MarkdownView) => {
				menu.addItem((item) => {
					item
						.setTitle('Export to PDF')
						.setIcon('file-output')
						.onClick(() => {
							this.plugin.exportCurrentNote(view).catch(error => {
								console.error('Failed to export current note:', error);
							});
						});
				});
			})
		);
		
		// Add multi-file menu item (for multiple selected files in file explorer)
		this.plugin.registerEvent(
			this.plugin.app.workspace.on('files-menu', (menu: Menu, files: TAbstractFile[]) => {
				// Filter for markdown files only
				const markdownFiles = files.filter((file) => this.plugin.isMarkdownFile(file));
				
				if (markdownFiles.length > 0) {
					menu.addItem((item) => {
						item
							.setTitle(`Export to PDF`)
							.setIcon('file-output')
							.onClick(() => {
								this.plugin.exportFiles(markdownFiles).catch(error => {
									console.error('Failed to export files:', error);
								});
							});
					});
					
					menu.addItem((item) => {
						item
							.setTitle(`Export with configuration...`)
							.setIcon('settings')
							.onClick(() => {
								this.plugin.showExportModalForFiles(markdownFiles).catch(error => {
									console.error('Failed to show export modal for files:', error);
								});
							});
					});
				}
			})
		);
	}
	
	/**
	 * Handle ribbon icon click
	 */
	handleRibbonClick(event: MouseEvent): void {
		const activeView = this.plugin.app.workspace.getActiveViewOfType(MarkdownView);
		
		if (!activeView || !activeView.file) {
			ExportErrorHandler.showFileNotFoundWarning('markdown');
			return;
		}
		
		// Create context menu for ribbon click
		const menu = new Menu();
		
		menu.addItem((item) =>
			item
				.setTitle('Export current note(s)')
				.setIcon('file-output')
				.onClick(() => {
					this.plugin.exportFile(activeView.file!).catch(error => {
						console.error('Failed to export file:', error);
					});
				})
		);
		
		menu.addItem((item) =>
			item
				.setTitle('Export with configuration…')
				.setIcon('settings')
				.onClick(() => {
					this.plugin.showExportModal(activeView).catch(error => {
						console.error('Failed to show export modal:', error);
					});
				})
		);
		
		menu.showAtMouseEvent(event);
	}
}