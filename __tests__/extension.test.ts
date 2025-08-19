import { createKsuidExtension } from "../src";

describe("Prisma Extension", () => {
  test("exports createKsuidExtension function correctly", () => {
    expect(createKsuidExtension).toBeDefined();
    expect(typeof createKsuidExtension).toBe("function");
  });

  test("createKsuidExtension returns a valid Prisma extension", () => {
    const extension = createKsuidExtension({
      prefixMap: { User: "usr_", Profile: "prof_" },
    });

    expect(extension).toBeDefined();
    expect(typeof extension).toBe("function");
  });

  test("createKsuidExtension supports processNestedCreates option", () => {
    const extension = createKsuidExtension({
      prefixMap: { User: "usr_" },
      processNestedCreates: false,
    });

    expect(extension).toBeDefined();
    expect(typeof extension).toBe("function");
  });

  test("createKsuidExtension supports prefixFn option", () => {
    const extension = createKsuidExtension({
      prefixMap: { User: "usr_" },
      prefixFn: (model) => model.slice(0, 2).toLowerCase() + "_",
    });

    expect(extension).toBeDefined();
    expect(typeof extension).toBe("function");
  });

  test("createKsuidExtension throws error for invalid prefixMap", () => {
    expect(() => {
      createKsuidExtension({
        prefixMap: null as any,
      });
    }).toThrow("A valid prefixMap must be provided.");

    expect(() => {
      createKsuidExtension({
        prefixMap: [] as any,
      });
    }).toThrow("A valid prefixMap must be provided.");
  });
});