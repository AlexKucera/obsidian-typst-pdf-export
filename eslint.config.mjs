// @ts-check

import eslint from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
	// Apply ESLint recommended rules
	eslint.configs.recommended,
	// Apply TypeScript-ESLint recommended rules
	...tseslint.configs.recommended,
	{
		// Configure language options
		languageOptions: {
			globals: {
				...globals.node,
				...globals.es2022,
			},
			parserOptions: {
				sourceType: 'module',
				ecmaVersion: 2022,
			},
		},
		
		// Configure files to lint
		files: ['**/*.ts', '**/*.js', 'main.ts'],
		
		// Configure rules - incorporating Obsidian sample plugin settings
		rules: {
			// Disable base ESLint no-unused-vars in favor of TypeScript version
			'no-unused-vars': 'off',
			'@typescript-eslint/no-unused-vars': ['warn', { args: 'none', varsIgnorePattern: '^_', argsIgnorePattern: '^_' }],
			
			// Allow @ts-ignore comments (useful for Obsidian API quirks)
			'@typescript-eslint/ban-ts-comment': 'off',
			
			// Allow prototype builtins usage
			'no-prototype-builtins': 'off',
			
			// Allow empty functions (common in plugin architecture)
			'@typescript-eslint/no-empty-function': 'off',
			
			// Allow require() imports (Node.js environment with mixed modules)
			'@typescript-eslint/no-require-imports': 'off',
			'@typescript-eslint/no-var-requires': 'off',
			
			// Obsidian plugins often use 'any' type for API flexibility
			'@typescript-eslint/no-explicit-any': 'warn',
			
			// Allow lexical declarations in case blocks
			'no-case-declarations': 'off',
			
			// Prefer const is good but not critical for existing code
			'prefer-const': 'warn',
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