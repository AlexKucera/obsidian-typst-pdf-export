/**
 * Command Registration
 * Handles registration of all plugin commands and their callbacks
 */

import { Editor, MarkdownView } from 'obsidian';
import type { obsidianTypstPDFExport } from '../../main';

export class CommandRegistry {
	constructor(private plugin: obsidianTypstPDFExport) {}

	/**
	 * Register all plugin commands
	 */
	registerCommands(): void {
		// Export current note command
		this.plugin.addCommand({
			id: 'export-current-note',
			name: 'Export current note(s)',
			editorCallback: (editor: Editor, view: MarkdownView) => {
				this.plugin.exportCurrentNote(view).catch(error => {
					console.error('Failed to export current note:', error);
				});
			}
		});
		
		// Export with configuration command
		this.plugin.addCommand({
			id: 'export-with-config',
			name: 'Export with configuration…',
			editorCallback: (editor: Editor, view: MarkdownView) => {
				this.plugin.showExportModal(view).catch(error => {
					console.error('Failed to show export modal:', error);
				});
			}
		});
		
		// Check dependencies command
		this.plugin.addCommand({
			id: 'check-dependencies',
			name: 'Check pandoc and typst dependencies',
			callback: () => {
				this.plugin.showDependencyStatus().catch(error => {
					console.error('Failed to show dependency status:', error);
				});
			}
		});
	}
}