# Product Requirements Document: Obsidian Typst PDF Export

## Executive Summary

**Product Name:** Obsidian Typst PDF Export  
**Version:** 1.0.0  
**Goal:** Create an Obsidian plugin that exports notes to aesthetically superior PDFs using Typst, with a unique single-page PDF option that dynamically adjusts page height to content.

## Problem Statement

Current PDF export solutions in Obsidian have limitations:
- Standard PDF exports lack aesthetic appeal and typography control
- Embedded images and PDFs format poorly
- No option for continuous single-page PDFs that adapt to content length
- Limited typography and layout customization
- Plugin-specific CSS styles are often lost in exports

## Solution Overview

A plugin that leverages Typst's superior typesetting capabilities through a Markdown → Pandoc → Typst → PDF pipeline, offering both standard pagination and innovative single-page exports, with optional CSS style preservation.

## Core Features

### 1. Export Modes

#### 1.1 Typography-Pure Export (Default)
- **Pipeline:** Markdown → Pandoc → Typst → PDF
- **Benefits:** Superior typography, consistent formatting, academic quality
- **Use Cases:** Papers, documentation, books, reports

#### 1.2 Style-Preserving Export
- **Pipeline:** Markdown → HTML+CSS → Typst-enhanced → PDF
- **Benefits:** Maintains Obsidian theme and plugin styles
- **Use Cases:** Notes with custom styling, plugin-rendered content

### 2. Export Formats

#### 2.1 Standard PDF Export
- Traditional paginated PDFs
- Page sizes: A4, A5, Letter, Legal, Custom
- Portrait/Landscape orientation
- Configurable margins and headers/footers

#### 2.2 Single-Page PDF Export
- Continuous PDF with dynamic height
- No page breaks - content flows continuously
- Ideal for web viewing and documentation
- Implementation using Typst's `height: auto` feature

### 3. Conversion Pipeline

```
Obsidian Note
    ↓
[Preprocess Obsidian Syntax]
    ↓
[Extract Frontmatter & Metadata]
    ↓
[Typography Mode] ←→ [Style Mode]
    ↓                      ↓
[Pandoc → Typst]    [Extract CSS]
    ↓                      ↓
[Apply Template]    [Map to Typst]
    ↓                      ↓
    └──────────┬──────────┘
               ↓
         [Generate PDF]
               ↓
         [Post-process]
```

## Technical Architecture

### Directory Structure

```
src/
├── converters/
│   ├── markdown-preprocessor.ts   # Obsidian syntax handling
│   ├── css-extractor.ts          # Capture Obsidian styles
│   ├── html-renderer.ts          # HTML+CSS rendering
│   ├── pandoc-typst.ts           # Pandoc-Typst conversion
│   └── css-to-typst-mapper.ts    # Style mapping
├── exporters/
│   ├── standard-exporter.ts      # Regular pagination
│   ├── single-page-exporter.ts   # Dynamic height
│   └── batch-exporter.ts         # Folder/vault export
├── templates/
│   ├── default.typ               # Standard template
│   ├── article.typ               # Academic article
│   ├── report.typ                # Business report
│   └── single-page.typ           # Continuous page
├── ui/
│   ├── export-modal.ts           # Export configuration
│   ├── settings-tab.ts           # Plugin settings
│   └── progress-indicator.ts     # Export progress
├── utils/
│   ├── dependency-checker.ts     # Verify Pandoc/Typst
│   ├── file-manager.ts          # Output handling
│   └── error-handler.ts         # User feedback
└── main.ts                       # Plugin entry point
```

### Key Components

#### Markdown Preprocessor
- Convert wikilinks `[[note]]` to standard markdown links
- Handle Obsidian embeds `![[image.png]]` and `![[note.md]]`
- Process callouts and custom code blocks
- Preserve frontmatter for template variables

#### CSS Extractor
```typescript
function getAllStyles(): string[] {
  const cssTexts: string[] = [];
  Array.from(document.styleSheets).forEach((sheet) => {
    Array.from(sheet.cssRules).forEach((rule) => {
      cssTexts.push(rule.cssText);
    });
  });
  return cssTexts;
}
```

#### Pandoc-Typst Converter
```typescript
async function convertToTypst(markdown: string, config: ExportConfig) {
  const args = [
    'input.md',
    '-o', 'output.pdf',
    '--pdf-engine=typst',
    '-V', `template=${config.template}`,
    ...config.variables.map(([k, v]) => ['-V', `${k}=${v}`]).flat()
  ];
  return await execPandoc(args);
}
```

#### Single-Page Template
```typst
#set page(
  paper: "a4",
  height: auto,  // Dynamic height
  margin: (x: 2cm, y: 2cm),
)

#set text(
  font: $font$,
  size: $fontSize$,
)

#set pagebreak(weak: true)  // No page breaks

$body$
```

## User Experience

### Export Workflow

1. **Initiate Export**
   - Right-click on note/folder → "Export to Typst PDF"
   - Command palette → "Typst PDF: Export current note"
   - Ribbon icon for quick export

2. **Configure Export**
   - Select export mode (Typography/Style-preserving)
   - Choose format (Standard/Single-page)
   - Pick template (Default/Article/Report/Custom)
   - Set output location

3. **Process**
   - Progress indicator shows conversion steps
   - Cancel option available
   - Error messages if dependencies missing

4. **Complete**
   - PDF opens automatically (configurable)
   - Success notification with file location
   - Recent exports in status bar

### Settings Interface

```typescript
interface PluginSettings {
  // Paths
  pandocPath: string;              // Path to Pandoc executable
  typstPath: string;               // Path to Typst executable
  outputFolder: string;            // Default export location
  
  // Defaults
  defaultTemplate: string;         // Template name
  defaultFormat: 'standard' | 'single-page';
  defaultExportMode: 'typography' | 'style-preserving';
  
  // Typography
  defaultFont: string;             // Main text font
  defaultFontSize: number;         // In points
  mathFont: string;               // Math equations font
  codeFont: string;               // Code blocks font
  
  // Page Setup
  defaultPageSize: string;         // A4, Letter, etc.
  defaultOrientation: 'portrait' | 'landscape';
  defaultMargins: {
    top: string;
    bottom: string;
    left: string;
    right: string;
  };
  
  // Behavior
  openAfterExport: boolean;        // Auto-open PDF
  preserveFolderStructure: boolean; // For batch export
  includeMetadata: boolean;        // Export frontmatter
  includeCssStyles: boolean;       // Capture CSS
  
  // Advanced
  pandocArgs: string;              // Additional Pandoc arguments
  typstArgs: string;              // Additional Typst arguments
  customTemplatesFolder: string;   // User templates location
  concurrency: number;             // Batch export parallelism
  debugMode: boolean;              // Show conversion details
}
```

## Implementation Phases

### Phase 1: Core Foundation (Week 1)
- [ ] Clean up template code and fix TypeScript issues
- [ ] Set up project structure and interfaces
- [ ] Implement basic Pandoc integration
- [ ] Create minimal Typst template
- [ ] Test basic markdown → PDF conversion

### Phase 2: Obsidian Integration (Week 2)
- [ ] Preprocess wikilinks and embeds
- [ ] Handle frontmatter extraction
- [ ] Process callouts and custom blocks
- [ ] Support tags and metadata
- [ ] Test with various Obsidian features

### Phase 3: Single-Page Feature (Week 3)
- [ ] Create single-page Typst template
- [ ] Implement height calculation algorithm
- [ ] Handle content overflow edge cases
- [ ] Test with documents of various lengths
- [ ] Optimize performance for large documents

### Phase 4: Style Preservation (Week 4)
- [ ] Extract CSS from Obsidian
- [ ] Build CSS to Typst mapping system
- [ ] Handle plugin-specific styles
- [ ] Create hybrid export mode
- [ ] Test with popular themes and plugins

### Phase 5: UI and Polish (Week 5)
- [ ] Build export configuration modal
- [ ] Create settings tab
- [ ] Add template management
- [ ] Implement progress indicators
- [ ] Add comprehensive error handling

### Phase 6: Advanced Features (Week 6)
- [ ] Batch export for folders/vault
- [ ] Custom template support
- [ ] Export presets/profiles
- [ ] Command-line interface
- [ ] Documentation and examples

## Technical Considerations

### Dependencies
- **Pandoc:** Required, version 3.0+
- **Typst:** Required, version 0.11+
- **Node.js:** Built-in with Obsidian
- **pdf-lib:** Bundled for PDF manipulation

### Performance Targets
- Single note export: < 3 seconds
- 10-page document: < 5 seconds
- 100-page document: < 30 seconds
- Batch export: Parallel processing with configurable concurrency

### Error Handling
- Clear messages for missing dependencies
- Fallback options when features unavailable
- Detailed logs in debug mode
- Recovery from partial failures

### Compatibility
- Obsidian version: 0.15.0+
- Operating Systems: Windows, macOS, Linux
- Themes: Test with top 10 popular themes
- Plugins: Ensure compatibility with:
  - Dataview
  - Templater
  - Email Block Plugin
  - Excalidraw
  - Advanced Tables

## Success Metrics

### Functional Requirements
- ✅ Export completes successfully for 95% of notes
- ✅ Single-page PDFs render without content cutoff
- ✅ Obsidian syntax correctly converted (90%+ accuracy)
- ✅ CSS styles preserved when requested (best effort)
- ✅ Templates customizable without code changes

### Performance Requirements
- ✅ Export time within targets for 90% of documents
- ✅ Memory usage < 500MB for typical exports
- ✅ No UI freezing during export

### User Experience
- ✅ Clear error messages with actionable solutions
- ✅ Intuitive configuration interface
- ✅ Consistent export quality
- ✅ Reliable batch processing

## Future Enhancements

### Version 1.1
- Live preview in export modal
- More built-in templates

### Version 1.2
- Bibliography and citation support
- Table of contents generation
- Index generation
- Cross-reference handling

## Risks and Mitigation

| Risk | Impact | Mitigation |
|------|---------|------------|
| Dependency installation complexity | High |  none |
| CSS mapping limitations | Medium | Set expectations, focus on common styles |
| Performance with large documents | Medium | Implement streaming, pagination options |
| Template compatibility issues | Low | Extensive testing, template validation |
| Cross-platform differences | Medium | Platform-specific testing, CI/CD |

## Appendix

### A. Obsidian Syntax Support

- [x] Wikilinks: `[[note]]`, `[[note|alias]]`
- [x] Embeds: `![[note]]`, `![[image.png]]`
- [x] Tags: `#tag`, `#nested/tag`
- [x] Callouts: `> [!note]`, `> [!warning]`
- [x] Code blocks with syntax highlighting
- [x] Tables (including advanced tables)
- [x] Footnotes: `[^1]`
- [x] Math: `$inline$`, `$$display$$`
- [x] Mermaid diagrams
- [ ] Excalidraw drawings (future)
- [ ] Canvas exports (future)

### B. Template Variables

Available variables for Typst templates:

```typst
$title$         // From frontmatter
$author$        // From frontmatter
$date$          // From frontmatter or current
$tags$          // Array of tags
$font$          // User-selected font
$fontSize$      // User-selected size
$pageSize$      // A4, Letter, etc.
$margins$       // Margin configuration
$headerText$    // Custom header
$footerText$    // Custom footer
$body$          // Document content
```

### C. CSS to Typst Mapping Examples

| CSS Property | Typst Equivalent |
|--------------|------------------|
| `font-size: 14px` | `#set text(size: 14pt)` |
| `color: #333` | `#set text(fill: rgb("#333"))` |
| `font-weight: bold` | `#strong[text]` |
| `font-style: italic` | `#emph[text]` |
| `text-align: center` | `#align(center)[text]` |
| `border: 1px solid` | `#box(stroke: 1pt)` |
| `background: #f0f0f0` | `#box(fill: rgb("#f0f0f0"))` |

---

*This PRD is a living document and will be updated as the project evolves.*