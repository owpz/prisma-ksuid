import { PrismaClient } from "./generated/client";
import { createKsuidExtension } from "../src";
import { execSync } from "child_process";
import { KSUID } from "@owpz/ksuid";

describe("Extension E2E Tests", () => {
  let prisma: PrismaClient;

  beforeAll(() => {
    // Reset the test database
    execSync("npm run prisma:reset", {
      stdio: "inherit",
      env: {
        ...process.env,
        PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION: "test"
      }
    });
  });

  beforeEach(async () => {
    // Create a fresh Prisma client with extension for each test
    prisma = new PrismaClient().$extends(
      createKsuidExtension({
        prefixMap: {
          User: "usr_",
          Profile: "prof_",
          Post: "post_",
          Tag: "tag_",
          Product: "prod_",
          Order: "ord_",
          OrderItem: "item_",
        },
      }),
    ) as PrismaClient;

    // Clean up all data
    await prisma.orderItem.deleteMany();
    await prisma.order.deleteMany();
    await prisma.$executeRaw`DELETE FROM "_PostToTag"`;
    await prisma.tag.deleteMany();
    await prisma.post.deleteMany();
    await prisma.profile.deleteMany();
    await prisma.user.deleteMany();
    await prisma.product.deleteMany();
  });

  afterEach(async () => {
    await prisma.$disconnect();
  });

  describe("Basic Operations", () => {
    test("creates single record with KSUID prefix", async () => {
      const user = await prisma.user.create({
        data: {
          email: "john@example.com",
          name: "John Doe",
        },
      });

      expect(user.id).toMatch(/^usr_[a-zA-Z0-9]{27}$/);
      expect(user.email).toBe("john@example.com");

      // Verify it's a valid KSUID
      const ksuid = KSUID.parse(user.id.slice(4));
      expect(ksuid.isNil()).toBe(false);
    });

    test("creates related records with different prefixes", async () => {
      const user = await prisma.user.create({
        data: {
          email: "jane@example.com",
          name: "Jane Smith",
          profile: {
            create: {
              bio: "Software developer",
            },
          },
          posts: {
            create: [
              {
                title: "First Post",
                content: "Hello World",
                published: true,
              },
              {
                title: "Second Post",
                content: "Another post",
                published: false,
              },
            ],
          },
        },
        include: {
          profile: true,
          posts: true,
        },
      });

      expect(user.id).toMatch(/^usr_[a-zA-Z0-9]{27}$/);
      expect(user.profile?.id).toMatch(/^prof_[a-zA-Z0-9]{27}$/);
      expect(user.posts).toHaveLength(2);
      user.posts.forEach((post) => {
        expect(post.id).toMatch(/^post_[a-zA-Z0-9]{27}$/);
      });
    });

    test("respects existing IDs when provided", async () => {
      const customId = "usr_custom1234567890123456789";

      const user = await prisma.user.create({
        data: {
          id: customId,
          email: "custom@example.com",
          name: "Custom ID User",
        },
      });

      expect(user.id).toBe(customId);
    });
  });

  describe("Batch Operations", () => {
    test("createMany generates unique KSUIDs for all records", async () => {
      const userData = Array.from({ length: 50 }, (_, i) => ({
        email: `user${i}@example.com`,
        name: `User ${i}`,
      }));

      const result = await prisma.user.createMany({
        data: userData,
      });

      expect(result.count).toBe(50);

      const users = await prisma.user.findMany({
        orderBy: { email: "asc" },
      });

      // Check if we got the expected number of users
      expect(users).toHaveLength(50);

      const ids = new Set<string>();
      users.forEach((user) => {
        expect(user.id).toMatch(/^usr_[a-zA-Z0-9]{27}$/);
        ids.add(user.id);
      });

      // All IDs should be unique
      expect(ids.size).toBe(users.length);
    });

    test("handles mixed model types in transaction", async () => {
      const result = await prisma.$transaction(async (tx) => {
        const user = await tx.user.create({
          data: {
            email: "transaction@example.com",
            name: "Transaction User",
          },
        });

        const products = await tx.product.createMany({
          data: [
            { name: "Product 1", price: 99.99, category: "Electronics" },
            { name: "Product 2", price: 49.99, category: "Books" },
          ],
        });

        const order = await tx.order.create({
          data: {
            total: 149.98,
            status: "pending",
          },
        });

        return { user, products, order };
      });

      expect(result.user.id).toMatch(/^usr_[a-zA-Z0-9]{27}$/);
      expect(result.order.id).toMatch(/^ord_[a-zA-Z0-9]{27}$/);

      const products = await prisma.product.findMany();
      products.forEach((product) => {
        expect(product.id).toMatch(/^prod_[a-zA-Z0-9]{27}$/);
      });
    });
  });

  describe("Complex Relationships", () => {
    test("handles many-to-many relationships", async () => {
      // Create tags
      const tags = await Promise.all([
        prisma.tag.create({ data: { name: "JavaScript" } }),
        prisma.tag.create({ data: { name: "TypeScript" } }),
        prisma.tag.create({ data: { name: "Prisma" } }),
      ]);

      tags.forEach((tag) => {
        expect(tag.id).toMatch(/^tag_[a-zA-Z0-9]{27}$/);
      });

      // Create user with post connected to tags
      const user = await prisma.user.create({
        data: {
          email: "blogger@example.com",
          name: "Tech Blogger",
          posts: {
            create: {
              title: "Working with Prisma",
              content: "Prisma is great!",
              published: true,
              tags: {
                connect: tags.map((tag) => ({ id: tag.id })),
              },
            },
          },
        },
        include: {
          posts: {
            include: {
              tags: true,
            },
          },
        },
      });

      expect(user.posts[0].tags).toHaveLength(3);
      user.posts[0].tags.forEach((tag) => {
        expect(tag.id).toMatch(/^tag_[a-zA-Z0-9]{27}$/);
      });
    });

    test("handles complex nested operations", async () => {
      const order = await prisma.order.create({
        data: {
          total: 299.97,
          status: "processing",
          items: {
            create: [
              {
                productId: "prod_test123",
                quantity: 2,
                price: 99.99,
              },
              {
                productId: "prod_test456",
                quantity: 1,
                price: 99.99,
              },
            ],
          },
        },
        include: {
          items: true,
        },
      });

      expect(order.id).toMatch(/^ord_[a-zA-Z0-9]{27}$/);
      expect(order.items).toHaveLength(2);
      order.items.forEach((item) => {
        expect(item.id).toMatch(/^item_[a-zA-Z0-9]{27}$/);
      });
    });
  });

  describe("Query Operations", () => {
    test("can query by KSUID prefix", async () => {
      // Create mixed data
      await prisma.user.createMany({
        data: [
          { email: "user1@test.com", name: "User 1" },
          { email: "user2@test.com", name: "User 2" },
        ],
      });

      await prisma.product.createMany({
        data: [
          { name: "Product A", price: 10.0, category: "A" },
          { name: "Product B", price: 20.0, category: "B" },
        ],
      });

      // Query users by prefix pattern
      const users = await prisma.user.findMany({
        where: {
          id: {
            startsWith: "usr_",
          },
        },
      });

      expect(users).toHaveLength(2);
      users.forEach((user) => {
        expect(user.id).toMatch(/^usr_/);
      });

      // Query products by prefix pattern
      const products = await prisma.product.findMany({
        where: {
          id: {
            startsWith: "prod_",
          },
        },
      });

      expect(products).toHaveLength(2);
      products.forEach((product) => {
        expect(product.id).toMatch(/^prod_/);
      });
    });

    test("maintains chronological ordering", async () => {
      const users = [];

      // Create users with small delays to ensure different timestamps
      for (let i = 0; i < 5; i++) {
        const user = await prisma.user.create({
          data: {
            email: `chrono${i}@example.com`,
            name: `Chrono User ${i}`,
          },
        });
        users.push(user);
        // Delay to ensure different KSUID timestamps (>1 second for guaranteed different timestamps)
        await new Promise((resolve) => setTimeout(resolve, 1100));
      }

      // IDs should be in chronological order when sorted
      const sortedIds = [...users.map((u) => u.id)].sort();
      const originalIds = users.map((u) => u.id);

      expect(sortedIds).toEqual(originalIds);
    });
  });

  describe("Database Constraints", () => {
    test("handles unique constraint violations", async () => {
      const email = "unique@example.com";

      await prisma.user.create({
        data: {
          email,
          name: "First User",
        },
      });

      // Second create should fail due to unique email
      await expect(
        prisma.user.create({
          data: {
            email,
            name: "Second User",
          },
        }),
      ).rejects.toThrow();
    });

    test("handles foreign key constraints", async () => {
      const invalidUserId = "usr_nonexistent1234567890123";

      await expect(
        prisma.post.create({
          data: {
            title: "Orphan Post",
            content: "This should fail",
            published: false,
            authorId: invalidUserId,
          },
        }),
      ).rejects.toThrow();
    });

    test("handles cascading deletes", async () => {
      const user = await prisma.user.create({
        data: {
          email: "cascade@example.com",
          name: "Cascade User",
          profile: {
            create: {
              bio: "Will be deleted",
            },
          },
          posts: {
            create: {
              title: "Will be deleted",
              content: "Cascade delete test",
              published: false,
            },
          },
        },
      });

      const profileId = await prisma.profile
        .findUnique({ where: { userId: user.id } })
        .then((p) => p?.id);

      const postIds = await prisma.post
        .findMany({ where: { authorId: user.id } })
        .then((posts) => posts.map((p) => p.id));

      // Delete user should cascade to profile and posts
      await prisma.user.delete({ where: { id: user.id } });

      // Verify cascading deletes
      const profile = await prisma.profile.findUnique({
        where: { id: profileId! },
      });
      const posts = await prisma.post.findMany({
        where: { id: { in: postIds } },
      });

      expect(profile).toBeNull();
      expect(posts).toHaveLength(0);
    });
  });

  describe("Raw Queries", () => {
    test("KSUIDs work with raw queries", async () => {
      const user = await prisma.user.create({
        data: {
          email: "raw@example.com",
          name: "Raw Query User",
        },
      });

      // Query using raw SQL
      const result = await prisma.$queryRaw`
        SELECT id, email, name 
        FROM "User" 
        WHERE id = ${user.id}
      `;

      expect(Array.isArray(result)).toBe(true);
      expect((result as any)[0].id).toBe(user.id);
      expect((result as any)[0].email).toBe("raw@example.com");
    });

    test("can insert with raw queries and manual KSUID", async () => {
      const manualKsuid = `usr_${KSUID.random().toString()}`;

      await prisma.$executeRaw`
        INSERT INTO "User" (id, email, name, "createdAt")
        VALUES (${manualKsuid}, ${"rawinsert@example.com"}, ${"Raw Insert User"}, ${new Date()})
      `;

      const user = await prisma.user.findUnique({
        where: { id: manualKsuid },
      });

      expect(user).toBeTruthy();
      expect(user?.id).toBe(manualKsuid);
      expect(user?.email).toBe("rawinsert@example.com");
    });
  });

  describe("Performance", () => {
    test("handles high-volume inserts efficiently", async () => {
      const startTime = Date.now();
      const batchSize = 100;

      const userData = Array.from({ length: batchSize }, (_, i) => ({
        email: `perf${i}@example.com`,
        name: `Performance User ${i}`,
      }));

      await prisma.user.createMany({
        data: userData,
      });

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Should complete reasonably quickly (under 5 seconds for 100 records)
      expect(duration).toBeLessThan(5000);

      const users = await prisma.user.findMany({
        where: {
          email: {
            startsWith: "perf",
          },
        },
      });

      expect(users).toHaveLength(batchSize);
    });

    test("maintains performance with nested creates", async () => {
      const startTime = Date.now();

      const users = await Promise.all(
        Array.from({ length: 10 }, (_, i) =>
          prisma.user.create({
            data: {
              email: `nested-perf${i}@example.com`,
              name: `Nested Perf User ${i}`,
              profile: {
                create: {
                  bio: `Bio for user ${i}`,
                },
              },
              posts: {
                create: [
                  {
                    title: `Post 1 by User ${i}`,
                    content: "Content",
                    published: true,
                  },
                  {
                    title: `Post 2 by User ${i}`,
                    content: "More content",
                    published: false,
                  },
                ],
              },
            },
            include: {
              profile: true,
              posts: true,
            },
          }),
        ),
      );

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Should complete in reasonable time
      expect(duration).toBeLessThan(10000);
      expect(users).toHaveLength(10);

      users.forEach((user) => {
        expect(user.id).toMatch(/^usr_[a-zA-Z0-9]{27}$/);
        expect(user.profile?.id).toMatch(/^prof_[a-zA-Z0-9]{27}$/);
        expect(user.posts).toHaveLength(2);
        user.posts.forEach((post) => {
          expect(post.id).toMatch(/^post_[a-zA-Z0-9]{27}$/);
        });
      });
    });
  });
});
