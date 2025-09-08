/**
 * Event Handler Registration
 * Handles registration of all plugin event handlers and menu items
 */

import { Menu, Editor, MarkdownView, TFile, TAbstractFile, Notice } from 'obsidian';
import type { obsidianTypstPDFExport } from '../../main';

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
							.setTitle('Export to PDF (Typst)')
							.setIcon('file-output')
							.onClick(() => {
								this.plugin.exportFile(file);
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
						.setTitle('Export to PDF (Typst)')
						.setIcon('file-output')
						.onClick(() => {
							this.plugin.exportCurrentNote(view);
						});
				});
			})
		);
		
		// Add multi-file menu item (for multiple selected files in file explorer)
		this.plugin.registerEvent(
			this.plugin.app.workspace.on('files-menu', (menu: Menu, files: TAbstractFile[]) => {
				// Filter for markdown files only
				const markdownFiles = files.filter(this.plugin.isMarkdownFile);
				
				if (markdownFiles.length > 0) {
					menu.addItem((item) => {
						item
							.setTitle(`Export to PDF (Typst)`)
							.setIcon('file-output')
							.onClick(() => {
								this.plugin.exportFiles(markdownFiles);
							});
					});
					
					menu.addItem((item) => {
						item
							.setTitle(`Export with configuration...`)
							.setIcon('settings')
							.onClick(() => {
								this.plugin.showExportModalForFiles(markdownFiles);
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
			new Notice('Please open a markdown file to export');
			return;
		}
		
		// Create context menu for ribbon click
		const menu = new Menu();
		
		menu.addItem((item) =>
			item
				.setTitle('Export current note(s)')
				.setIcon('file-output')
				.onClick(() => {
					this.plugin.exportFile(activeView.file!);
				})
		);
		
		menu.addItem((item) =>
			item
				.setTitle('Export with configuration…')
				.setIcon('settings')
				.onClick(() => {
					this.plugin.showExportModal(activeView);
				})
		);
		
		menu.showAtMouseEvent(event);
	}
}