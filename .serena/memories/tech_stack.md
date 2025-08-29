# Tech Stack - Obsidian Typst PDF Export Plugin

## Core Technologies
- **TypeScript 4.7.4**: Primary language with strict type checking
- **Node.js 16+**: Runtime environment requirement
- **esbuild 0.17.3**: Fast bundler and build system
- **Obsidian API**: Plugin framework and UI integration

## Build System
- **esbuild**: Bundling, compilation, and development server
- **TypeScript Compiler**: Type checking (tsc -noEmit)
- **Source Maps**: Inline source maps for development

## Code Quality Tools
- **ESLint**: Linting with TypeScript-specific rules
- **@typescript-eslint**: TypeScript ESLint integration
- **Prettier**: Code formatting (via .prettierrc in reference)

## External Tools (Planned)
- **Pandoc**: Markdown to intermediate format conversion
- **Typst**: Superior typesetting and PDF generation
- **System Dependencies**: Will require external tool management

## Development Dependencies
- obsidian: Latest Obsidian API
- @types/node: Node.js type definitions
- builtin-modules: Node.js built-in module handling
- tslib: TypeScript runtime library

## Module System
- **Format**: CommonJS (cjs) for Obsidian compatibility
- **Target**: ES2018 for broad compatibility
- **Externals**: Obsidian API and built-in modules excluded from bundle