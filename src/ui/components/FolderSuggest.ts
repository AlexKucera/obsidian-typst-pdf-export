/**
 * Folder suggestion component for folder path inputs
 * Provides autocomplete for existing vault folders
 */

import { App, AbstractInputSuggest } from 'obsidian';

export class FolderSuggest extends AbstractInputSuggest<string> {
	private folders: string[];
	private inputElement: HTMLInputElement;

	constructor(app: App, inputEl: HTMLInputElement) {
		super(app, inputEl);
		this.inputElement = inputEl;
		this.folders = ["/"].concat(this.app.vault.getAllFolders().map(folder => folder.path));
	}

	getSuggestions(inputStr: string): string[] {
		const inputLower = inputStr.toLowerCase();
		return this.folders.filter(folder => 
			folder.toLowerCase().includes(inputLower)
		);
	}

	renderSuggestion(folder: string, el: HTMLElement): void {
		el.createEl("div", { text: folder });
	}

	selectSuggestion(folder: string): void {
		this.inputElement.value = folder;
		this.inputElement.dispatchEvent(new Event('input'));
		this.close();
	}
}