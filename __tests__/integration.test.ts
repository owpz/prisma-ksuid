import { createKsuidMiddleware, generateKSUID } from "../src";
import { KSUID } from "@owpz/ksuid";

describe("Integration Tests", () => {
  describe("End-to-End Middleware Integration", () => {
    test("complete workflow: middleware generates valid KSUIDs that work with @owpz/ksuid", async () => {
      const middleware = createKsuidMiddleware({
        prefixMap: {
          User: "usr_",
          Product: "prod_",
          Order: "ord_",
        },
        prefixFn: (model) => `${model.toLowerCase()}_`,
      });

      const testCases = [
        { model: "User", expectedPrefix: "usr_" },
        { model: "Product", expectedPrefix: "prod_" },
        { model: "Order", expectedPrefix: "ord_" },
        { model: "Category", expectedPrefix: "category_" }, // Uses prefixFn
      ];

      for (const { model, expectedPrefix } of testCases) {
        const params = {
          model,
          action: "create",
          args: { data: { name: "Test Item" } },
        };

        const next = jest.fn().mockResolvedValue({
          id: `${expectedPrefix}mockResult`,
          name: "Test Item",
        });

        await middleware(params, next);

        const generatedId = (params.args.data as any).id as string;

        // Verify the ID was generated with correct prefix
        expect(generatedId.startsWith(expectedPrefix)).toBe(true);
        expect(generatedId.length).toBe(expectedPrefix.length + 27);

        // Verify the KSUID part is valid by parsing it
        const ksuidPart = generatedId.slice(expectedPrefix.length);
        const parsedKsuid = KSUID.parse(ksuidPart);

        expect(parsedKsuid.isNil()).toBe(false);
        expect(parsedKsuid.timestamp).toBeGreaterThan(0);
        expect(parsedKsuid.toString()).toBe(ksuidPart);
      }
    });

    test("middleware handles concurrent operations correctly", async () => {
      const middleware = createKsuidMiddleware({
        prefixMap: { User: "usr_" },
      });

      // Simulate concurrent create operations
      const concurrentOperations = Array.from({ length: 10 }, (_, i) => {
        const params = {
          model: "User",
          action: "create",
          args: { data: { name: `User ${i}` } },
        };

        const next = jest.fn().mockResolvedValue({
          id: `usr_concurrent_${i}`,
          name: `User ${i}`,
        });

        return middleware(params, next).then(
          () => (params.args.data as any).id as string,
        );
      });

      const generatedIds = await Promise.all(concurrentOperations);

      // All IDs should be unique
      const uniqueIds = new Set(generatedIds);
      expect(uniqueIds.size).toBe(generatedIds.length);

      // All IDs should have correct prefix and format
      generatedIds.forEach((id) => {
        expect(id.startsWith("usr_")).toBe(true);
        expect(id.length).toBe(31); // "usr_" + 27

        const ksuidPart = id.slice(4);
        expect(() => KSUID.parse(ksuidPart)).not.toThrow();
      });
    });

    test("middleware works with complex nested data structures", async () => {
      const middleware = createKsuidMiddleware({
        prefixMap: { User: "usr_" },
      });

      const complexData = {
        name: "John Doe",
        profile: {
          bio: "Software developer",
          settings: {
            theme: "dark",
            notifications: true,
          },
        },
        tags: ["developer", "typescript"],
        metadata: {
          createdBy: "system",
          version: 1,
        },
      };

      const params = {
        model: "User",
        action: "create",
        args: { data: complexData },
      };

      const next = jest.fn().mockResolvedValue({
        id: "usr_complexResult",
        ...complexData,
      });

      await middleware(params, next);

      const generatedId = (params.args.data as any).id as string;

      // Verify ID was added without affecting other data
      expect(generatedId.startsWith("usr_")).toBe(true);
      expect(params.args.data.name).toBe("John Doe");
      expect(params.args.data.profile.bio).toBe("Software developer");
      expect(params.args.data.tags).toEqual(["developer", "typescript"]);

      // Verify KSUID is valid
      const ksuidPart = generatedId.slice(4);
      expect(() => KSUID.parse(ksuidPart)).not.toThrow();
    });

    test("middleware handles createMany with mixed prefixes correctly", async () => {
      const middleware = createKsuidMiddleware({
        prefixMap: {
          User: "usr_",
          Admin: "adm_",
        },
      });

      // Test createMany for User model
      const userParams = {
        model: "User",
        action: "createMany",
        args: {
          data: [
            { name: "User 1" },
            { name: "User 2", id: "existing_id" },
            { name: "User 3" },
          ],
        },
      };

      const userNext = jest.fn().mockResolvedValue({ count: 3 });
      await middleware(userParams, userNext);

      // Test createMany for Admin model
      const adminParams = {
        model: "Admin",
        action: "createMany",
        args: {
          data: [{ name: "Admin 1" }, { name: "Admin 2" }],
        },
      };

      const adminNext = jest.fn().mockResolvedValue({ count: 2 });
      await middleware(adminParams, adminNext);

      // Verify User IDs
      expect((userParams.args.data[0] as any).id.startsWith("usr_")).toBe(true);
      expect(userParams.args.data[1].id).toBe("existing_id");
      expect((userParams.args.data[2] as any).id.startsWith("usr_")).toBe(true);

      // Verify Admin IDs
      expect((adminParams.args.data[0] as any).id.startsWith("adm_")).toBe(
        true,
      );
      expect((adminParams.args.data[1] as any).id.startsWith("adm_")).toBe(
        true,
      );

      // Verify all generated KSUIDs are valid
      const generatedIds = [
        (userParams.args.data[0] as any).id as string,
        (userParams.args.data[2] as any).id as string,
        (adminParams.args.data[0] as any).id as string,
        (adminParams.args.data[1] as any).id as string,
      ];

      generatedIds.forEach((id) => {
        const prefix = id.startsWith("usr_") ? "usr_" : "adm_";
        const ksuidPart = id.slice(prefix.length);
        expect(() => KSUID.parse(ksuidPart)).not.toThrow();
      });
    });
  });

  describe("Cross-Library Compatibility Tests", () => {
    test("generateKSUID produces KSUIDs compatible with @owpz/ksuid operations", () => {
      const id1 = generateKSUID("test_");
      const id2 = generateKSUID("test_");

      // Extract KSUID parts
      const ksuid1 = KSUID.parse(id1.slice(5));
      const ksuid2 = KSUID.parse(id2.slice(5));

      // Test comparison
      const comparison = ksuid1.compare(ksuid2);
      expect(typeof comparison).toBe("number");

      // Test next/prev operations
      const nextKsuid = ksuid1.next();
      const prevKsuid = ksuid1.prev();

      expect(nextKsuid.compare(ksuid1)).toBe(1);
      expect(prevKsuid.compare(ksuid1)).toBe(-1);

      // Test buffer operations
      const buffer1 = ksuid1.toBuffer();
      const reconstructed = KSUID.fromBytes(buffer1);
      expect(reconstructed.toString()).toBe(ksuid1.toString());
    });

    test("KSUIDs from different sources maintain chronological ordering", () => {
      const directKsuid = KSUID.random().toString();
      const wrapperKsuid = generateKSUID();

      // Parse both and compare timestamps
      const direct = KSUID.parse(directKsuid);
      const wrapper = KSUID.parse(wrapperKsuid);

      // Both should have recent timestamps
      const now = Math.floor(Date.now() / 1000);
      const epoch = 1400000000; // KSUID epoch
      const directTime = direct.timestamp + epoch;
      const wrapperTime = wrapper.timestamp + epoch;

      expect(Math.abs(directTime - now)).toBeLessThan(5); // Within 5 seconds
      expect(Math.abs(wrapperTime - now)).toBeLessThan(5); // Within 5 seconds
    });

    test("batch operations maintain uniqueness across different generation methods", () => {
      const batchSize = 50;
      const allIds = new Set<string>();

      // Generate using wrapper function
      for (let i = 0; i < batchSize; i++) {
        allIds.add(generateKSUID("wrap_"));
      }

      // Generate using direct @owpz/ksuid
      for (let i = 0; i < batchSize; i++) {
        allIds.add(`direct_${KSUID.random().toString()}`);
      }

      // All should be unique
      expect(allIds.size).toBe(batchSize * 2);

      // Verify all wrapper-generated IDs are valid
      const wrapperIds = Array.from(allIds).filter((id) =>
        id.startsWith("wrap_"),
      );
      expect(wrapperIds.length).toBe(batchSize);

      wrapperIds.forEach((id) => {
        const ksuidPart = id.slice(5);
        expect(() => KSUID.parse(ksuidPart)).not.toThrow();
      });
    });
  });

  describe("Real-world Scenario Tests", () => {
    test("simulates typical user registration flow", async () => {
      const middleware = createKsuidMiddleware({
        prefixMap: {
          User: "usr_",
          Profile: "prof_",
          Settings: "set_",
        },
      });

      // Create user
      const userParams = {
        model: "User",
        action: "create",
        args: {
          data: {
            email: "user@example.com",
            username: "testuser",
          },
        },
      };

      const userNext = jest.fn().mockResolvedValue({
        id: "usr_generated",
        email: "user@example.com",
        username: "testuser",
      });

      await middleware(userParams, userNext);
      const userId = (userParams.args.data as any).id as string;

      // Create profile linked to user
      const profileParams = {
        model: "Profile",
        action: "create",
        args: {
          data: {
            userId,
            firstName: "Test",
            lastName: "User",
          },
        },
      };

      const profileNext = jest.fn().mockResolvedValue({
        id: "prof_generated",
        userId,
        firstName: "Test",
        lastName: "User",
      });

      await middleware(profileParams, profileNext);
      const profileId = (profileParams.args.data as any).id as string;

      // Verify all IDs are valid and properly prefixed
      expect(userId.startsWith("usr_")).toBe(true);
      expect(profileId.startsWith("prof_")).toBe(true);

      const userKsuid = KSUID.parse(userId.slice(4));
      const profileKsuid = KSUID.parse(profileId.slice(5));

      expect(userKsuid.isNil()).toBe(false);
      expect(profileKsuid.isNil()).toBe(false);
    });

    test("handles high-volume batch inserts", async () => {
      const middleware = createKsuidMiddleware({
        prefixMap: { BatchItem: "batch_" },
      });

      const batchSize = 200;
      const batchData = Array.from({ length: batchSize }, (_, i) => ({
        name: `Item ${i}`,
        value: i * 10,
      }));

      const params = {
        model: "BatchItem",
        action: "createMany",
        args: { data: batchData },
      };

      const next = jest.fn().mockResolvedValue({ count: batchSize });

      const startTime = Date.now();
      await middleware(params, next);
      const duration = Date.now() - startTime;

      // Should complete quickly
      expect(duration).toBeLessThan(1000);

      // All items should have IDs
      const generatedIds = params.args.data.map(
        (item: any) => item.id as string,
      );
      expect(generatedIds.length).toBe(batchSize);

      // All IDs should be unique and valid
      const uniqueIds = new Set(generatedIds);
      expect(uniqueIds.size).toBe(batchSize);

      generatedIds.forEach((id) => {
        expect(id.startsWith("batch_")).toBe(true);
        const ksuidPart = id.slice(6);
        expect(() => KSUID.parse(ksuidPart)).not.toThrow();
      });
    });
  });
});
