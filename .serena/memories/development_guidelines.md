# Development Guidelines and Design Patterns

## Obsidian Plugin Architecture Patterns

### Core Plugin Structure
- **Main Class**: Extends `Plugin` from Obsidian API
- **Settings Management**: Interface-based configuration with load/save methods
- **Lifecycle Methods**: `onload()` for initialization, `onunload()` for cleanup
- **Command Registration**: Use `addCommand()` for palette integration
- **UI Integration**: Ribbon icons, status bar, settings tab

### Settings Pattern
```typescript
interface PluginSettings {
    // Configuration properties with types
}

const DEFAULT_SETTINGS: PluginSettings = {
    // Default values
}

// Load/save pattern in plugin class
async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
}

async saveSettings() {
    await this.saveData(this.settings);
}
```

### Modal and UI Patterns
- **Modals**: Extend `Modal` class for dialog interfaces
- **Settings Tabs**: Extend `PluginSettingTab` for configuration UI
- **DOM Events**: Use `registerDomEvent()` for automatic cleanup
- **Intervals**: Use `registerInterval()` for automatic cleanup

## Design Principles

### Type Safety First
- Use strong TypeScript typing throughout
- Define interfaces for all configuration objects
- Avoid `any` types - use proper type definitions
- Leverage Obsidian API types

### Plugin Integration Best Practices
- Follow Obsidian's plugin lifecycle patterns
- Use proper event registration for automatic cleanup
- Integrate with command palette and ribbon appropriately
- Provide clear user feedback via `Notice` class

### Error Handling
- Graceful degradation when external tools unavailable
- Clear user messaging for dependency issues
- Proper error boundaries in async operations
- Logging for debugging without cluttering user experience

### Code Organization
- Keep main plugin class focused on orchestration
- Separate concerns into logical modules
- Use composition over inheritance where appropriate
- Follow single responsibility principle

## External Tool Integration Patterns
- **Dependency Checking**: Verify external tools before usage
- **Process Management**: Spawn external processes safely
- **Path Handling**: Cross-platform path resolution
- **Error Recovery**: Fallback strategies for tool failures