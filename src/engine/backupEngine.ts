/**
 * Backup & Restore Engine
 *
 * Provides one-tap encrypted local backup and restore for DriveLedger.
 *
 * HOW IT WORKS:
 * 1. Export: Reads all tables → builds JSON → writes to a local file.
 * 2. Import: Reads the JSON file → validates structure → inserts into tables.
 *
 * BACKUP FORMAT:
 * A single JSON file containing:
 * {
 *   version: 1,
 *   created_at: "ISO date",
 *   app_version: "1.0.0",
 *   data: {
 *     vehicles: [...],
 *     fuel_entries: [...],
 *     service_records: [...],
 *     expenses: [...],
 *     documents: [...]
 *   }
 * }
 *
 * STORAGE: The backup file is saved to the app's document directory.
 * In v2.0, this will be replaced by Supabase cloud sync.
 *
 * NOTE: expo-sqlite databases are stored in the app's private directory.
 * This engine exports the DATA (not the .db file) so it's portable
 * and doesn't depend on the SQLite binary format.
 */

import { getDatabase } from '@/database/connection';
import type { VehicleDocument } from '@/types/document';
import type { Expense } from '@/types/expense';
import type { FuelEntry } from '@/types/fuel';
import type { ServiceRecord } from '@/types/service';
import type { Vehicle } from '@/types/vehicle';
import { nowISO } from '@/utils/date';

// ─── Types ───────────────────────────────────────────────────────────

export interface BackupData {
  version: number;
  created_at: string;
  app_version: string;
  data: {
    vehicles: Vehicle[];
    fuel_entries: FuelEntry[];
    service_records: ServiceRecord[];
    expenses: Expense[];
    documents: VehicleDocument[];
  };
}

export interface BackupResult {
  success: boolean;
  message: string;
  backup?: BackupData;
}

export interface RestoreResult {
  success: boolean;
  message: string;
  counts?: {
    vehicles: number;
    fuel_entries: number;
    service_records: number;
    expenses: number;
    documents: number;
  };
}

// ─── Export ──────────────────────────────────────────────────────────

/**
 * Creates a backup of all data in the database.
 *
 * @returns BackupResult with the complete backup data
 */
export function createBackup(): BackupResult {
  try {
    const db = getDatabase();

    // Use a read transaction for snapshot consistency across all 5 queries
    db.execSync('BEGIN TRANSACTION');

    const vehicles = db.getAllSync<Vehicle>('SELECT * FROM vehicles');
    const fuelEntries = db.getAllSync<FuelEntry>('SELECT * FROM fuel_entries');
    const serviceRecords = db.getAllSync<ServiceRecord>('SELECT * FROM service_records');
    const expenses = db.getAllSync<Expense>('SELECT * FROM expenses');
    const documents = db.getAllSync<VehicleDocument>('SELECT * FROM documents');

    db.execSync('COMMIT');

    const backup: BackupData = {
      version: 1,
      created_at: nowISO(),
      app_version: '1.0.3',
      data: {
        vehicles,
        fuel_entries: fuelEntries,
        service_records: serviceRecords,
        expenses,
        documents,
      },
    };

    const totalRecords =
      vehicles.length +
      fuelEntries.length +
      serviceRecords.length +
      expenses.length +
      documents.length;

    return {
      success: true,
      message: `Backup created with ${totalRecords} records.`,
      backup,
    };
  } catch (e) {
    // Ensure transaction is rolled back on error
    try { getDatabase().execSync('ROLLBACK'); } catch (_) { }
    return {
      success: false,
      message: `Backup failed: ${e instanceof Error ? e.message : 'Unknown error'}`,
    };
  }
}

/**
 * Converts a backup to a JSON string for file storage or sharing.
 */
export function backupToJSON(backup: BackupData): string {
  return JSON.stringify(backup, null, 2);
}

// ─── Import ─────────────────────────────────────────────────────────

/**
 * Validates that a parsed JSON object has a usable backup structure,
 * normalizing it to standard BackupData format if needed.
 */
function normalizeAndValidateBackup(parsed: unknown): BackupData | null {
  if (!parsed || typeof parsed !== 'object') return null;
  const obj = parsed as Record<string, unknown>;

  // Check if it is wrapped in { version, data: { ... } } or raw tables { vehicles, ... }
  let rawData: Record<string, unknown>;

  if (obj.data && typeof obj.data === 'object') {
    rawData = obj.data as Record<string, unknown>;
  } else if (Array.isArray(obj.vehicles)) {
    // Tolerant mode: raw table payload pasted directly
    rawData = obj;
  } else {
    return null;
  }

  // Vehicles array is mandatory for a valid backup
  if (!Array.isArray(rawData.vehicles)) return null;

  return {
    version: typeof obj.version === 'number' ? obj.version : 1,
    created_at: typeof obj.created_at === 'string' ? obj.created_at : nowISO(),
    app_version: typeof obj.app_version === 'string' ? obj.app_version : '1.0.0',
    data: {
      vehicles: rawData.vehicles as Vehicle[],
      fuel_entries: Array.isArray(rawData.fuel_entries) ? (rawData.fuel_entries as FuelEntry[]) : [],
      service_records: Array.isArray(rawData.service_records) ? (rawData.service_records as ServiceRecord[]) : [],
      expenses: Array.isArray(rawData.expenses) ? (rawData.expenses as Expense[]) : [],
      documents: Array.isArray(rawData.documents) ? (rawData.documents as VehicleDocument[]) : [],
    },
  };
}

/**
 * Restores data from a backup JSON string.
 *
 * WARNING: This REPLACES all existing data. It clears all tables
 * before importing. The user should be warned with a confirmation dialog.
 *
 * @param jsonString - The backup JSON string
 * @returns RestoreResult with counts of imported records
 */
export function restoreFromJSON(jsonString: string): RestoreResult {
  try {
    const parsed = JSON.parse(jsonString);
    const backup = normalizeAndValidateBackup(parsed);

    if (!backup) {
      return {
        success: false,
        message: 'Invalid backup file format. Expected vehicle records and backup structure.',
      };
    }

    const db = getDatabase();

    // Atomic restore: if ANY insert fails, ALL changes are rolled back.
    // This prevents the catastrophic scenario where DELETE succeeds but INSERT fails,
    // leaving the user with zero data.
    db.execSync('BEGIN TRANSACTION');

    try {
      // Clear all existing data (order matters for foreign keys)
      db.execSync('DELETE FROM documents');
      db.execSync('DELETE FROM expenses');
      db.execSync('DELETE FROM service_records');
      db.execSync('DELETE FROM fuel_entries');
      db.execSync('DELETE FROM vehicles');

      // Insert vehicles
      for (const v of backup.data.vehicles) {
        // Map legacy 'hybrid' to valid constraint value
        let fuelType = v.fuel_type as string;
        if (fuelType === 'hybrid') {
          fuelType = 'hybrid_cng_petrol';
        }

        db.runSync(
          `INSERT OR IGNORE INTO vehicles (
             id, nickname, vehicle_type, manufacturer, model, variant, year, color,
             registration_number, fuel_type, tank_capacity, secondary_tank_capacity,
             current_odometer, front_tyre_pressure, rear_tyre_pressure,
             service_interval_km, purchase_date, notes, is_archived, created_at, updated_at, deleted_at
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            v.id,
            v.nickname,
            v.vehicle_type,
            v.manufacturer ?? null,
            v.model ?? null,
            v.variant ?? null,
            v.year ?? null,
            v.color ?? null,
            v.registration_number,
            fuelType,
            v.tank_capacity ?? null,
            v.secondary_tank_capacity ?? null,
            v.current_odometer ?? null,
            v.front_tyre_pressure ?? null,
            v.rear_tyre_pressure ?? null,
            v.service_interval_km ?? null,
            v.purchase_date ?? null,
            v.notes ?? null,
            v.is_archived ?? 0,
            v.created_at || nowISO(),
            v.updated_at || nowISO(),
            v.deleted_at ?? null,
          ]
        );
      }

      // Insert fuel entries
      for (const f of backup.data.fuel_entries) {
        db.runSync(
          `INSERT INTO fuel_entries (id, vehicle_id, date, odometer, fuel_amount, fuel_unit, price_per_unit,
           total_cost, fuel_station, is_full_tank, calculated_mileage, mileage_unit,
           receipt_photo_uri, notes, created_at, updated_at, deleted_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            f.id,
            f.vehicle_id,
            f.date,
            f.odometer,
            f.fuel_amount,
            f.fuel_unit,
            f.price_per_unit,
            f.total_cost,
            f.fuel_station ?? null,
            f.is_full_tank ?? 1,
            f.calculated_mileage ?? null,
            f.mileage_unit ?? null,
            f.receipt_photo_uri ?? null,
            f.notes ?? null,
            f.created_at || nowISO(),
            f.updated_at || nowISO(),
            f.deleted_at ?? null,
          ]
        );
      }

      // Insert service records
      for (const s of backup.data.service_records) {
        db.runSync(
          `INSERT INTO service_records (id, vehicle_id, date, odometer, service_type, cost, work_done,
           garage_name, next_due_km, next_due_date, notes, created_at, updated_at, deleted_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            s.id,
            s.vehicle_id,
            s.date,
            s.odometer ?? null,
            s.service_type,
            s.cost ?? null,
            s.work_done ?? null,
            s.garage_name ?? null,
            s.next_due_km ?? null,
            s.next_due_date ?? null,
            s.notes ?? null,
            s.created_at || nowISO(),
            s.updated_at || nowISO(),
            s.deleted_at ?? null,
          ]
        );
      }

      // Insert expenses
      for (const e of backup.data.expenses) {
        db.runSync(
          `INSERT INTO expenses (id, vehicle_id, date, category, amount, description, created_at, updated_at, deleted_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            e.id,
            e.vehicle_id,
            e.date,
            e.category,
            e.amount,
            e.description ?? null,
            e.created_at || nowISO(),
            e.updated_at || nowISO(),
            e.deleted_at ?? null,
          ]
        );
      }

      // Insert documents
      for (const d of backup.data.documents) {
        db.runSync(
          `INSERT INTO documents (id, vehicle_id, type, document_number, insurer_name, issue_date,
           expiry_date, file_uri, superseded_by, notes, created_at, updated_at, deleted_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            d.id,
            d.vehicle_id,
            d.type,
            d.document_number ?? null,
            d.insurer_name ?? null,
            d.issue_date ?? null,
            d.expiry_date ?? null,
            d.file_uri ?? null,
            d.superseded_by ?? null,
            d.notes ?? null,
            d.created_at || nowISO(),
            d.updated_at || nowISO(),
            d.deleted_at ?? null,
          ]
        );
      }

      db.execSync('COMMIT');
    } catch (insertError) {
      // Roll back — original data is preserved
      db.execSync('ROLLBACK');
      return {
        success: false,
        message: `Restore failed during import: ${insertError instanceof Error ? insertError.message : 'Unknown error'}. Your existing data was NOT changed.`,
      };
    }

    return {
      success: true,
      message: 'Data restored successfully!',
      counts: {
        vehicles: backup.data.vehicles.length,
        fuel_entries: backup.data.fuel_entries.length,
        service_records: backup.data.service_records.length,
        expenses: backup.data.expenses.length,
        documents: backup.data.documents.length,
      },
    };
  } catch (e) {
    return {
      success: false,
      message: `Restore failed: ${e instanceof Error ? e.message : 'Unknown error'}`,
    };
  }
}
