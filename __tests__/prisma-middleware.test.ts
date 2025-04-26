import { createKsuidMiddleware } from "../src";
import { generateKSUID } from "../src";

// Mock the generateKSUID function
jest.mock("../src/util/ksuid", () => ({
  generateKSUID: jest.fn(),
}));

describe("Prisma KSUID Middleware", () => {
  beforeEach(() => {
    // Reset the mock before each test
    jest.clearAllMocks();
    (generateKSUID as jest.Mock).mockImplementation(
      (prefix: string = "") => `${prefix}mockedKSUID`,
    );
  });

  test("should add id field to create operation", async () => {
    const middleware = createKsuidMiddleware({
      prefixMap: { User: "usr_" },
    });

    const params = {
      model: "User",
      action: "create",
      args: { data: {} as Record<string, unknown> },
    };

    const next = jest
      .fn()
      .mockResolvedValue({ id: "usr_mockedKSUID", name: "John" });

    await middleware(params, next);

    expect(params.args.data.id).toBe("usr_mockedKSUID");
    expect(generateKSUID).toHaveBeenCalledWith("usr_");
    expect(next).toHaveBeenCalledWith(params);
  });

  test("should not override existing id in create operation", async () => {
    const middleware = createKsuidMiddleware({
      prefixMap: { User: "usr_" },
    });

    const params = {
      model: "User",
      action: "create",
      args: { data: { id: "existing_id" } },
    };

    const next = jest
      .fn()
      .mockResolvedValue({ id: "existing_id", name: "John" });

    await middleware(params, next);

    expect(params.args.data.id).toBe("existing_id");
    expect(generateKSUID).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledWith(params);
  });

  test("should add ids to createMany operation", async () => {
    const middleware = createKsuidMiddleware({
      prefixMap: { User: "usr_" },
    });

    const params = {
      model: "User",
      action: "createMany",
      args: {
        data: [
          { name: "John" },
          { name: "Jane" },
          { id: "existing_id", name: "Bob" },
        ],
      },
    };

    const next = jest.fn().mockResolvedValue({ count: 3 });

    await middleware(params, next);

    expect(params.args.data[0].id).toBe("usr_mockedKSUID");
    expect(params.args.data[1].id).toBe("usr_mockedKSUID");
    expect(params.args.data[2].id).toBe("existing_id");
    expect(generateKSUID).toHaveBeenCalledTimes(2);
    expect(next).toHaveBeenCalledWith(params);
  });

  test("should use prefixFn when prefix not found in prefixMap", async () => {
    const prefixFn = jest.fn().mockReturnValue("custom_");

    const middleware = createKsuidMiddleware({
      prefixMap: { User: "usr_" },
      prefixFn,
    });

    const params = {
      model: "Product",
      action: "create",
      args: { data: {} as Record<string, unknown> },
    };

    const next = jest
      .fn()
      .mockResolvedValue({ id: "custom_mockedKSUID", name: "Product 1" });

    await middleware(params, next);

    expect(prefixFn).toHaveBeenCalledWith("Product");
    expect(params.args.data.id).toBe("custom_mockedKSUID");
    expect(generateKSUID).toHaveBeenCalledWith("custom_");
    expect(next).toHaveBeenCalledWith(params);
  });

  test("should throw error when prefix not defined", async () => {
    const middleware = createKsuidMiddleware({
      prefixMap: { User: "usr_" },
    });

    const params = {
      model: "Product",
      action: "create",
      args: { data: {} as Record<string, unknown> },
    };

    const next = jest.fn();

    await expect(middleware(params, next)).rejects.toThrow(
      'Prefix not defined or invalid for model "Product"',
    );
    expect(next).not.toHaveBeenCalled();
  });

  test("should throw error when prefixMap is not valid", () => {
    expect(() => {
      // @ts-expect-error - Testing invalid input
      createKsuidMiddleware({ prefixMap: null });
    }).toThrow("A valid prefixMap must be provided.");
  });

  // New test: No ID added for operations other than create/createMany
  test("should not add id field for non-create operations", async () => {
    const middleware = createKsuidMiddleware({
      prefixMap: { User: "usr_" },
    });

    const operations = ["update", "delete", "findUnique", "findMany"];

    for (const action of operations) {
      const params = {
        model: "User",
        action,
        args: { data: {} as Record<string, unknown> },
      };

      const next = jest
        .fn()
        .mockResolvedValue({ id: "existing_id", name: "John" });

      await middleware(params, next);

      expect(params.args.data.id).toBeUndefined();
      expect(generateKSUID).not.toHaveBeenCalled();
      expect(next).toHaveBeenCalledWith(params);
    }
  });

  // New test: Handling malformed data arguments for create operation
  test("should handle missing data property in create operation", async () => {
    const middleware = createKsuidMiddleware({
      prefixMap: { User: "usr_" },
    });

    const params = {
      model: "User",
      action: "create",
      args: {}, // Missing data property
    };

    const next = jest
      .fn()
      .mockResolvedValue({ id: "usr_mockedKSUID", name: "John" });

    await middleware(params, next);

    // Should not throw and should pass params to next
    expect(next).toHaveBeenCalledWith(params);
    expect(generateKSUID).not.toHaveBeenCalled();
  });

  // New test: createMany with mixed records (some with IDs, some without)
  test("should handle createMany with a mix of records with and without IDs", async () => {
    const middleware = createKsuidMiddleware({
      prefixMap: { User: "usr_" },
    });

    const params = {
      model: "User",
      action: "createMany",
      args: {
        data: [
          { name: "John" },
          { id: "existing_id", name: "Bob" },
          { name: "Alice" },
          { id: "", name: "Empty ID" }, // Empty string ID should be replaced
          { name: "Charlie", id: null }, // Null ID should be replaced
        ],
      },
    };

    const next = jest.fn().mockResolvedValue({ count: 5 });

    await middleware(params, next);

    expect(params.args.data[0].id).toBe("usr_mockedKSUID");
    expect(params.args.data[1].id).toBe("existing_id"); // Should keep existing ID
    expect(params.args.data[2].id).toBe("usr_mockedKSUID");
    expect(params.args.data[3].id).toBe("usr_mockedKSUID"); // Empty string ID gets replaced
    expect(params.args.data[4].id).toBe("usr_mockedKSUID"); // Null ID gets replaced

    // Should be called 4 times (for records 0, 2, 3, and 4)
    expect(generateKSUID).toHaveBeenCalledTimes(4);
    expect(next).toHaveBeenCalledWith(params);
  });
});
