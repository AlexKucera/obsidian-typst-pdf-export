import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
	test: {
		globals: true,
		environment: 'happy-dom',
		setupFiles: ['./tests/setup.ts'],
		coverage: {
			provider: 'v8',
			reporter: ['text', 'json', 'html', 'lcov'],
			include: ['src/**/*.ts'],
			exclude: [
				'node_modules/**',
				'tests/**',
				'*.config.*',
				'**/*.d.ts',
				'**/*.test.ts',
				'main.ts', // Entry point, tested through integration
				'version-bump.mjs',
				'scripts/**',
			],
			all: true, // Include all source files in coverage report
			thresholds: {
				lines: 80,
				functions: 80,
				branches: 80,
				statements: 80,
			},
		},
		include: ['tests/**/*.test.ts'],
	},
	resolve: {
		alias: {
			'@': path.resolve(__dirname, './src'),
			'obsidian': path.resolve(__dirname, './tests/__mocks__/obsidian.ts'),
		},
	},
});
