/**
 * Safe Update Builder
 *
 * Utility for building SQL UPDATE SET clauses from user input objects.
 * Only allows explicitly whitelisted column names, preventing SQL injection
 * through dynamic column names.
 *
 * WHY THIS EXISTS:
 * Our repo update functions dynamically build `SET col = ?` clauses from
 * `Object.entries(input)`. If input ever comes from untrusted JSON (e.g.,
 * a restored backup or a future API), an attacker could inject column names
 * like `id`, `deleted_at`, or even `id = ?; DROP TABLE`.
 *
 * This utility ensures only whitelisted column names are accepted.
 */

/**
 * Builds a safe SET clause from an input object, filtering keys against
 * an explicit whitelist.
 *
 * @param input - The update input object (key-value pairs)
 * @param allowedColumns - Set of column names that are allowed
 * @returns Object with fields (SET clause parts) and values (parameterized)
 *
 * @example
 * const { fields, values } = buildSafeUpdate(
 *   { name: 'foo', id: 'hack' },
 *   new Set(['name', 'date'])
 * );
 * // fields: ['name = ?'], values: ['foo']
 * // 'id' was silently skipped
 */
export function buildSafeUpdate(
  input: Record<string, unknown>,
  allowedColumns: Set<string>
): { fields: string[]; values: (string | number | null | Uint8Array)[] } {
  const fields: string[] = [];
  const values: (string | number | null | Uint8Array)[] = [];

  for (const [key, value] of Object.entries(input)) {
    if (!allowedColumns.has(key)) continue;
    fields.push(`${key} = ?`);
    values.push((value ?? null) as string | number | null | Uint8Array);
  }

  return { fields, values };
}

