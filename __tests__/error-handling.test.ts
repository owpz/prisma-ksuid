import { createKsuidMiddleware } from "../src";

describe("Error Handling Tests", () => {
  describe("Middleware Configuration Errors", () => {
    test("throws error when prefixMap is null", () => {
      expect(() => {
        // @ts-expect-error - Testing invalid input
        createKsuidMiddleware({ prefixMap: null });
      }).toThrow("A valid prefixMap must be provided.");
    });

    test("throws error when prefixMap is undefined", () => {
      expect(() => {
        // @ts-expect-error - Testing invalid input
        createKsuidMiddleware({ prefixMap: undefined });
      }).toThrow("A valid prefixMap must be provided.");
    });

    test("throws error when prefixMap is not an object", () => {
      expect(() => {
        // @ts-expect-error - Testing invalid input
        createKsuidMiddleware({ prefixMap: "invalid" });
      }).toThrow("A valid prefixMap must be provided.");
    });

    test("throws error when prefixMap is an array", () => {
      expect(() => {
        // @ts-expect-error - Testing invalid input
        createKsuidMiddleware({ prefixMap: [] });
      }).toThrow("A valid prefixMap must be provided.");
    });

    test("accepts empty prefixMap if prefixFn is provided", () => {
      expect(() => {
        createKsuidMiddleware({
          prefixMap: {},
          prefixFn: (model) => `${model.toLowerCase()}_`,
        });
      }).not.toThrow();
    });
  });

  describe("Runtime Errors", () => {
    test("throws error when model not found in prefixMap and no prefixFn", async () => {
      const middleware = createKsuidMiddleware({
        prefixMap: { User: "usr_" },
      });

      const params = {
        model: "UnknownModel",
        action: "create",
        args: { data: {} },
      };

      const next = jest.fn();

      await expect(middleware(params, next)).rejects.toThrow(
        'Prefix not defined or invalid for model "UnknownModel"',
      );
      expect(next).not.toHaveBeenCalled();
    });

    test("throws error when prefixFn returns invalid prefix", async () => {
      const middleware = createKsuidMiddleware({
        prefixMap: { User: "usr_" },
        prefixFn: () => null as any, // Invalid return type
      });

      const params = {
        model: "Product",
        action: "create",
        args: { data: {} },
      };

      const next = jest.fn();

      await expect(middleware(params, next)).rejects.toThrow(
        'Prefix not defined or invalid for model "Product"',
      );
      expect(next).not.toHaveBeenCalled();
    });

    test("throws error when prefixFn returns undefined", async () => {
      const middleware = createKsuidMiddleware({
        prefixMap: { User: "usr_" },
        prefixFn: () => undefined as any,
      });

      const params = {
        model: "Product",
        action: "create",
        args: { data: {} },
      };

      const next = jest.fn();

      await expect(middleware(params, next)).rejects.toThrow(
        'Prefix not defined or invalid for model "Product"',
      );
      expect(next).not.toHaveBeenCalled();
    });

    test("throws error when prefixFn throws an exception", async () => {
      const middleware = createKsuidMiddleware({
        prefixMap: { User: "usr_" },
        prefixFn: () => {
          throw new Error("PrefixFn error");
        },
      });

      const params = {
        model: "Product",
        action: "create",
        args: { data: {} },
      };

      const next = jest.fn();

      await expect(middleware(params, next)).rejects.toThrow("PrefixFn error");
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe("Data Structure Edge Cases", () => {
    test("handles malformed create params gracefully", async () => {
      const middleware = createKsuidMiddleware({
        prefixMap: { User: "usr_" },
      });

      const malformedParams = [
        {
          model: "User",
          action: "create",
          args: null, // Malformed args
        },
        {
          model: "User",
          action: "create",
          args: {}, // Missing data property
        },
        {
          model: "User",
          action: "create",
          args: { data: null }, // Null data
        },
      ];

      const next = jest.fn().mockResolvedValue({ id: "result" });

      for (const params of malformedParams) {
        await expect(middleware(params as any, next)).resolves.not.toThrow();
        expect(next).toHaveBeenCalled();
        next.mockClear();
      }
    });

    test("handles malformed createMany params gracefully", async () => {
      const middleware = createKsuidMiddleware({
        prefixMap: { User: "usr_" },
      });

      const malformedParams = [
        {
          model: "User",
          action: "createMany",
          args: { data: null }, // Null data array
        },
        {
          model: "User",
          action: "createMany",
          args: { data: "not-an-array" }, // Invalid data type
        },
        {
          model: "User",
          action: "createMany",
          args: { data: [] }, // Empty array
        },
      ];

      const next = jest.fn().mockResolvedValue({ count: 0 });

      for (const params of malformedParams) {
        await expect(middleware(params as any, next)).resolves.not.toThrow();
        expect(next).toHaveBeenCalled();
        next.mockClear();
      }
    });

    test("handles mixed valid/invalid records in createMany", async () => {
      const middleware = createKsuidMiddleware({
        prefixMap: { User: "usr_" },
      });

      const params = {
        model: "User",
        action: "createMany",
        args: {
          data: [
            { name: "Valid User" }, // Valid record
            null, // Invalid record
            { name: "Another Valid User" }, // Valid record
            undefined, // Invalid record
            { name: "Third Valid User" }, // Valid record
          ] as any,
        },
      };

      const next = jest.fn().mockResolvedValue({ count: 3 });

      await middleware(params as any, next);

      // Should not throw and should pass through to next
      expect(next).toHaveBeenCalled();

      // Valid records should have IDs, invalid ones should remain unchanged
      expect(params.args.data[0]).toHaveProperty("id");
      expect(params.args.data[1]).toBe(null);
      expect(params.args.data[2]).toHaveProperty("id");
      expect(params.args.data[3]).toBe(undefined);
      expect(params.args.data[4]).toHaveProperty("id");
    });
  });

  describe("Next Function Error Propagation", () => {
    test("propagates errors from next function", async () => {
      const middleware = createKsuidMiddleware({
        prefixMap: { User: "usr_" },
      });

      const params = {
        model: "User",
        action: "create",
        args: { data: { name: "Test User" } },
      };

      const expectedError = new Error("Database connection failed");
      const next = jest.fn().mockRejectedValue(expectedError);

      await expect(middleware(params, next)).rejects.toThrow(
        "Database connection failed",
      );

      // Should still have generated the ID before calling next
      expect((params.args.data as any).id).toBeDefined();
      expect((params.args.data as any).id).toMatch(/^usr_[0-9A-Za-z]{27}$/);
    });

    test("handles async errors from next function", async () => {
      const middleware = createKsuidMiddleware({
        prefixMap: { User: "usr_" },
      });

      const params = {
        model: "User",
        action: "create",
        args: { data: { name: "Test User" } },
      };

      const next = jest.fn().mockImplementation(async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        throw new Error("Async error");
      });

      await expect(middleware(params, next)).rejects.toThrow("Async error");
    });
  });

  describe("Type Safety Edge Cases", () => {
    test("handles non-string model names gracefully", async () => {
      const middleware = createKsuidMiddleware({
        prefixMap: { "123": "num_" },
      });

      const params = {
        model: 123 as any, // Non-string model
        action: "create",
        args: { data: {} },
      };

      const next = jest.fn().mockResolvedValue({ id: "result" });

      // Should handle the conversion internally
      await expect(middleware(params, next)).resolves.not.toThrow();
    });

    test("handles non-string action names gracefully", async () => {
      const middleware = createKsuidMiddleware({
        prefixMap: { User: "usr_" },
      });

      const params = {
        model: "User",
        action: null as any, // Non-string action
        args: { data: {} },
      };

      const next = jest.fn().mockResolvedValue({ id: "result" });

      // Should not process non-create actions
      await middleware(params, next);
      expect((params.args.data as any).id).toBeUndefined();
    });
  });

  describe("Memory and Performance Edge Cases", () => {
    test("handles very large prefixMap without memory issues", () => {
      const largePrefixMap: Record<string, string> = {};

      // Create a large prefix map
      for (let i = 0; i < 10000; i++) {
        largePrefixMap[`Model${i}`] = `model${i}_`;
      }

      expect(() => {
        createKsuidMiddleware({ prefixMap: largePrefixMap });
      }).not.toThrow();
    });

    test("handles deeply nested data structures", async () => {
      const middleware = createKsuidMiddleware({
        prefixMap: { User: "usr_" },
      });

      // Create deeply nested object
      let deeplyNested: any = { name: "Test" };
      for (let i = 0; i < 1000; i++) {
        deeplyNested = { level: i, data: deeplyNested };
      }

      const params = {
        model: "User",
        action: "create",
        args: { data: deeplyNested },
      };

      const next = jest.fn().mockResolvedValue({ id: "result" });

      await expect(middleware(params, next)).resolves.not.toThrow();
      expect((params.args.data as any).id).toBeDefined();
    });
  });
});
