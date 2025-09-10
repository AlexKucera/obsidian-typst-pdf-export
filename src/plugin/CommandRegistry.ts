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
				this.plugin.exportCurrentNote(view);
			}
		});
		
		// Export with configuration command
		this.plugin.addCommand({
			id: 'export-with-config',
			name: 'Export with configuration…',
			editorCallback: (editor: Editor, view: MarkdownView) => {
				this.plugin.showExportModal(view);
			}
		});
		
		// Check dependencies command
		this.plugin.addCommand({
			id: 'check-dependencies',
			name: 'Check Pandoc and Typst dependencies',
			callback: () => {
				this.plugin.showDependencyStatus();
			}
		});
	}
}