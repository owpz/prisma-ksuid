import { generateKSUID, createKsuidExtension, createKsuidMiddleware } from "../src";

describe("Index Exports", () => {
  test("exports generateKSUID function correctly", () => {
    expect(generateKSUID).toBeDefined();
    expect(typeof generateKSUID).toBe("function");

    // Verify function behavior is correct
    const ksuid = generateKSUID();
    expect(ksuid).toBeDefined();
    expect(ksuid.length).toBe(27);
  });

  test("exports createKsuidExtension function correctly", () => {
    expect(createKsuidExtension).toBeDefined();
    expect(typeof createKsuidExtension).toBe("function");

    // Verify function accepts proper parameters
    const extension = createKsuidExtension({
      prefixMap: { User: "usr_" },
    });
    expect(typeof extension).toBe("function");
  });

  test("createKsuidMiddleware exists for backward compatibility", () => {
    // Suppress console.warn for this test
    const originalWarn = console.warn;
    console.warn = jest.fn();

    expect(createKsuidMiddleware).toBeDefined();
    expect(typeof createKsuidMiddleware).toBe("function");

    // Verify it returns an extension (same as createKsuidExtension)
    const result = createKsuidMiddleware({
      prefixMap: { User: "usr_" },
    });
    expect(typeof result).toBe("function");

    // Verify deprecation warning was shown
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining("createKsuidMiddleware is deprecated")
    );

    // Restore console.warn
    console.warn = originalWarn;
  });

  test("createKsuidExtension supports enhanced features", () => {
    // Test that it accepts the processNestedCreates option
    const extension = createKsuidExtension({
      prefixMap: { User: "usr_", Profile: "prof_" },
      processNestedCreates: true,
    });
    expect(typeof extension).toBe("function");

    // Test with processNestedCreates disabled
    const extensionNoNested = createKsuidExtension({
      prefixMap: { User: "usr_" },
      processNestedCreates: false,
    });
    expect(typeof extensionNoNested).toBe("function");

    // Test with prefixFn
    const extensionWithFn = createKsuidExtension({
      prefixMap: { User: "usr_" },
      prefixFn: (model) => `${model.toLowerCase()}_`,
    });
    expect(typeof extensionWithFn).toBe("function");
  });
});
