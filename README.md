# Obsidian Typst PDF Export

[![GitHub release (latest by date)](https://img.shields.io/github/v/release/akucera/obsidian-typst-pdf-export-blue)](https://github.com/akucera/obsidian-typst-pdf-export/releases)
[![License: MIT](https://img.shields.io/github/license/AlexKucera/obsidian-typst-pdf-export?color=yellow)](https://opensource.org/licenses/MIT)
[![Obsidian Downloads](https://img.shields.io/github/downloads/AlexKucera/obsidian-typst-pdf-export/total?color=green)](https://obsidian.md/plugins?id=obsidian-typst-pdf-export)
![](https://img.shields.io/badge/desktop_only-red?label=obsidian&labelColor=purple)


Export Obsidian notes to PDF using the Typst typesetting system. Supports customizable templates, batch processing, and advanced formatting options.

## Table of Contents

- [Key Features](#key-features)
- [Why Typst?](#why-typst)
- [Installation](#installation)
- [Quick Start](#quick-start)
- [Configuration](#configuration)
- [Requirements](#requirements)
- [Templates](#templates)
- [Advanced Usage](#advanced-usage)
- [Troubleshooting](#troubleshooting)
- [Development](#development)
- [Contributing](#contributing)
- [License](#license)

## Key Features

- **🎨 Multiple Templates**: Choose from built-in templates (default, modern, article, report) or create custom ones
- **📁 Batch Export**: Export entire folders of notes with a single click
- **🖼️ Media Support**: Smart handling of embedded images and PDFs
- **📎 File Embedding**: Embed any file type as attachments in the output PDF
- **⚡ Real-time Progress**: Visual progress tracking with cancellation support
- **🔧 Advanced Configuration**: Comprehensive export options including typography, layout, and behavior settings
- **🔍 Font Discovery**: Automatic system font detection and caching
- **🛡️ Security First**: Path validation and sanitization for safe operations
- **📐 Professional Layout**: Paper sizes, margins, typography controls, and more
- **📧 Email Block SUpport**: Supports the YAML Email Block format introduced by the [Email Block plugin](https://github.com/joleaf/obsidian-email-block-plugin)

## Why Typst?

Typst offers several advantages over standard PDF export:

- Superior typography with advanced font handling and mathematical typesetting
- Flexible layouts with multi-column support and custom headers/footers
- Fast compilation compared to LaTeX
- Clean, readable markup syntax
- Publication-quality output

## Installation

### Method 1: Community Plugin Store (Recommended)

1. Open **Settings** → **Community Plugins**
2. **Disable Safe Mode** if needed
3. Click **Browse** and search for "Typst PDF Export"
4. **Install** and **Enable** the plugin

### Method 2: Manual Installation from GitHub Releases

**⚠️ Important**: This plugin requires template files to function. Always use the complete ZIP package.

1. Go to [GitHub Releases](https://github.com/akucera/obsidian-typst-pdf-export/releases)
2. Download the **complete ZIP package** (`typst-pdf-export.zip`) - **NOT just main.js**
3. Extract the entire contents to `{VaultFolder}/.obsidian/plugins/typst-pdf-export/`
4. Ensure the `templates/` directory is included with all `.typ` files:
   ```
   .obsidian/plugins/typst-pdf-export/
   ├── main.js
   ├── manifest.json
   ├── styles.css
   └── templates/
       ├── default.typ
       ├── modern.typ
       ├── article.typ
       ├── report.typ
       └── universal-wrapper.pandoc.typ
   ```
5. Reload Obsidian (`Ctrl/Cmd + R` or restart)
6. Enable the plugin in **Settings** → **Community Plugins**

### Method 3: BRAT (Beta Reviewer's Auto-update Tool)

1. Install the [BRAT plugin](https://github.com/TfTHacker/obsidian42-brat)
2. Add this repository: `akucera/obsidian-typst-pdf-export`
3. Enable the plugin after installation

### Method 4: Developer Installation

For development or the latest changes:

1. Clone the repository to your vault's plugins folder:
   ```bash
   cd {VaultFolder}/.obsidian/plugins/
   git clone https://github.com/akucera/obsidian-typst-pdf-export.git typst-pdf-export
   cd typst-pdf-export
   ```
2. Install dependencies and build:
   ```bash
   npm install
   npm run build
   ```
3. Reload Obsidian and enable the plugin

### Troubleshooting Installation

**Plugin doesn't work after manual installation?**
- Verify the `templates/` directory exists with all `.typ` files
- Check the browser console (F12) for error messages
- Try downloading the complete ZIP package again

**Missing templates error?**
- The plugin automatically extracts embedded templates if missing
- Check Settings → Community Plugins → Typst PDF Export for status

## Quick Start

### 1. Install Dependencies

**Required:**
- [Pandoc](https://pandoc.org/installing.html) - Markdown to Typst conversion
- [Typst](https://typst.app/docs/reference/foundations/) - PDF generation
- [ImageMagick](https://imagemagick.org/script/download.php) - Enhanced image processing

### 2. Export Your First Note

1. Open any note in Obsidian
2. Click the **Typst Export** ribbon icon or use `Ctrl/Cmd + P` → "Export to Typst PDF"
3. Configure your export settings in the modal
4. Click **Export** and select your output location

### 3. Verify Installation

Go to the plugin settings and click **Check Dependencies** to ensure all required tools are properly installed.

## Configuration

### Export Options

| Category | Options | Description |
|----------|---------|-------------|
| **General** | Template selection, paper size| Basic export configuration |
| **Typography** | Font family, size| Control document appearance |
| **Page Setup** | Margins, orientation | Layout customization |

### Templates

- **Default**: Clean, minimal design suitable for most documents
- **Modern**: Contemporary styling with accent colors and modern typography
- **Article**: Academic paper format with proper spacing and citations
- **Report**: Business/technical report format with structured sections

## Requirements

### System Requirements

- **Obsidian**: Version 1.9.12 or higher
- **Platform**: Desktop only (Windows, macOS, Linux) - I develop this on macOS, but it should in theory work on Windows and Linux. I just have no way to test it.
- **Node.js**: Version 16+ (for development)

### External Dependencies

| Tool | Purpose | Installation |
|------|---------|-------------|
| **Pandoc** | Markdown → Typst conversion | [Download here](https://pandoc.org/installing.html) or `brew install pandoc` |
| **Typst** | PDF generation | [Download here](https://typst.app/docs/reference/foundations/) or `brew install typst` |
| **ImageMagick** | Enhanced image processing (optional) | [Download here](https://imagemagick.org/script/download.php) or `brew install imagemagick` |

### Dependency Verification

The plugin includes an automated dependency checker accessible through:
- Plugin settings → **Check Dependencies**
- Export modal → **Dependency Status** indicator

## Templates

### Built-in Templates

1. **Default Template** (`default.typ`)
   - Clean, minimal design
   - Perfect for notes and documentation
   - Supports all basic formatting

2. **Modern Template** (`modern.typ`)
   - Contemporary styling with accent colors
   - Enhanced typography and spacing
   - Great for presentations and reports

3. **Article Template** (`article.typ`)
   - Academic paper formatting
   - Proper citation handling
   - Structured section layouts

4. **Report Template** (`report.typ`)
   - Business/technical document format
   - Professional styling
   - Multi-section organization

### Custom Templates

Create your own Typst templates by:
1. Adding `.typ` files to the plugin's `templates/` directory
2. Including template metadata at the top of your file
3. Following the Typst template structure

## Advanced Usage

### Folder Export

Export multiple notes at once:

1. Right-click on any folder in the file explorer
2. Select **Export Folder to Typst PDF**
3. Configure batch export settings
4. Monitor progress in the export modal

### Embedded Media Handling

The plugin automatically processes:
- **Images**: PNG, JPG, GIF, WebP formats
- **PDFs**: Converted to images for Typst inclusion
- **Links**: Properly formatted in the output PDF
- **Math**: LaTeX math expressions rendered correctly

### Email Blocks

Format them like this:

````
```email
to: info@randommail.com
subject: Hello World
---
Hi there,
this is my new body
Best!
JB
```
````

## Troubleshooting

### Common Issues

| Problem | Solution |
|---------|----------|
| **"Pandoc not found"** | Install Pandoc and ensure it's in your system PATH |
| **"Typst not found"** | Install Typst CLI and verify PATH configuration |
| **Export hangs** | Check if files are locked by other applications |
| **Images not showing** | Verify image paths and file permissions |
| **Template errors** | Check template syntax and file integrity |

### Debug Steps

1. **Check Dependencies**: Use the built-in dependency checker
2. **Console Logs**: Open Developer Tools (Ctrl/Cmd+Shift+I) for error details
3. **Test Manually**: Try running Pandoc/Typst commands directly in terminal
4. **Clear Cache**: Reset plugin settings if needed
5. **Clean Install**: Remove and reinstall the plugin

### Getting Help

- **Issues**: Report bugs on [GitHub Issues](https://github.com/akucera/obsidian-typst-pdf-export/issues)
- **Discussions**: Join conversations in [GitHub Discussions](https://github.com/akucera/obsidian-typst-pdf-export/discussions)
- **Documentation**: Check the plugin's settings for inline help

## Development

### Setup

```bash
# Clone the repository
git clone https://github.com/akucera/obsidian-typst-pdf-export.git typst-pdf-export
cd typst-pdf-export

# Install dependencies
npm install

# Start development server
npm run dev
```

### Project Structure

```
typst-pdf-export/
├── src/
│   ├── core/              # Core system components
│   ├── converters/        # Conversion pipeline
│   ├── ui/               # User interface components
│   ├── templates/        # Template management
│   └── utils/            # Utility functions
├── templates/            # Built-in Typst templates
├── main.ts              # Plugin entry point
└── manifest.json        # Plugin metadata
```

### Build Commands

```bash
npm run dev      # Development with file watching
npm run build    # Production build with type checking
npm run version  # Version bump and manifest update
```

### Architecture

The plugin follows a modular architecture with:
- **Conversion Pipeline**: Markdown → Typst → PDF via Pandoc
- **Template System**: Dynamic template loading and management
- **Security Layer**: Path validation and sanitization
- **Progress Tracking**: Real-time feedback with cancellation support

## Contributing

Contributions are welcome.

### Development Guidelines

1. **Fork** the repository
2. **Create** a feature branch: `git checkout -b feature/amazing-feature`
3. **Follow** TypeScript and ESLint conventions
4. **Test** your changes thoroughly in Obsidian
5. **Commit** with descriptive messages: `git commit -m 'feat: add amazing feature'`
6. **Push** to your branch: `git push origin feature/amazing-feature`
7. **Submit** a Pull Request

### Code Style

- Follow existing TypeScript patterns and conventions
- Use meaningful variable and function names
- Add comments for complex logic
- Ensure proper error handling
- Write modular, testable code

## License

This project is licensed under the GNU GPL v3.0 License - see the [LICENSE](LICENSE) file for details.

### Third-Party Licenses

This plugin uses the following dependencies:
- **gray-matter** (MIT License) - YAML front matter parsing
- **pdf-to-img** (MIT License) - PDF to image conversion

## Support

If you find this plugin helpful, consider supporting its development:

[![Buy Me a Coffee](https://img.shields.io/badge/Buy%20Me%20a%20Coffee-ffdd00?style=for-the-badge&logo=buy-me-a-coffee&logoColor=black)](https://buymeacoffee.com/babylondreams)
[![Ko-fi](https://img.shields.io/badge/Ko--fi-F16061?style=for-the-badge&logo=ko-fi&logoColor=white)](https://ko-fi.com/babylondreams)
[![Patreon](https://img.shields.io/badge/Patreon-F96854?style=for-the-badge&logo=patreon&logoColor=white)](https://patreon.com/babylondreams)

## Contact

**Author**: Alexander Kucera  
**Website**: [alexanderkucera.com](https://alexanderkucera.com)  
**GitHub**: [@AlexKucera](https://github.com/AlexKucera)

If this plugin helped you, please consider giving it a star on GitHub.
