import { readFileSync, writeFileSync, existsSync } from "fs";
import { execSync } from "child_process";

const targetVersion = process.env.npm_package_version;

console.log(`🔄 Bumping version to ${targetVersion}`);

// read minAppVersion from manifest.json and bump version to target version
let manifest = JSON.parse(readFileSync("manifest.json", "utf8"));
const { minAppVersion } = manifest;
manifest.version = targetVersion;
writeFileSync("manifest.json", JSON.stringify(manifest, null, "\t"));
console.log(`✅ Updated manifest.json version to ${targetVersion}`);

// update versions.json with target version and minAppVersion from manifest.json
let versions = JSON.parse(readFileSync("versions.json", "utf8"));
versions[targetVersion] = minAppVersion;
writeFileSync("versions.json", JSON.stringify(versions, null, "\t"));
console.log(`✅ Updated versions.json with version ${targetVersion}`);

// Update CHANGELOG.md if it exists
if (existsSync("CHANGELOG.md")) {
	try {
		const changelog = readFileSync("CHANGELOG.md", "utf8");
		
		// Check if this version is already in the changelog
		if (!changelog.includes(`## [${targetVersion}]`) && !changelog.includes(`## ${targetVersion}`)) {
			const today = new Date().toISOString().split('T')[0];
			const versionEntry = `\n## [${targetVersion}] - ${today}\n\n### Added\n- Version ${targetVersion} release\n\n### Changed\n\n### Fixed\n\n### Removed\n`;
			
			// Insert after the first # heading (usually "# Changelog")
			const lines = changelog.split('\n');
			let insertIndex = 0;
			for (let i = 0; i < lines.length; i++) {
				if (lines[i].startsWith('# ')) {
					insertIndex = i + 1;
					// Skip any existing content until we find a good insertion point
					while (insertIndex < lines.length && lines[insertIndex].trim() === '') {
						insertIndex++;
					}
					break;
				}
			}
			
			lines.splice(insertIndex, 0, ...versionEntry.split('\n'));
			writeFileSync("CHANGELOG.md", lines.join('\n'));
			console.log(`✅ Added version ${targetVersion} to CHANGELOG.md`);
		} else {
			console.log(`ℹ️  Version ${targetVersion} already exists in CHANGELOG.md`);
		}
	} catch (error) {
		console.warn(`⚠️  Could not update CHANGELOG.md: ${error.message}`);
	}
} else {
	console.log(`ℹ️  No CHANGELOG.md found, skipping changelog update`);
}

// Create git tag in Obsidian format (no 'v' prefix)
try {
	// Check if tag already exists
	const existingTags = execSync('git tag', { encoding: 'utf8' }).split('\n').filter(Boolean);
	
	if (!existingTags.includes(targetVersion)) {
		console.log(`📌 Creating git tag: ${targetVersion} (Obsidian format)`);
		execSync(`git tag ${targetVersion}`, { stdio: 'inherit' });
		console.log(`✅ Git tag ${targetVersion} created successfully`);
		console.log(`💡 Push the tag with: git push origin ${targetVersion}`);
	} else {
		console.log(`ℹ️  Git tag ${targetVersion} already exists`);
	}
} catch (error) {
	console.warn(`⚠️  Could not create git tag: ${error.message}`);
	console.log(`💡 You can manually create the tag with: git tag ${targetVersion}`);
}

console.log('\n🎉 Version bump completed!');
console.log(`📦 New version: ${targetVersion}`);
console.log(`📋 Next steps:`);
console.log(`   1. Review the changes in manifest.json and versions.json`);
console.log(`   2. Update CHANGELOG.md with release notes if needed`);
console.log(`   3. Commit the changes: git add . && git commit -m "Release ${targetVersion}"`);
console.log(`   4. Push the tag: git push origin ${targetVersion}`);
console.log(`   5. GitHub Actions will create the release automatically`);
