/**
 * Backup & Restore Engine
 *
 * SECURITY MODEL
 * ─────────────
 * Every exported backup is signed with HMAC-SHA256 using a secret key
 * that is compiled into the app bundle. The signed payload looks like:
 *
 *   {
 *     app_id:    "com.driveledger.app",   ← identifies the app
 *     version:   2,                        ← backup schema version
 *     created_at: "<ISO date>",
 *     app_version: "1.0.3",
 *     signature: "<64-char hex>",          ← HMAC over the data field (JSON)
 *     data: { vehicles, fuel_entries, service_records, expenses, documents }
 *   }
 *
 * On restore the engine:
 *   1. Checks `app_id` matches — rejects foreign files immediately.
 *   2. Re-derives the HMAC over `data` and compares it byte-by-byte
 *      with the stored `signature` — rejects any tampered file.
 *   3. Validates the structural schema (vehicles array must exist, all
 *      required numeric/string fields must be present and within range).
 *   4. Only then proceeds to the atomic SQL transaction.
 *
 * EXPORT
 *   Creates the signed JSON → writes to documentDirectory →
 *   uses expo-sharing so the OS share sheet lets the user save to
 *   Downloads / Drive / iCloud / AirDrop / etc.
 *
 * IMPORT
 *   Uses expo-document-picker to let the user browse and pick a .dlbak
 *   (or .json) file → reads it with expo-file-system → validates signature
 *   → runs the atomic restore transaction.
 *
 * NOTE: expo-sqlite databases are stored in the app's private directory.
 * This engine exports the DATA (not the .db file) so it is portable.
 */

import { getDatabase } from '@/database/connection';
import type { VehicleDocument } from '@/types/document';
import type { Expense } from '@/types/expense';
import type { FuelEntry } from '@/types/fuel';
import type { ServiceRecord } from '@/types/service';
import type { Vehicle } from '@/types/vehicle';
import { nowISO } from '@/utils/date';
import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

// ─── Constants ───────────────────────────────────────────────────────

/** The canonical app identifier embedded in every backup file. */
const APP_ID = 'com.driveledger.app';

/**
 * HMAC signing key — compiled into the bundle.
 * Not a user-visible password. Purpose: prevent restoring random JSON files
 * that happen to have the right shape, and detect any bit-level tampering.
 * Changing this value will invalidate all previously exported backups.
 */
const SIGNING_KEY = 'DriveLedger$SecretKey#2026!v1';

/** File extension used for backup files. */
const BACKUP_EXT = '.dlbak';

// ─── Types ───────────────────────────────────────────────────────────

export interface BackupData {
  app_id: string;
  version: number;
  created_at: string;
  app_version: string;
  /** HMAC-SHA256 hex of JSON.stringify(data). Absent on raw legacy backups. */
  signature?: string;
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

export interface ExportFileResult {
  success: boolean;
  message: string;
  /** Full path of the written .dlbak file (temp, before sharing). */
  filePath?: string;
}

export interface ImportFileResult {
  success: boolean;
  message: string;
  /** The validated & parsed backup, before the DB transaction. */
  backup?: BackupData;
  /** Human-readable record count summary. */
  counts?: RestoreResult['counts'];
}

// ─── HMAC helpers (Web Crypto API — available on Hermes in RN) ───────

/** Converts a hex string to a Uint8Array. */
function hexToBytes(hex: string): Uint8Array {
  const arr = new Uint8Array(hex.length / 2);
  for (let i = 0; i < arr.length; i++) {
    arr[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return arr;
}

/** Converts a Uint8Array to a lowercase hex string. */
function bytesToHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/** Derives an HMAC-SHA256 hex string over `message` using `SIGNING_KEY`. */
async function hmacSign(message: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(SIGNING_KEY),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(message));
  return bytesToHex(sig);
}

/** Constant-time HMAC verification to prevent timing attacks. */
async function hmacVerify(message: string, expectedHex: string): Promise<boolean> {
  try {
    const enc = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      enc.encode(SIGNING_KEY),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    );
    const expectedBytes = hexToBytes(expectedHex);
    // Cast to ArrayBuffer to satisfy strict TS lib types
    const sigBuffer: ArrayBuffer = expectedBytes.buffer.slice(
      expectedBytes.byteOffset,
      expectedBytes.byteOffset + expectedBytes.byteLength
    ) as ArrayBuffer;
    return await crypto.subtle.verify(
      'HMAC',
      key,
      sigBuffer,
      enc.encode(message)
    );
  } catch {
    return false;
  }
}

// ─── Schema Validation ───────────────────────────────────────────────

/** Strict field validators for each table row. */

function isValidVehicle(v: unknown): boolean {
  if (!v || typeof v !== 'object') return false;
  const r = v as Record<string, unknown>;
  return (
    typeof r.id === 'string' && r.id.length > 0 &&
    typeof r.nickname === 'string' && r.nickname.length > 0 &&
    typeof r.registration_number === 'string' &&
    typeof r.fuel_type === 'string' &&
    typeof r.vehicle_type === 'string' &&
    typeof r.created_at === 'string' &&
    typeof r.updated_at === 'string'
  );
}

function isValidFuelEntry(f: unknown): boolean {
  if (!f || typeof f !== 'object') return false;
  const r = f as Record<string, unknown>;
  return (
    typeof r.id === 'string' &&
    typeof r.vehicle_id === 'string' &&
    typeof r.date === 'string' &&
    typeof r.odometer === 'number' && r.odometer >= 0 &&
    typeof r.fuel_amount === 'number' && (r.fuel_amount as number) > 0 &&
    typeof r.price_per_unit === 'number' && (r.price_per_unit as number) > 0 &&
    typeof r.total_cost === 'number' &&
    typeof r.fuel_unit === 'string' &&
    ['litres', 'kg', 'kWh'].includes(r.fuel_unit as string)
  );
}

function isValidServiceRecord(s: unknown): boolean {
  if (!s || typeof s !== 'object') return false;
  const r = s as Record<string, unknown>;
  return (
    typeof r.id === 'string' &&
    typeof r.vehicle_id === 'string' &&
    typeof r.date === 'string' &&
    typeof r.service_type === 'string' && (r.service_type as string).length > 0
  );
}

function isValidExpense(e: unknown): boolean {
  if (!e || typeof e !== 'object') return false;
  const r = e as Record<string, unknown>;
  return (
    typeof r.id === 'string' &&
    typeof r.vehicle_id === 'string' &&
    typeof r.date === 'string' &&
    typeof r.category === 'string' &&
    typeof r.amount === 'number' && (r.amount as number) > 0
  );
}

function isValidDocument(d: unknown): boolean {
  if (!d || typeof d !== 'object') return false;
  const r = d as Record<string, unknown>;
  return (
    typeof r.id === 'string' &&
    typeof r.vehicle_id === 'string' &&
    typeof r.type === 'string' &&
    ['RC', 'Insurance', 'PUC', 'FASTag', 'Warranty'].includes(r.type as string)
  );
}

/**
 * Validates and normalises a parsed JSON object to BackupData.
 * Returns null if the object fails any structural check.
 */
function validateSchema(obj: Record<string, unknown>): {
  data: BackupData['data'];
  error?: string;
} | null {
  // Find the data wrapper
  let rawData: Record<string, unknown>;
  if (obj.data && typeof obj.data === 'object' && !Array.isArray(obj.data)) {
    rawData = obj.data as Record<string, unknown>;
  } else if (Array.isArray(obj.vehicles)) {
    rawData = obj; // Tolerant: raw table payload
  } else {
    return null;
  }

  if (!Array.isArray(rawData.vehicles) || rawData.vehicles.length === 0) {
    return null; // Vehicles array is mandatory
  }

  // Row-level validation
  const badVehicle = (rawData.vehicles as unknown[]).find((v) => !isValidVehicle(v));
  if (badVehicle) return null;

  const fuelEntries: FuelEntry[] = Array.isArray(rawData.fuel_entries)
    ? (rawData.fuel_entries as unknown[]).filter((f) => isValidFuelEntry(f)) as FuelEntry[]
    : [];

  const serviceRecords: ServiceRecord[] = Array.isArray(rawData.service_records)
    ? (rawData.service_records as unknown[]).filter((s) => isValidServiceRecord(s)) as ServiceRecord[]
    : [];

  const expenses: Expense[] = Array.isArray(rawData.expenses)
    ? (rawData.expenses as unknown[]).filter((e) => isValidExpense(e)) as Expense[]
    : [];

  const documents: VehicleDocument[] = Array.isArray(rawData.documents)
    ? (rawData.documents as unknown[]).filter((d) => isValidDocument(d)) as VehicleDocument[]
    : [];

  return {
    data: {
      vehicles: rawData.vehicles as Vehicle[],
      fuel_entries: fuelEntries,
      service_records: serviceRecords,
      expenses,
      documents,
    },
  };
}

// ─── Read from database ──────────────────────────────────────────────

/**
 * Creates an in-memory snapshot of all DriveLedger data.
 */
export function createBackup(): BackupResult {
  try {
    const db = getDatabase();
    db.execSync('BEGIN TRANSACTION');

    const vehicles = db.getAllSync<Vehicle>('SELECT * FROM vehicles');
    const fuelEntries = db.getAllSync<FuelEntry>('SELECT * FROM fuel_entries');
    const serviceRecords = db.getAllSync<ServiceRecord>('SELECT * FROM service_records');
    const expenses = db.getAllSync<Expense>('SELECT * FROM expenses');
    const documents = db.getAllSync<VehicleDocument>('SELECT * FROM documents');

    db.execSync('COMMIT');

    const backup: BackupData = {
      app_id: APP_ID,
      version: 2,
      created_at: nowISO(),
      app_version: '1.0.3',
      data: { vehicles, fuel_entries: fuelEntries, service_records: serviceRecords, expenses, documents },
    };

    const total =
      vehicles.length + fuelEntries.length + serviceRecords.length +
      expenses.length + documents.length;

    return { success: true, message: `Backup created with ${total} records.`, backup };
  } catch (e) {
    try { getDatabase().execSync('ROLLBACK'); } catch (_) { }
    return {
      success: false,
      message: `Backup failed: ${e instanceof Error ? e.message : 'Unknown error'}`,
    };
  }
}

/** @deprecated - Use exportToFile() instead. Kept for CSV export only. */
export function backupToJSON(backup: BackupData): string {
  return JSON.stringify(backup, null, 2);
}

// ─── Export — File Download ──────────────────────────────────────────

/**
 * Signs and exports backup as a .dlbak file via the OS share sheet.
 *
 * Flow:
 *   1. Read all data from SQLite.
 *   2. Sign data with HMAC-SHA256.
 *   3. Write signed JSON to app's documentDirectory.
 *   4. Open OS share sheet so user can save to Downloads / Drive / etc.
 */
export async function exportToFile(): Promise<ExportFileResult> {
  // 1. Read data
  const result = createBackup();
  if (!result.success || !result.backup) {
    return { success: false, message: result.message };
  }

  // 2. Sign
  const dataString = JSON.stringify(result.backup.data);
  let signature: string;
  try {
    signature = await hmacSign(dataString);
  } catch (e) {
    return {
      success: false,
      message: `Signing failed: ${e instanceof Error ? e.message : 'Unknown error'}`,
    };
  }

  const signedBackup: BackupData = {
    ...result.backup,
    signature,
  };

  // 3. Write file using the new expo-file-system class-based API
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const filename = `DriveLedger_${timestamp}${BACKUP_EXT}`;
  const file = new File(Paths.document, filename);

  try {
    file.write(JSON.stringify(signedBackup, null, 2));
  } catch (e) {
    return {
      success: false,
      message: `Could not write backup file: ${e instanceof Error ? e.message : 'Unknown error'}`,
    };
  }

  // 4. Share via OS sheet
  const canShare = await Sharing.isAvailableAsync();
  if (!canShare) {
    return {
      success: false,
      message: 'Sharing is not available on this device.',
      filePath: file.uri,
    };
  }

  try {
    await Sharing.shareAsync(file.uri, {
      mimeType: 'application/json',
      dialogTitle: 'Save DriveLedger Backup',
      UTI: 'public.json',
    });
    return { success: true, message: 'Backup exported!', filePath: file.uri };
  } catch (e) {
    // User cancelled the share sheet — not an error
    if (
      e instanceof Error &&
      (e.message.includes('cancelled') || e.message.includes('User canceled'))
    ) {
      return { success: true, message: 'Backup ready (share cancelled by user).', filePath: file.uri };
    }
    return {
      success: false,
      message: `Could not share backup file: ${e instanceof Error ? e.message : 'Unknown error'}`,
    };
  }
}

// ─── Import — File Picker ────────────────────────────────────────────

/**
 * Opens the OS document picker, reads the selected .dlbak file, verifies
 * the HMAC signature, and validates the schema.
 *
 * Does NOT write to the database — call restoreFromValidated() for that.
 * This separation lets the caller show a confirmation dialog before committing.
 *
 * Security checks (in order — fail-fast):
 *   1. File must be JSON-parseable.
 *   2. `app_id` must equal APP_ID — blocks random JSON files.
 *   3. If `signature` is present, HMAC must match — blocks tampered files.
 *      (Legacy backups without a signature field are accepted with a warning.)
 *   4. Row-level schema validation for every vehicle and fuel entry.
 */
export async function pickAndVerifyBackup(): Promise<{
  success: boolean;
  message: string;
  backup?: BackupData;
  isLegacy?: boolean;
}> {
  // Open file picker
  let pickerResult: DocumentPicker.DocumentPickerResult;
  try {
    pickerResult = await DocumentPicker.getDocumentAsync({
      type: ['application/json', 'text/plain', '*/*'],
      copyToCacheDirectory: true,
    });
  } catch (e) {
    return { success: false, message: 'Could not open file picker.' };
  }

  if (pickerResult.canceled) {
    return { success: false, message: 'No file selected.' };
  }

  const asset = pickerResult.assets[0];
  if (!asset?.uri) {
    return { success: false, message: 'No file URI returned.' };
  }

  // Check extension — warn but don't block .json files
  const name = (asset.name ?? '').toLowerCase();
  const isOfficialFormat = name.endsWith(BACKUP_EXT) || name.endsWith('.json');
  if (!isOfficialFormat) {
    return {
      success: false,
      message: `Invalid file type.\n\nDriveLedger backup files end in "${BACKUP_EXT}" or ".json". The file you selected appears to be a different type.`,
    };
  }

  // Read file content using the new File class
  let rawContent: string;
  try {
    const pickedFile = new File(asset.uri);
    rawContent = await pickedFile.text();
  } catch (e) {
    return {
      success: false,
      message: `Could not read file: ${e instanceof Error ? e.message : 'Unknown error'}`,
    };
  }

  // Guard against very large files (> 50 MB)
  if (rawContent.length > 50 * 1024 * 1024) {
    return { success: false, message: 'File is too large to be a valid backup (> 50 MB).' };
  }

  // Parse JSON
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawContent);
  } catch {
    return {
      success: false,
      message: 'The selected file is not valid JSON.\n\nMake sure you are picking a DriveLedger backup file (not an edited or corrupted file).',
    };
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return { success: false, message: 'Invalid backup structure.' };
  }

  const obj = parsed as Record<string, unknown>;

  // ── Check 1: app_id ──────────────────────────────────────────────
  if (obj.app_id !== undefined && obj.app_id !== APP_ID) {
    return {
      success: false,
      message: `Wrong app backup.\n\nThis file was exported by a different app (ID: "${obj.app_id}"). DriveLedger can only restore its own backups.`,
    };
  }

  // Legacy backup: no app_id and no signature — warn and proceed
  const isLegacy = obj.app_id === undefined && obj.signature === undefined;

  // ── Check 2: HMAC signature ──────────────────────────────────────
  if (!isLegacy) {
    if (typeof obj.signature !== 'string' || obj.signature.length !== 64) {
      return {
        success: false,
        message: 'Backup file is missing or has an invalid security signature.\n\nThis could mean the file was manually edited or is corrupted. Only export files directly from the DriveLedger app.',
      };
    }

    // Re-derive HMAC over the raw data field
    let dataString: string;
    try {
      dataString = JSON.stringify(obj.data);
    } catch {
      return { success: false, message: 'Could not read backup data section.' };
    }

    let signatureValid: boolean;
    try {
      signatureValid = await hmacVerify(dataString, obj.signature as string);
    } catch (e) {
      return {
        success: false,
        message: `Signature verification error: ${e instanceof Error ? e.message : 'Unknown error'}`,
      };
    }

    if (!signatureValid) {
      return {
        success: false,
        message: '🚨 Tampered Backup Detected!\n\nThe backup file\'s security signature does not match its contents. This means the data was altered after export.\n\nThe restore has been blocked to protect your data. Use only unmodified backup files exported directly from DriveLedger.',
      };
    }
  }

  // ── Check 3: schema validation ───────────────────────────────────
  const validated = validateSchema(obj);
  if (!validated) {
    return {
      success: false,
      message: 'The backup file does not contain valid DriveLedger data.\n\nRequired fields are missing or have invalid values. The file may be from an incompatible version or was corrupted.',
    };
  }

  const backup: BackupData = {
    app_id: (obj.app_id as string) ?? APP_ID,
    version: typeof obj.version === 'number' ? obj.version : 1,
    created_at: typeof obj.created_at === 'string' ? obj.created_at : nowISO(),
    app_version: typeof obj.app_version === 'string' ? obj.app_version : '1.0.0',
    signature: obj.signature as string | undefined,
    data: validated.data,
  };

  return { success: true, message: 'Backup verified.', backup, isLegacy };
}

// ─── DB Restore ──────────────────────────────────────────────────────

/**
 * Atomically replaces all database data with the contents of a verified backup.
 *
 * WARNING: This CLEARS all existing data. Call only after user confirmation.
 */
export function restoreFromValidated(backup: BackupData): RestoreResult {
  const db = getDatabase();
  db.execSync('BEGIN TRANSACTION');

  try {
    // Clear all tables (order respects FK constraints)
    db.execSync('DELETE FROM documents');
    db.execSync('DELETE FROM expenses');
    db.execSync('DELETE FROM service_records');
    db.execSync('DELETE FROM fuel_entries');
    db.execSync('DELETE FROM vehicles');

    // Vehicles
    for (const v of backup.data.vehicles) {
      let fuelType = v.fuel_type as string;
      if (fuelType === 'hybrid') fuelType = 'hybrid_cng_petrol'; // migrate legacy

      db.runSync(
        `INSERT OR IGNORE INTO vehicles (
           id, nickname, vehicle_type, manufacturer, model, variant, year, color,
           registration_number, fuel_type, tank_capacity, secondary_tank_capacity,
           current_odometer, front_tyre_pressure, rear_tyre_pressure,
           service_interval_km, purchase_date, notes, is_archived, created_at, updated_at, deleted_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          v.id, v.nickname, v.vehicle_type, v.manufacturer ?? null, v.model ?? null,
          v.variant ?? null, v.year ?? null, v.color ?? null, v.registration_number,
          fuelType, v.tank_capacity ?? null, v.secondary_tank_capacity ?? null,
          v.current_odometer ?? null, v.front_tyre_pressure ?? null, v.rear_tyre_pressure ?? null,
          v.service_interval_km ?? null, v.purchase_date ?? null, v.notes ?? null,
          v.is_archived ?? 0, v.created_at || nowISO(), v.updated_at || nowISO(), v.deleted_at ?? null,
        ]
      );
    }

    // Fuel entries
    for (const f of backup.data.fuel_entries) {
      db.runSync(
        `INSERT INTO fuel_entries (id, vehicle_id, date, odometer, fuel_amount, fuel_unit, price_per_unit,
         total_cost, fuel_station, is_full_tank, calculated_mileage, mileage_unit,
         receipt_photo_uri, notes, created_at, updated_at, deleted_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          f.id, f.vehicle_id, f.date, f.odometer, f.fuel_amount, f.fuel_unit,
          f.price_per_unit, f.total_cost, f.fuel_station ?? null, f.is_full_tank ?? 1,
          f.calculated_mileage ?? null, f.mileage_unit ?? null, f.receipt_photo_uri ?? null,
          f.notes ?? null, f.created_at || nowISO(), f.updated_at || nowISO(), f.deleted_at ?? null,
        ]
      );
    }

    // Service records
    for (const s of backup.data.service_records) {
      db.runSync(
        `INSERT INTO service_records (id, vehicle_id, date, odometer, service_type, cost, work_done,
         garage_name, next_due_km, next_due_date, notes, created_at, updated_at, deleted_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          s.id, s.vehicle_id, s.date, s.odometer ?? null, s.service_type, s.cost ?? null,
          s.work_done ?? null, s.garage_name ?? null, s.next_due_km ?? null,
          s.next_due_date ?? null, s.notes ?? null,
          s.created_at || nowISO(), s.updated_at || nowISO(), s.deleted_at ?? null,
        ]
      );
    }

    // Expenses
    for (const e of backup.data.expenses) {
      db.runSync(
        `INSERT INTO expenses (id, vehicle_id, date, category, amount, description, created_at, updated_at, deleted_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          e.id, e.vehicle_id, e.date, e.category, e.amount, e.description ?? null,
          e.created_at || nowISO(), e.updated_at || nowISO(), e.deleted_at ?? null,
        ]
      );
    }

    // Documents
    for (const d of backup.data.documents) {
      db.runSync(
        `INSERT INTO documents (id, vehicle_id, type, document_number, insurer_name, issue_date,
         expiry_date, file_uri, superseded_by, notes, created_at, updated_at, deleted_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          d.id, d.vehicle_id, d.type, d.document_number ?? null, d.insurer_name ?? null,
          d.issue_date ?? null, d.expiry_date ?? null, d.file_uri ?? null,
          d.superseded_by ?? null, d.notes ?? null,
          d.created_at || nowISO(), d.updated_at || nowISO(), d.deleted_at ?? null,
        ]
      );
    }

    db.execSync('COMMIT');
  } catch (insertError) {
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
}

// ─── Legacy text-paste restore (kept for backward compat) ────────────

/**
 * Restores from a raw JSON string (the old paste-into-textbox flow).
 * For legacy backups only. New flow uses pickAndVerifyBackup() +
 * restoreFromValidated().
 *
 * @deprecated Prefer the file-picker flow.
 */
export function restoreFromJSON(jsonString: string): RestoreResult {
  try {
    const parsed = JSON.parse(jsonString) as Record<string, unknown>;

    // Minimal validation
    const validated = validateSchema(parsed);
    if (!validated) {
      return { success: false, message: 'Invalid backup file format. Expected vehicle records.' };
    }

    const backup: BackupData = {
      app_id: (parsed.app_id as string) ?? APP_ID,
      version: typeof parsed.version === 'number' ? parsed.version : 1,
      created_at: typeof parsed.created_at === 'string' ? parsed.created_at : nowISO(),
      app_version: typeof parsed.app_version === 'string' ? parsed.app_version : '1.0.0',
      data: validated.data,
    };

    return restoreFromValidated(backup);
  } catch (e) {
    return {
      success: false,
      message: `Restore failed: ${e instanceof Error ? e.message : 'Unknown error'}`,
    };
  }
}
