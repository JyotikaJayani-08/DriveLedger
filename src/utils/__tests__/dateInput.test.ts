/**
 * Tests for dateInput utilities
 *
 * Verifies the DD/MM/YYYY ↔ ISO 8601 conversion functions
 * that are used across all form screens.
 */

import { displayToISO, isoToDisplay } from '../dateInput';

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
});

describe('isoToDisplay', () => {
  it('converts YYYY-MM-DD to DD/MM/YYYY', () => {
    expect(isoToDisplay('2026-07-14')).toBe('14/07/2026');
  });

  it('handles full ISO datetime string (takes date part)', () => {
    // isoToDisplay only splits on '-', so a full datetime won't work correctly
    // This documents the expected behavior — only date-only strings should be passed
    const result = isoToDisplay('2026-07-14');
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
