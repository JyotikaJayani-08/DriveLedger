/**
 * Version comparison utility for in-app update checking.
 */

/**
 * Parses a version string into an array of numeric parts.
 * Strips leading 'v' or 'V' and non-numeric suffixes.
 * E.g., 'v1.2.3' -> [1, 2, 3]
 */
export function parseVersion(versionStr: string): number[] {
  if (!versionStr || typeof versionStr !== 'string') return [0, 0, 0];
  const cleaned = versionStr.trim().replace(/^[vV]/, '');
  return cleaned
    .split('.')
    .map((part) => {
      const num = parseInt(part, 10);
      return isNaN(num) ? 0 : num;
    });
}

/**
 * Returns true if remoteVersion is strictly greater than currentVersion.
 * E.g., isNewerVersion('1.0.0', '1.0.1') -> true
 *       isNewerVersion('1.1.0', '1.0.5') -> false
 *       isNewerVersion('1.0.0', '1.0.0') -> false
 */
export function isNewerVersion(currentVersion: string, remoteVersion: string): boolean {
  const current = parseVersion(currentVersion);
  const remote = parseVersion(remoteVersion);

  const length = Math.max(current.length, remote.length);
  for (let i = 0; i < length; i++) {
    const c = current[i] || 0;
    const r = remote[i] || 0;
    if (r > c) return true;
    if (r < c) return false;
  }
  return false;
}
