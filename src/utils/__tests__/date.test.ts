/**
 * Tests for date utilities
 *
 * Verifies ISO date helpers, date formatting, and day calculations
 * used across the entire application.
 */

import { nowISO, todayISO, isCurrentMonth, daysUntil } from '../date';

describe('nowISO', () => {
  it('returns a valid ISO 8601 string', () => {
    const result = nowISO();
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
  });

  it('returns the current time (within 2 seconds)', () => {
    const before = Date.now();
    const result = new Date(nowISO()).getTime();
    const after = Date.now();
    expect(result).toBeGreaterThanOrEqual(before - 100);
    expect(result).toBeLessThanOrEqual(after + 100);
  });
});

describe('todayISO', () => {
  it('returns a date-only string (YYYY-MM-DD)', () => {
    const result = todayISO();
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('matches the current date', () => {
    const result = todayISO();
    const today = new Date().toISOString().split('T')[0];
    expect(result).toBe(today);
  });
});

describe('isCurrentMonth', () => {
  it('returns true for today', () => {
    expect(isCurrentMonth(todayISO())).toBe(true);
  });

  it('returns true for a date in the current month', () => {
    const now = new Date();
    const dateInMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-15`;
    expect(isCurrentMonth(dateInMonth)).toBe(true);
  });

  it('returns false for a date in a different month', () => {
    // Use a date definitely not this month
    const now = new Date();
    const otherMonth = now.getMonth() === 0 ? 2 : 1; // If Jan, use Feb; else use Jan
    const dateOtherMonth = `${now.getFullYear()}-${String(otherMonth).padStart(2, '0')}-15`;
    expect(isCurrentMonth(dateOtherMonth)).toBe(false);
  });

  it('returns false for a date in a different year', () => {
    expect(isCurrentMonth('2000-01-15')).toBe(false);
  });
});

describe('daysUntil', () => {
  it('returns 0 for today', () => {
    expect(daysUntil(todayISO())).toBe(0);
  });

  it('returns positive number for future dates', () => {
    const future = new Date();
    future.setDate(future.getDate() + 10);
    const isoFuture = future.toISOString().split('T')[0];
    expect(daysUntil(isoFuture)).toBe(10);
  });

  it('returns negative number for past dates', () => {
    const past = new Date();
    past.setDate(past.getDate() - 5);
    const isoPast = past.toISOString().split('T')[0];
    expect(daysUntil(isoPast)).toBe(-5);
  });

  it('handles exactly 1 day', () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const isoTomorrow = tomorrow.toISOString().split('T')[0];
    expect(daysUntil(isoTomorrow)).toBe(1);
  });
});
