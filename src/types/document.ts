/**
 * Vehicle Document Types
 *
 * TypeScript interface for the `documents` table.
 * Matches the charter's database schema.
 *
 * KEY DESIGN DECISION: `superseded_by` enables insurance/PUC renewal chains.
 * When a document is renewed, the old record's `superseded_by` points to
 * the new record's `id`, preserving the full history chain.
 */

import { DocumentType } from '@/constants/documentTypes';

// ─── Full Database Row ───────────────────────────────────────────────
export interface VehicleDocument {
  /** Primary key — UUID v4 */
  id: string;

  /** FK → vehicles.id */
  vehicle_id: string;

  /**
   * Type of document.
   * RC | Insurance | PUC | FASTag | Warranty
   */
  type: DocumentType;

  /** Document/policy number (optional) */
  document_number: string | null;

  /** Provider / insurer / issuing authority name (optional) */
  insurer_name: string | null;

  /** Date the document was issued. ISO 8601 string. (optional) */
  issue_date: string | null;

  /** Date the document expires. ISO 8601 string. (optional) */
  expiry_date: string | null;

  /**
   * Local file path to a photo or scan of the actual document.
   * Fulfils User Story 4 — digital copy, don't carry physical.
   */
  file_uri: string | null;

  /**
   * FK → documents.id of the renewal record.
   * Enables insurance/PUC renewal chains without losing history.
   * NULL if this is the latest (or only) version.
   */
  superseded_by: string | null;

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
export interface CreateDocumentInput {
  vehicle_id: string;
  type: DocumentType;

  // Optional
  document_number?: string;
  insurer_name?: string;
  issue_date?: string;
  expiry_date?: string;
  file_uri?: string;
  superseded_by?: string;
  notes?: string;
}

// ─── Update Input ────────────────────────────────────────────────────
export type UpdateDocumentInput = Partial<
  Omit<VehicleDocument, 'id' | 'vehicle_id' | 'created_at' | 'updated_at' | 'deleted_at'>
>;
