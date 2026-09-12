/**
 * Fuel Types, Vehicle Types, Fuel Units & Mileage Units
 *
 * These are stored as string constants in the database (not free text)
 * to prevent spelling inconsistencies and enable type-safe comparisons.
 *
 * WHY enums instead of union types?
 * - Enums are iterable (Object.values(FuelType)) — useful for dropdowns.
 * - Enum values are the actual strings stored in SQLite.
 * - Union types are compile-time only; enums exist at runtime too.
 *
 * HYBRID VARIANTS:
 * - A hybrid vehicle has two fuel systems. We track them as distinct
 *   fuel types so the mileage engine knows which unit to use by default
 *   and the UI can show two tank capacity fields.
 */

// ─── Fuel Types ──────────────────────────────────────────────────────
export enum FuelType {
  PETROL = 'petrol',
  DIESEL = 'diesel',
  CNG = 'cng',
  LPG = 'lpg',
  ELECTRIC = 'electric',
  // ── Hybrid Variants (dual-fuel, two tanks) ──
  HYBRID_CNG_PETROL = 'hybrid_cng_petrol',
  HYBRID_CNG_DIESEL = 'hybrid_cng_diesel',
  HYBRID_LPG_PETROL = 'hybrid_lpg_petrol',
  HYBRID_LPG_DIESEL = 'hybrid_lpg_diesel',
}

/**
 * Returns true when a fuel type represents a dual-fuel (hybrid) vehicle.
 * Used to show secondary tank fields in the UI.
 */
export function isHybridFuel(ft: FuelType): boolean {
  return [
    FuelType.HYBRID_CNG_PETROL,
    FuelType.HYBRID_CNG_DIESEL,
    FuelType.HYBRID_LPG_PETROL,
    FuelType.HYBRID_LPG_DIESEL,
  ].includes(ft);
}

/**
 * Returns true when the fuel type is fully electric.
 * Used to rename "Tank Capacity" → "Battery Capacity (kWh)".
 */
export function isElectricFuel(ft: FuelType): boolean {
  return ft === FuelType.ELECTRIC;
}

// ─── Vehicle Types ───────────────────────────────────────────────────
export enum VehicleType {
  CAR = 'car',
  TWO_WHEELER = 'two_wheeler',
  THREE_WHEELER = 'three_wheeler',
  OTHER = 'other',
}

// ─── Fuel Units ──────────────────────────────────────────────────────
export enum FuelUnit {
  LITRES = 'litres',
  KG = 'kg',
  KWH = 'kWh',
}

// ─── Mileage Units ──────────────────────────────────────────────────
export enum MileageUnit {
  KM_PER_LITRE = 'km_per_litre',
  KM_PER_KG = 'km_per_kg',
  KM_PER_KWH = 'km_per_kwh',
}

// ─── Mapping Helpers ─────────────────────────────────────────────────

/**
 * Maps a vehicle's fuel_type to the default fuel_unit for fuel entries.
 * For hybrids, we default to the gas component (first fill is usually CNG/LPG).
 */
export const FUEL_TYPE_TO_DEFAULT_UNIT: Record<FuelType, FuelUnit> = {
  [FuelType.PETROL]: FuelUnit.LITRES,
  [FuelType.DIESEL]: FuelUnit.LITRES,
  [FuelType.CNG]: FuelUnit.KG,
  [FuelType.LPG]: FuelUnit.KG,
  [FuelType.ELECTRIC]: FuelUnit.KWH,
  [FuelType.HYBRID_CNG_PETROL]: FuelUnit.KG,
  [FuelType.HYBRID_CNG_DIESEL]: FuelUnit.KG,
  [FuelType.HYBRID_LPG_PETROL]: FuelUnit.KG,
  [FuelType.HYBRID_LPG_DIESEL]: FuelUnit.KG,
};

/**
 * Maps a fuel_unit to its corresponding mileage_unit.
 */
export const FUEL_UNIT_TO_MILEAGE_UNIT: Record<FuelUnit, MileageUnit> = {
  [FuelUnit.LITRES]: MileageUnit.KM_PER_LITRE,
  [FuelUnit.KG]: MileageUnit.KM_PER_KG,
  [FuelUnit.KWH]: MileageUnit.KM_PER_KWH,
};

// ─── Display Labels ─────────────────────────────────────────────────

/** Human-readable labels for fuel types (used in UI chips) */
export const FUEL_TYPE_LABELS: Record<FuelType, string> = {
  [FuelType.PETROL]: 'Petrol',
  [FuelType.DIESEL]: 'Diesel',
  [FuelType.CNG]: 'CNG',
  [FuelType.LPG]: 'LPG',
  [FuelType.ELECTRIC]: 'Electric ⚡',
  [FuelType.HYBRID_CNG_PETROL]: 'CNG + Petrol',
  [FuelType.HYBRID_CNG_DIESEL]: 'CNG + Diesel',
  [FuelType.HYBRID_LPG_PETROL]: 'LPG + Petrol',
  [FuelType.HYBRID_LPG_DIESEL]: 'LPG + Diesel',
};

/** Short UI labels (e.g. for display in list cards) */
export const FUEL_TYPE_SHORT_LABELS: Record<FuelType, string> = {
  [FuelType.PETROL]: 'Petrol',
  [FuelType.DIESEL]: 'Diesel',
  [FuelType.CNG]: 'CNG',
  [FuelType.LPG]: 'LPG',
  [FuelType.ELECTRIC]: 'EV',
  [FuelType.HYBRID_CNG_PETROL]: 'CNG+Petrol',
  [FuelType.HYBRID_CNG_DIESEL]: 'CNG+Diesel',
  [FuelType.HYBRID_LPG_PETROL]: 'LPG+Petrol',
  [FuelType.HYBRID_LPG_DIESEL]: 'LPG+Diesel',
};

/** Human-readable labels for vehicle types (used in UI dropdowns) */
export const VEHICLE_TYPE_LABELS: Record<VehicleType, string> = {
  [VehicleType.CAR]: 'Car',
  [VehicleType.TWO_WHEELER]: 'Two Wheeler',
  [VehicleType.THREE_WHEELER]: 'Three Wheeler',
  [VehicleType.OTHER]: 'Other',
};

/** Human-readable labels for mileage units (used in stat displays) */
export const MILEAGE_UNIT_LABELS: Record<MileageUnit, string> = {
  [MileageUnit.KM_PER_LITRE]: 'km/L',
  [MileageUnit.KM_PER_KG]: 'km/kg',
  [MileageUnit.KM_PER_KWH]: 'km/kWh',
};

/**
 * For a hybrid fuel type, returns a label for the primary (gas) tank.
 * Returns null for non-hybrid types.
 */
export function getPrimaryTankLabel(ft: FuelType): string | null {
  switch (ft) {
    case FuelType.HYBRID_CNG_PETROL:
    case FuelType.HYBRID_CNG_DIESEL:
      return 'CNG Tank Capacity (kg)';
    case FuelType.HYBRID_LPG_PETROL:
    case FuelType.HYBRID_LPG_DIESEL:
      return 'LPG Tank Capacity (kg)';
    default:
      return null;
  }
}

/**
 * For a hybrid fuel type, returns a label for the secondary (liquid) tank.
 * Returns null for non-hybrid types.
 */
export function getSecondaryTankLabel(ft: FuelType): string | null {
  switch (ft) {
    case FuelType.HYBRID_CNG_PETROL:
    case FuelType.HYBRID_LPG_PETROL:
      return 'Petrol Tank Capacity (litres)';
    case FuelType.HYBRID_CNG_DIESEL:
    case FuelType.HYBRID_LPG_DIESEL:
      return 'Diesel Tank Capacity (litres)';
    default:
      return null;
  }
}

/**
 * Returns the primary (single) tank label for non-hybrid vehicles.
 */
export function getTankCapacityLabel(ft: FuelType): string {
  if (ft === FuelType.ELECTRIC) return 'Battery Capacity (kWh)';
  if (ft === FuelType.CNG) return 'CNG Tank Capacity (kg)';
  if (ft === FuelType.LPG) return 'LPG Tank Capacity (kg)';
  if (isHybridFuel(ft)) return getPrimaryTankLabel(ft) ?? 'Primary Tank Capacity';
  return 'Tank Capacity (litres)';
}
