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
 */

// ─── Fuel Types ──────────────────────────────────────────────────────
/**
 * Determines which mileage formula the engine uses for a vehicle.
 * Stored on the `vehicles` table.
 */
export enum FuelType {
  PETROL = 'petrol',
  DIESEL = 'diesel',
  CNG = 'cng',
  LPG = 'lpg',
  ELECTRIC = 'electric',
  HYBRID = 'hybrid',
}

// ─── Vehicle Types ───────────────────────────────────────────────────
/**
 * Drives mileage-reasonableness thresholds and UI labels.
 * A two-wheeler at 60 km/L is normal; a car at 60 km/L is suspicious.
 */
export enum VehicleType {
  CAR = 'car',
  TWO_WHEELER = 'two_wheeler',
  THREE_WHEELER = 'three_wheeler',
  OTHER = 'other',
}

// ─── Fuel Units ──────────────────────────────────────────────────────
/**
 * Unit of the fuel_amount field on fuel_entries.
 * Automatically set from the vehicle's fuel_type, but editable for dual-fuel.
 */
export enum FuelUnit {
  LITRES = 'litres',
  KG = 'kg',
  KWH = 'kWh',
}

// ─── Mileage Units ──────────────────────────────────────────────────
/**
 * Unit stored alongside calculated_mileage so the value is always unambiguous.
 */
export enum MileageUnit {
  KM_PER_LITRE = 'km_per_litre',
  KM_PER_KG = 'km_per_kg',
  KM_PER_KWH = 'km_per_kwh',
}

// ─── Mapping Helpers ─────────────────────────────────────────────────

/**
 * Maps a vehicle's fuel_type to the default fuel_unit for fuel entries.
 *
 * WHY: When a user creates a fuel entry, we auto-set the fuel_unit
 * based on their vehicle. A petrol car defaults to litres; a CNG
 * vehicle defaults to kg. The user can override for dual-fuel vehicles.
 */
export const FUEL_TYPE_TO_DEFAULT_UNIT: Record<FuelType, FuelUnit> = {
  [FuelType.PETROL]: FuelUnit.LITRES,
  [FuelType.DIESEL]: FuelUnit.LITRES,
  [FuelType.CNG]: FuelUnit.KG,
  [FuelType.LPG]: FuelUnit.KG,
  [FuelType.ELECTRIC]: FuelUnit.KWH,
  [FuelType.HYBRID]: FuelUnit.LITRES,
};

/**
 * Maps a fuel_unit to its corresponding mileage_unit.
 *
 * WHY: After the mileage engine calculates a value, we need to store
 * the correct unit alongside it so displays are always clear.
 */
export const FUEL_UNIT_TO_MILEAGE_UNIT: Record<FuelUnit, MileageUnit> = {
  [FuelUnit.LITRES]: MileageUnit.KM_PER_LITRE,
  [FuelUnit.KG]: MileageUnit.KM_PER_KG,
  [FuelUnit.KWH]: MileageUnit.KM_PER_KWH,
};

// ─── Display Labels ─────────────────────────────────────────────────

/** Human-readable labels for fuel types (used in UI dropdowns) */
export const FUEL_TYPE_LABELS: Record<FuelType, string> = {
  [FuelType.PETROL]: 'Petrol',
  [FuelType.DIESEL]: 'Diesel',
  [FuelType.CNG]: 'CNG',
  [FuelType.LPG]: 'LPG',
  [FuelType.ELECTRIC]: 'Electric',
  [FuelType.HYBRID]: 'Hybrid',
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
