# KSUID Middleware Prisma Client Example

This example demonstrates how to enhance a Prisma Client with KSUID middleware for model-specific ID prefixes.

## Installation

Ensure you have the following packages installed:

```bash
npm install @prisma/client @owpz/prisma-ksuid
```

## Example code

```typescript
import { PrismaClient } from "@prisma/client";
import { createKsuidMiddleware } from "@owpz/prisma-ksuid";

const prefixMap = {
  User: "usr_",
  PaymentIntent: "pi_",
  Customer: "cus_",
};

const prefixFn = (model: string) => model.slice(0, 2).toLowerCase() + "_";

const prisma = new PrismaClient();

prisma.$use(
  createKsuidMiddleware({
    prefixMap,
    prefixFn,
  }) as Parameters<PrismaClient["$use"]>[0],
);

export default prisma;
```

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
