// @ts-check

import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import obsidianmd from 'eslint-plugin-obsidianmd';
import importPlugin from 'eslint-plugin-import';
import globals from 'globals';

export default tseslint.config(
	// Base JavaScript recommended rules
	js.configs.recommended,

	// TypeScript recommended type-checked rules
	...tseslint.configs.recommendedTypeChecked,

	// Obsidian-specific configuration
	{
		plugins: {
			obsidianmd: obsidianmd,
			import: importPlugin,
		},

		languageOptions: {
			globals: {
				...globals.node,
				...globals.browser,
				NodeJS: 'readonly',  // TypeScript global namespace
			},
			parserOptions: {
				projectService: true,
				tsconfigRootDir: import.meta.dirname,
			},
		},

		// Apply Obsidian plugin recommended rules (manually specified)
		rules: {
			// Obsidian command rules
			'obsidianmd/commands/no-command-in-command-id': 'error',
			'obsidianmd/commands/no-command-in-command-name': 'error',
			'obsidianmd/commands/no-default-hotkeys': 'error',
			'obsidianmd/commands/no-plugin-id-in-command-id': 'error',
			'obsidianmd/commands/no-plugin-name-in-command-name': 'error',

			// Settings tab rules
			'obsidianmd/settings-tab/no-manual-html-headings': 'error',
			'obsidianmd/settings-tab/no-problematic-settings-headings': 'error',

			// Other Obsidian rules
			'obsidianmd/vault/iterate': 'error',
			'obsidianmd/detach-leaves': 'error',
			'obsidianmd/hardcoded-config-path': 'error',
			'obsidianmd/no-forbidden-elements': 'error',
			'obsidianmd/no-plugin-as-component': 'error',
			'obsidianmd/no-sample-code': 'error',
			'obsidianmd/no-tfile-tfolder-cast': 'error',
			'obsidianmd/no-view-references-in-plugin': 'error',
			'obsidianmd/no-static-styles-assignment': 'error',
			'obsidianmd/object-assign': 'error',
			'obsidianmd/platform': 'error',
			'obsidianmd/prefer-file-manager-trash-file': 'warn',
			'obsidianmd/prefer-abstract-input-suggest': 'error',
			'obsidianmd/regex-lookbehind': 'error',
			'obsidianmd/sample-names': 'error',
			'obsidianmd/validate-manifest': 'error',
			'obsidianmd/validate-license': 'error',
			'obsidianmd/ui/sentence-case': ['warn', { enforceCamelCaseLower: true }],

			// General ESLint rules from Obsidian recommended
			'no-unused-vars': 'off',
			'no-prototype-builtins': 'off',
			'no-self-compare': 'warn',
			'no-eval': 'error',
			'no-implied-eval': 'error',
			'prefer-const': 'off',
			'no-implicit-globals': 'error',
			'no-console': ['error', { allow: ['warn', 'error', 'debug'] }],
			'no-alert': 'error',
			'no-undef': 'error',

			// TypeScript rules from Obsidian recommended
			'@typescript-eslint/ban-ts-comment': 'off',
			'@typescript-eslint/no-deprecated': 'error',
			'@typescript-eslint/require-await': 'off',
			'@typescript-eslint/no-explicit-any': ['error', { fixToUnknown: true }],

			// Downgrade strict type checking rules to warnings
			'@typescript-eslint/no-unsafe-assignment': 'warn',
			'@typescript-eslint/no-unsafe-member-access': 'warn',
			'@typescript-eslint/no-unsafe-argument': 'warn',
			'@typescript-eslint/no-unsafe-call': 'warn',
			'@typescript-eslint/no-unsafe-return': 'warn',

			// Unused vars with underscore prefix
			'@typescript-eslint/no-unused-vars': ['warn', { args: 'none', varsIgnorePattern: '^_', argsIgnorePattern: '^_' }],

			// Import rules
			'import/no-extraneous-dependencies': 'error',
		},
	},
	{
		// Global ignores configuration
		ignores: [
			'node_modules/**',
			'main.js',
			'dist/**',
			'build/**',
			'*.min.js',
			'coverage/**',
		],
	}
);
