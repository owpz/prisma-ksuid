[![Tests](https://github.com/owpz/prisma-ksuid/actions/workflows/test.yml/badge.svg)](https://github.com/owpz/prisma-ksuid/actions/workflows/test.yml) [![Publish](https://github.com/owpz/prisma-ksuid/actions/workflows/publish.yml/badge.svg)](https://github.com/owpz/prisma-ksuid/actions/workflows/publish.yml)

# prisma-ksuid

A Prisma middleware for generating K-Sortable Unique IDs (KSUIDs) for your database models.

KSUIDs are globally unique identifiers similar to UUIDs, but with additional advantages:

- **Time-sortable**: KSUIDs can be sorted chronologically, making them ideal for databases
- **Shorter**: More compact than UUIDs when encoded in base62
- **URL-friendly**: No special characters, making them safe for URLs and file names
- **Prefixable**: Can be prefixed with model-specific identifiers for better readability

## Example schema.prisma

```shell
model User {
  id        String   @id @default(dbgenerated()) @map("id") // The prisma-ksuid middleware will override this with a KSUID
  name      String
  email     String   @unique
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

model PaymentIntent {
  id        String   @id @default(dbgenerated()) @map("id") // The prisma-ksuid middleware will override this with a KSUID
  amount    Float
  currency  String
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

model Customer {
  id        String   @id @default(dbgenerated()) @map("id") // The prisma-ksuid middleware will override this with a KSUID
  name      String
  email     String   @unique
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
```

## Installation

```bash
# Using npm
npm install @owpz/prisma-ksuid

# Using yarn
yarn add @owpz/prisma-ksuid
```

## Usage

### Setting up the middleware with Prisma Client

```typescript
import { PrismaClient } from "@prisma/client";
import { createKsuidMiddleware } from "@owpz/prisma-ksuid";

// Define prefixes for your models
const prefixMap = {
  User: "usr_",
  Post: "post_",
  Comment: "cmt_",
  // Add more models as needed
};

// Create a Prisma client
const prisma = new PrismaClient();

// Apply the KSUID middleware
prisma.$use(
  createKsuidMiddleware({
    prefixMap,
  }) as Parameters<PrismaClient["$use"]>[0],
);

export default prisma;
```

### Configure with a prefix generator function

```typescript
import { PrismaClient } from "@prisma/client";
import { createKsuidMiddleware } from "@owpz/prisma-ksuid";

const prefixMap = {
  User: "usr_",
  Post: "post_",
};

// Define a fallback prefix generator function
const prefixFn = (model: string) => model.slice(0, 3).toLowerCase() + "_";

const prisma = new PrismaClient();

prisma.$use(
  createKsuidMiddleware({
    prefixMap,
    prefixFn, // Will be used for models not found in prefixMap
  }) as Parameters<PrismaClient["$use"]>[0],
);
```

### Using the KSUID generator directly

```typescript
import { generateKSUID } from "@owpz/prisma-ksuid";

// Generate a KSUID with a prefix
const userId = generateKSUID("usr_");
console.log(userId); // usr_1xGVYLMNZO2PfHqPnRlwu5NFNMB

// Generate a KSUID without a prefix
const id = generateKSUID();
console.log(id); // 1xGVYLMNZO2PfHqPnRlwu5NFNMB
```

## API Reference

### `createKsuidMiddleware(options)`

Creates a Prisma middleware that automatically generates KSUIDs for models during create operations.

#### Parameters

- `options`: Object with the following properties:
  - `prefixMap`: An object mapping model names to prefix strings
  - `prefixFn` (optional): A function that generates a prefix based on the model name, used as fallback when a model is not found in the prefixMap

#### Returns

A Prisma middleware function that can be used with `prisma.$use()`.

### `generateKSUID(prefix?)`

Generates a K-Sortable Unique ID (KSUID).

#### Parameters

- `prefix` (optional): A string prefix to add to the generated KSUID. Default is an empty string.

#### Returns

A string containing the generated KSUID with the optional prefix.

## License

This package is released under the [MIT License](LICENSE).

Copyright (c) 2025 Apex Innovations, Inc.
