# How to use Prisma KSUID Extension

This example shows a complete implementation using the KSUID Extension.

## Project Structure

```
src/
├── prisma/
│   └── schema.prisma
└── lib/
    └── db.ts
```

## schema.prisma

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model User {
  id        String   @id @default(dbgenerated()) @map("id")
  name      String
  email     String   @unique
  posts     Post[]
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

model Post {
  id       String @id @default(dbgenerated()) @map("id")
  title    String
  content  String?
  authorId String
  author   User   @relation(fields: [authorId], references: [id])
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
```

## lib/db.ts

### Using Prisma Client Extensions

```typescript
import { PrismaClient } from "@prisma/client";
import { createKsuidExtension } from "@owpz/prisma-ksuid";

const prefixMap = {
  User: "usr_",
  Post: "post_",
  PaymentIntent: "pi_",
  Customer: "cus_",
};

// Fallback for models not in prefixMap
const prefixFn = (model: string) => model.slice(0, 2).toLowerCase() + "_";

const prisma = new PrismaClient().$extends(
  createKsuidExtension({
    prefixMap,
    prefixFn,
  }),
);

export default prisma;
```

## Usage in your application

```typescript
import prisma from "./lib/db";

// Create a user - ID will be generated as "usr_1xGVYLMNZO2PfHqPnRlwu5NFNMB"
const user = await prisma.user.create({
  data: {
    name: "John Doe",
    email: "john@example.com",
  },
});

// Create a post - ID will be generated as "post_1xGVYLMNZO2PfHqPnRlwu5NFNMC"
const post = await prisma.post.create({
  data: {
    title: "Hello World",
    content: "This is my first post!",
    authorId: user.id,
  },
});

console.log("User ID:", user.id);
console.log("Post ID:", post.id);
```
