/**
 * Fuel Entry Store (Zustand)
 *
 * Global state for fuel entry data.
 * Handles CRUD + mileage calculation orchestration.
 *
 * KEY FLOW:
 * 1. User fills the fuel entry form.
 * 2. UI calls addFuelEntry().
 * 3. Store creates the entry via fuelRepo.
 * 4. Store calls mileageEngine to calculate mileage.
 * 5. Store persists the calculated mileage back to the entry.
 * 6. Store updates the vehicle's current_odometer.
 * 7. State is refreshed.
 */

import { create } from 'zustand';
import type { FuelEntry, CreateFuelEntryInput } from '@/types/fuel';
import type { Vehicle } from '@/types/vehicle';
import * as fuelRepo from '@/database/repositories/fuelRepo';
import * as vehicleRepo from '@/database/repositories/vehicleRepo';
import {
  calculateMileageForEntry,
  recalculateAllMileage,
  computeMileageStats,
  checkMileageReasonableness,
  type MileageStats,
  type MileageWarning,
} from '@/engine/mileageEngine';
import { FuelType, FUEL_UNIT_TO_MILEAGE_UNIT } from '@/constants/fuelTypes';
import type { FuelUnit, VehicleType } from '@/constants/fuelTypes';

interface FuelState {
  /** Fuel entries for the currently selected vehicle (date DESC for display) */
  entries: FuelEntry[];
  /** Mileage statistics for the selected vehicle */
  stats: MileageStats;
  /** Loading state */
  isLoading: boolean;

  // ── Actions ──
  /** Load fuel entries + stats for a vehicle */
  loadEntries: (vehicleId: string) => void;
  /** Create a new fuel entry with mileage calculation */
  addFuelEntry: (input: CreateFuelEntryInput, vehicle: Vehicle) => {
    entry: FuelEntry;
    warning: MileageWarning | null;
  };
  /** Delete a fuel entry and recalculate downstream mileage */
  deleteFuelEntry: (entryId: string, vehicle: Vehicle) => void;
}

const emptyStats: MileageStats = {
  lastFillMileage: null,
  runningAverage: null,
  monthlyAverage: null,
  best: null,
  worst: null,
};

export const useFuelStore = create<FuelState>((set) => ({
  entries: [],
  stats: emptyStats,
  isLoading: true,

  loadEntries: (vehicleId: string) => {
    const entries = fuelRepo.getFuelEntriesByVehicle(vehicleId);
    const stats = computeMileageStats(entries);
    set({ entries, stats, isLoading: false });
  },

  addFuelEntry: (input: CreateFuelEntryInput, vehicle: Vehicle) => {
    // 1. Create the entry in the database
    const entry = fuelRepo.createFuelEntry(input);

    // 2. Calculate mileage for this entry
    const chronological = fuelRepo.getFuelEntriesByVehicleChronological(vehicle.id);
    const entryIndex = chronological.findIndex((e) => e.id === entry.id);

    let warning: MileageWarning | null = null;

    if (entryIndex >= 0) {
      const mileageResult = calculateMileageForEntry(
        chronological,
        entryIndex,
        vehicle.fuel_type as FuelType
      );

      if (mileageResult) {
        // 3. Persist mileage to the entry
        fuelRepo.updateFuelEntryMileage(entry.id, mileageResult.value, mileageResult.unit);
        entry.calculated_mileage = mileageResult.value;
        entry.mileage_unit = mileageResult.unit;

        // 4. Check reasonableness
        warning = checkMileageReasonableness(
          mileageResult.value,
          vehicle.vehicle_type as VehicleType,
          input.fuel_unit as FuelUnit
        );
      }
    }

    // 5. Update vehicle's current_odometer
    vehicleRepo.updateVehicleOdometer(vehicle.id, input.odometer);

    // 6. Refresh state
    const entries = fuelRepo.getFuelEntriesByVehicle(vehicle.id);
    const stats = computeMileageStats(entries);
    set({ entries, stats });

    return { entry, warning };
  },

  deleteFuelEntry: (entryId: string, vehicle: Vehicle) => {
    // 1. Soft delete the entry
    fuelRepo.softDeleteFuelEntry(entryId);

    // 2. Recalculate all mileage (deletion may affect downstream calculations)
    const chronological = fuelRepo.getFuelEntriesByVehicleChronological(vehicle.id);
    const recalculated = recalculateAllMileage(chronological, vehicle.fuel_type as FuelType);

    for (const { entryId: id, mileage } of recalculated) {
      fuelRepo.updateFuelEntryMileage(
        id,
        mileage?.value ?? null,
        mileage?.unit ?? null
      );
    }

    // 3. Refresh state
    const entries = fuelRepo.getFuelEntriesByVehicle(vehicle.id);
    const stats = computeMileageStats(entries);
    set({ entries, stats });
  },
}));
