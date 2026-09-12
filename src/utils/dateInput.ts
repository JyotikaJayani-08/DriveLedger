/**
 * Date Input Helpers
 *
 * Shared utilities for converting between ISO date strings
 * and the DD/MM/YYYY display format used in all form screens.
 *
 * Eliminates the `parseDate` function that was duplicated
 * identically in add-fuel, add-service, add-expense, and add-document.
 */

/**
 * Converts a DD/MM/YYYY display string to an ISO 8601 date string.
 *
 * @param display - A date string like "14/07/2026"
 * @returns ISO date string like "2026-07-14", or null if unparseable
 */
export function displayToISO(display: string): string | null {
  const parts = display.trim().split('/');
  if (parts.length === 3 && parts[0] && parts[1] && parts[2]) {
    return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
  }
  return null;
}

/**
 * Converts an ISO 8601 date string to DD/MM/YYYY display format.
 *
 * @param iso - ISO date string like "2026-07-14"
 * @returns Display string like "14/07/2026", or empty string if invalid
 */
export function isoToDisplay(iso: string): string {
  const parts = iso.split('-');
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return '';
}
