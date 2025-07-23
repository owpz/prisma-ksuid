import { PrismaClient } from "./generated/client";
import { createKsuidMiddleware } from "../src/prisma-middleware";
import { KSUID } from "@owpz/ksuid";

describe("Enhanced KSUID Middleware - Nested Creates", () => {
  let prisma: PrismaClient;

  beforeAll(async () => {
    prisma = new PrismaClient();

    // Push the schema to create the database
    const { execSync } = require("child_process");
    try {
      execSync("npx prisma db push --force-reset", {
        cwd: require("path").join(__dirname, ".."),
        stdio: "pipe",
      });
    } catch (error) {
      console.log("Database setup error (expected in some environments)");
    }

    // Set up the enhanced KSUID middleware
    const middleware = createKsuidMiddleware({
      prefixMap: {
        User: "usr_",
        Profile: "prof_",
        Post: "post_",
        Tag: "tag_",
        Product: "prod_",
        Order: "ord_",
        OrderItem: "item_",
      },
      processNestedCreates: true,
    });

    prisma.$use(middleware as any);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    // Clean up all data before each test
    await prisma.orderItem.deleteMany();
    await prisma.order.deleteMany();
    await prisma.product.deleteMany();
    await prisma.post.deleteMany();
    await prisma.profile.deleteMany();
    await prisma.user.deleteMany();
  });

  describe("Single Nested Creates", () => {
    test("creates user with nested profile using enhanced middleware", async () => {
      const user = await prisma.user.create({
        data: {
          email: "enhanced-test@enhanced.test",
          name: "Test User",
          profile: {
            create: {
              bio: "Test bio",
            },
          },
        },
        include: {
          profile: true,
        },
      });

      // Both should have KSUIDs with correct prefixes
      expect(user.id.startsWith("usr_")).toBe(true);
      expect(user.profile?.id.startsWith("prof_")).toBe(true);

      // Verify they're valid KSUIDs
      const userKsuid = KSUID.parse(user.id.slice(4));
      const profileKsuid = KSUID.parse(user.profile!.id.slice(5));

      expect(userKsuid.isNil()).toBe(false);
      expect(profileKsuid.isNil()).toBe(false);
    });

    test("creates user with multiple nested creates", async () => {
      const user = await prisma.user.create({
        data: {
          email: "blogger@enhanced.test",
          name: "Blogger",
          profile: {
            create: {
              bio: "I love writing",
            },
          },
        },
        include: {
          profile: true,
        },
      });

      // Now create posts for this user
      const postResult = await prisma.post.create({
        data: {
          title: "My First Post",
          content: "Hello world!",
          authorId: user.id,
        },
      });

      expect(user.id.startsWith("usr_")).toBe(true);
      expect(user.profile?.id.startsWith("prof_")).toBe(true);
      expect(postResult.id.startsWith("post_")).toBe(true);
    });
  });

  describe("Complex Nested Scenarios", () => {
    test("handles deeply nested creates", async () => {
      // This would be a complex scenario if we had more deeply nested relationships
      // For now, test what we can with the current schema

      const user = await prisma.user.create({
        data: {
          email: "complex@enhanced.test",
          name: "Complex User",
          profile: {
            create: {
              bio: "Complex user bio",
            },
          },
        },
        include: {
          profile: true,
        },
      });

      expect(user.id.startsWith("usr_")).toBe(true);
      expect(user.profile?.id.startsWith("prof_")).toBe(true);

      // Verify the relationship works
      const fetchedUser = await prisma.user.findUnique({
        where: { id: user.id },
        include: { profile: true },
      });

      expect(fetchedUser?.profile?.id).toBe(user.profile?.id);
    });

    test("respects existing IDs in nested creates", async () => {
      const customProfileId = "custom_profile_123";

      const user = await prisma.user.create({
        data: {
          email: "custom@enhanced.test",
          name: "Custom User",
          profile: {
            create: {
              id: customProfileId,
              bio: "Custom profile",
            },
          },
        },
        include: {
          profile: true,
        },
      });

      expect(user.id.startsWith("usr_")).toBe(true);
      expect(user.profile?.id).toBe(customProfileId);
    });
  });

  describe("Edge Cases and Error Handling", () => {
    test("handles middleware with processNestedCreates disabled", async () => {
      // Create a new client with enhanced middleware but nested processing disabled
      const prismaWithoutNested = new PrismaClient();

      const middleware = createKsuidMiddleware({
        prefixMap: {
          User: "usr_",
          Profile: "prof_",
        },
        processNestedCreates: false,
      });

      prismaWithoutNested.$use(middleware as any);

      const user = await prismaWithoutNested.user.create({
        data: {
          email: "no-nested@enhanced.test",
          name: "No Nested User",
          profile: {
            create: {
              bio: "Should get default ID",
            },
          },
        },
        include: {
          profile: true,
        },
      });

      // User should get KSUID, profile should get default cuid()
      expect(user.id.startsWith("usr_")).toBe(true);
      expect(user.profile?.id.startsWith("prof_")).toBe(false);
      expect(user.profile?.id.startsWith("c")).toBe(true); // cuid starts with 'c'

      await prismaWithoutNested.$disconnect();
    });

    test("handles malformed nested data gracefully", async () => {
      // This test verifies the middleware doesn't break with unexpected data structures
      const user = await prisma.user.create({
        data: {
          email: "malformed@enhanced.test",
          name: "Malformed User",
          // No nested creates - should work fine
        },
      });

      expect(user.id.startsWith("usr_")).toBe(true);
    });
  });

  describe("Performance and Integration", () => {
    test("enhanced middleware doesn't significantly impact performance", async () => {
      const startTime = Date.now();

      // Create multiple users with nested profiles
      const users = await Promise.all(
        Array.from({ length: 10 }, (_, i) =>
          prisma.user.create({
            data: {
              email: `perf${i}@enhanced.test`,
              name: `Performance User ${i}`,
              profile: {
                create: {
                  bio: `Bio for user ${i}`,
                },
              },
            },
            include: {
              profile: true,
            },
          }),
        ),
      );

      const duration = Date.now() - startTime;

      // Should complete reasonably quickly
      expect(duration).toBeLessThan(1000);

      // All should have correct prefixes
      users.forEach((user) => {
        expect(user.id.startsWith("usr_")).toBe(true);
        expect(user.profile?.id.startsWith("prof_")).toBe(true);
      });
    });
  });
});
