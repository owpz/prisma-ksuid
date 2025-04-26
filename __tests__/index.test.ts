import { generateKSUID, createKsuidMiddleware } from "../src";
import { generateKSUID as originalGenerateKSUID } from "../src/util/ksuid";
import { createKsuidMiddleware as originalCreateKsuidMiddleware } from "../src/prisma-middleware";

describe("Index Exports", () => {
  test("exports generateKSUID function correctly", () => {
    expect(generateKSUID).toBeDefined();
    expect(typeof generateKSUID).toBe("function");
    expect(generateKSUID).toBe(originalGenerateKSUID);

    // Verify function behavior is correct
    const ksuid = generateKSUID();
    expect(ksuid).toBeDefined();
    expect(ksuid.length).toBe(27);
  });

  test("exports createKsuidMiddleware function correctly", () => {
    expect(createKsuidMiddleware).toBeDefined();
    expect(typeof createKsuidMiddleware).toBe("function");
    expect(createKsuidMiddleware).toBe(originalCreateKsuidMiddleware);

    // Verify function accepts proper parameters
    const middleware = createKsuidMiddleware({
      prefixMap: { User: "usr_" },
    });
    expect(typeof middleware).toBe("function");
  });
});
