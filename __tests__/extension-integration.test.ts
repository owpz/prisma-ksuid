import { PrismaClient } from "./generated/client";
import { createKsuidExtension } from "../src";
import { execSync } from "child_process";
import { KSUID } from "@owpz/ksuid";

describe("Extension Integration Tests", () => {
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

  afterEach(async () => {
    if (prisma) {
      // Clean up all data to ensure test isolation
      await prisma.product.deleteMany();
      await prisma.profile.deleteMany();
      await prisma.post.deleteMany();
      await prisma.user.deleteMany();
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
      createKsuidExtension({ prefixMap }),
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
      createKsuidExtension({ prefixMap }),
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
      createKsuidExtension({ prefixMap, processNestedCreates: true }),
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
      createKsuidExtension({ prefixMap, prefixFn }),
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
      createKsuidExtension({ prefixMap }),
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
      }),
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
      createKsuidExtension({ prefixMap, processNestedCreates: false }),
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
      createKsuidExtension({ prefixMap }),
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

  describe("Concurrency Tests", () => {
    test("handles concurrent creates without ID collision", async () => {
      const prefixMap = {
        User: "usr_",
      };

      prisma = new PrismaClient().$extends(
        createKsuidExtension({ prefixMap }),
      ) as PrismaClient;

      // Create 100 users concurrently
      const promises = Array.from({ length: 100 }, (_, i) =>
        prisma.user.create({
          data: {
            email: `concurrent${i}@example.com`,
            name: `Concurrent User ${i}`,
          },
        }),
      );

      const users = await Promise.all(promises);
      const ids = users.map((u) => u.id);
      const uniqueIds = new Set(ids);

      // All IDs should be unique
      expect(uniqueIds.size).toBe(100);

      // All should have correct prefix
      users.forEach((user) => {
        expect(user.id).toMatch(/^usr_[a-zA-Z0-9]{27}$/);
      });
    });

    test("handles concurrent nested creates", async () => {
      const prefixMap = {
        User: "usr_",
        Profile: "prof_",
        Post: "post_",
      };

      prisma = new PrismaClient().$extends(
        createKsuidExtension({ prefixMap, processNestedCreates: true }),
      ) as PrismaClient;

      const promises = Array.from({ length: 20 }, (_, i) =>
        prisma.user.create({
          data: {
            email: `nested-concurrent${i}@example.com`,
            name: `Nested Concurrent User ${i}`,
            profile: {
              create: {
                bio: `Bio for user ${i}`,
              },
            },
            posts: {
              create: {
                title: `Post by user ${i}`,
                content: `Content from user ${i}`,
                published: i % 2 === 0,
              },
            },
          },
          include: {
            profile: true,
            posts: true,
          },
        }),
      );

      const users = await Promise.all(promises);

      // Collect all IDs
      const allIds = new Set<string>();
      users.forEach((user) => {
        allIds.add(user.id);
        if (user.profile) allIds.add(user.profile.id);
        user.posts.forEach((post) => allIds.add(post.id));
      });

      // All IDs should be unique across all models
      expect(allIds.size).toBe(60); // 20 users + 20 profiles + 20 posts

      // Verify prefixes
      users.forEach((user) => {
        expect(user.id).toMatch(/^usr_[a-zA-Z0-9]{27}$/);
        expect(user.profile?.id).toMatch(/^prof_[a-zA-Z0-9]{27}$/);
        expect(user.posts[0].id).toMatch(/^post_[a-zA-Z0-9]{27}$/);
      });
    });

    test("handles race conditions in createMany", async () => {
      const prefixMap = {
        User: "usr_",
      };

      prisma = new PrismaClient().$extends(
        createKsuidExtension({ prefixMap }),
      ) as PrismaClient;

      // Run multiple createMany operations concurrently
      const batches = Array.from({ length: 10 }, (_, batchIndex) =>
        prisma.user.createMany({
          data: Array.from({ length: 10 }, (_, userIndex) => ({
            email: `batch${batchIndex}-user${userIndex}@example.com`,
            name: `Batch ${batchIndex} User ${userIndex}`,
          })),
        }),
      );

      const results = await Promise.all(batches);
      const totalCreated = results.reduce(
        (sum, result) => sum + result.count,
        0,
      );
      expect(totalCreated).toBe(100);

      // Verify all have unique IDs
      const allUsers = await prisma.user.findMany({
        where: {
          email: {
            contains: "batch",
          },
        },
      });

      const ids = new Set(allUsers.map((u) => u.id));
      expect(ids.size).toBe(100);
    });
  });

  describe("Complex Integration Scenarios", () => {
    test("handles complex business workflow", async () => {
      const prefixMap = {
        User: "usr_",
        Product: "prod_",
        Order: "ord_",
        OrderItem: "item_",
      };

      prisma = new PrismaClient().$extends(
        createKsuidExtension({ prefixMap }),
      ) as PrismaClient;

      // Simulate e-commerce workflow
      // 1. Create products
      const products = await prisma.product.createMany({
        data: [
          { name: "Laptop", price: 999.99, category: "Electronics" },
          { name: "Mouse", price: 29.99, category: "Electronics" },
          { name: "Keyboard", price: 79.99, category: "Electronics" },
        ],
      });

      const productList = await prisma.product.findMany();
      expect(productList).toHaveLength(3);
      productList.forEach((p) => {
        expect(p.id).toMatch(/^prod_[a-zA-Z0-9]{27}$/);
      });

      // 2. Create user
      const user = await prisma.user.create({
        data: {
          email: "shopper@example.com",
          name: "Happy Shopper",
        },
      });

      // 3. Create order with items
      const order = await prisma.order.create({
        data: {
          total: 1109.97,
          status: "pending",
          items: {
            create: productList.map((product) => ({
              productId: product.id,
              quantity: 1,
              price: product.price,
            })),
          },
        },
        include: {
          items: true,
        },
      });

      expect(order.id).toMatch(/^ord_[a-zA-Z0-9]{27}$/);
      expect(order.items).toHaveLength(3);
      order.items.forEach((item) => {
        expect(item.id).toMatch(/^item_[a-zA-Z0-9]{27}$/);
      });
    });

    test("handles data migration scenario", async () => {
      const prefixMap = {
        User: "usr_",
        Post: "post_",
      };

      prisma = new PrismaClient().$extends(
        createKsuidExtension({ prefixMap }),
      ) as PrismaClient;

      // Simulate migrating data with mix of new and existing IDs
      const existingUsers = [
        {
          id: "usr_existing001",
          email: "old1@example.com",
          name: "Old User 1",
        },
        {
          id: "usr_existing002",
          email: "old2@example.com",
          name: "Old User 2",
        },
      ];

      const newUsers = [
        { email: "new1@example.com", name: "New User 1" },
        { email: "new2@example.com", name: "New User 2" },
      ];

      // Create with existing IDs
      for (const userData of existingUsers) {
        const user = await prisma.user.create({ data: userData });
        expect(user.id).toBe(userData.id);
      }

      // Create without IDs (should generate KSUIDs)
      for (const userData of newUsers) {
        const user = await prisma.user.create({ data: userData });
        expect(user.id).toMatch(/^usr_[a-zA-Z0-9]{27}$/);
      }

      const allUsers = await prisma.user.findMany();
      expect(allUsers).toHaveLength(4);
    });

    test("handles multi-tenant scenario with prefixFn", async () => {
      const tenantPrefixes: Record<string, string> = {
        tenant1: "t1",
        tenant2: "t2",
        tenant3: "t3",
      };

      let currentTenant = "tenant1";

      const prefixMap = {
        User: "usr_",
      };

      const prefixFn = (model: string) => {
        const tenantPrefix = tenantPrefixes[currentTenant] || "unknown";
        return `${tenantPrefix}_${model.toLowerCase().slice(0, 3)}_`;
      };

      prisma = new PrismaClient().$extends(
        createKsuidExtension({ prefixMap, prefixFn }),
      ) as PrismaClient;

      // Create posts for different tenants
      const posts = [];

      for (const tenant of Object.keys(tenantPrefixes)) {
        currentTenant = tenant;

        // Create user for tenant
        const user = await prisma.user.create({
          data: {
            email: `${tenant}@example.com`,
            name: `${tenant} User`,
          },
        });

        // Create post (will use prefixFn since Post not in prefixMap)
        const post = await prisma.post.create({
          data: {
            title: `Post for ${tenant}`,
            content: `Content from ${tenant}`,
            published: true,
            authorId: user.id,
          },
        });

        posts.push({ tenant, post });
      }

      // Verify tenant-specific prefixes
      expect(posts[0].post.id).toMatch(/^t1_pos_[a-zA-Z0-9]{27}$/);
      expect(posts[1].post.id).toMatch(/^t2_pos_[a-zA-Z0-9]{27}$/);
      expect(posts[2].post.id).toMatch(/^t3_pos_[a-zA-Z0-9]{27}$/);
    });

    test("handles KSUID chronological properties", async () => {
      const prefixMap = {
        Order: "ord_",
      };

      prisma = new PrismaClient().$extends(
        createKsuidExtension({ prefixMap }),
      ) as PrismaClient;

      const orders = [];

      // Create orders with deliberate time gaps
      for (let i = 0; i < 5; i++) {
        const order = await prisma.order.create({
          data: {
            total: (i + 1) * 100,
            status: "completed",
          },
        });
        orders.push(order);

        // Wait to ensure different timestamps (>1 second for guaranteed different timestamps)
        await new Promise((resolve) => setTimeout(resolve, 1100));
      }

      // Extract KSUIDs and verify chronological ordering
      const ksuidStrings = orders.map((o) => o.id.slice(4)); // Remove prefix
      const ksuids = ksuidStrings.map((s) => KSUID.parse(s));

      // Verify each KSUID is newer than the previous
      for (let i = 1; i < ksuids.length; i++) {
        const prev = ksuids[i - 1];
        const curr = ksuids[i];
        expect(curr.compare(prev)).toBeGreaterThan(0);
      }

      // Verify lexicographical sorting matches chronological order
      const sortedIds = [...orders.map((o) => o.id)].sort();
      const originalIds = orders.map((o) => o.id);
      expect(sortedIds).toEqual(originalIds);
    });
  });
});
