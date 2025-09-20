[![NPM Version](https://img.shields.io/npm/v/@owpz/prisma-ksuid)](https://www.npmjs.com/package/@owpz/prisma-ksuid)
[![TypeScript](https://img.shields.io/badge/TypeScript-Ready-blue.svg)](https://www.typescriptlang.org/)
[![Tests](https://github.com/owpz/prisma-ksuid/actions/workflows/test.yml/badge.svg)](https://github.com/owpz/prisma-ksuid/actions/workflows/test.yml)
[![Publish](https://github.com/owpz/prisma-ksuid/actions/workflows/publish.yml/badge.svg)](https://github.com/owpz/prisma-ksuid/actions/workflows/publish.yml)

# @owpz/prisma-ksuid

A production-ready Prisma Client extension for generating K-Sortable Unique IDs (KSUIDs) as primary keys in your database models. Built on [@owpz/ksuid](https://github.com/owpz/ksuid) for 100% Go compatibility and high performance.

> **Important**:
> - **Requires Prisma 4.16.0+** - This is when the extension API (`$extends`) was introduced
> - **For Prisma 6.14.0+** - The extension API is mandatory as middleware support (`$use`) was completely removed

## What is a KSUID?

KSUID is for K-Sortable Unique IDentifier. It is a kind of globally unique identifier similar to a [RFC 4122 UUID](https://en.wikipedia.org/wiki/Universally_unique_identifier), built from the ground-up to be "naturally" sorted by generation timestamp without any special type-aware logic.

**Key advantages over UUIDs:**

- **Time-sortable**: KSUIDs can be sorted chronologically, making them ideal for databases
- **Shorter**: More compact than UUIDs when encoded in base62 (27 vs 36 characters)
- **URL-friendly**: No special characters, making them safe for URLs and file names
- **Prefixable**: Can be prefixed with model-specific identifiers for better readability

For detailed KSUID documentation, see [@owpz/ksuid](https://github.com/owpz/ksuid).

## Quick Start

1. **Install the package:**

   ```bash
   npm install @owpz/prisma-ksuid
   ```

2. **Set up your Prisma schema** with string IDs:

   ```prisma
   model User {
     id        String   @id @default(dbgenerated()) @map("id")
     name      String
     email     String   @unique
     createdAt DateTime @default(now())
     updatedAt DateTime @updatedAt
   }
   ```

3. **Configure the extension:**

   ```typescript
   import { PrismaClient } from "@prisma/client";
   import { createKsuidExtension } from "@owpz/prisma-ksuid";

   const prisma = new PrismaClient().$extends(
     createKsuidExtension({
       prefixMap: { User: "usr_" },
     }),
   );
   ```

## Migration from Middleware

If you're upgrading from an older version that used `createKsuidMiddleware`:

### Before (Prisma < 6.14.0 with middleware)
```typescript
import { createKsuidMiddleware } from "@owpz/prisma-ksuid";

const prisma = new PrismaClient();
prisma.$use(createKsuidMiddleware({ prefixMap }));
```

### After (Prisma 4.16.0+ with extensions)
```typescript
import { createKsuidExtension } from "@owpz/prisma-ksuid";

const prisma = new PrismaClient().$extends(
  createKsuidExtension({ prefixMap })
);
```

> **Note**: `createKsuidMiddleware` is still exported for backward compatibility but will show a deprecation warning. It won't work with Prisma 6.14.0+ since `$use` has been removed.

## Advanced Usage

### Multiple models with prefixes

```typescript
import { PrismaClient } from "@prisma/client";
import { createKsuidExtension } from "@owpz/prisma-ksuid";

const prefixMap = {
  User: "usr_",
  PaymentIntent: "pi_",
  Customer: "cus_",
  Post: "post_",
  Comment: "cmt_",
};

const prisma = new PrismaClient().$extends(createKsuidExtension({ prefixMap }));

export default prisma;
```

### With fallback prefix function

```typescript
const prefixMap = {
  User: "usr_",
  Post: "post_",
};

const prefixFn = (model: string) => model.slice(0, 3).toLowerCase() + "_";

const prisma = new PrismaClient().$extends(
  createKsuidExtension({
    prefixMap,
    prefixFn, // Used for models not in prefixMap
  }),
);
```

### Using the KSUID generator directly

> **⚠️ DEPRECATED**: Direct usage of `generateKSUID` from this package is deprecated and will be removed in version v25.8 or greater. Use [@owpz/ksuid](https://github.com/owpz/ksuid) directly for standalone KSUID generation.

```typescript
// ❌ Deprecated - will be removed in future versions
import { generateKSUID } from "@owpz/prisma-ksuid";

// ✅ Recommended - use the core library instead
import { KSUID } from "@owpz/ksuid";

// Generate KSUIDs with the core library
const userId = "usr_" + KSUID.random().toString();
console.log(userId); // usr_1xGVYLMNZO2PfHqPnRlwu5NFNMB

const id = KSUID.random().toString();
console.log(id); // 1xGVYLMNZO2PfHqPnRlwu5NFNMB
```

## Features

This extension supports all Prisma operations that create new records:

- ✅ **Basic creates**: `prisma.user.create()`
- ✅ **Nested creates**: Creating related records in a single operation
- ✅ **Batch creates**: `prisma.user.createMany()`
- ✅ **Upsert operations**: `prisma.user.upsert()` (on create)
- ✅ **Connect or create**: Nested `connectOrCreate` operations
- ✅ **Transaction support**: Works within `prisma.$transaction()`
- ✅ **Flexible prefixing**: Map-based or function-based prefix generation
- ✅ **Type safety**: Full TypeScript support with proper typing

## Limitations

Due to Prisma extension constraints, this library **cannot** handle:

- ❌ **Raw queries**: `prisma.$executeRaw()` and `prisma.$queryRaw()` bypass extensions
- ❌ **Database-level operations**: Direct SQL INSERTs, stored procedures, or triggers
- ❌ **Schema-level defaults**: Cannot override `@default(cuid())` or `@default(uuid())` in schema
- ❌ **External inserts**: Records created outside of Prisma Client (e.g., database admin tools)
- ❌ **Retroactive ID generation**: Cannot generate KSUIDs for existing records

## API Reference

### `createKsuidExtension(options)`

Creates a Prisma Client extension that automatically generates KSUIDs for models during create operations.

#### Parameters

- `options`: Object with the following properties:
  - `prefixMap`: An object mapping model names to prefix strings
  - `prefixFn` (optional): A function that generates a prefix based on the model name, used as fallback when a model is not found in the prefixMap
  - `processNestedCreates` (optional): Boolean to enable/disable processing of nested create operations (default: true)

#### Returns

A Prisma extension function that can be used with `prisma.$extends()`.

### `generateKSUID(prefix?)` ⚠️ DEPRECATED

> **Deprecated**: Use [@owpz/ksuid](https://github.com/owpz/ksuid) directly instead.

Generates a K-Sortable Unique ID (KSUID).

#### Parameters

- `prefix` (optional): A string prefix to add to the generated KSUID. Default is an empty string.

#### Returns

A string containing the generated KSUID with the optional prefix.

## 🔌 Database Integration

This extension integrates seamlessly with Prisma's ecosystem:

### **Core Prisma Features**

- **Full TypeScript support** with proper type inference
- **Transaction support** for consistent ID generation
- **Migration compatible** with existing string primary keys
- **Works with all databases** Prisma supports (PostgreSQL, MySQL, SQLite, etc.)

## License

This package is released under the [MIT License](LICENSE).

Copyright (c) 2025 Apex Innovations, Inc.
