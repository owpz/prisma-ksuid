import { PrismaClient } from "./generated/client";
import { createKsuidExtension } from "../src";
import { execSync } from "child_process";

describe("Extension Integration Tests", () => {
  let prisma: PrismaClient;

  beforeAll(() => {
    // Reset the test database
    execSync("npm run prisma:reset", { stdio: "inherit" });
  });

  afterEach(async () => {
    if (prisma) {
      await prisma.$disconnect();
    }
  });

  test("extension generates KSUIDs with correct prefixes for create operations", async () => {
    const prefixMap = {
      User: "usr_",
      Post: "post_",
      Product: "prod_",
      Profile: "prof_",
    };

    prisma = new PrismaClient().$extends(
      createKsuidExtension({ prefixMap })
    ) as PrismaClient;

    // Create a user
    const user = await prisma.user.create({
      data: {
        email: "test@example.com",
        name: "Test User",
      },
    });

    expect(user.id).toMatch(/^usr_[a-zA-Z0-9]{27}$/);
    expect(user.id.startsWith("usr_")).toBe(true);
    expect(user.id.length).toBe(31); // 4 char prefix + 27 char KSUID

    // Create a post
    const post = await prisma.post.create({
      data: {
        title: "Test Post",
        content: "Test content",
        published: false,
        authorId: user.id,
      },
    });

    expect(post.id).toMatch(/^post_[a-zA-Z0-9]{27}$/);
    expect(post.id.startsWith("post_")).toBe(true);
    expect(post.id.length).toBe(32); // 5 char prefix + 27 char KSUID

    // Create a product
    const product = await prisma.product.create({
      data: {
        name: "Test Product",
        price: 99.99,
        category: "Electronics",
      },
    });

    expect(product.id).toMatch(/^prod_[a-zA-Z0-9]{27}$/);
    expect(product.id.startsWith("prod_")).toBe(true);
    expect(product.id.length).toBe(32); // 5 char prefix + 27 char KSUID
  });

  test("extension handles createMany operations", async () => {
    const prefixMap = {
      User: "usr_",
      Post: "post_",
    };

    prisma = new PrismaClient().$extends(
      createKsuidExtension({ prefixMap })
    ) as PrismaClient;

    // Clean up any existing users first
    await prisma.user.deleteMany({
      where: {
        email: {
          in: ["user1@example.com", "user2@example.com", "user3@example.com"],
        },
      },
    });

    // Create multiple users
    const result = await prisma.user.createMany({
      data: [
        { email: "user1@example.com", name: "User 1" },
        { email: "user2@example.com", name: "User 2" },
        { email: "user3@example.com", name: "User 3" },
      ],
    });

    expect(result.count).toBe(3);

    // Verify all created users have proper KSUIDs
    const users = await prisma.user.findMany({
      where: {
        email: {
          in: ["user1@example.com", "user2@example.com", "user3@example.com"],
        },
      },
      orderBy: { email: "asc" },
    });

    expect(users).toHaveLength(3);
    users.forEach((user: any) => {
      expect(user.id).toMatch(/^usr_[a-zA-Z0-9]{27}$/);
      expect(user.id.startsWith("usr_")).toBe(true);
    });

    // Verify all IDs are unique
    const uniqueIds = new Set(users.map((u: any) => u.id));
    expect(uniqueIds.size).toBe(3);
  });

  test("extension handles nested create operations", async () => {
    const prefixMap = {
      User: "usr_",
      Post: "post_",
      Profile: "prof_",
    };

    prisma = new PrismaClient().$extends(
      createKsuidExtension({ prefixMap, processNestedCreates: true })
    ) as PrismaClient;

    // Create user with nested profile and post
    const user = await prisma.user.create({
      data: {
        email: "nested@example.com",
        name: "Nested User",
        profile: {
          create: {
            bio: "I love testing nested creates!",
          },
        },
        posts: {
          create: {
            title: "Nested Post",
            content: "Nested content",
            published: true,
          },
        },
      },
      include: {
        profile: true,
        posts: true,
      },
    });

    // Verify user has correct prefix
    expect(user.id).toMatch(/^usr_[a-zA-Z0-9]{27}$/);

    // Verify nested profile has correct prefix
    expect(user.profile).toBeDefined();
    expect(user.profile?.id).toMatch(/^prof_[a-zA-Z0-9]{27}$/);

    // Verify nested post has correct prefix
    expect(user.posts).toHaveLength(1);
    expect(user.posts[0].id).toMatch(/^post_[a-zA-Z0-9]{27}$/);
  });

  test("extension with prefixFn fallback", async () => {
    const prefixMap = {
      User: "usr_",
    };

    const prefixFn = (model: string) => {
      return model.slice(0, 2).toLowerCase() + "_";
    };

    prisma = new PrismaClient().$extends(
      createKsuidExtension({ prefixMap, prefixFn })
    ) as PrismaClient;

    // Create a post (not in prefixMap, should use prefixFn)
    const user = await prisma.user.create({
      data: {
        email: "fallback@example.com",
        name: "Fallback User",
      },
    });

    const post = await prisma.post.create({
      data: {
        title: "Fallback Post",
        content: "Fallback content",
        published: false,
        authorId: user.id,
      },
    });

    // Post should use prefixFn: "Po" -> "po_"
    expect(post.id).toMatch(/^po_[a-zA-Z0-9]{27}$/);
    expect(post.id.startsWith("po_")).toBe(true);
  });

  test("extension throws error when prefix not found", async () => {
    const prefixMap = {
      User: "usr_",
      // Post is not in the map and no prefixFn provided
    };

    prisma = new PrismaClient().$extends(
      createKsuidExtension({ prefixMap })
    ) as PrismaClient;

    const user = await prisma.user.create({
      data: {
        email: "error@example.com",
        name: "Error User",
      },
    });

    // This should throw an error
    await expect(
      prisma.post.create({
        data: {
          title: "Error Post",
          content: "This should fail",
          published: false,
          authorId: user.id,
        },
      })
    ).rejects.toThrow('Prefix not defined or invalid for model "Post"');
  });

  test("extension respects processNestedCreates option", async () => {
    const prefixMap = {
      User: "usr_",
      Post: "post_",
      Profile: "prof_",
    };

    // Create extension with processNestedCreates disabled
    prisma = new PrismaClient().$extends(
      createKsuidExtension({ prefixMap, processNestedCreates: false })
    ) as PrismaClient;

    // Create user with nested post - nested post should get default cuid, not our KSUID
    const user = await prisma.user.create({
      data: {
        email: "no-nested@example.com",
        name: "No Nested User",
        posts: {
          create: {
            title: "Should use default ID",
            content: "No KSUID generated",
            published: false,
          },
        },
      },
      include: {
        posts: true,
      },
    });

    // User should have KSUID
    expect(user.id).toMatch(/^usr_[a-zA-Z0-9]{27}$/);
    
    // Post should NOT have our prefix (should have default cuid)
    expect(user.posts[0].id).not.toMatch(/^post_/);
    expect(user.posts[0].id.length).not.toBe(32); // Not our KSUID length
  });

  test("extension preserves existing IDs", async () => {
    const prefixMap = {
      User: "usr_",
    };

    prisma = new PrismaClient().$extends(
      createKsuidExtension({ prefixMap })
    ) as PrismaClient;

    const customId = "usr_custom123456789012345678901";

    const user = await prisma.user.create({
      data: {
        id: customId,
        email: "custom-id@example.com",
        name: "Custom ID User",
      },
    });

    expect(user.id).toBe(customId);
  });
});