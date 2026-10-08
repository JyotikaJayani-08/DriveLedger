/**
 * CSV Export
 *
 * Builds a single chronological ledger CSV (fuel + service + expenses)
 * that opens cleanly in Excel / Google Sheets. Pure functions — no I/O.
 *
 * Columns: Date, Vehicle, Type, Category, Details, Odometer, Quantity, Unit, Amount
 */

import type { BackupData } from '@/engine/backupEngine';

type LedgerData = BackupData['data'];

const HEADERS = [
  'Date', 'Vehicle', 'Type', 'Category', 'Details',
  'Odometer', 'Quantity', 'Unit', 'Amount',
] as const;

type Cell = string | number | null | undefined;

/**
 * Escapes a single CSV cell (RFC 4180): wraps in quotes when it contains
 * a comma, quote, or newline, and doubles any embedded quotes.
 * Also neutralises spreadsheet formula injection (=, +, -, @ prefixes).
 */
export function escapeCsvCell(value: Cell): string {
  if (value === null || value === undefined) return '';
  let text = String(value);
  if (typeof value === 'string' && /^[=+\-@]/.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** Joins cells into one CSV line. */
export function toCsvLine(cells: Cell[]): string {
  return cells.map(escapeCsvCell).join(',');
}

/**
 * Builds the ledger CSV from backup data, skipping soft-deleted rows.
 * Rows are sorted oldest → newest.
 */
export function buildLedgerCsv(data: LedgerData): string {
  const vehicleName = new Map(data.vehicles.map((v) => [v.id, v.nickname]));
  const nameOf = (id: string) => vehicleName.get(id) ?? '';

  const rows: { date: string; cells: Cell[] }[] = [];

  for (const f of data.fuel_entries) {
    if (f.deleted_at) continue;
    rows.push({
      date: f.date,
      cells: [
        f.date, nameOf(f.vehicle_id), 'Fuel', f.fuel_station ?? '', f.notes ?? '',
        f.odometer, f.fuel_amount, f.fuel_unit, f.total_cost,
      ],
    });
  }

  for (const s of data.service_records) {
    if (s.deleted_at) continue;
    rows.push({
      date: s.date,
      cells: [
        s.date, nameOf(s.vehicle_id), 'Service', s.service_type,
        [s.work_done, s.garage_name].filter(Boolean).join(' @ '),
        s.odometer, '', '', s.cost,
      ],
    });
  }

  for (const e of data.expenses) {
    if (e.deleted_at) continue;
    rows.push({
      date: e.date,
      cells: [e.date, nameOf(e.vehicle_id), 'Expense', e.category, e.description ?? '', '', '', '', e.amount],
    });
  }

  rows.sort((a, b) => a.date.localeCompare(b.date));

  return [toCsvLine([...HEADERS]), ...rows.map((r) => toCsvLine(r.cells))].join('\r\n');
}
