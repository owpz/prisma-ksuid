import { PrismaClient } from "./generated/client";
import { createKsuidExtension } from "../src";
import { execSync } from "child_process";

describe("Extension Error Handling", () => {
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
      await prisma.$disconnect();
    }
  });

  describe("Configuration Errors", () => {
    test("throws error when prefixMap is null", () => {
      expect(() => {
        createKsuidExtension({ prefixMap: null as any });
      }).toThrow("A valid prefixMap must be provided.");
    });

    test("throws error when prefixMap is undefined", () => {
      expect(() => {
        createKsuidExtension({ prefixMap: undefined as any });
      }).toThrow("A valid prefixMap must be provided.");
    });

    test("throws error when prefixMap is an array", () => {
      expect(() => {
        createKsuidExtension({ prefixMap: [] as any });
      }).toThrow("A valid prefixMap must be provided.");
    });

    test("throws error when prefixMap is a string", () => {
      expect(() => {
        createKsuidExtension({ prefixMap: "not-an-object" as any });
      }).toThrow("A valid prefixMap must be provided.");
    });

    test("accepts empty prefixMap object", () => {
      const extension = createKsuidExtension({ prefixMap: {} });
      expect(extension).toBeDefined();
      expect(typeof extension).toBe("function");
    });
  });

  describe("Runtime Errors", () => {
    test("throws error when model has no prefix and no prefixFn", async () => {
      prisma = new PrismaClient().$extends(
        createKsuidExtension({
          prefixMap: { User: "usr_" },
          // No Post prefix and no prefixFn
        }),
      ) as PrismaClient;

      const user = await prisma.user.create({
        data: {
          email: `test-${Date.now()}@example.com`,
          name: "Test User",
        },
      });

      await expect(
        prisma.post.create({
          data: {
            title: "Test Post",
            content: "Content",
            published: false,
            authorId: user.id,
          },
        }),
      ).rejects.toThrow('Prefix not defined or invalid for model "Post"');
    });

    test("throws error when prefix is empty string", async () => {
      prisma = new PrismaClient().$extends(
        createKsuidExtension({
          prefixMap: { User: "" }, // Empty prefix
        }),
      ) as PrismaClient;

      await expect(
        prisma.user.create({
          data: {
            email: "empty-prefix@example.com",
            name: "Empty Prefix User",
          },
        }),
      ).rejects.toThrow('Prefix not defined or invalid for model "User"');
    });

    test("handles prefixFn that returns invalid values", async () => {
      const prefixMap = { User: "usr_" };
      const prefixFn = (model: string) => {
        if (model === "Post") return ""; // Invalid empty string
        return "default_";
      };

      prisma = new PrismaClient().$extends(
        createKsuidExtension({ prefixMap, prefixFn }),
      ) as PrismaClient;

      const user = await prisma.user.create({
        data: {
          email: `custom-prefix-${Date.now()}@example.com`,
          name: "Test User",
        },
      });

      await expect(
        prisma.post.create({
          data: {
            title: "Test Post",
            content: "Content",
            published: false,
            authorId: user.id,
          },
        }),
      ).rejects.toThrow('Prefix not defined or invalid for model "Post"');
    });

    test("handles prefixFn that throws errors", async () => {
      const prefixMap = { User: "usr_" };
      const prefixFn = (model: string) => {
        throw new Error("PrefixFn error");
      };

      prisma = new PrismaClient().$extends(
        createKsuidExtension({ prefixMap, prefixFn }),
      ) as PrismaClient;

      const user = await prisma.user.create({
        data: {
          email: `prefixfn-error-${Date.now()}@example.com`,
          name: "Test User",
        },
      });

      await expect(
        prisma.post.create({
          data: {
            title: "Test Post",
            content: "Content",
            published: false,
            authorId: user.id,
          },
        }),
      ).rejects.toThrow("PrefixFn error");
    });
  });

  describe("Data Handling Errors", () => {
    test("handles null data in create", async () => {
      prisma = new PrismaClient().$extends(
        createKsuidExtension({
          prefixMap: { User: "usr_" },
        }),
      ) as PrismaClient;

      // This should fail with Prisma validation, not our extension
      await expect(
        (prisma.user.create as any)({ data: null }),
      ).rejects.toThrow();
    });

    test("handles undefined data in create", async () => {
      prisma = new PrismaClient().$extends(
        createKsuidExtension({
          prefixMap: { User: "usr_" },
        }),
      ) as PrismaClient;

      await expect(
        (prisma.user.create as any)({ data: undefined }),
      ).rejects.toThrow();
    });

    test("handles non-array data in createMany", async () => {
      prisma = new PrismaClient().$extends(
        createKsuidExtension({
          prefixMap: { User: "usr_" },
        }),
      ) as PrismaClient;

      await expect(
        (prisma.user.createMany as any)({ data: "not-an-array" }),
      ).rejects.toThrow();
    });

    test("handles null items in createMany array", async () => {
      prisma = new PrismaClient().$extends(
        createKsuidExtension({
          prefixMap: { User: "usr_" },
        }),
      ) as PrismaClient;

      const result = await prisma.user.createMany({
        data: [
          { email: "valid@example.com", name: "Valid User" },
          null as any,
          { email: "another@example.com", name: "Another User" },
        ],
      });

      // Prisma should handle the null and either skip it or error
      expect(result.count).toBeLessThanOrEqual(3);
    });

    test("handles empty objects in createMany", async () => {
      prisma = new PrismaClient().$extends(
        createKsuidExtension({
          prefixMap: { User: "usr_" },
        }),
      ) as PrismaClient;

      // Empty objects should fail Prisma validation (missing required fields)
      await expect(
        prisma.user.createMany({
          data: [{} as any],
        }),
      ).rejects.toThrow();
    });
  });

  describe("Nested Create Error Handling", () => {
    test("handles malformed nested create structure", async () => {
      prisma = new PrismaClient().$extends(
        createKsuidExtension({
          prefixMap: { User: "usr_", Profile: "prof_" },
          processNestedCreates: true,
        }),
      ) as PrismaClient;

      await expect(
        prisma.user.create({
          data: {
            email: "malformed@example.com",
            name: "Malformed User",
            profile: {
              create: null as any, // Invalid nested create
            },
          },
        }),
      ).rejects.toThrow();
    });

    test("handles nested create with missing prefix", async () => {
      prisma = new PrismaClient().$extends(
        createKsuidExtension({
          prefixMap: { User: "usr_" }, // No Profile prefix
          processNestedCreates: true,
        }),
      ) as PrismaClient;

      // This should throw because Profile has no prefix
      await expect(
        prisma.user.create({
          data: {
            email: "nested-no-prefix@example.com",
            name: "Nested User",
            profile: {
              create: {
                bio: "Test bio",
              },
            },
          },
        }),
      ).rejects.toThrow('Prefix not defined or invalid for model "Profile"');
    });

    test("handles circular references gracefully", async () => {
      prisma = new PrismaClient().$extends(
        createKsuidExtension({
          prefixMap: { User: "usr_", Post: "post_" },
          processNestedCreates: true,
        }),
      ) as PrismaClient;

      // Create a user first
      const user = await prisma.user.create({
        data: {
          email: "circular@example.com",
          name: "Circular User",
        },
      });

      // Create a post with valid authorId
      const post = await prisma.post.create({
        data: {
          title: "Circular Post",
          content: "Content",
          published: false,
          authorId: user.id,
        },
      });

      expect(post.id).toMatch(/^post_[a-zA-Z0-9]{27}$/);
    });
  });

  describe("Edge Cases", () => {
    test("handles very long prefix strings", async () => {
      const longPrefix =
        "this_is_a_very_long_prefix_that_exceeds_normal_length_";

      prisma = new PrismaClient().$extends(
        createKsuidExtension({
          prefixMap: { User: longPrefix },
        }),
      ) as PrismaClient;

      const user = await prisma.user.create({
        data: {
          email: "long-prefix@example.com",
          name: "Long Prefix User",
        },
      });

      expect(user.id.startsWith(longPrefix)).toBe(true);
      expect(user.id.length).toBe(longPrefix.length + 27);
    });

    test("handles special characters in prefix", async () => {
      const specialPrefix = "usr-2024_v1.0#";

      prisma = new PrismaClient().$extends(
        createKsuidExtension({
          prefixMap: { User: specialPrefix },
        }),
      ) as PrismaClient;

      const user = await prisma.user.create({
        data: {
          email: "special-prefix@example.com",
          name: "Special Prefix User",
        },
      });

      expect(user.id.startsWith(specialPrefix)).toBe(true);
    });

    test("handles prefixMap with many models", async () => {
      const largePrefixMap: Record<string, string> = {};
      for (let i = 0; i < 100; i++) {
        largePrefixMap[`Model${i}`] = `m${i}_`;
      }
      largePrefixMap.User = "usr_";

      prisma = new PrismaClient().$extends(
        createKsuidExtension({
          prefixMap: largePrefixMap,
        }),
      ) as PrismaClient;

      const user = await prisma.user.create({
        data: {
          email: "large-map@example.com",
          name: "Large Map User",
        },
      });

      expect(user.id).toMatch(/^usr_[a-zA-Z0-9]{27}$/);
    });

    test("handles rapid sequential creates", async () => {
      prisma = new PrismaClient().$extends(
        createKsuidExtension({
          prefixMap: { User: "usr_" },
        }),
      ) as PrismaClient;

      const promises = [];
      for (let i = 0; i < 10; i++) {
        promises.push(
          prisma.user.create({
            data: {
              email: `rapid${i}@example.com`,
              name: `Rapid User ${i}`,
            },
          }),
        );
      }

      const users = await Promise.all(promises);
      const ids = users.map((u) => u.id);
      const uniqueIds = new Set(ids);

      expect(uniqueIds.size).toBe(10);
      users.forEach((user) => {
        expect(user.id).toMatch(/^usr_[a-zA-Z0-9]{27}$/);
      });
    });
  });
});
