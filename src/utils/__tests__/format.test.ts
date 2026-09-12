/**
 * Tests for format utilities
 *
 * Verifies currency, mileage, number, and odometer formatting
 * with Indian locale specifics.
 */

import { formatCurrency, formatMileage, formatNumber, formatOdometer } from '../format';

describe('formatCurrency', () => {
  it('formats a simple number as INR', () => {
    const result = formatCurrency(50);
    expect(result).toContain('50');
    expect(result).toContain('₹');
  });

  it('includes two decimal places', () => {
    const result = formatCurrency(50);
    expect(result).toContain('.00');
  });

  it('formats zero correctly', () => {
    const result = formatCurrency(0);
    expect(result).toContain('0.00');
  });

  it('formats large numbers with Indian grouping', () => {
    const result = formatCurrency(123456.5);
    // Indian format: 1,23,456.50
    expect(result).toContain('1,23,456.50');
  });
});

describe('formatMileage', () => {
  it('formats mileage with one decimal place', () => {
    expect(formatMileage(18.2, 'km/L')).toBe('18.2 km/L');
  });

  it('rounds to one decimal place', () => {
    expect(formatMileage(18.267, 'km/L')).toBe('18.3 km/L');
  });

  it('adds .0 for whole numbers', () => {
    expect(formatMileage(20, 'km/L')).toBe('20.0 km/L');
  });

  it('works with different units', () => {
    expect(formatMileage(5.5, 'km/kg')).toBe('5.5 km/kg');
    expect(formatMileage(8.1, 'km/kWh')).toBe('8.1 km/kWh');
  });
});

describe('formatNumber', () => {
  it('formats with Indian grouping', () => {
    const result = formatNumber(123456);
    expect(result).toBe('1,23,456');
  });

  it('formats small numbers without grouping', () => {
    expect(formatNumber(999)).toBe('999');
  });

  it('formats zero', () => {
    expect(formatNumber(0)).toBe('0');
  });
});

describe('formatOdometer', () => {
  it('formats with km suffix', () => {
    const result = formatOdometer(12500);
    expect(result).toBe('12,500 km');
  });

  it('rounds to whole number', () => {
    const result = formatOdometer(12500.7);
    expect(result).toBe('12,501 km');
  });

  it('formats large odometer values', () => {
    const result = formatOdometer(123456);
    expect(result).toBe('1,23,456 km');
  });

  it('handles zero', () => {
    expect(formatOdometer(0)).toBe('0 km');
  });
});
