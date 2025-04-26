/**
 * KSUID (K-Sortable Unique Identifier) Generator
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
import * as crypto from "crypto";

/**
 * Custom epoch for KSUID timestamp (May 13, 2014).
 * Using a more recent epoch than Unix epoch (1970) allows the timestamp
 * to fit in fewer bytes while still covering a large range of future dates.
 */
const EPOCH = 1400000000; // May 13, 2014

/**
 * Base62 alphabet used for encoding.
 * Consists of digits 0-9, uppercase A-Z, and lowercase a-z (62 characters total).
 * This provides a URL-safe encoding with good character density.
 */
const BASE62_ALPHABET =
  "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

/**
 * Encodes a binary buffer into a base62 string.
 *
 * The algorithm converts the binary data to a big integer and then
 * repeatedly divides by 62, using the remainder to select characters
 * from the base62 alphabet.
 *
 * @param buffer - Binary buffer to encode (typically 20 bytes: 4-byte timestamp + 16-byte random data)
 * @returns A 27-character base62 encoded string
 */
const encodeBase62 = (buffer: Buffer): string => {
  // Convert buffer to a big integer (prefixed with 0x for hex interpretation)
  let num = BigInt("0x" + buffer.toString("hex"));
  let str = "";

  // Convert the number to base62 by repeatedly dividing by 62
  // and using the remainder to select characters from the alphabet
  while (num > 0) {
    str = BASE62_ALPHABET[Number(num % 62n)] + str; // Prepend each character (right-to-left encoding)
    num /= 62n; // Integer division by 62
  }

  // Ensure the result is always 27 characters by padding with leading zeros
  return str.padStart(27, "0");
};

/**
 * Generates a K-Sortable Unique ID (KSUID) with an optional prefix.
 *
 * The KSUID consists of:
 * 1. An optional string prefix (e.g., for model-specific IDs)
 * 2. A 4-byte timestamp (seconds since the custom epoch)
 * 3. 16 bytes of random data for uniqueness
 * All encoded as a 27-character base62 string
 *
 * @param prefix - Optional string prefix to prepend to the KSUID
 * @returns A string containing the optional prefix and the 27-character KSUID
 */
export const generateKSUID = (prefix = ""): string => {
  // Get current time in seconds and calculate offset from our custom epoch
  const now = Math.floor(Date.now() / 1000);
  const seconds = now - EPOCH;

  // Create a 4-byte buffer for the timestamp component
  const timeBuffer = Buffer.alloc(4);
  timeBuffer.writeUInt32BE(seconds); // Write timestamp in big-endian format

  // Generate 16 random bytes for the uniqueness component
  const randomBuffer = crypto.randomBytes(16);

  // Combine timestamp and random components into a single 20-byte buffer
  const ksuidBuffer = Buffer.concat([timeBuffer, randomBuffer]);

  // Encode the buffer to base62 and prepend the optional prefix
  return `${prefix}${encodeBase62(ksuidBuffer)}`;
};
