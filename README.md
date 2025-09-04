# Obsidian Typst PDF Export

[![GitHub release (latest by date)](https://img.shields.io/github/v/release/akucera/obsidian-typst-pdf-export)](https://github.com/akucera/obsidian-typst-pdf-export/releases)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Obsidian Downloads](https://img.shields.io/badge/dynamic/json?logo=obsidian&color=%23483699&label=downloads&query=%24%5B%22obsidian-typst-pdf-export%22%5D.downloads&url=https%3A%2F%2Fraw.githubusercontent.com%2Fobsidianmd%2Fobsidian-releases%2Fmaster%2Fcommunity-plugin-stats.json)](https://obsidian.md/plugins?id=obsidian-typst-pdf-export)

Transform your Obsidian notes into beautiful, professionally-typeset PDFs using the powerful Typst typesetting system. This plugin provides a complete PDF export solution with customizable templates, advanced formatting options, and batch processing capabilities.

## 📖 Table of Contents

- [✨ Key Features](#-key-features)
- [🎯 Why Typst Over Standard PDF Export?](#-why-typst-over-standard-pdf-export)
- [📥 Installation](#-installation)
- [🚀 Quick Start](#-quick-start)
- [⚙️ Configuration](#️-configuration)
- [📋 Requirements](#-requirements)
- [🎨 Available Templates](#-available-templates)
- [🔧 Advanced Usage](#-advanced-usage)
- [❗ Troubleshooting](#-troubleshooting)
- [🛠️ Development](#️-development)
- [🤝 Contributing](#-contributing)
- [📄 License](#-license)

## ✨ Key Features

- **🎨 Multiple Templates**: Choose from built-in templates (default, modern, article, report) or create custom ones
- **📁 Batch Export**: Export entire folders of notes with a single click
- **🖼️ Media Support**: Smart handling of embedded images and PDFs
- **⚡ Real-time Progress**: Visual progress tracking with cancellation support
- **🔧 Advanced Configuration**: Comprehensive export options including typography, layout, and behavior settings
- **🔍 Font Discovery**: Automatic system font detection and caching
- **🛡️ Security First**: Path validation and sanitization for safe operations
- **📐 Professional Layout**: Paper sizes, margins, typography controls, and more

## 🎯 Why Typst Over Standard PDF Export?

Typst is a modern typesetting system that produces publication-quality documents with:

- **Superior Typography**: Advanced font handling, ligatures, and mathematical typesetting
- **Flexible Layouts**: Multi-column layouts, custom headers/footers, and precise spacing control
- **Fast Compilation**: Near-instant PDF generation compared to LaTeX
- **Modern Syntax**: Clean, readable markup that's easy to customize
- **Professional Output**: Conference-paper and book-quality formatting out of the box

## 📥 Installation

### Method 1: Community Plugin Store (Recommended)

1. Open **Settings** → **Community Plugins**
2. **Disable Safe Mode** if needed
3. Click **Browse** and search for "Typst PDF Export"
4. **Install** and **Enable** the plugin

### Method 2: Manual Installation

1. Download the latest release from [GitHub Releases](https://github.com/akucera/obsidian-typst-pdf-export/releases)
2. Extract the files to `{VaultFolder}/.obsidian/plugins/obsidian-typst-pdf-export/`
3. Reload Obsidian and enable the plugin in Settings

### Method 3: BRAT (Beta Reviewer's Auto-update Tool)

1. Install the [BRAT plugin](https://github.com/TfTHacker/obsidian42-brat)
2. Add this repository: `akucera/obsidian-typst-pdf-export`
3. Enable the plugin after installation

## 🚀 Quick Start

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

## ⚙️ Configuration

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

## 📋 Requirements

### System Requirements

- **Obsidian**: Version 1.9.12 or higher
- **Platform**: Desktop only (Windows, macOS, Linux) - I develop this on macOS, but it should in theory work on Windows and Linux. I just have no way to test it.
- **Node.js**: Version 16+ (for development)

### External Dependencies

| Tool | Purpose | Installation |
|------|---------|-------------|
| **Pandoc** | Markdown → Typst conversion | [Download here](https://pandoc.org/installing.html) |
| **Typst** | PDF generation | [Download here](https://typst.app/docs/reference/foundations/) |
| **ImageMagick** | Enhanced image processing (optional) | [Download here](https://imagemagick.org/script/download.php) |

### Dependency Verification

The plugin includes an automated dependency checker accessible through:
- Plugin settings → **Check Dependencies**
- Export modal → **Dependency Status** indicator

## 🎨 Available Templates

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

## 🔧 Advanced Usage

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

### Export Configuration Persistence

Your export settings are automatically saved and restored for consistent output across sessions.

## ❗ Troubleshooting

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

## 🛠️ Development

### Setup

```bash
# Clone the repository
git clone https://github.com/akucera/obsidian-typst-pdf-export.git
cd obsidian-typst-pdf-export

# Install dependencies
npm install

# Start development server
npm run dev
```

### Project Structure

```
obsidian-typst-pdf-export/
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

## 🤝 Contributing

We welcome contributions! Please read our [Contributing Guidelines](CONTRIBUTING.md) before submitting pull requests.

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

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

### Third-Party Licenses

This plugin uses the following dependencies:
- **gray-matter** (MIT License) - YAML front matter parsing
- **pdf-to-img** (MIT License) - PDF to image conversion
- **sharp** (Apache 2.0 License) - High-performance image processing

## ☕ Support the Project

If you find this plugin helpful, consider supporting its development:

[![Buy Me a Coffee](https://img.shields.io/badge/Buy%20Me%20a%20Coffee-ffdd00?style=for-the-badge&logo=buy-me-a-coffee&logoColor=black)](https://buymeacoffee.com/babylondreams)
[![Ko-fi](https://img.shields.io/badge/Ko--fi-F16061?style=for-the-badge&logo=ko-fi&logoColor=white)](https://ko-fi.com/babylondreams)
[![Patreon](https://img.shields.io/badge/Patreon-F96854?style=for-the-badge&logo=patreon&logoColor=white)](https://patreon.com/babylondreams)

## 📞 Contact & Support

**Author**: Alexander Kucera  
**Website**: [alexanderkucera.com](https://alexanderkucera.com)  
**GitHub**: [@akucera](https://github.com/akucera)

---

**⭐ If this plugin helped you, please consider giving it a star on GitHub!**

---

*Last Updated: September 2025*
