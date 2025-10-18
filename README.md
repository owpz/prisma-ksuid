[![NPM Version](https://img.shields.io/npm/v/@owpz/prisma-ksuid)](https://www.npmjs.com/package/@owpz/prisma-ksuid)
[![TypeScript](https://img.shields.io/badge/TypeScript-Ready-blue.svg)](https://www.typescriptlang.org/)
[![Tests](https://github.com/owpz/prisma-ksuid/actions/workflows/test.yml/badge.svg)](https://github.com/owpz/prisma-ksuid/actions/workflows/test.yml)
[![Publish](https://github.com/owpz/prisma-ksuid/actions/workflows/publish.yml/badge.svg)](https://github.com/owpz/prisma-ksuid/actions/workflows/publish.yml)

# @owpz/prisma-ksuid

A production-ready Prisma Client extension for generating K-Sortable Unique IDs (KSUIDs) as primary keys in your database models. Built on [@owpz/ksuid](https://github.com/owpz/ksuid) for 100% Go compatibility and high performance.

## 📋 Project Links

- **[Contributing Guidelines](CONTRIBUTING.md)** - How to contribute, report issues, and submit pull requests
- **[Security Policy](SECURITY.md)** - How to report security vulnerabilities
- **[GitHub Issues](https://github.com/owpz/prisma-ksuid/issues)** - Report bugs or request features
- **[NPM Package](https://www.npmjs.com/package/@owpz/prisma-ksuid)** - Install the package

> **Important**:
>
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

const prisma = new PrismaClient().$extends(createKsuidExtension({ prefixMap }));
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

### With custom primary key fields

```typescript
// For models using different primary key field names
const prisma = new PrismaClient().$extends(
  createKsuidExtension({
    prefixMap: {
      User: "usr_",
      Session: "sess_",
    },
    primaryKeyField: (model) => {
      // Session model uses 'token' as primary key
      if (model === "Session") return "token";
      // Others use default 'id'
      return "id";
    },
  }),
);
```

### Working with upserts

```typescript
// The extension generates KSUIDs for the create portion of upserts
const user = await prisma.user.upsert({
  where: { email: "user@example.com" },
  update: { name: "Updated Name" },
  create: {
    email: "user@example.com",
    name: "New User",
    // ID will be generated with usr_ prefix
  },
});
```

### Using createManyAndReturn (Prisma 6+)

```typescript
// Create multiple records and get them back with generated IDs
const users = await prisma.user.createManyAndReturn({
  data: [
    { email: "user1@example.com", name: "User 1" },
    { email: "user2@example.com", name: "User 2" },
    // IDs will be generated with usr_ prefix
  ],
});

console.log(users);
// [
//   { id: 'usr_2KjMLq...', email: 'user1@example.com', ... },
//   { id: 'usr_2KjMLr...', email: 'user2@example.com', ... }
// ]
```

 

## Features

This extension supports all Prisma operations that create new records:

- **Basic creates**: `prisma.user.create()`
- **Nested creates**: Creating related records in a single operation
- **Batch creates**: `prisma.user.createMany()`
- **Batch creates with return**: `prisma.user.createManyAndReturn()` (Prisma 6+)
- **Upsert operations**: `prisma.user.upsert()` (generates ID for create portion)
- **Nested upserts**: Handles nested `upsert` in relations
- **Connect or create**: Nested `connectOrCreate` operations
- **Transaction support**: Works within `prisma.$transaction()`
- **Flexible prefixing**: Map-based or function-based prefix generation
- **Custom primary keys**: Support for non-`id` fields and composite keys
- **DMMF metadata**: Uses Prisma's metadata for accurate relation resolution
- **Type safety**: Full TypeScript support with proper typing

## Limitations

Due to Prisma extension constraints, this library **cannot** handle:

- **Raw queries**: `prisma.$executeRaw()` and `prisma.$queryRaw()` bypass extensions
- **Database-level operations**: Direct SQL INSERTs, stored procedures, or triggers
- **Schema-level defaults**: Cannot override `@default(cuid())` or `@default(uuid())` in schema
- **External inserts**: Records created outside of Prisma Client (e.g., database admin tools)
- **Retroactive ID generation**: Cannot generate KSUIDs for existing records

## API Reference

### `createKsuidExtension(options)`

Creates a Prisma Client extension that automatically generates KSUIDs for models during create operations.

#### Parameters

- `options` (object, required): Configuration object with the following properties:

| Property | Type | Required | Default | Description |
|----------|------|----------|---------|-------------|
| `prefixMap` | `Record<string, string>` | Yes | - | Object mapping model names to their prefix strings |
| `prefixFn` | `(model: string) => string` | No | `undefined` | Fallback function to generate prefixes for models not in prefixMap |
| `processNestedCreates` | `boolean` | No | `true` | Enable/disable processing of nested create operations |
| `primaryKeyField` | `string \| ((model: string) => string)` | No | `"id"` | Specify the primary key field name per model |

#### Returns

Returns a Prisma extension function compatible with `prisma.$extends()`.

#### Example Usage

```typescript
import { PrismaClient } from "@prisma/client";
import { createKsuidExtension } from "@owpz/prisma-ksuid";

const prisma = new PrismaClient().$extends(
  createKsuidExtension({
    prefixMap: {
      User: "usr_",
      Post: "post_",
      Comment: "cmt_"
    },
    prefixFn: (model) => model.slice(0, 3).toLowerCase() + "_",
    processNestedCreates: true,
    primaryKeyField: "id"
  })
);
```

### Supported Operations

The extension automatically generates KSUIDs for the following Prisma operations:

#### Basic Operations

- **`create`**: Creates a single record with generated KSUID
  ```typescript
  const user = await prisma.user.create({
    data: { email: "user@example.com", name: "John Doe" }
  });
  // Returns: { id: "usr_2KjMLq...", email: "...", name: "..." }
  ```

- **`createMany`**: Creates multiple records with generated KSUIDs
  ```typescript
  await prisma.user.createMany({
    data: [
      { email: "user1@example.com", name: "User 1" },
      { email: "user2@example.com", name: "User 2" }
    ]
  });
  ```

- **`createManyAndReturn`** (Prisma 6+): Creates multiple records and returns them
  ```typescript
  const users = await prisma.user.createManyAndReturn({
    data: [
      { email: "user1@example.com", name: "User 1" },
      { email: "user2@example.com", name: "User 2" }
    ]
  });
  // Returns array of created users with generated IDs
  ```

#### Advanced Operations

- **`upsert`**: Creates with KSUID if record doesn't exist
  ```typescript
  const user = await prisma.user.upsert({
    where: { email: "user@example.com" },
    update: { name: "Updated Name" },
    create: { email: "user@example.com", name: "New User" }
  });
  ```

- **Nested Creates**: Generates KSUIDs for related records
  ```typescript
  const user = await prisma.user.create({
    data: {
      email: "user@example.com",
      posts: {
        create: [
          { title: "First Post" },  // Gets post_ prefix
          { title: "Second Post" }   // Gets post_ prefix
        ]
      }
    }
  });
  ```

- **Connect or Create**: Generates KSUID for create portion
  ```typescript
  const post = await prisma.post.create({
    data: {
      title: "New Post",
      author: {
        connectOrCreate: {
          where: { email: "user@example.com" },
          create: { email: "user@example.com", name: "New User" }
        }
      }
    }
  });
  ```

### `generateKSUID(prefix?)` (Deprecated)

> Deprecated: Use [@owpz/ksuid](https://github.com/owpz/ksuid) directly instead.

Generates a K-Sortable Unique ID (KSUID).

#### Parameters

- `prefix` (string, optional): A string prefix to add to the generated KSUID. Default is an empty string.

#### Returns

Returns a string containing the generated KSUID with the optional prefix.

#### Migration Guide

```typescript
// Old way (deprecated)
import { generateKSUID } from "@owpz/prisma-ksuid";
const id = generateKSUID("usr_");

// New way (recommended)
import { KSUID } from "@owpz/ksuid";
const id = "usr_" + KSUID.random().toString();
```

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
