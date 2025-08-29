# Code Style and Conventions

## TypeScript Configuration
- **Strict Type Checking**: noImplicitAny and strictNullChecks enabled
- **Module System**: ESNext modules with Node.js resolution
- **Target**: ES6 with DOM, ES5-ES7 lib support
- **Source Maps**: Inline source maps for development

## ESLint Rules
- **Base**: TypeScript recommended + ESLint recommended
- **Unused Variables**: Error level, args ignored
- **TypeScript Comments**: @ts-comment allowed
- **Empty Functions**: Allowed (common in plugin lifecycle)
- **Prototype Builtins**: Disabled check

## Naming Conventions
- **Classes**: PascalCase (e.g., `obsidianTypstPDFExport`)
- **Interfaces**: PascalCase with descriptive suffixes (e.g., `obsidianTypstPDFExportSettings`)
- **Constants**: SCREAMING_SNAKE_CASE (e.g., `DEFAULT_SETTINGS`)
- **Methods/Properties**: camelCase

## Code Organization
- **Single File Structure**: Main plugin functionality in `main.ts`
- **Interface Definitions**: Defined alongside implementation
- **Settings**: Object-based configuration with defaults
- **Plugin Lifecycle**: Standard Obsidian onload/onunload pattern

## Type Safety
- **Settings Interface**: Strongly typed configuration objects
- **Plugin Class**: Proper inheritance from Obsidian Plugin base
- **API Integration**: Type-safe Obsidian API usage

## Current Type Issues (To Fix)
- Line 14: `settings: MyPluginSettings` should be `settings: obsidianTypstPDFExportSettings`
- Template references need updating for proper typing