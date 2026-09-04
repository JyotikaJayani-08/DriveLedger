/**
 * Formatting Utilities
 *
 * Display formatters for currency, numbers, and mileage values.
 * These are presentation-only — they never modify stored data.
 *
 * WHY centralized formatting?
 * - Consistent display across the entire app.
 * - When settings change (e.g., currency from ₹ to $), all display
 *   updates come from here.
 */

// ─── Cached Formatters ──────────────────────────────────────────────
// Intl.NumberFormat is expensive to instantiate. Cache at module level
// so every formatCurrency/formatNumber call reuses the same instance.

const INR_FORMATTER = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const NUMBER_FORMATTER = new Intl.NumberFormat('en-IN');

/**
 * Formats a number as Indian Rupee currency.
 * Uses the Indian number grouping system (lakhs/crores).
 *
 * @param amount - The numeric amount
 * @returns Formatted string like "₹1,23,456.00"
 *
 * @example
 * formatCurrency(123456.5) // → "₹1,23,456.50"
 * formatCurrency(50)       // → "₹50.00"
 */
export function formatCurrency(amount: number): string {
  return INR_FORMATTER.format(amount);
}

/**
 * Formats a mileage value with its unit for display.
 *
 * @param value - The mileage number (e.g., 18.2)
 * @param unit - The mileage unit label (e.g., "km/L")
 * @returns Formatted string like "18.2 km/L"
 */
export function formatMileage(value: number, unit: string): string {
  return `${value.toFixed(1)} ${unit}`;
}

/**
 * Formats a number with Indian-style grouping (no currency symbol).
 *
 * @param value - The number to format
 * @returns Formatted string like "1,23,456"
 */
export function formatNumber(value: number): string {
  return NUMBER_FORMATTER.format(value);
}

/**
 * Formats an odometer value for display.
 * Always shows as a whole number with grouping.
 *
 * @param km - The odometer reading
 * @returns Formatted string like "1,23,456 km"
 */
export function formatOdometer(km: number): string {
  return `${formatNumber(Math.round(km))} km`;
}
