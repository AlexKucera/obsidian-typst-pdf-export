// Mock Obsidian API for testing
import { vi } from 'vitest';

export class Notice {
	constructor(message: string) {}
}

export class Plugin {
	app: any;
	manifest: any;
}

export class PluginSettingTab {
	constructor(app: any, plugin: any) {}
}

export class Setting {
	constructor(containerEl: HTMLElement) {}
	setName(name: string): this { return this; }
	setDesc(desc: string): this { return this; }
	addText(cb: any): this { return this; }
	addToggle(cb: any): this { return this; }
	addDropdown(cb: any): this { return this; }
}

export class Modal {
	constructor(app: any) {}
	open(): void {}
	close(): void {}
}

export class FuzzySuggestModal {
	constructor(app: any) {}
}

export class TFile {
	path = '';
	basename = '';
	extension = '';
}

export class TFolder {
	path = '';
	name = '';
}

export function normalizePath(path: string): string {
	return path.replace(/\\/g, '/');
}

export const requestUrl = vi.fn();

// Type exports for compatibility
export interface App {
	vault: {
		adapter: {
			exists: (path: string) => Promise<boolean>;
			mkdir: (path: string) => Promise<void>;
			remove: (path: string) => Promise<void>;
			list: (path: string) => Promise<{ files: string[]; folders: string[] }>;
			read: (path: string) => Promise<string>;
			write: (path: string, data: string) => Promise<void>;
		};
	};
}
