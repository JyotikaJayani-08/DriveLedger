/**
 * Database Connection — Singleton
 *
 * Initializes and provides a single shared SQLite database instance
 * for the entire app.
 *
 * WHY a singleton?
 * - SQLite allows only one write connection at a time.
 * - Opening multiple connections causes locking issues.
 * - A single instance shared across all repositories avoids this.
 *
 * HOW expo-sqlite works (SDK 57):
 * - `openDatabaseSync()` opens or creates the database synchronously.
 * - The database file lives in the app's private directory on the device.
 * - It persists across app restarts but is deleted when the app is uninstalled.
 *
 * USAGE:
 * ```ts
 * import { getDatabase } from '@/database/connection';
 * const db = getDatabase();
 * ```
 */

import * as SQLite from 'expo-sqlite';
import { createTables } from './schema';

const DB_NAME = 'driveledger.db';

let _db: SQLite.SQLiteDatabase | null = null;

/**
 * Returns the singleton database instance.
 * On first call, it opens the database and creates all tables.
 *
 * @returns The shared SQLiteDatabase instance
 */
export function getDatabase(): SQLite.SQLiteDatabase {
  if (_db === null) {
    _db = SQLite.openDatabaseSync(DB_NAME);

    // Enable WAL mode for better concurrent read performance
    _db.execSync('PRAGMA journal_mode = WAL;');

    // Enable foreign key constraints (SQLite has them OFF by default)
    _db.execSync('PRAGMA foreign_keys = ON;');

    // Create all tables if they don't exist
    createTables(_db);
  }

  return _db;
}
