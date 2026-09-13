/**
 * Date Input Helpers
 *
 * Shared utilities for converting between ISO date strings
 * and the DD/MM/YYYY display format used in all form screens.
 *
 * Eliminates the `parseDate` function that was duplicated
 * identically in add-fuel, add-service, add-expense, and add-document.
 *
 * Also provides `formatDateInput` for auto-slash insertion so numpad
 * keyboards work seamlessly — no `/` key required.
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

/**
 * Formats raw text input into DD/MM/YYYY as the user types on a numpad.
 *
 * Strips all non-digits, then auto-inserts `/` after the 2nd and 4th digit
 * so the user never has to type a slash character themselves.
 *
 * Usage:
 *   onChangeText={(text) => {
 *     const formatted = formatDateInput(text, previousValue);
 *     setPreviousValue(formatted);
 *     setDate(displayToISO(formatted) ?? '');
 *   }}
 *
 * @param raw - The raw text from the TextInput's onChangeText callback
 * @param prev - The previous formatted value (used to detect backspace)
 * @returns Formatted date string like "14/07/2026" (partial is fine)
 */
export function formatDateInput(raw: string, prev: string): string {
  // If user is deleting (new text shorter than prev), just trim cleanly
  if (raw.length < prev.length) {
    // Strip trailing slash if they backspaced onto it
    if (raw.endsWith('/')) {
      return raw.slice(0, -1);
    }
    return raw;
  }

  // Strip everything except digits
  const digits = raw.replace(/\D/g, '');

  // Rebuild with auto-slashes: DD/MM/YYYY
  let formatted = '';
  if (digits.length <= 2) {
    formatted = digits;
  } else if (digits.length <= 4) {
    formatted = `${digits.slice(0, 2)}/${digits.slice(2)}`;
  } else {
    formatted = `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4, 8)}`;
  }

  return formatted;
}
