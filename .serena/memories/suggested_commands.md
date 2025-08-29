# Suggested Commands for Development

## Core Development Workflow
```bash
# Install dependencies (run once after clone)
npm install

# Start development with file watching and auto-compilation
npm run dev

# Production build with type checking
npm run build

# Version bump and manifest update
npm run version
```

## Build System Details
- **Development**: `npm run dev` runs esbuild with watch mode and inline source maps
- **Production**: `npm run build` includes TypeScript type checking and minification
- **Entry Point**: `main.ts` compiles to `main.js`

## Code Quality Commands
```bash
# Type checking (part of build process)
tsc -noEmit -skipLibCheck

# Linting (manual - not in package.json scripts)
npx eslint main.ts

# Format code (if prettier is used)
npx prettier --write main.ts
```

## Darwin-Specific System Commands
```bash
# File operations
ls -la                    # List files with details
find . -name "*.ts"       # Find TypeScript files
grep -r "pattern" .       # Search for patterns

# Git operations
git status               # Check working directory status
git add .               # Stage changes
git commit -m "message" # Commit with message

# Process management
ps aux | grep node      # Find Node.js processes
kill -9 <pid>          # Force kill process
```

## Plugin Development Testing
- Install plugin in Obsidian vault at `.obsidian/plugins/obsidian-typst-pdf-export/`
- Use `npm run dev` for live reloading during development
- Restart Obsidian or reload plugin after changes

## External Tool Management (Future)
```bash
# Check Pandoc installation
pandoc --version

# Check Typst installation  
typst --version

# Install via package managers
brew install pandoc typst    # macOS Homebrew
```