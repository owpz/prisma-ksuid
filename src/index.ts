/**
 * Prisma KSUID Middleware
 *
 * Provides a Prisma middleware for generating K-Sortable Unique IDs (KSUIDs)
 * for database records. KSUIDs are time-sortable, URL-safe unique identifiers
 * that can include custom prefixes for different models.
 *
 * @packageDocumentation
 */

/**
 * @deprecated Use createKsuidExtension instead. Prisma removed middleware support in v6.14.0.
 * This function now returns the extension for backward compatibility, but you must use it with
 * prisma.$extends() instead of prisma.$use().
 *
 * Migration guide:
 * ```typescript
 * // Old (no longer works with Prisma 6.14.0+):
 * prisma.$use(createKsuidMiddleware({ prefixMap }));
 *
 * // New (required for Prisma 6.14.0+):
 * const prisma = new PrismaClient().$extends(
 *   createKsuidExtension({ prefixMap })
 * );
 * ```
 */
import { createKsuidExtension } from "./prisma-extension";

let middlewareWarned = false;

export function createKsuidMiddleware(options: Parameters<typeof createKsuidExtension>[0]) {
  if (!middlewareWarned) {
    console.warn(
      "⚠️ createKsuidMiddleware is deprecated and will not work with Prisma 6.14.0+\n" +
      "Prisma removed middleware support ($use) in v6.14.0.\n" +
      "Please migrate to createKsuidExtension with $extends:\n\n" +
      "const prisma = new PrismaClient().$extends(\n" +
      "  createKsuidExtension({ prefixMap: { User: 'usr_' } })\n" +
      ");\n\n" +
      "See migration guide: https://github.com/owpz/prisma-ksuid#migration-from-middleware"
    );
    middlewareWarned = true;
  }

  // Return the extension for users who might try to use it with $extends
  return createKsuidExtension(options);
}

/**
 * Creates a Prisma Client extension that automatically generates KSUIDs for model IDs.
 * Required for Prisma 6.14.0+ where middleware was removed.
 *
 * The extension applies to `create` and `createMany` operations, generating
 * prefixed KSUIDs based on model names.
 *
 * **Enhanced Features**: This extension supports nested create operations by default.
 * Nested creates (like `user.create({ profile: { create: { ... } } })`) will also get KSUIDs.
 * To disable nested processing, set `processNestedCreates: false`.
 *
 * @example
 * ```typescript
 * // Basic usage with Prisma Client extensions
 * import { PrismaClient } from '@prisma/client';
 * import { createKsuidExtension } from '@owpz/prisma-ksuid';
 *
 * const prisma = new PrismaClient().$extends(
 *   createKsuidExtension({
 *     prefixMap: { User: 'usr_', Profile: 'prof_' }
 *   })
 * );
 *
 * // Both User and Profile get KSUIDs:
 * const user = await prisma.user.create({
 *   data: {
 *     email: 'user@example.com',
 *     profile: {
 *       create: { bio: 'Hello world' } // Gets prof_ prefix!
 *     }
 *   }
 * });
 * ```
 */
export { createKsuidExtension };

/**
 * Generates a K-Sortable Unique ID (KSUID) with an optional prefix.
 * KSUIDs are time-sortable, consisting of a timestamp component and random data,
 * encoded in base62.
 *
 * This library is fully supported and maintained, we are only deprecating one
 * export.
 *
 * @deprecated External use of `generateKSUID` is deprecated as of version > v25.8
 * and it will be removed in the next major version.
 * For external usage, please use
 * [`@owpz/ksuid`](https://github.com/owpz/ksuid) directly instead.
 *
 * ⚠️ This function will continue to be available internally until removal.
 *
 * @example
 * ```typescript
 * // Deprecated: For external codebases, use @owpz/ksuid instead.
 * const userId = generateKSUID('user_');  // user_0ujsswThIGTUYm2K8FjOOfXtY1K
 * const plainId = generateKSUID();        // 0ujsswThIGTUYm2K8FjOOfXtY1K
 * ```
 */
import { generateKSUID as internalGenerateKSUID } from "./util/ksuid";

let hasWarned = false;

export function generateKSUID(
  ...args: Parameters<typeof internalGenerateKSUID>
) {
  if (!hasWarned) {
    console.warn(
      "⚠️ `generateKSUID` is deprecated for external use (as of > v25.8) and will be removed in the next major version.\n" +
        "Please use `@owpz/ksuid` directly instead: https://github.com/owpz/ksuid",
    );
    hasWarned = true;
  }
  return internalGenerateKSUID(...args);
}
