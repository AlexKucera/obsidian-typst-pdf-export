# Project Overview - Obsidian Typst PDF Export Plugin

## Purpose
This is an Obsidian plugin that exports notes to high-quality PDFs using Typst, featuring:
- Superior typography through Markdown → Pandoc → Typst → PDF pipeline
- Two export modes: Typography-pure and Style-preserving
- Standard and single-page PDF formats
- CSS style preservation capabilities
- Dynamic page height adjustment for single-page exports

## Current Status
The project is in early development, currently based on the Obsidian sample plugin template. The main plugin class and interfaces exist but contain mostly template code that needs to be replaced with Typst PDF export functionality.

## Key Components
- **Plugin Class**: `obsidianTypstPDFExport` extends Obsidian's `Plugin` class
- **Settings Interface**: `obsidianTypstPDFExportSettings` for configuration
- **Template Components**: SampleModal and SampleSettingTab (need replacement)
- **External Dependencies**: Will integrate with Pandoc and Typst tools

## Development Architecture
- Built with TypeScript and esbuild
- Follows Obsidian plugin architecture patterns
- Uses standard Obsidian API for UI integration
- Reference implementations available in `reference/` directory