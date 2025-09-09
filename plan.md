# Typst PDF Export Plugin Refactoring Plan

## CRITICAL SAFETY REQUIREMENTS ⚠️
**Previous refactor broke workflows** - We must be EXTREMELY careful
- **STOP after EVERY file creation** for verification
- **STOP after EVERY file modification** for verification  
- **NO jumping ahead** - wait for explicit confirmation
- **Use Context7** for Obsidian and TypeScript API documentation
- **Test build after EVERY change**

## Overview
Refactoring 6 large files (200-1800 lines) into smaller, focused modules to improve maintainability and reduce complexity.

### Files Requiring Refactoring
1. **main.ts** - 1792 lines → ~200 lines + 6 modules
2. **MarkdownPreprocessor.ts** - 1235 lines → ~200 lines + 5 modules
3. **PandocTypstConverter.ts** - 741 lines → ~200 lines + 4 modules
4. **ExportConfigModal.ts** - 492 lines → ~200 lines + 3 modules
5. **PdfToImageConverter.ts** - 444 lines → ~150 lines + 3 modules
6. **DependencyChecker.ts** - 319 lines → ~170 lines + 2 modules

## PHASE 1: Refactor main.ts (MOST CRITICAL)- DONE

The main.ts file is the plugin entry point and most critical to get right.

### Step 1.1: Create PluginLifecycle.ts - DONE
**Location:** `src/plugin/PluginLifecycle.ts` (~150 lines)
**Extract:**
- `onload()` method
- `onunload()` method  
- Template initialization logic
- Settings loading/saving
- Cleanup on startup

**STOP** → Verify: `npm run build` passes
**STOP** → Test: Plugin loads in Obsidian without errors

### Step 1.2: Create CommandRegistry.ts - DONE
**Location:** `src/plugin/CommandRegistry.ts` (~150 lines)
**Extract:**
- `registerCommands()` method
- All command handler methods
- Command definitions and callbacks

**STOP** → Verify: `npm run build` passes
**STOP** → Test: Commands appear and work in command palette

### Step 1.3: Create EventHandlers.ts - DONE
**Location:** `src/plugin/EventHandlers.ts` (~150 lines)
**Extract:**
- `registerEventHandlers()` method
- `handleRibbonClick()` method
- File menu integration
- Context menu handlers

**STOP** → Verify: `npm run build` passes
**STOP** → Test: Context menus and ribbon icon work

### Step 1.4: Create ExportOrchestrator.ts
**Location:** `src/plugin/ExportOrchestrator.ts` (~400 lines)
**Extract:**
- `exportFile()` method
- `exportFiles()` method
- `exportFileWithConfig()` method
- `handleFolderExport()` method
- Export workflow coordination

**STOP** → Verify: `npm run build` passes
**STOP** → Test: Basic single note export works

### Step 1.5: Create FontManager.ts - DONE
**Location:** `src/plugin/FontManager.ts` (~150 lines)
**Extract:**
- `cacheAvailableFonts()` method
- `getCachedFonts()` method
- Font discovery and caching logic

**STOP** → Verify: `npm run build` passes
**STOP** → Test: Font detection works in settings

### Step 1.6: Create PathResolver.ts - DONE
**Location:** `src/plugin/PathResolver.ts` (~200 lines)
**Extract:**
- `resolveExecutablePath()` method
- `prepareOutputPath()` method
- Path validation utilities
- Executable finding logic

**STOP** → Verify: `npm run build` passes
**STOP** → Test: Pandoc/Typst detection works

### Step 1.7: Update main.ts - DONE
**Final size:** ~200 lines
**Keep:**
- Plugin class declaration
- Settings property
- Core Obsidian plugin methods
- Delegation to modules

**STOP** → Full integration test of all functionality

**CHECKPOINT: Complete test of all Phase 1 functionality** - DONE

## PHASE 2: Refactor MarkdownPreprocessor.ts - IN PROGRESS

### Step 2.1: Create FrontmatterProcessor.ts - DONE
**Location:** `src/converters/preprocessors/FrontmatterProcessor.ts` (~200 lines)
**Extract:**
- `processFrontmatter()` method
- `formatFrontmatterForDisplay()` method
- Frontmatter parsing logic

**STOP** → Verify build → Test frontmatter parsing works

### Step 2.2: Create WikilinkProcessor.ts - DONE
**Location:** `src/converters/preprocessors/WikilinkProcessor.ts` (~150 lines)
**Extract:**
- `parseWikilinks()` method
- `sanitizeFilePath()` method
- `sanitizeHeadingForLink()` method
- `resolveRelativePath()` method

**STOP** → Verify build → Test wikilink conversion works

### Step 2.3: Create EmbedProcessor.ts - IN PROGRESS
**Location:** `src/converters/preprocessors/EmbedProcessor.ts` (~250 lines)
**Extract:**
- `parseEmbeds()` method
- `processImageEmbed()` method
- `processVideoEmbed()` method
- `processAudioEmbed()` method
- `processPdfEmbed()` method
- `processFileEmbed()` method

**STOP** → Verify build → Test all embed types work

### Step 2.4: Create CalloutProcessor.ts
**Location:** `src/converters/preprocessors/CalloutProcessor.ts` (~200 lines)
**Extract:**
- `parseCallouts()` method
- `parseEmailBlocks()` method
- `processMultiLineCallouts()` method
- `processEmailBlock()` method

**STOP** → Verify build → Test callouts and email blocks work

### Step 2.5: Create MetadataExtractor.ts
**Location:** `src/converters/preprocessors/MetadataExtractor.ts` (~150 lines)
**Extract:**
- `extractTags()` method
- `extractTitle()` method
- `calculateWordCount()` method
- Metadata processing utilities

**STOP** → Verify build → Test metadata extraction works

### Step 2.6: Update MarkdownPreprocessor.ts
**Final size:** ~200 lines
**Keep:**
- Main `preprocess()` method
- Orchestration logic
- Result compilation

**STOP** → Full preprocessing test with various note types

**CHECKPOINT: Test various note types with different content**

## PHASE 3: Refactor PandocTypstConverter.ts

### Step 3.1: Create PandocCommandBuilder.ts
**Location:** `src/converters/pandoc/PandocCommandBuilder.ts` (~200 lines)
**Extract:**
- Command building logic
- Argument construction
- Template handling

**STOP** → Verify build → Test Pandoc command generation

### Step 3.2: Create TypstVariableMapper.ts
**Location:** `src/converters/pandoc/TypstVariableMapper.ts` (~200 lines)
**Extract:**
- Variable mapping logic
- Settings to Typst conversion
- Font and layout variable handling

**STOP** → Verify build → Test variable application in templates

### Step 3.3: Create ResourcePathResolver.ts
**Location:** `src/converters/pandoc/ResourcePathResolver.ts` (~150 lines)
**Extract:**
- `resolveResourcePaths()` method
- Path caching logic
- Resource discovery

**STOP** → Verify build → Test resource resolution works

### Step 3.4: Update PandocTypstConverter.ts
**Final size:** ~200 lines
**Keep:**
- Main conversion method
- Result processing
- Error handling

**STOP** → Full conversion test with various settings

**CHECKPOINT: Test PDF generation with various settings**

## PHASE 4: Refactor ExportConfigModal.ts

### Step 4.1: Create ModalRenderer.ts
**Location:** `src/ui/modal/ModalRenderer.ts` (~150 lines)
**Extract:**
- `createHeader()` method
- `renderSections()` method
- `createProgressContainer()` method
- `createActionButtons()` method

**STOP** → Verify build → Test modal displays correctly

### Step 4.2: Create ModalValidator.ts
**Location:** `src/ui/modal/ModalValidator.ts` (~100 lines)
**Extract:**
- `validateAllSections()` method
- `showValidationErrors()` method
- `showValidationWarnings()` method
- Validation logic

**STOP** → Verify build → Test validation works

### Step 4.3: Update ExportConfigModal.ts
**Final size:** ~200 lines
**Keep:**
- Modal lifecycle methods
- Event handlers
- State management

**STOP** → Full modal functionality test

**CHECKPOINT: Test all modal interactions**

## PHASE 5: Refactor PdfToImageConverter.ts

### Step 5.1: Create PdfProcessor.ts
**Location:** `src/converters/pdf/PdfProcessor.ts` (~150 lines)
**Extract:**
- Core PDF processing logic
- PDF parsing and page extraction

**STOP** → Verify build → Test PDF processing

### Step 5.2: Create ImageOptimizer.ts
**Location:** `src/converters/pdf/ImageOptimizer.ts` (~150 lines)
**Extract:**
- Image optimization logic
- Resizing and compression
- Quality management

**STOP** → Verify build → Test image optimization

### Step 5.3: Update PdfToImageConverter.ts
**Final size:** ~150 lines
**Keep:**
- Main conversion method
- Error handling
- Result processing

**STOP** → Test PDF to image conversion works

**CHECKPOINT: Test embedded PDF conversion**

## PHASE 6: Refactor DependencyChecker.ts

### Step 6.1: Create ExecutableChecker.ts
**Location:** `src/core/dependencies/ExecutableChecker.ts` (~150 lines)
**Extract:**
- Executable checking utilities
- Version detection
- Path validation

**STOP** → Verify build → Test executable detection

### Step 6.2: Update DependencyChecker.ts
**Final size:** ~170 lines
**Keep:**
- Main dependency checking logic
- Status reporting
- Error handling

**STOP** → Test all dependency checking functionality

**CHECKPOINT: Test all external tool detection**

## Final Verification

After ALL phases complete:
1. Full plugin functionality test
2. Export various note types (simple, complex, with embeds)
3. Test all settings combinations
4. Verify no regressions from original functionality
5. Performance check - ensure no significant slowdown

## Execution Process (CRITICAL)

For EACH file modification:
1. **Use Context7** to check Obsidian/TypeScript API documentation
2. Create new file with minimal extraction
3. Update imports in original file
4. Run `npm run build`
5. **STOP and wait for user verification of build**
6. Test specific functionality in Obsidian
7. **STOP and wait for user confirmation functionality works**
8. Only then proceed to next step

## Success Criteria

- All 6 large files reduced to manageable size (150-200 lines each)
- No loss of functionality
- No performance degradation
- Clean module boundaries
- Maintainable code structure
- All tests pass (build + manual verification)

## Rollback Plan

If any phase fails:
1. Revert changes using git
2. Analyze what went wrong
3. Adjust approach before retrying
4. Consider smaller extraction steps

---

*Plan created: 2025-01-08*
*Status: Ready to execute Phase 1*