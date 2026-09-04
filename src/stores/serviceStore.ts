/**
 * Service Record Store (Zustand)
 *
 * Global state for service records.
 * Connects the UI layer to the serviceRepo.
 *
 * KEY FEATURES:
 * - CRUD operations for service records
 * - Computes "km until next service" from latest service's next_due_km
 *   and vehicle.current_odometer
 * - Provides latest service record for dashboard display
 */

import { create } from 'zustand';
import type { ServiceRecord, CreateServiceRecordInput, UpdateServiceRecordInput } from '@/types/service';
import type { Vehicle } from '@/types/vehicle';
import * as serviceRepo from '@/database/repositories/serviceRepo';

interface ServiceState {
  /** Service records for the currently selected vehicle */
  records: ServiceRecord[];
  /** Loading state */
  isLoading: boolean;

  // ── Actions ──
  /** Load service records for a vehicle */
  loadRecords: (vehicleId: string) => void;
  /** Create a new service record */
  addRecord: (input: CreateServiceRecordInput) => ServiceRecord;
  /** Update an existing service record */
  editRecord: (id: string, input: UpdateServiceRecordInput) => ServiceRecord | null;
  /** Delete a service record (soft delete) */
  deleteRecord: (id: string) => void;
}

export const useServiceStore = create<ServiceState>((set, get) => ({
  records: [],
  isLoading: true,

  loadRecords: (vehicleId: string) => {
    const records = serviceRepo.getServiceRecordsByVehicle(vehicleId);
    set({ records, isLoading: false });
  },

  addRecord: (input: CreateServiceRecordInput) => {
    const record = serviceRepo.createServiceRecord(input);
    const records = serviceRepo.getServiceRecordsByVehicle(input.vehicle_id);
    set({ records });
    return record;
  },

  editRecord: (id: string, input: UpdateServiceRecordInput) => {
    const updated = serviceRepo.updateServiceRecord(id, input);
    if (updated) {
      const records = serviceRepo.getServiceRecordsByVehicle(updated.vehicle_id);
      set({ records });
    }
    return updated;
  },

  deleteRecord: (id: string) => {
    // Get the record first so we know its vehicle_id for refresh
    const record = serviceRepo.getServiceRecordById(id);
    serviceRepo.softDeleteServiceRecord(id);
    if (record) {
      const records = serviceRepo.getServiceRecordsByVehicle(record.vehicle_id);
      set({ records });
    }
  },
}));

// ─── Computed Helpers (pure functions, no state) ────────────────────

/**
 * Computes km remaining until the next service is due.
 *
 * @param vehicle - The vehicle (needs current_odometer)
 * @param latestService - The most recent service record (needs next_due_km)
 * @returns km remaining, or null if not computable
 */
export function getKmUntilService(
  vehicle: Vehicle,
  latestService: ServiceRecord | null
): number | null {
  if (!latestService?.next_due_km || !vehicle.current_odometer) {
    return null;
  }
  return latestService.next_due_km - vehicle.current_odometer;
}
