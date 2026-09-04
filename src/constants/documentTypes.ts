/**
 * Document Types
 *
 * Vehicle document types for the documents table.
 * Matches the charter's document type list.
 *
 * NOTE: Driving License is intentionally excluded from v1.0.
 * A Driving License belongs to a person, not a vehicle.
 * If added in a future version, it belongs in a separate
 * `person_documents` table or a user profile.
 */

export enum DocumentType {
  RC = 'RC',
  INSURANCE = 'Insurance',
  PUC = 'PUC',
  FASTAG = 'FASTag',
  WARRANTY = 'Warranty',
}

/** Human-readable labels for UI display */
export const DOCUMENT_TYPE_LABELS: Record<DocumentType, string> = {
  [DocumentType.RC]: 'Registration Certificate (RC)',
  [DocumentType.INSURANCE]: 'Insurance',
  [DocumentType.PUC]: 'Pollution Under Control (PUC)',
  [DocumentType.FASTAG]: 'FASTag',
  [DocumentType.WARRANTY]: 'Warranty',
};

/** Array form for populating UI dropdowns */
export const DOCUMENT_TYPE_LIST = Object.values(DocumentType);

/** Emoji icons for each document type (used in UI chips and list items) */
export const DOCUMENT_TYPE_ICONS: Record<DocumentType, string> = {
  [DocumentType.RC]: '📋',
  [DocumentType.INSURANCE]: '🛡️',
  [DocumentType.PUC]: '💨',
  [DocumentType.FASTAG]: '🏷️',
  [DocumentType.WARRANTY]: '📄',
};
