import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TempDirectoryManager } from '../src/core/TempDirectoryManager';
import type { App } from 'obsidian';

// Create mock functions that will be used in vi.mock - using vi.hoisted to ensure they're available
const { mockFsAccess, mockFsMkdir, mockFsReaddir, mockFsStat, mockFsUnlink } = vi.hoisted(() => ({
	mockFsAccess: vi.fn(),
	mockFsMkdir: vi.fn(),
	mockFsReaddir: vi.fn(),
	mockFsStat: vi.fn(),
	mockFsUnlink: vi.fn(),
}));

// Mock the fs module
vi.mock('fs', () => ({
	default: {},
	promises: {
		access: mockFsAccess,
		mkdir: mockFsMkdir,
		readdir: mockFsReaddir,
		stat: mockFsStat,
		unlink: mockFsUnlink,
	},
}));

describe('TempDirectoryManager', () => {
	let mockApp: App;
	let mockVaultAdapter: any;

	beforeEach(() => {
		// Reset all mocks before each test
		vi.clearAllMocks();

		// Reset mocks before each test
		mockVaultAdapter = {
			exists: vi.fn(),
			mkdir: vi.fn(),
			remove: vi.fn(),
			list: vi.fn(),
		};

		mockApp = {
			vault: {
				adapter: mockVaultAdapter,
			},
		} as any;
	});

	describe('constructor and static create', () => {
		it('should create an instance with provided options', () => {
			const manager = new TempDirectoryManager({
				vaultPath: '/vault',
				configDir: '.obsidian',
				pluginName: 'test-plugin',
				app: mockApp,
			});

			expect(manager).toBeInstanceOf(TempDirectoryManager);
		});

		it('should use default plugin name if not provided', () => {
			const manager = new TempDirectoryManager({
				vaultPath: '/vault',
				configDir: '.obsidian',
				app: mockApp,
			});

			const tempDir = manager.getTempDir('images');
			expect(tempDir).toContain('typst-pdf-export');
		});

		it('should create instance via static create method', () => {
			const manager = TempDirectoryManager.create(
				'/vault',
				'.obsidian',
				'test-plugin',
				mockApp
			);

			expect(manager).toBeInstanceOf(TempDirectoryManager);
		});
	});

	describe('getTempDir', () => {
		it('should return correct path for images temp directory', () => {
			const manager = new TempDirectoryManager({
				vaultPath: '/vault',
				configDir: '.obsidian',
				pluginName: 'typst-pdf-export',
				app: mockApp,
			});

			const tempDir = manager.getTempDir('images');
			expect(tempDir).toContain('temp-images');
			expect(tempDir).toContain('.obsidian');
			expect(tempDir).toContain('plugins');
		});

		it('should return correct path for pandoc temp directory', () => {
			const manager = new TempDirectoryManager({
				vaultPath: '/vault',
				configDir: '.obsidian',
				pluginName: 'typst-pdf-export',
				app: mockApp,
			});

			const tempDir = manager.getTempDir('pandoc');
			expect(tempDir).toContain('temp-pandoc');
			expect(tempDir).toContain('.obsidian');
			expect(tempDir).toContain('plugins');
		});

		it('should normalize paths correctly', () => {
			const manager = new TempDirectoryManager({
				vaultPath: '/vault',
				configDir: '.obsidian',
				pluginName: 'typst-pdf-export',
				app: mockApp,
			});

			const tempDir = manager.getTempDir('images');
			// Should use forward slashes after normalization
			expect(tempDir).not.toContain('\\');
		});

		it('should handle absolute vault paths on Windows', () => {
			const manager = new TempDirectoryManager({
				vaultPath: 'C:/Users/Test/Vault',
				configDir: '.obsidian',
				pluginName: 'typst-pdf-export',
				app: mockApp,
			});

			const tempDir = manager.getTempDir('images');
			expect(tempDir).toContain('C:/Users/Test/Vault');
		});
	});

	describe('ensureTempDir', () => {
		it('should create directory if it does not exist', async () => {
			// fs.access rejects when directory doesn't exist
			mockFsAccess.mockRejectedValue(new Error('ENOENT'));
			mockFsMkdir.mockResolvedValue(undefined);

			const manager = new TempDirectoryManager({
				vaultPath: '/vault',
				configDir: '.obsidian',
				pluginName: 'typst-pdf-export',
				app: mockApp,
			});

			const result = await manager.ensureTempDir('images');

			expect(mockFsAccess).toHaveBeenCalledOnce();
			expect(mockFsMkdir).toHaveBeenCalledOnce();
			expect(result).toContain('temp-images');
		});

		it('should not create directory if it already exists', async () => {
			// fs.access resolves when directory exists
			mockFsAccess.mockResolvedValue(undefined);

			const manager = new TempDirectoryManager({
				vaultPath: '/vault',
				configDir: '.obsidian',
				pluginName: 'typst-pdf-export',
				app: mockApp,
			});

			const result = await manager.ensureTempDir('images');

			expect(mockFsAccess).toHaveBeenCalledOnce();
			expect(mockFsMkdir).not.toHaveBeenCalled();
			expect(result).toContain('temp-images');
		});

		it('should handle both images and pandoc directories', async () => {
			mockFsAccess.mockRejectedValue(new Error('ENOENT'));
			mockFsMkdir.mockResolvedValue(undefined);

			const manager = new TempDirectoryManager({
				vaultPath: '/vault',
				configDir: '.obsidian',
				pluginName: 'typst-pdf-export',
				app: mockApp,
			});

			const imagesDir = await manager.ensureTempDir('images');
			const pandocDir = await manager.ensureTempDir('pandoc');

			expect(imagesDir).toContain('temp-images');
			expect(pandocDir).toContain('temp-pandoc');
			expect(mockFsMkdir).toHaveBeenCalledTimes(2);
		});
	});

	describe('cleanupTempDir', () => {
		it('should remove all files from temp directory', async () => {
			mockFsAccess.mockResolvedValue(undefined);
			mockFsReaddir.mockResolvedValue(['file1.png', 'file2.png', 'file3.typ']);
			mockFsStat.mockResolvedValue({ isFile: () => true } as any);
			mockFsUnlink.mockResolvedValue(undefined);

			const manager = new TempDirectoryManager({
				vaultPath: '/vault',
				configDir: '.obsidian',
				pluginName: 'typst-pdf-export',
				app: mockApp,
			});

			const result = await manager.cleanupTempDir('images');

			expect(result).toBe(true);
			expect(mockFsUnlink).toHaveBeenCalledTimes(3);
		});

		it('should return true if directory does not exist', async () => {
			mockFsAccess.mockRejectedValue(new Error('ENOENT'));

			const manager = new TempDirectoryManager({
				vaultPath: '/vault',
				configDir: '.obsidian',
				pluginName: 'typst-pdf-export',
				app: mockApp,
			});

			const result = await manager.cleanupTempDir('images');

			expect(result).toBe(true);
			expect(mockFsUnlink).not.toHaveBeenCalled();
		});

		it('should return false and log warning on error', async () => {
			mockFsAccess.mockResolvedValue(undefined);
			mockFsReaddir.mockRejectedValue(new Error('Access denied'));
			const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

			const manager = new TempDirectoryManager({
				vaultPath: '/vault',
				configDir: '.obsidian',
				pluginName: 'typst-pdf-export',
				app: mockApp,
			});

			const result = await manager.cleanupTempDir('images');

			expect(result).toBe(false);
			expect(consoleWarnSpy).toHaveBeenCalled();

			consoleWarnSpy.mockRestore();
		});

		it('should handle errors during file removal', async () => {
			mockFsAccess.mockResolvedValue(undefined);
			mockFsReaddir.mockResolvedValue(['file1.png']);
			mockFsStat.mockResolvedValue({ isFile: () => true } as any);
			mockFsUnlink.mockRejectedValue(new Error('Cannot delete'));
			const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

			const manager = new TempDirectoryManager({
				vaultPath: '/vault',
				configDir: '.obsidian',
				pluginName: 'typst-pdf-export',
				app: mockApp,
			});

			const result = await manager.cleanupTempDir('images');

			expect(result).toBe(false);
			expect(consoleWarnSpy).toHaveBeenCalled();

			consoleWarnSpy.mockRestore();
		});
	});

	describe('cleanupAllTempDirs', () => {
		it('should clean up both temp directories', async () => {
			mockFsAccess.mockResolvedValue(undefined);
			mockFsReaddir.mockResolvedValue(['file1.png']);
			mockFsStat.mockResolvedValue({ isFile: () => true } as any);
			mockFsUnlink.mockResolvedValue(undefined);

			const manager = new TempDirectoryManager({
				vaultPath: '/vault',
				configDir: '.obsidian',
				pluginName: 'typst-pdf-export',
				app: mockApp,
			});

			const result = await manager.cleanupAllTempDirs();

			expect(result).toEqual({ images: true, pandoc: true });
			expect(mockFsReaddir).toHaveBeenCalledTimes(2);
		});

		it('should return status for each directory independently', async () => {
			let callCount = 0;
			mockFsAccess.mockImplementation(() => {
				callCount++;
				// First call (images) succeeds, second call (pandoc) fails
				if (callCount === 1) return Promise.resolve(undefined);
				return Promise.reject(new Error('Access denied'));
			});
			mockFsReaddir.mockResolvedValue(['file1.png']);
			mockFsStat.mockResolvedValue({ isFile: () => true } as any);
			mockFsUnlink.mockResolvedValue(undefined);
			vi.spyOn(console, 'warn').mockImplementation(() => {});

			const manager = new TempDirectoryManager({
				vaultPath: '/vault',
				configDir: '.obsidian',
				pluginName: 'typst-pdf-export',
				app: mockApp,
			});

			const result = await manager.cleanupAllTempDirs();

			expect(result.images).toBe(true);
			expect(result.pandoc).toBe(false);
		});
	});

	describe('isPluginTempDir', () => {
		it('should return true for images temp directory', () => {
			const manager = new TempDirectoryManager({
				vaultPath: '/vault',
				configDir: '.obsidian',
				pluginName: 'typst-pdf-export',
				app: mockApp,
			});

			const tempImagesDir = manager.getTempDir('images');
			expect(manager.isPluginTempDir(tempImagesDir)).toBe(true);
		});

		it('should return true for pandoc temp directory', () => {
			const manager = new TempDirectoryManager({
				vaultPath: '/vault',
				configDir: '.obsidian',
				pluginName: 'typst-pdf-export',
				app: mockApp,
			});

			const tempPandocDir = manager.getTempDir('pandoc');
			expect(manager.isPluginTempDir(tempPandocDir)).toBe(true);
		});

		it('should return true for subdirectories within temp directories', () => {
			const manager = new TempDirectoryManager({
				vaultPath: '/vault',
				configDir: '.obsidian',
				pluginName: 'typst-pdf-export',
				app: mockApp,
			});

			const tempImagesDir = manager.getTempDir('images');
			const subDir = `${tempImagesDir}/subfolder`;
			expect(manager.isPluginTempDir(subDir)).toBe(true);
		});

		it('should return false for non-temp directories', () => {
			const manager = new TempDirectoryManager({
				vaultPath: '/vault',
				configDir: '.obsidian',
				pluginName: 'typst-pdf-export',
				app: mockApp,
			});

			expect(manager.isPluginTempDir('/vault/some-other-folder')).toBe(false);
			expect(manager.isPluginTempDir('/vault/.obsidian/plugins/other-plugin')).toBe(false);
		});

		it('should handle paths with different separators', () => {
			const manager = new TempDirectoryManager({
				vaultPath: 'C:/vault',
				configDir: '.obsidian',
				pluginName: 'typst-pdf-export',
				app: mockApp,
			});

			const tempImagesDir = manager.getTempDir('images');
			// Test with backslashes (should be normalized)
			const windowsStylePath = tempImagesDir.replace(/\//g, '\\');
			expect(manager.isPluginTempDir(windowsStylePath)).toBe(true);
		});
	});
});
