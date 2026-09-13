/**
 * Tests for dateInput utilities
 *
 * Verifies the DD/MM/YYYY ↔ ISO 8601 conversion functions
 * and strict validation rules (DD 01-31, MM 01-12, calendar validity).
 */

import {
  displayToISO,
  isoToDisplay,
  validateDateDisplay,
  formatDateInput,
} from '../dateInput';

describe('displayToISO', () => {
  it('converts DD/MM/YYYY to YYYY-MM-DD', () => {
    expect(displayToISO('14/07/2026')).toBe('2026-07-14');
  });

  it('pads single-digit day and month', () => {
    expect(displayToISO('5/3/2026')).toBe('2026-03-05');
  });

  it('handles whitespace', () => {
    expect(displayToISO('  14/07/2026  ')).toBe('2026-07-14');
  });

  it('returns null for empty string', () => {
    expect(displayToISO('')).toBeNull();
  });

  it('returns null for incomplete input', () => {
    expect(displayToISO('14/07')).toBeNull();
    expect(displayToISO('14')).toBeNull();
  });

  it('returns null for just slashes', () => {
    expect(displayToISO('//')).toBeNull();
  });

  it('handles 01/01/2000 (edge case dates)', () => {
    expect(displayToISO('01/01/2000')).toBe('2000-01-01');
  });

  it('handles 31/12/2099 (far future)', () => {
    expect(displayToISO('31/12/2099')).toBe('2099-12-31');
  });

  // ── Strict limitations (DD 01-31, MM 01-12) ──
  it('rejects day greater than 31', () => {
    expect(displayToISO('32/01/2026')).toBeNull();
    expect(displayToISO('99/01/2026')).toBeNull();
  });

  it('rejects day 00', () => {
    expect(displayToISO('00/01/2026')).toBeNull();
  });

  it('rejects month greater than 12', () => {
    expect(displayToISO('15/13/2026')).toBeNull();
    expect(displayToISO('15/99/2026')).toBeNull();
  });

  it('rejects month 00', () => {
    expect(displayToISO('15/00/2026')).toBeNull();
  });

  it('rejects 31st on a 30-day month (April 31st)', () => {
    expect(displayToISO('31/04/2026')).toBeNull();
  });

  it('rejects 30th or 31st of February', () => {
    expect(displayToISO('30/02/2026')).toBeNull();
    expect(displayToISO('31/02/2026')).toBeNull();
  });

  it('accepts Feb 29 on leap year (2024)', () => {
    expect(displayToISO('29/02/2024')).toBe('2024-02-29');
  });

  it('rejects Feb 29 on non-leap year (2025)', () => {
    expect(displayToISO('29/02/2025')).toBeNull();
  });
});

describe('validateDateDisplay', () => {
  it('returns valid for correct date', () => {
    expect(validateDateDisplay('14/07/2026')).toEqual({ isValid: true });
  });

  it('returns error for empty date', () => {
    const res = validateDateDisplay('');
    expect(res.isValid).toBe(false);
    expect(res.error).toBe('Date is required.');
  });

  it('returns error for day > 31', () => {
    const res = validateDateDisplay('32/05/2026');
    expect(res.isValid).toBe(false);
    expect(res.error).toBe('Day must be between 01 and 31.');
  });

  it('returns error for month > 12', () => {
    const res = validateDateDisplay('15/13/2026');
    expect(res.isValid).toBe(false);
    expect(res.error).toBe('Month must be between 01 and 12.');
  });

  it('returns error for invalid calendar date', () => {
    const res = validateDateDisplay('31/02/2026');
    expect(res.isValid).toBe(false);
    expect(res.error).toBe('Please enter a valid calendar date.');
  });
});

describe('isoToDisplay', () => {
  it('converts YYYY-MM-DD to DD/MM/YYYY', () => {
    expect(isoToDisplay('2026-07-14')).toBe('14/07/2026');
  });

  it('handles full ISO datetime string (takes date part)', () => {
    const result = isoToDisplay('2026-07-14T10:30:00.000Z');
    expect(result).toBe('14/07/2026');
  });

  it('returns empty string for empty input', () => {
    expect(isoToDisplay('')).toBe('');
  });

  it('returns empty string for input without dashes', () => {
    expect(isoToDisplay('20260714')).toBe('');
  });

  it('handles 2000-01-01', () => {
    expect(isoToDisplay('2000-01-01')).toBe('01/01/2000');
  });

  it('handles already formatted DD/MM/YYYY string', () => {
    expect(isoToDisplay('14/07/2026')).toBe('14/07/2026');
  });
});

describe('formatDateInput', () => {
  it('inserts auto-slash after 2 digits', () => {
    expect(formatDateInput('14', '')).toBe('14/');
  });

  it('auto-prefixes 0 for days starting with 4-9', () => {
    expect(formatDateInput('4', '')).toBe('04/');
    expect(formatDateInput('9', '')).toBe('09/');
  });

  it('clamps day to 31 if typed > 31', () => {
    expect(formatDateInput('35', '3')).toBe('31/');
  });

  it('clamps month to 12 if typed > 12', () => {
    expect(formatDateInput('14/15', '14/1')).toBe('14/12/');
  });

  it('auto-prefixes 0 for month starting with 2-9', () => {
    expect(formatDateInput('14/5', '14/')).toBe('14/05/');
  });

  it('allows full DD/MM/YYYY entry', () => {
    expect(formatDateInput('14072026', '')).toBe('14/07/2026');
  });

  it('handles backspacing without re-inserting slashes', () => {
    expect(formatDateInput('14/', '14/0')).toBe('14');
  });
});

describe('roundtrip conversions', () => {
  it('displayToISO → isoToDisplay roundtrip', () => {
    const original = '14/07/2026';
    const iso = displayToISO(original);
    expect(iso).not.toBeNull();
    expect(isoToDisplay(iso!)).toBe(original);
  });

  it('isoToDisplay → displayToISO roundtrip', () => {
    const original = '2026-07-14';
    const display = isoToDisplay(original);
    expect(displayToISO(display)).toBe(original);
  });
});
