/**
 * Version Utilities
 *
 * Lightweight utilities for comparing semantic version strings.
 * Used for minimum version validation of external dependencies.
 */

/**
 * Compares two semantic version strings.
 *
 * @param version1 - First version string (e.g., "0.13.0")
 * @param version2 - Second version string (e.g., "0.5.0")
 * @returns Negative if version1 < version2, 0 if equal, positive if version1 > version2
 *
 * @example
 * ```typescript
 * compareVersions("0.13.0", "0.5.0")  // Returns 8 (0.13.0 > 0.5.0)
 * compareVersions("1.0.0", "1.0.0")   // Returns 0 (equal)
 * ```
 */
export function compareVersions(version1: string, version2: string): number {
	// Extract numeric parts, ignoring pre-release tags and build metadata
	const v1Parts = version1.split(/[-+]/)[0].split('.').map(Number);
	const v2Parts = version2.split(/[-+]/)[0].split('.').map(Number);

	const maxLength = Math.max(v1Parts.length, v2Parts.length);
	for (let i = 0; i < maxLength; i++) {
		const v1 = v1Parts[i] || 0;
		const v2 = v2Parts[i] || 0;

		if (v1 !== v2) {
			return v1 - v2;
		}
	}

	return 0;
}

/**
 * Checks if a version meets a minimum required version.
 *
 * @param actualVersion - The detected version string
 * @param minimumVersion - The minimum required version string
 * @returns True if actualVersion >= minimumVersion
 *
 * @example
 * ```typescript
 * isVersionAtLeast("0.13.0", "0.13.0")  // Returns true
 * isVersionAtLeast("0.12.0", "0.13.0")  // Returns false
 * ```
 */
export function isVersionAtLeast(actualVersion: string, minimumVersion: string): boolean {
	return compareVersions(actualVersion, minimumVersion) >= 0;
}
