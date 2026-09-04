/**
 * Date Utilities
 *
 * All dates in DriveLedger are stored as ISO 8601 strings in SQLite.
 * These helpers ensure consistent formatting across the app.
 *
 * WHY ISO 8601?
 * - SQLite doesn't have a native DATE type. Text is the standard approach.
 * - ISO 8601 strings sort correctly in alphabetical order (lexicographic sort = chronological sort).
 * - Maps cleanly to PostgreSQL timestamps when cloud sync arrives in v2.0.
 */

/**
 * Returns the current date-time as an ISO 8601 string.
 * Used for `created_at` and `updated_at` fields.
 *
 * @returns ISO 8601 string like "2026-07-14T08:30:00.000Z"
 */
export function nowISO(): string {
  return new Date().toISOString();
}

/**
 * Returns today's date as an ISO 8601 date-only string (no time component).
 * Used for date fields like fuel entry date, service date, etc.
 *
 * @returns Date string like "2026-07-14"
 */
export function todayISO(): string {
  return new Date().toISOString().split('T')[0];
}

/**
 * Formats an ISO 8601 date string for display to the user.
 * Uses Indian locale by default (dd/mm/yyyy).
 *
 * @param isoDate - ISO 8601 date string
 * @returns Formatted date like "14/07/2026"
 */
export function formatDisplayDate(isoDate: string): string {
  const date = new Date(isoDate);
  return date.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

/**
 * Formats an ISO 8601 date string for display with month name.
 *
 * @param isoDate - ISO 8601 date string
 * @returns Formatted date like "14 Jul 2026"
 */
export function formatDisplayDateLong(isoDate: string): string {
  const date = new Date(isoDate);
  return date.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

/**
 * Checks if a given date is in the current calendar month.
 * Used by the mileage engine for monthly average calculations.
 *
 * @param isoDate - ISO 8601 date string
 * @returns true if the date falls in the current month
 */
export function isCurrentMonth(isoDate: string): boolean {
  const date = new Date(isoDate);
  const now = new Date();
  return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth();
}

/**
 * Calculates the number of days until a given date.
 * Used for document expiry warnings.
 *
 * @param isoDate - ISO 8601 date string (the target date)
 * @returns Number of days until the date. Negative if past.
 */
export function daysUntil(isoDate: string): number {
  const target = new Date(isoDate);
  const now = new Date();

  // Reset both to midnight for accurate day count
  target.setHours(0, 0, 0, 0);
  now.setHours(0, 0, 0, 0);

  const diffMs = target.getTime() - now.getTime();
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
}
