/**
 * Date Input Helpers
 *
 * Shared utilities for converting between ISO date strings
 * and the DD/MM/YYYY display format used in all form screens.
 *
 * Enforces DD (01-31), MM (01-12), YYYY (4 digits), and calendar date validity.
 *
 * Also provides `formatDateInput` for auto-slash insertion and input limitation
 * so numpad keyboards work seamlessly — no `/` key required.
 */

export interface DateValidationResult {
  isValid: boolean;
  error?: string;
}

/**
 * Validates a DD/MM/YYYY display date string.
 *
 * Checks:
 * 1. Non-empty string
 * 2. Proper DD/MM/YYYY format with 4-digit year
 * 3. Day is between 01 and 31
 * 4. Month is between 01 and 12
 * 5. Year is between 1900 and 2100
 * 6. Valid calendar date (e.g. Feb 30 is invalid, leap year Feb 29 check)
 *
 * @param display - A date string like "14/07/2026"
 * @param fieldName - Optional field name for user-friendly error messages
 * @returns DateValidationResult
 */
export function validateDateDisplay(
  display: string,
  fieldName = 'Date'
): DateValidationResult {
  if (!display || typeof display !== 'string' || !display.trim()) {
    return { isValid: false, error: `${fieldName} is required.` };
  }

  const trimmed = display.trim();
  const parts = trimmed.split('/');
  if (parts.length !== 3 || !parts[0] || !parts[1] || !parts[2]) {
    return { isValid: false, error: `${fieldName} must be in DD/MM/YYYY format.` };
  }

  const dayStr = parts[0].trim();
  const monthStr = parts[1].trim();
  const yearStr = parts[2].trim();

  if (!/^\d{1,2}$/.test(dayStr) || !/^\d{1,2}$/.test(monthStr)) {
    return { isValid: false, error: `${fieldName} must be in DD/MM/YYYY format.` };
  }

  if (!/^\d{4}$/.test(yearStr)) {
    return { isValid: false, error: 'Year must be a 4-digit number (e.g., 2026).' };
  }

  const day = parseInt(dayStr, 10);
  const month = parseInt(monthStr, 10);
  const year = parseInt(yearStr, 10);

  if (isNaN(day) || day < 1 || day > 31) {
    return { isValid: false, error: 'Day must be between 01 and 31.' };
  }

  if (isNaN(month) || month < 1 || month > 12) {
    return { isValid: false, error: 'Month must be between 01 and 12.' };
  }

  if (isNaN(year) || year < 1900 || year > 2100) {
    return { isValid: false, error: 'Year must be between 1900 and 2100.' };
  }

  // Calendar validity check (leap years, 28/29/30/31 day limits)
  const testDate = new Date(year, month - 1, day);
  if (
    testDate.getFullYear() !== year ||
    testDate.getMonth() !== month - 1 ||
    testDate.getDate() !== day
  ) {
    return { isValid: false, error: 'Please enter a valid calendar date.' };
  }

  return { isValid: true };
}

/**
 * Checks whether a display date string is valid DD/MM/YYYY.
 */
export function isValidDisplayDate(display: string): boolean {
  return validateDateDisplay(display).isValid;
}

/**
 * Converts a DD/MM/YYYY display string to an ISO 8601 date string.
 *
 * Validates day (01-31), month (01-12), year (4 digits), and calendar validity.
 *
 * @param display - A date string like "14/07/2026" or "5/3/2026"
 * @returns ISO date string like "2026-07-14", or null if unparseable or invalid
 */
export function displayToISO(display: string): string | null {
  if (!display || typeof display !== 'string') return null;

  const validation = validateDateDisplay(display);
  if (!validation.isValid) {
    return null;
  }

  const parts = display.trim().split('/');
  const day = parseInt(parts[0].trim(), 10);
  const month = parseInt(parts[1].trim(), 10);
  const year = parseInt(parts[2].trim(), 10);

  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/**
 * Converts an ISO 8601 date string to DD/MM/YYYY display format.
 *
 * Also handles ISO strings with timestamp parts and strings already formatted.
 *
 * @param iso - ISO date string like "2026-07-14"
 * @returns Display string like "14/07/2026", or empty string if invalid
 */
export function isoToDisplay(iso: string): string {
  if (!iso || typeof iso !== 'string') return '';

  const trimmed = iso.trim();

  // If already in DD/MM/YYYY format, normalize and return
  if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(trimmed)) {
    const p = trimmed.split('/');
    return `${p[0].padStart(2, '0')}/${p[1].padStart(2, '0')}/${p[2]}`;
  }

  const datePart = trimmed.split('T')[0];
  const parts = datePart.split('-');
  if (parts.length === 3 && parts[0].length === 4) {
    return `${parts[2].padStart(2, '0')}/${parts[1].padStart(2, '0')}/${parts[0]}`;
  }
  return '';
}

/**
 * Formats raw text input into DD/MM/YYYY as the user types on a numpad.
 *
 * Strips all non-digits, applies limitations for DD (01-31) and MM (01-12),
 * and auto-inserts `/` after the 2nd and 4th digit so the user never
 * has to type a slash character themselves.
 *
 * @param raw - The raw text from the TextInput's onChangeText callback
 * @param prev - The previous formatted value (used to detect backspace)
 * @returns Formatted date string like "14/07/2026" (partial is fine)
 */
export function formatDateInput(raw: string, prev: string): string {
  // If user is deleting (new text shorter than prev), just trim cleanly
  if (raw.length < prev.length) {
    if (raw.endsWith('/')) {
      return raw.slice(0, -1);
    }
    return raw;
  }

  // Strip everything except digits, limit to 8 digits (DDMMYYYY)
  let digits = raw.replace(/\D/g, '').slice(0, 8);
  if (digits.length === 0) return '';

  // Enforce Day limitations (01 - 31)
  if (digits.length === 1) {
    const firstDigit = parseInt(digits[0], 10);
    // If user enters 4-9, day cannot be 40-99; auto-prefix with 0
    if (firstDigit > 3) {
      digits = `0${firstDigit}`;
    }
  } else if (digits.length >= 2) {
    const dayVal = parseInt(digits.slice(0, 2), 10);
    if (dayVal > 31) {
      digits = `31${digits.slice(2)}`;
    } else if (dayVal === 0) {
      digits = `01${digits.slice(2)}`;
    }
  }

  // Enforce Month limitations (01 - 12)
  if (digits.length === 3) {
    const monthFirstDigit = parseInt(digits[2], 10);
    // If month first digit is 2-9, month cannot be 20-99; auto-prefix with 0
    if (monthFirstDigit > 1) {
      digits = `${digits.slice(0, 2)}0${monthFirstDigit}`;
    }
  } else if (digits.length >= 4) {
    const monthVal = parseInt(digits.slice(2, 4), 10);
    if (monthVal > 12) {
      digits = `${digits.slice(0, 2)}12${digits.slice(4)}`;
    } else if (monthVal === 0) {
      digits = `${digits.slice(0, 2)}01${digits.slice(4)}`;
    }
  }

  // Rebuild with auto-slashes: DD/MM/YYYY
  let formatted = '';
  if (digits.length <= 2) {
    formatted = digits.length === 2 && raw.length > prev.length ? `${digits}/` : digits;
  } else if (digits.length <= 4) {
    formatted = digits.length === 4 && raw.length > prev.length
      ? `${digits.slice(0, 2)}/${digits.slice(2)}/`
      : `${digits.slice(0, 2)}/${digits.slice(2)}`;
  } else {
    formatted = `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4, 8)}`;
  }

  return formatted;
}
