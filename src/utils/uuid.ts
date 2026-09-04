/**
 * UUID Utility
 *
 * Generates UUID v4 identifiers using expo-crypto.
 *
 * WHY expo-crypto instead of the `uuid` npm package?
 * - expo-crypto hooks directly into the native OS cryptographic module.
 * - No polyfills needed (the `uuid` package requires `react-native-get-random-values`).
 * - Lighter bundle, fewer dependencies, fewer things that can break.
 *
 * WHY UUIDs at all?
 * - Auto-increment IDs (1, 2, 3...) would collide when syncing local → cloud in v2.0.
 * - UUIDs are globally unique — generated offline, safe to sync later, no remapping needed.
 */

import * as Crypto from 'expo-crypto';

/**
 * Generate a new UUID v4 string.
 *
 * @returns A UUID string like "550e8400-e29b-41d4-a716-446655440000"
 *
 * @example
 * const id = generateUUID();
 * // → "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
 */
export function generateUUID(): string {
  return Crypto.randomUUID();
}
