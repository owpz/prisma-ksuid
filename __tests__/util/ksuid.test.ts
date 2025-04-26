import { generateKSUID } from "../../src";

describe("KSUID Utility", () => {
  test("generates a valid KSUID with correct length", () => {
    const ksuid = generateKSUID();
    expect(ksuid).toBeDefined();
    expect(ksuid.length).toBe(27);
  });

  test("generates a valid KSUID with prefix", () => {
    const prefix = "usr_";
    const ksuid = generateKSUID(prefix);
    expect(ksuid).toBeDefined();
    expect(ksuid.startsWith(prefix)).toBeTruthy();
    expect(ksuid.length).toBe(prefix.length + 27);
  });

  test("generates unique KSUIDs", () => {
    const count = 100;
    const ksuids = new Set();

    for (let i = 0; i < count; i++) {
      ksuids.add(generateKSUID());
    }

    expect(ksuids.size).toBe(count);
  });

  test("generates time-sortable KSUIDs", () => {
    // Setup fake timers
    jest.useFakeTimers();

    // Generate first KSUID
    const first = generateKSUID();

    // Advance time by 1001ms to ensure timestamps differ (KSUIDs use second-level precision)
    jest.advanceTimersByTime(1001);

    // Generate second KSUID
    const second = generateKSUID();

    // KSUIDs should sort chronologically when timestamps differ
    expect(first < second).toBeTruthy();

    // Restore real timers
    jest.useRealTimers();
  });

  test("generates KSUIDs with empty string prefix", () => {
    const ksuid = generateKSUID("");
    expect(ksuid).toBeDefined();
    expect(ksuid.length).toBe(27);
  });

  test("generates KSUIDs with special character prefixes", () => {
    const specialPrefix = "@#$%_";
    const ksuid = generateKSUID(specialPrefix);
    expect(ksuid).toBeDefined();
    expect(ksuid.startsWith(specialPrefix)).toBeTruthy();
    expect(ksuid.length).toBe(specialPrefix.length + 27);
  });

  test("generated KSUIDs match expected format", () => {
    const ksuid = generateKSUID();
    // KSUIDs should only contain characters from the base62 alphabet
    expect(ksuid).toMatch(/^[0-9A-Za-z]+$/);
  });
});
