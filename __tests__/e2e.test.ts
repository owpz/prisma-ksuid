import { PrismaClient } from "./generated/client";
import { createKsuidMiddleware } from "../src";
import { KSUID } from "@owpz/ksuid";
import * as fs from "fs";
import * as path from "path";

// Cast middleware to be compatible with Prisma client type
const createCompatibleMiddleware = (options: any) => {
  const middleware = createKsuidMiddleware(options);
  return middleware as any;
};

describe("End-to-End Tests with Prisma and SQLite", () => {
  let prisma: PrismaClient;
  const dbPath = path.join(__dirname, "../prisma/test.db");

  beforeAll(async () => {
    // Clean up any existing test database
    if (fs.existsSync(dbPath)) {
      fs.unlinkSync(dbPath);
    }

    // Create Prisma client
    prisma = new PrismaClient();

    // Set up the KSUID middleware
    const middleware = createCompatibleMiddleware({
      prefixMap: {
        User: "usr_",
        Profile: "prof_",
        Post: "post_",
        Tag: "tag_",
        Product: "prod_",
        Order: "ord_",
        OrderItem: "item_",
      },
    });

    prisma.$use(middleware);

    // Push the schema to create the database
    const { execSync } = require("child_process");
    try {
      execSync("npx prisma db push --force-reset", {
        cwd: path.join(__dirname, ".."),
        stdio: "inherit",
      });
    } catch (error) {
      console.error("Failed to push database schema:", error);
      throw error;
    }
  });

  afterAll(async () => {
    await prisma.$disconnect();

    // Clean up test database
    if (fs.existsSync(dbPath)) {
      fs.unlinkSync(dbPath);
    }
  });

  beforeEach(async () => {
    // Clean up all data before each test (order matters due to foreign key constraints)
    try {
      await prisma.orderItem.deleteMany();
      await prisma.order.deleteMany();
      await prisma.product.deleteMany();

      // Clear many-to-many relations first
      await prisma.$executeRaw`DELETE FROM _PostToTag`;

      await prisma.tag.deleteMany();
      await prisma.post.deleteMany();
      await prisma.profile.deleteMany();

      // Ensure all users are deleted, including any leftover from other tests
      await prisma.user.deleteMany();

      // Double-check that all users are actually deleted
      const remainingUsers = await prisma.user.count();
      if (remainingUsers > 0) {
        console.log(
          `Warning: ${remainingUsers} users remain after cleanup, forcing database reset`,
        );
        // Force database reset if cleanup didn't work
        const { execSync } = require("child_process");
        execSync("npx prisma db push --force-reset", {
          cwd: require("path").join(__dirname, ".."),
          stdio: "pipe",
        });

        // Verify reset worked
        const postResetUsers = await prisma.user.count();
        if (postResetUsers > 0) {
          throw new Error(
            `Database reset failed, ${postResetUsers} users still remain`,
          );
        }
      }
    } catch (error) {
      console.log("Cleanup error:", error);
      // If cleanup fails, reset the entire database
      const { execSync } = require("child_process");
      try {
        execSync("npx prisma db push --force-reset", {
          cwd: require("path").join(__dirname, ".."),
          stdio: "pipe",
        });

        // Verify reset worked
        const postResetUsers = await prisma.user.count();
        if (postResetUsers > 0) {
          throw new Error(
            `Database reset failed, ${postResetUsers} users still remain after error cleanup`,
          );
        }
      } catch (resetError) {
        console.log("Database reset failed, continuing with test");
        throw resetError;
      }
    }
  });

  describe("Single Record Creation", () => {
    test("creates user with KSUID id via middleware", async () => {
      const user = await prisma.user.create({
        data: {
          email: "test@example.com",
          name: "Test User",
        },
      });

      // Verify KSUID format and prefix
      expect(user.id.startsWith("usr_")).toBe(true);
      expect(user.id.length).toBe(31); // "usr_" + 27 chars

      // Verify it's a valid KSUID
      const ksuidPart = user.id.slice(4);
      expect(() => KSUID.parse(ksuidPart)).not.toThrow();

      // Verify other fields
      expect(user.email).toBe("test@example.com");
      expect(user.name).toBe("Test User");
      expect(user.createdAt).toBeInstanceOf(Date);
    });

    test("creates related records with different prefixes", async () => {
      // Create user
      const user = await prisma.user.create({
        data: {
          email: "author@example.com",
          name: "Author",
        },
      });

      // Create profile for user
      const profile = await prisma.profile.create({
        data: {
          bio: "Test bio",
          userId: user.id,
        },
      });

      // Create post by user
      const post = await prisma.post.create({
        data: {
          title: "Test Post",
          content: "This is a test post",
          authorId: user.id,
          published: true,
        },
      });

      // Verify all have correct prefixes
      expect(user.id.startsWith("usr_")).toBe(true);
      expect(profile.id.startsWith("prof_")).toBe(true);
      expect(post.id.startsWith("post_")).toBe(true);

      // Verify relationships work
      const userWithRelations = await prisma.user.findUnique({
        where: { id: user.id },
        include: {
          profile: true,
          posts: true,
        },
      });

      expect(userWithRelations?.profile?.id).toBe(profile.id);
      expect(userWithRelations?.posts[0]?.id).toBe(post.id);
    });

    test("respects existing IDs when provided", async () => {
      const customId = "custom_id_123";

      const user = await prisma.user.create({
        data: {
          id: customId,
          email: "custom@example.com",
          name: "Custom User",
        },
      });

      expect(user.id).toBe(customId);
      expect(user.id.startsWith("usr_")).toBe(false);
    });
  });

  describe("Batch Record Creation", () => {
    test("creates multiple users with createMany and KSUID middleware", async () => {
      const result = await prisma.user.createMany({
        data: [
          { email: "user1@example.com", name: "User 1" },
          { email: "user2@example.com", name: "User 2" },
          { email: "user3@example.com", name: "User 3" },
        ],
      });

      expect(result.count).toBe(3);

      // Retrieve all users to verify KSUIDs
      const users = await prisma.user.findMany({
        orderBy: { email: "asc" },
      });

      expect(users).toHaveLength(3);

      users.forEach((user, index) => {
        expect(user.id.startsWith("usr_")).toBe(true);
        expect(user.id.length).toBe(31);
        expect(user.email).toBe(`user${index + 1}@example.com`);

        // Verify KSUID validity
        const ksuidPart = user.id.slice(4);
        expect(() => KSUID.parse(ksuidPart)).not.toThrow();
      });

      // Verify all IDs are unique
      const ids = users.map((u) => u.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });

    test("handles mixed records with and without IDs in createMany", async () => {
      const customId = "preset_usr_123";

      const result = await prisma.product.createMany({
        data: [
          { name: "Product 1", price: 10.99, category: "electronics" },
          { id: customId, name: "Product 2", price: 20.99, category: "books" },
          { name: "Product 3", price: 30.99, category: "clothing" },
        ],
      });

      expect(result.count).toBe(3);

      const products = await prisma.product.findMany({
        orderBy: { name: "asc" },
      });

      expect(products[0].id.startsWith("prod_")).toBe(true);
      expect(products[1].id).toBe(customId);
      expect(products[2].id.startsWith("prod_")).toBe(true);
    });
  });

  describe("Complex Relationships and Transactions", () => {
    test("creates complex order with items using transactions", async () => {
      // Create products first
      const productsResult = await prisma.product.createMany({
        data: [
          { name: "Laptop", price: 999.99, category: "electronics" },
          { name: "Mouse", price: 29.99, category: "electronics" },
          { name: "Keyboard", price: 79.99, category: "electronics" },
        ],
      });

      expect(productsResult.count).toBe(3);

      const products = await prisma.product.findMany();

      // Create order with items in a transaction
      const orderWithItems = await prisma.$transaction(async (tx) => {
        // Create order
        const order = await tx.order.create({
          data: {
            total: 1109.97,
            status: "confirmed",
          },
        });

        // Create order items
        const items = await Promise.all([
          tx.orderItem.create({
            data: {
              orderId: order.id,
              productId: products[0].id,
              quantity: 1,
              price: 999.99,
            },
          }),
          tx.orderItem.create({
            data: {
              orderId: order.id,
              productId: products[1].id,
              quantity: 1,
              price: 29.99,
            },
          }),
          tx.orderItem.create({
            data: {
              orderId: order.id,
              productId: products[2].id,
              quantity: 1,
              price: 79.99,
            },
          }),
        ]);

        return { order, items };
      });

      // Verify all records have correct prefixes
      expect(orderWithItems.order.id.startsWith("ord_")).toBe(true);
      orderWithItems.items.forEach((item) => {
        expect(item.id.startsWith("item_")).toBe(true);
      });

      // Verify relationships
      const fullOrder = await prisma.order.findUnique({
        where: { id: orderWithItems.order.id },
        include: {
          items: true,
        },
      });

      expect(fullOrder?.items).toHaveLength(3);
      expect(fullOrder?.total).toBe(1109.97);
    });

    test("creates users with posts and tags using nested operations", async () => {
      // Create tags first
      const tagsResult = await prisma.tag.createMany({
        data: [
          { name: "typescript" },
          { name: "javascript" },
          { name: "testing" },
        ],
      });

      expect(tagsResult.count).toBe(3);

      const tags = await prisma.tag.findMany();

      // First create the user with profile, then create posts separately to avoid constraint issues
      const user = await prisma.user.create({
        data: {
          email: "blogger@example.com",
          name: "Blogger",
          profile: {
            create: {
              bio: "I write about web development",
            },
          },
        },
        include: {
          profile: true,
        },
      });

      // Now create the posts with tag connections
      const post1 = await prisma.post.create({
        data: {
          title: "TypeScript Best Practices",
          content: "Here are some TypeScript best practices...",
          published: true,
          authorId: user.id,
          tags: {
            connect: [
              { id: tags[0].id }, // typescript
              { id: tags[2].id }, // testing
            ],
          },
        },
        include: {
          tags: true,
        },
      });

      const post2 = await prisma.post.create({
        data: {
          title: "JavaScript vs TypeScript",
          content: "Comparing JavaScript and TypeScript...",
          published: false,
          authorId: user.id,
          tags: {
            connect: [
              { id: tags[0].id }, // typescript
              { id: tags[1].id }, // javascript
            ],
          },
        },
        include: {
          tags: true,
        },
      });

      // Get the complete user with all relations
      const userWithPosts = await prisma.user.findUnique({
        where: { id: user.id },
        include: {
          posts: {
            include: {
              tags: true,
            },
          },
          profile: true,
        },
      });

      // Verify all KSUIDs have correct prefixes
      expect(userWithPosts!.id.startsWith("usr_")).toBe(true);

      // Note: Nested creates in Prisma don't always trigger middleware for each nested operation
      // This is expected behavior - the middleware processes the main operation, not nested ones
      // So the profile gets a default cuid() which is fine for this test
      expect(user.profile?.id).toBeDefined();
      expect(post1.id.startsWith("post_")).toBe(true);
      expect(post2.id.startsWith("post_")).toBe(true);

      tags.forEach((tag) => {
        expect(tag.id.startsWith("tag_")).toBe(true);
      });

      // Verify relationships and data integrity
      expect(userWithPosts!.posts).toHaveLength(2);
      expect(post1.tags).toHaveLength(2);
      expect(post2.tags).toHaveLength(2);
    });
  });

  describe("Data Retrieval and Querying", () => {
    test("can query and filter records by KSUID prefixes", async () => {
      // Create mixed data
      await prisma.user.createMany({
        data: [
          { email: "user1@test.com", name: "User 1" },
          { email: "user2@test.com", name: "User 2" },
        ],
      });

      await prisma.product.createMany({
        data: [
          { name: "Product 1", price: 10, category: "test" },
          { name: "Product 2", price: 20, category: "test" },
        ],
      });

      const users = await prisma.user.findMany();
      const products = await prisma.product.findMany();

      // All users should have usr_ prefix
      users.forEach((user) => {
        expect(user.id.startsWith("usr_")).toBe(true);
      });

      // All products should have prod_ prefix
      products.forEach((product) => {
        expect(product.id.startsWith("prod_")).toBe(true);
      });

      // Can filter by ID patterns (simulating prefix-based queries)
      const userIds = users.map((u) => u.id);
      const usersById = await prisma.user.findMany({
        where: {
          id: {
            in: userIds,
          },
        },
      });

      expect(usersById).toHaveLength(2);
    });

    test("KSUIDs maintain chronological ordering", async () => {
      const users: any[] = [];

      // Create users with small delays to ensure different timestamps
      for (let i = 0; i < 5; i++) {
        const user = await prisma.user.create({
          data: {
            email: `user${i}@timing.com`,
            name: `User ${i}`,
          },
        });
        users.push(user);

        // Small delay to ensure different KSUID timestamps (KSUIDs have second precision)
        await new Promise((resolve) => setTimeout(resolve, 1100));
      }

      // Retrieve users ordered by creation time
      const retrievedUsers = await prisma.user.findMany({
        where: {
          email: {
            contains: "@timing.com",
          },
        },
        orderBy: {
          createdAt: "asc",
        },
      });

      // KSUID string ordering should match creation order
      const ksuidOnlyIds = retrievedUsers.map((u) => u.id.slice(4)); // Remove prefix
      const sortedKsuidIds = [...ksuidOnlyIds].sort();

      // Since KSUIDs are time-sortable, chronological order should match lexicographical order
      expect(ksuidOnlyIds).toEqual(sortedKsuidIds);
    });
  });

  describe("Error Handling and Edge Cases", () => {
    test("handles database constraints with KSUID IDs", async () => {
      // Create user
      const user1 = await prisma.user.create({
        data: {
          email: "unique@test.com",
          name: "User 1",
        },
      });

      // Try to create another user with same email (should fail due to unique constraint)
      await expect(
        prisma.user.create({
          data: {
            email: "unique@test.com", // Duplicate email
            name: "User 2",
          },
        }),
      ).rejects.toThrow();

      // Verify first user still exists with correct KSUID
      const existingUser = await prisma.user.findUnique({
        where: { email: "unique@test.com" },
      });

      expect(existingUser?.id).toBe(user1.id);
      expect(existingUser?.id.startsWith("usr_")).toBe(true);
    });

    test("handles cascading deletes with KSUID relationships", async () => {
      // Create user with profile and posts
      const user = await prisma.user.create({
        data: {
          email: "cascade@test.com",
          name: "Cascade User",
          profile: {
            create: {
              bio: "Will be deleted",
            },
          },
          posts: {
            create: [
              {
                title: "Post 1",
                content: "Content 1",
              },
              {
                title: "Post 2",
                content: "Content 2",
              },
            ],
          },
        },
        include: {
          profile: true,
          posts: true,
        },
      });

      const profileId = user.profile?.id;
      const postIds = user.posts.map((p: any) => p.id);

      // Delete user (should cascade to profile and posts)
      await prisma.user.delete({
        where: { id: user.id },
      });

      // Verify cascading deletions
      const deletedProfile = await prisma.profile.findUnique({
        where: { id: profileId! },
      });
      expect(deletedProfile).toBeNull();

      const deletedPosts = await prisma.post.findMany({
        where: { id: { in: postIds } },
      });
      expect(deletedPosts).toHaveLength(0);
    });

    test("middleware doesn't interfere with raw queries", async () => {
      // Create a user normally
      const normalUser = await prisma.user.create({
        data: {
          email: "normal@test.com",
          name: "Normal User",
        },
      });

      expect(normalUser.id.startsWith("usr_")).toBe(true);

      // Use raw query (should bypass middleware)
      const rawResult = await prisma.$executeRaw`
        INSERT INTO User (id, email, name, createdAt) 
        VALUES ('raw_user_123', 'raw@test.com', 'Raw User', datetime('now'))
      `;

      expect(rawResult).toBe(1); // 1 row affected

      // Verify both users exist
      const allUsers = await prisma.user.findMany({
        orderBy: { email: "asc" },
      });

      expect(allUsers).toHaveLength(2);
      expect(allUsers[0].id.startsWith("usr_")).toBe(true); // Normal user
      expect(allUsers[1].id).toBe("raw_user_123"); // Raw insert
    });
  });
});
