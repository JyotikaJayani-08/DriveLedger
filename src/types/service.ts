/**
 * Service Record Types
 *
 * TypeScript interface for the `service_records` table.
 * Matches the charter's database schema.
 */

// ─── Full Database Row ───────────────────────────────────────────────
export interface ServiceRecord {
  /** Primary key — UUID v4 */
  id: string;

  /** FK → vehicles.id */
  vehicle_id: string;

  /** Date the service was performed. ISO 8601 string. */
  date: string;

  /** Odometer reading at time of service (optional) */
  odometer: number | null;

  /**
   * Type of service performed.
   * Either from the predefined templates list or a custom free-text value.
   */
  service_type: string;

  /** Cost of the service (optional) */
  cost: number | null;

  /** Free-text description of what work was done (optional) */
  work_done: string | null;

  /** Name of the garage or service center (optional) */
  garage_name: string | null;

  /**
   * Next service due at this odometer reading.
   * Used with vehicle.current_odometer to compute km-until-next-service.
   */
  next_due_km: number | null;

  /** Next service due date. ISO 8601 string. (optional) */
  next_due_date: string | null;

  /** Free-text notes (optional) */
  notes: string | null;

  /** ISO 8601 timestamp */
  created_at: string;

  /** ISO 8601 timestamp */
  updated_at: string;

  /** ISO 8601 timestamp — soft delete marker. NULL = not deleted. */
  deleted_at: string | null;
}

// ─── Create Input ────────────────────────────────────────────────────
export interface CreateServiceRecordInput {
  vehicle_id: string;
  date: string;
  service_type: string;

  // Optional
  odometer?: number;
  cost?: number;
  work_done?: string;
  garage_name?: string;
  next_due_km?: number;
  next_due_date?: string;
  notes?: string;
}

// ─── Update Input ────────────────────────────────────────────────────
export type UpdateServiceRecordInput = Partial<
  Omit<ServiceRecord, 'id' | 'vehicle_id' | 'created_at' | 'updated_at' | 'deleted_at'>
>;
