# Changelog

All notable changes to the Obsidian Typst PDF Export plugin will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0]

### Added
- **Template Embedding System**: Templates are now embedded as base64 strings in main.js as fallback
- **Automated Release System**: GitHub Actions workflow for automated ZIP releases with templates
- **EmbeddedTemplateManager**: Automatic template extraction when templates directory is missing
- **Complete Distribution Packages**: ZIP releases include templates directory for all installation methods
- PDF embedding and frontmatter display controls for enhanced document customization
- Email Block plugin support with improved content processing
- Export modal display utilities for better user experience
- Cross-platform path normalization for output folder settings

### Changed
- **BREAKING**: Replaced plugin license from MIT to GPLv3
- **Release Process**: Now supports both manual and automated GitHub releases with proper template distribution
- **Installation Methods**: Plugin now works with both complete ZIP packages and minimal installations
- **Version Tagging**: Uses Obsidian-compliant version tags (1.0.0, not v1.0.0)
- Improved export progress display with better visual feedback
- Enhanced export modal's progress display functionality
- Normalized output folder path handling in settings for cross-platform compatibility
- Improved resource path caching with better error handling
- Updated README with comprehensive installation instructions and troubleshooting
- Enhanced type safety for process event handlers

### Removed
- Default hotkeys from export commands to comply with Obsidian plugin submission requirements
- Excessive debug logging throughout the codebase for cleaner console output
- Sharp dependency removal as part of optimization efforts

### Fixed
- **Export Consistency**: Plain export now uses same settings structure as modal export
- **Template Availability**: Templates are guaranteed available through embedding system
- Export modal progress display now works correctly
- Resource path caching error handling improved
- Cross-platform path compatibility issues resolved

### Security
- Enhanced path validation and normalization for secure file operations

---

## Historical Changes

*Previous versions were tracked through git commits. This CHANGELOG.md was introduced as part of plugin submission preparation to follow industry best practices.*

### Plugin Submission Compliance Updates

This version includes comprehensive updates to ensure full compliance with Obsidian's plugin submission requirements:

#### Removed
- All unnecessary debug console.log statements from:
  - MarkdownPreprocessor.ts
  - PandocTypstConverter.ts  
  - PdfToImageConverter.ts
  - TempDirectoryManager.ts
  - main.ts
- Default hotkey bindings from export commands

#### Added
- Proper path normalization using `normalizePath()` for user-defined paths
- CSS classes for modal display states (replacing some hardcoded inline styles)
- Enhanced error handling and validation

#### Fixed
- Cross-platform path handling for output directories
- Modal display state management
- Progress bar functionality in export modal

#### Security
- Path validation using SecurityUtils for all user-provided paths
- Sanitization of file paths to prevent directory traversal

### Developer Experience Improvements

#### Changed
- Reduced console noise by removing debug logging while preserving error/warning messages
- Improved code maintainability with better separation of CSS and JavaScript
- Enhanced type safety throughout the codebase

#### Technical Debt
- Evaluated Adapter API usage (confirmed appropriate for plugin-specific files)
- Standardized code style and formatting
- Improved error handling patterns

---

## About This Plugin

The Obsidian Typst PDF Export plugin provides comprehensive PDF export functionality for Obsidian notes using the Typst typesetting system. It converts Markdown notes to beautiful PDFs through a Pandoc → Typst conversion pipeline.

### Core Features
- Single note and batch folder export
- Multiple built-in Typst templates (default, modern, article, report)
- Advanced configuration options for typography, layout, and behavior
- Smart handling of embedded media (images, PDFs)
- Automatic font discovery and caching
- Real-time export progress with cancellation support
- Security-focused path validation and file operations