/**
 * KSUID (K-Sortable Unique Identifier) Generator
 *
 * This module provides a simple interface for generating KSUIDs using the @owpz/ksuid library.
 * It maintains compatibility with the previous interface while leveraging the more robust
 * implementation from the @owpz/ksuid package.
 *
 * KSUIDs are unique identifiers that embed timestamps, making them sortable by creation time.
 * They consist of a 4-byte timestamp component and a 16-byte random component,
 * encoded as a 27-character base62 string.
 *
 * Benefits:
 * - Time sortable: KSUIDs created later will sort lexicographically later
 * - Unique across distributed systems without coordination
 * - URL-safe encoding (base62)
 * - Compact representation (27 characters)
 *
 * Format: [optional prefix] + [27-character base62 encoded string]
 */
import { KSUID } from "@owpz/ksuid";

/**
 * Generates a K-Sortable Unique ID (KSUID) with an optional prefix.
 *
 * This function uses the @owpz/ksuid library internally while maintaining
 * the same external interface as the legacy implementation.
 *
 * @param prefix - Optional string prefix to prepend to the KSUID
 * @returns A string containing the optional prefix and the 27-character KSUID
 */
export const generateKSUID = (prefix = ""): string => {
  const ksuid = KSUID.random();
  return `${prefix}${ksuid.toString()}`;
};
