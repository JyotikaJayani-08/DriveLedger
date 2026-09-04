/**
 * Validation Engine
 *
 * Data validation rules for all user inputs in DriveLedger.
 * These functions return validation results — they do NOT throw errors.
 * The UI layer decides whether to reject, warn, or accept.
 *
 * ═══════════════════════════════════════════════════════════════════
 * VALIDATION PHILOSOPHY
 * ═══════════════════════════════════════════════════════════════════
 *
 * There are two types of validation results:
 *   1. ERROR   → The input is invalid. The UI must block save.
 *   2. WARNING → The input is unusual. The UI shows a warning
 *                but allows save with confirmation.
 *
 * This matches the charter's validation rules exactly:
 *   - Odometer < previous → ❌ Reject
 *   - Odometer = previous → ⚠️ Warning
 *   - Litres > tank capacity → ⚠️ Warning
 *   - Date is in the future → ⚠️ Warning
 *   - Litres = 0 or negative → ❌ Reject
 *   etc.
 */

import { FuelType, FuelUnit } from '@/constants/fuelTypes';

// ─── Types ───────────────────────────────────────────────────────────

export type ValidationSeverity = 'error' | 'warning';

export interface ValidationResult {
  /** Whether the validation passed */
  isValid: boolean;
  /** List of issues found (empty if valid) */
  issues: ValidationIssue[];
}

export interface ValidationIssue {
  /** The field that has the issue */
  field: string;
  /** Whether this blocks saving (error) or just warns (warning) */
  severity: ValidationSeverity;
  /** Human-readable message for the user */
  message: string;
}

// ─── Fuel Entry Validation ──────────────────────────────────────────

/**
 * Validates a fuel entry before saving.
 *
 * @param input - The fuel entry data to validate
 * @param previousOdometer - The most recent odometer reading for this vehicle (null if first entry)
 * @param tankCapacity - The vehicle's tank capacity (null if not set)
 * @param vehicleFuelType - The vehicle's fuel type
 * @returns ValidationResult with any errors and warnings
 */
export function validateFuelEntry(input: {
  odometer: number;
  fuel_amount: number;
  fuel_unit: FuelUnit;
  price_per_unit: number;
  date: string;
}, previousOdometer: number | null, tankCapacity: number | null, vehicleFuelType: FuelType): ValidationResult {
  const issues: ValidationIssue[] = [];

  // ── Odometer validation ──

  if (input.odometer <= 0) {
    issues.push({
      field: 'odometer',
      severity: 'error',
      message: 'Odometer reading must be greater than 0.',
    });
  } else if (previousOdometer !== null) {
    if (input.odometer < previousOdometer) {
      issues.push({
        field: 'odometer',
        severity: 'error',
        message: `Odometer can't be lower than the previous reading (${previousOdometer}).`,
      });
    } else if (input.odometer === previousOdometer) {
      issues.push({
        field: 'odometer',
        severity: 'warning',
        message: 'Odometer is the same as the previous reading. Are you sure?',
      });
    }
  }

  // ── Fuel amount validation ──

  if (input.fuel_amount <= 0) {
    issues.push({
      field: 'fuel_amount',
      severity: 'error',
      message: 'Fuel amount must be greater than 0.',
    });
  }

  if (tankCapacity !== null && input.fuel_amount > tankCapacity) {
    issues.push({
      field: 'fuel_amount',
      severity: 'warning',
      message: `Fuel amount (${input.fuel_amount}) exceeds the vehicle's tank capacity (${tankCapacity}). Are you sure?`,
    });
  }

  // ── Price validation ──

  if (input.price_per_unit <= 0) {
    issues.push({
      field: 'price_per_unit',
      severity: 'error',
      message: 'Price per unit must be greater than 0.',
    });
  }

  // ── Date validation ──

  const entryDate = new Date(input.date);
  const today = new Date();
  today.setHours(23, 59, 59, 999); // End of today
  if (entryDate > today) {
    issues.push({
      field: 'date',
      severity: 'warning',
      message: 'This date is in the future. Are you sure?',
    });
  }

  // ── Fuel unit / fuel type cross-validation ──
  // CNG/LPG should use kg, not litres

  if (
    (vehicleFuelType === FuelType.CNG || vehicleFuelType === FuelType.LPG) &&
    input.fuel_unit === FuelUnit.LITRES
  ) {
    issues.push({
      field: 'fuel_unit',
      severity: 'error',
      message: `${vehicleFuelType.toUpperCase()} vehicles should use kg, not litres. Please correct the fuel unit.`,
    });
  }

  // Determine overall validity (errors block, warnings don't)
  const hasErrors = issues.some((i) => i.severity === 'error');

  return {
    isValid: !hasErrors,
    issues,
  };
}

// ─── Vehicle Validation ─────────────────────────────────────────────

/**
 * Validates vehicle creation/update input.
 */
export function validateVehicle(input: {
  nickname: string;
  registration_number: string;
}): ValidationResult {
  const issues: ValidationIssue[] = [];

  if (!input.nickname || input.nickname.trim().length === 0) {
    issues.push({
      field: 'nickname',
      severity: 'error',
      message: 'Vehicle name is required.',
    });
  }

  if (!input.registration_number || input.registration_number.trim().length === 0) {
    issues.push({
      field: 'registration_number',
      severity: 'error',
      message: 'Registration number is required.',
    });
  }

  const hasErrors = issues.some((i) => i.severity === 'error');
  return { isValid: !hasErrors, issues };
}

// ─── Expense Validation ─────────────────────────────────────────────

/**
 * Validates expense creation/update input.
 */
export function validateExpense(input: {
  amount: number;
  date: string;
}): ValidationResult {
  const issues: ValidationIssue[] = [];

  if (input.amount <= 0) {
    issues.push({
      field: 'amount',
      severity: 'error',
      message: 'Amount must be greater than 0.',
    });
  }

  const entryDate = new Date(input.date);
  const today = new Date();
  today.setHours(23, 59, 59, 999);
  if (entryDate > today) {
    issues.push({
      field: 'date',
      severity: 'warning',
      message: 'This date is in the future. Are you sure?',
    });
  }

  const hasErrors = issues.some((i) => i.severity === 'error');
  return { isValid: !hasErrors, issues };
}

// ─── Helper ─────────────────────────────────────────────────────────

/**
 * Convenience function to check if a validation result has warnings only
 * (no errors). Used by the UI to decide whether to show a confirmation dialog.
 */
export function hasWarningsOnly(result: ValidationResult): boolean {
  return result.isValid && result.issues.length > 0;
}
