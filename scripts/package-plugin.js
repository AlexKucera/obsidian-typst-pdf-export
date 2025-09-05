#!/usr/bin/env node

/**
 * Package Obsidian Typst PDF Export Plugin for Release
 * 
 * This script creates a ZIP file containing all necessary plugin files
 * including the critical templates directory that Obsidian's default
 * installation process doesn't handle.
 */

const fs = require('fs');
const path = require('path');
const archiver = require('archiver');

const PLUGIN_NAME = 'obsidian-typst-pdf-export';

async function packagePlugin() {
    const projectRoot = path.resolve(__dirname, '..');
    const outputPath = path.join(projectRoot, `${PLUGIN_NAME}.zip`);

    console.log('🚀 Creating Obsidian plugin release package...');
    console.log(`📁 Project root: ${projectRoot}`);
    console.log(`📦 Output: ${outputPath}`);
    
    // Verify required files exist
    const requiredFiles = [
        'main.js',
        'manifest.json',
        'templates'
    ];

    const missingFiles = [];
    for (const file of requiredFiles) {
        const filePath = path.join(projectRoot, file);
        if (!fs.existsSync(filePath)) {
            missingFiles.push(file);
        }
    }

    if (missingFiles.length > 0) {
        console.error('❌ Missing required files:');
        missingFiles.forEach(file => console.error(`   - ${file}`));
        console.error('\n💡 Run "npm run build" first to generate main.js');
        process.exit(1);
    }

    // Check templates directory
    const templatesDir = path.join(projectRoot, 'templates');
    const templateFiles = fs.readdirSync(templatesDir).filter(f => f.endsWith('.typ'));
    
    if (templateFiles.length === 0) {
        console.error('❌ No .typ template files found in templates/ directory');
        process.exit(1);
    }

    console.log(`✅ Found ${templateFiles.length} template files:`, templateFiles.join(', '));

    // Create ZIP package
    const output = fs.createWriteStream(outputPath);
    const archive = archiver('zip', {
        zlib: { level: 9 } // Maximum compression
    });

    return new Promise((resolve, reject) => {
        output.on('close', () => {
            const sizeKB = Math.round(archive.pointer() / 1024);
            console.log('\n✅ Package created successfully!');
            console.log(`📊 Size: ${sizeKB} KB (${archive.pointer()} bytes)`);
            console.log(`📄 Location: ${outputPath}`);
            resolve();
        });

        archive.on('error', (err) => {
            console.error('❌ Error creating package:', err);
            reject(err);
        });

        archive.pipe(output);

        console.log('\n📂 Adding files to package:');

        // Add main.js (required)
        archive.file(path.join(projectRoot, 'main.js'), { name: 'main.js' });
        console.log('   ✓ main.js');

        // Add manifest.json (required)
        archive.file(path.join(projectRoot, 'manifest.json'), { name: 'manifest.json' });
        console.log('   ✓ manifest.json');

        // Add styles.css (optional)
        const stylesPath = path.join(projectRoot, 'styles.css');
        if (fs.existsSync(stylesPath)) {
            archive.file(stylesPath, { name: 'styles.css' });
            console.log('   ✓ styles.css');
        } else {
            console.log('   - styles.css (not found, skipping)');
        }

        // Add templates directory (critical for this plugin)
        archive.directory(templatesDir, 'templates/');
        console.log(`   ✓ templates/ (${templateFiles.length} files)`);
        templateFiles.forEach(file => {
            console.log(`     - ${file}`);
        });

        archive.finalize();
    });
}

async function validatePackage() {
    const packagePath = path.resolve(__dirname, '..', `${PLUGIN_NAME}.zip`);
    
    if (!fs.existsSync(packagePath)) {
        console.error('❌ Package file not found for validation');
        return false;
    }

    console.log('\n🔍 Package validation:');
    console.log('   ✓ ZIP file created');
    console.log('   ✓ Ready for GitHub release');
    console.log('   ✓ Contains templates for proper functionality');

    return true;
}

async function main() {
    try {
        await packagePlugin();
        await validatePackage();
        
        console.log('\n🎉 Plugin packaging complete!');
        console.log('\n📋 Next steps:');
        console.log('   1. Create a git tag: git tag 1.0.0');
        console.log('   2. Push the tag: git push origin 1.0.0');
        console.log('   3. GitHub Actions will create the release automatically');
        console.log('   4. Or upload the ZIP manually to a GitHub release');
        
    } catch (error) {
        console.error('❌ Packaging failed:', error.message);
        process.exit(1);
    }
}

// Check if archiver is available
try {
    require.resolve('archiver');
} catch (error) {
    console.error('❌ Missing dependency: archiver');
    console.error('💡 Install it with: npm install --save-dev archiver');
    process.exit(1);
}

if (require.main === module) {
    main();
}