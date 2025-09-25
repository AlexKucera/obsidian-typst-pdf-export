# Changelog

All notable changes to the Obsidian Typst PDF Export plugin will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.3.1] - 2025-01-25

### Added
- **Windows Compatibility**: Comprehensive Windows executable detection with platform-specific extensions (.cmd, .bat, .ps1, .exe)
- **Dynamic Image Format Support**: FileDiscovery now supports multiple image formats (.png, .jpg, .jpeg, .webp, .gif, .bmp, .tiff)
- **Enhanced Pattern Matching**: Five-strategy file discovery system for robust PDF-to-image conversion output detection
- **Cross-Platform Font Discovery**: Platform-specific PATH building for improved Typst executable and font detection
- **Improved Plugin Isolation**: TempDirectoryManager now uses proper plugin namespacing to prevent conflicts

### Fixed
- **Cross-Platform Binary Discovery**: BinaryLocator now includes comprehensive fallback paths for different installation methods
- **Vault-Relative Path Consistency**: Fixed all vault.adapter operations to use proper vault-relative paths instead of absolute paths
- **Resource Path Resolution**: Removed extra quotes from Pandoc arguments that could break spawn commands on Windows
- **Font Cache Corruption Recovery**: Enhanced error handling with automatic cache regeneration and validation
- **Template Path Resolution**: Fixed resource path handling in PandocCommandBuilder for better cross-platform compatibility

### Changed
- **Enhanced Error Recovery**: Improved fallback mechanisms and graceful degradation throughout font and file discovery systems
- **Platform Detection**: Added platform awareness to caching systems for better cross-platform consistency
- **Code Quality**: Improved type safety, error handling, and validation across all affected modules
- **Performance**: Optimized file discovery with progressive pattern matching strategies

### Security
- **Path Validation**: Enhanced path sanitization and validation for all file system operations
- **Process Spawning**: Improved security in font discovery and binary execution with proper argument handling

## [1.3.0] - 2024-12-25

### Added
- PathUtils helper class for centralized path operations and safe Obsidian API usage
- Improved Typst error reporting in Pandoc conversion with enhanced diagnostic output
- New Typst templates for varied document styles (modern, article, report)
- Enhanced README with plugin motivation, development philosophy, and updated badges

### Fixed
- **Critical**: Embedded file path resolution issue that caused "File not found" errors for PDFs, images, and documents
- Proper vault.adapter integration replacing unsafe type casts throughout codebase
- Path handling reliability with comprehensive migration from Node.js fs/path to Obsidian APIs
- File existence checks now handle both vault-relative and absolute filesystem paths

### Changed
- **Major Refactoring**: Complete migration from Node.js fs/path to Obsidian vault.adapter APIs
- Centralized path utilities replacing unsafe `(app.vault.adapter as unknown as { basePath: string }).basePath` patterns
- Improved file system operations security and cross-platform compatibility
- Enhanced error handling and path validation across all modules
- Updated all 16 core files with consistent, safe path handling practices

## [1.2.1] - 2025-01-10

### Fixed
- **Horizontal Rule Processing**: Resolved YAML parsing conflicts when documents contain horizontal rules (`---`)
  - Added HorizontalRuleProcessor to transform horizontal rules to asterisks (`***`) before Pandoc processing
  - Preserved YAML frontmatter by detecting and skipping frontmatter sections during transformation
  - Added horizontalrule definition to all Typst templates for Pandoc compatibility
- **TypeScript Build Errors**: Fixed 23 TypeScript errors in 8 files
  - Resolved DataAdapter casting issues with proper type assertions
  - Fixed template variable type issues by adding undefined to union types
  - Ensured type safety while maintaining full functionality

### Changed
- **Code Quality**: Replaced explicit any types for Obsidian plugin review compliance
  - Improved type safety throughout the codebase
  - Enhanced code maintainability with proper type assertions

## [1.2.0] - 2025-01-10

### Changed
- **Major Refactoring**: Complete modularization of codebase for improved maintainability
  - Restructured main.ts into focused modules (PluginLifecycle, CommandRegistry, EventHandlers, ExportOrchestrator, FontManager, PathResolver, etc.)
  - Modularized MarkdownPreprocessor into specialized processors (FrontmatterProcessor, WikilinkProcessor, EmbedProcessor, CalloutProcessor, MetadataExtractor)
  - Split PandocTypstConverter into PandocCommandBuilder, TypstVariableMapper, and ResourcePathResolver
  - Separated ExportConfigModal into ModalRenderer and ModalValidator components
  - Extracted PDF processing utilities (ImageOptimizer, PdfProcessor) from PdfToImageConverter
  - Improved TypeScript type safety throughout the codebase
  - Enhanced separation of concerns with ExecutableChecker extraction from DependencyChecker

### Fixed
- Used Obsidian API for more robust file path resolution
- Simplified file type classification to properly handle DOCX embedding

### Removed
- Unused metadata extraction code (tags/wordCount) for cleaner processing pipeline

## [1.1.0]

### Added
- **Generic File Embedding**: Added support for embedding any file type as attachments in the output PDF
- **Comprehensive Dependency Discovery**: Enhanced dependency checker to automatically find executables in common installation locations including Homebrew, Cargo, npm-global, and system directories
- **Smart Path Resolution**: Added intelligent path resolution that handles both full paths and bare executable names with fallback to `which` command

### Fixed
- **ImageMagick Compatibility**: Updated to use `magick` command instead of deprecated `convert` command for ImageMagick v7 compatibility
- **PDF Conversion PATH Issues**: Fixed pdf2img execution failures by ensuring Node.js paths are included in the execution environment
- **Dependency Checker Robustness**: Improved executable discovery to work with user-configured additional paths and system installations
- **Obsidian Plugin Store Compatibility**: Addressed feedback from Obsidian Review Bot for plugin submission requirements

### Changed
- **Default ImageMagick Command**: Changed from `convert` to `magick` in default settings and UI labels
- **Path Environment Handling**: Enhanced PATH augmentation to include comprehensive system and package manager locations

## [1.0.1]

### Fixed
- **Dynamic Path Resolution**: Fixed font caching, template loading, and temp directory paths to use dynamic plugin directory resolution instead of hardcoded "obsidian-typst-pdf-export" paths
- **Plugin Directory Detection**: Updated PdfToImageConverter to dynamically detect plugin directory name from manifest
- **Template Manager Paths**: Fixed template directory path resolution to work with renamed plugin folder
- **Documentation**: Updated README.md to reflect correct folder name "typst-pdf-export" in all installation instructions

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