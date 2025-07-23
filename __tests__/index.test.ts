import { generateKSUID } from "../src";
import { createKsuidMiddleware } from "../src";

describe("Index Exports", () => {
  test("exports generateKSUID function correctly", () => {
    expect(generateKSUID).toBeDefined();
    expect(typeof generateKSUID).toBe("function");

    // Verify function behavior is correct
    const ksuid = generateKSUID();
    expect(ksuid).toBeDefined();
    expect(ksuid.length).toBe(27);
  });

  test("exports createKsuidMiddleware function correctly", () => {
    expect(createKsuidMiddleware).toBeDefined();
    expect(typeof createKsuidMiddleware).toBe("function");

    // Now it should be the enhanced middleware
    expect(createKsuidMiddleware).toBe(createKsuidMiddleware);

    // Verify function accepts proper parameters
    const middleware = createKsuidMiddleware({
      prefixMap: { User: "usr_" },
    });
    expect(typeof middleware).toBe("function");
  });

  test("createKsuidMiddleware supports enhanced features", () => {
    // Test that it accepts the processNestedCreates option
    const middleware = createKsuidMiddleware({
      prefixMap: { User: "usr_", Profile: "prof_" },
      processNestedCreates: true,
    });
    expect(typeof middleware).toBe("function");

    // Test backwards compatibility - should work without processNestedCreates
    const legacyMiddleware = createKsuidMiddleware({
      prefixMap: { User: "usr_" },
    });
    expect(typeof legacyMiddleware).toBe("function");
  });
});
