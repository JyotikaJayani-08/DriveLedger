/**
 * Database Schema — Table Definitions
 *
 * Contains all CREATE TABLE statements for DriveLedger's SQLite database.
 * Matches the charter's database design exactly.
 *
 * KEY DESIGN DECISIONS:
 * 1. All primary keys are UUID TEXT, not auto-increment INTEGER.
 *    → Prevents ID collisions when cloud sync arrives in v2.0.
 *
 * 2. All tables have `deleted_at` for soft delete.
 *    → Accidental deletions are recoverable.
 *    → Needed for proper sync conflict resolution in v2.0.
 *
 * 3. All timestamps are ISO 8601 TEXT strings.
 *    → SQLite has no native DATE type.
 *    → ISO 8601 strings sort correctly in alphabetical order.
 *    → Maps cleanly to PostgreSQL timestamps for v2.0 Supabase sync.
 *
 * 4. `vehicles.is_archived` is separate from `deleted_at`.
 *    → Archiving hides a vehicle without orphaning its history.
 *    → `deleted_at` on vehicles is reserved for v2.0 sync tombstoning.
 *
 * 5. `fuel_entries.total_cost` is stored (denormalized) for query speed.
 *    → Must be updated if fuel_amount or price_per_unit is edited.
 *
 * 6. `vehicles.current_odometer` is denormalized for performance.
 *    → Updated atomically with each fuel entry save.
 *
 * NOTE: Tyre pressure fields are included in the schema (as specified
 * in the charter) but are deferred to v1.5 — no UI or logic in v1.0.
 */

import type * as SQLite from 'expo-sqlite';

// ─── Table Creation ──────────────────────────────────────────────────

const CREATE_VEHICLES_TABLE = `
  CREATE TABLE IF NOT EXISTS vehicles (
    id                   TEXT PRIMARY KEY NOT NULL,
    nickname             TEXT NOT NULL,
    vehicle_type         TEXT NOT NULL CHECK (vehicle_type IN ('car', 'two_wheeler', 'three_wheeler', 'other')),
    manufacturer         TEXT,
    model                TEXT,
    variant              TEXT,
    year                 INTEGER,
    color                TEXT,
    registration_number  TEXT NOT NULL,
    fuel_type            TEXT NOT NULL CHECK (fuel_type IN (
                           'petrol', 'diesel', 'cng', 'lpg', 'electric',
                           'hybrid_cng_petrol', 'hybrid_cng_diesel',
                           'hybrid_lpg_petrol', 'hybrid_lpg_diesel'
                         )),
    tank_capacity        REAL,
    secondary_tank_capacity REAL,
    current_odometer     REAL,
    front_tyre_pressure  REAL,
    rear_tyre_pressure   REAL,
    service_interval_km  REAL,
    purchase_date        TEXT,
    notes                TEXT,
    is_archived          INTEGER NOT NULL DEFAULT 0 CHECK (is_archived IN (0, 1)),
    created_at           TEXT NOT NULL,
    updated_at           TEXT NOT NULL,
    deleted_at           TEXT
  );
`;

const CREATE_FUEL_ENTRIES_TABLE = `
  CREATE TABLE IF NOT EXISTS fuel_entries (
    id                   TEXT PRIMARY KEY NOT NULL,
    vehicle_id           TEXT NOT NULL REFERENCES vehicles(id),
    date                 TEXT NOT NULL,
    odometer             REAL NOT NULL,
    fuel_amount          REAL NOT NULL CHECK (fuel_amount > 0),
    fuel_unit            TEXT NOT NULL CHECK (fuel_unit IN ('litres', 'kg', 'kWh')),
    price_per_unit       REAL NOT NULL CHECK (price_per_unit > 0),
    total_cost           REAL NOT NULL,
    fuel_station         TEXT,
    is_full_tank         INTEGER NOT NULL DEFAULT 1 CHECK (is_full_tank IN (0, 1)),
    calculated_mileage   REAL,
    mileage_unit         TEXT CHECK (mileage_unit IN ('km_per_litre', 'km_per_kg', 'km_per_kwh')),
    receipt_photo_uri    TEXT,
    notes                TEXT,
    created_at           TEXT NOT NULL,
    updated_at           TEXT NOT NULL,
    deleted_at           TEXT
  );
`;

const CREATE_SERVICE_RECORDS_TABLE = `
  CREATE TABLE IF NOT EXISTS service_records (
    id                   TEXT PRIMARY KEY NOT NULL,
    vehicle_id           TEXT NOT NULL REFERENCES vehicles(id),
    date                 TEXT NOT NULL,
    odometer             REAL,
    service_type         TEXT NOT NULL,
    cost                 REAL,
    work_done            TEXT,
    garage_name          TEXT,
    next_due_km          REAL,
    next_due_date        TEXT,
    notes                TEXT,
    created_at           TEXT NOT NULL,
    updated_at           TEXT NOT NULL,
    deleted_at           TEXT
  );
`;

const CREATE_EXPENSES_TABLE = `
  CREATE TABLE IF NOT EXISTS expenses (
    id                   TEXT PRIMARY KEY NOT NULL,
    vehicle_id           TEXT NOT NULL REFERENCES vehicles(id),
    date                 TEXT NOT NULL,
    category             TEXT NOT NULL,
    amount               REAL NOT NULL CHECK (amount > 0),
    description          TEXT,
    created_at           TEXT NOT NULL,
    updated_at           TEXT NOT NULL,
    deleted_at           TEXT
  );
`;

const CREATE_DOCUMENTS_TABLE = `
  CREATE TABLE IF NOT EXISTS documents (
    id                   TEXT PRIMARY KEY NOT NULL,
    vehicle_id           TEXT NOT NULL REFERENCES vehicles(id),
    type                 TEXT NOT NULL CHECK (type IN ('RC', 'Insurance', 'PUC', 'FASTag', 'Warranty')),
    document_number      TEXT,
    insurer_name         TEXT,
    issue_date           TEXT,
    expiry_date          TEXT,
    file_uri             TEXT,
    superseded_by        TEXT REFERENCES documents(id),
    notes                TEXT,
    created_at           TEXT NOT NULL,
    updated_at           TEXT NOT NULL,
    deleted_at           TEXT
  );
`;

// ─── Indexes ─────────────────────────────────────────────────────────
/**
 * WHY indexes?
 * - fuel_entries are queried by vehicle_id + date constantly (dashboard, history).
 * - Without indexes, SQLite does a full table scan every time.
 * - These are the most common query patterns from the charter's UI flows.
 */

const CREATE_INDEXES = `
  CREATE INDEX IF NOT EXISTS idx_fuel_entries_vehicle_date
    ON fuel_entries(vehicle_id, date);

  CREATE INDEX IF NOT EXISTS idx_fuel_entries_vehicle_deleted
    ON fuel_entries(vehicle_id, deleted_at);

  CREATE INDEX IF NOT EXISTS idx_service_records_vehicle_date
    ON service_records(vehicle_id, date);

  CREATE INDEX IF NOT EXISTS idx_expenses_vehicle_date
    ON expenses(vehicle_id, date);

  CREATE INDEX IF NOT EXISTS idx_documents_vehicle_type
    ON documents(vehicle_id, type);

  CREATE INDEX IF NOT EXISTS idx_documents_expiry
    ON documents(expiry_date);
`;

// ─── Public API ──────────────────────────────────────────────────────

/**
 * Creates all tables and indexes if they don't already exist.
 * Called once during database initialization in connection.ts.
 *
 * @param db - The SQLite database instance
 */
export function createTables(db: SQLite.SQLiteDatabase): void {
  db.execSync(CREATE_VEHICLES_TABLE);
  db.execSync(CREATE_FUEL_ENTRIES_TABLE);
  db.execSync(CREATE_SERVICE_RECORDS_TABLE);
  db.execSync(CREATE_EXPENSES_TABLE);
  db.execSync(CREATE_DOCUMENTS_TABLE);
  db.execSync(CREATE_INDEXES);

  // ── Migrations ──────────────────────────────────────────────────
  // ADD COLUMN migrations are idempotent (SQLite ignores if column already exists
  // via try/catch). Each migration targets a specific schema version bump.

  // v1.1 — Dual-tank support for hybrid vehicles
  try {
    db.execSync(
      `ALTER TABLE vehicles ADD COLUMN secondary_tank_capacity REAL`
    );
  } catch {
    // Column already exists on fresh installs — safe to ignore
  }
}
