/**
 * Prisma KSUID Middleware
 *
 * This package provides a Prisma middleware for generating K-Sortable Unique IDs (KSUIDs)
 * for database records. KSUIDs are time-sortable, URL-safe unique identifiers that can
 * include custom prefixes for different models.
 */

/**
 * Creates a Prisma middleware that automatically generates KSUIDs for model IDs.
 * The middleware applies to 'create' and 'createMany' operations, generating
 * prefixed KSUIDs based on model names.
 *
 * @example
 * ```typescript
 * const middleware = createKsuidMiddleware({
 *   prefixMap: { User: 'usr_', Product: 'prod_' }
 * });
 *
 * prisma.$use(middleware);
 * ```
 */
export { createKsuidMiddleware } from "./prisma-middleware";

/**
 * Generates a K-Sortable Unique ID (KSUID) with an optional prefix.
 * KSUIDs are time-sortable, consisting of a timestamp component and random data,
 * encoded in base62.
 *
 * @example
 * ```typescript
 * const userId = generateKSUID('user_');  // user_0ujsswThIGTUYm2K8FjOOfXtY1K
 * const plainId = generateKSUID();        // 0ujsswThIGTUYm2K8FjOOfXtY1K
 * ```
 */
export { generateKSUID } from "./util/ksuid";
