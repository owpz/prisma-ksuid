import { generateKSUID } from "../../src";
import { KSUID } from "@owpz/ksuid";

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

  describe("Advanced KSUID Generation Tests", () => {
    test("generates valid KSUIDs with various prefix types", () => {
      const prefixes = [
        "",
        "a",
        "user_",
        "very_long_prefix_with_numbers_123_",
        "UPPERCASE_",
        "MiXeD_CaSe_",
        "123_numeric_start_",
        "special-chars_@#$%^&*()_",
        "unicode_émojî_🎉_",
      ];

      prefixes.forEach((prefix) => {
        const ksuid = generateKSUID(prefix);
        expect(ksuid).toBeDefined();
        expect(ksuid.startsWith(prefix)).toBeTruthy();
        expect(ksuid.length).toBe(prefix.length + 27);

        // Verify the KSUID part is valid
        const ksuidPart = ksuid.slice(prefix.length);
        expect(ksuidPart).toMatch(/^[0-9A-Za-z]+$/);
        expect(ksuidPart.length).toBe(27);
      });
    });

    test("generates KSUIDs that can be parsed by KSUID library", () => {
      const plainKsuid = generateKSUID();
      const prefixedKsuid = generateKSUID("test_");

      // Plain KSUID should be parseable
      expect(() => KSUID.parse(plainKsuid)).not.toThrow();

      // Prefixed KSUID should be parseable after removing prefix
      const ksuidPart = prefixedKsuid.slice(5); // Remove "test_"
      expect(() => KSUID.parse(ksuidPart)).not.toThrow();
    });

    test("generates KSUIDs with consistent timestamp ordering", () => {
      jest.useFakeTimers();

      const ksuids: string[] = [];
      const timestamps: number[] = [];

      // Generate KSUIDs over time
      for (let i = 0; i < 10; i++) {
        const ksuid = generateKSUID();
        const parsed = KSUID.parse(ksuid);
        ksuids.push(ksuid);
        timestamps.push(parsed.timestamp);

        // Small delay to ensure different timestamps
        jest.advanceTimersByTime(1100); // Advance more than 1 second
      }

      // Timestamps should be non-decreasing
      for (let i = 1; i < timestamps.length; i++) {
        expect(timestamps[i]).toBeGreaterThanOrEqual(timestamps[i - 1]);
      }

      jest.useRealTimers();
    });

    test("stress test: generates large number of unique KSUIDs", () => {
      const count = 1000;
      const ksuids = new Set<string>();

      for (let i = 0; i < count; i++) {
        const ksuid = generateKSUID(`batch_${i % 10}_`);
        ksuids.add(ksuid);
      }

      expect(ksuids.size).toBe(count);
    });

    test("handles undefined prefix parameter", () => {
      const ksuid = generateKSUID(undefined as any);
      expect(ksuid).toBeDefined();
      expect(ksuid.length).toBe(27);
      expect(ksuid).toMatch(/^[0-9A-Za-z]+$/);
    });

    test("handles null prefix parameter", () => {
      const ksuid = generateKSUID(null as any);
      expect(ksuid).toBeDefined();
      expect(ksuid.startsWith("null")).toBeTruthy();
      expect(ksuid.length).toBe(31); // "null" + 27
    });

    test("performance test: generates KSUIDs quickly", () => {
      const start = Date.now();
      const count = 100;

      for (let i = 0; i < count; i++) {
        generateKSUID("perf_");
      }

      const duration = Date.now() - start;
      expect(duration).toBeLessThan(1000); // Should complete in less than 1 second
    });

    test("validates KSUID properties match @owpz/ksuid expectations", () => {
      const ksuid = generateKSUID();
      const parsed = KSUID.parse(ksuid);

      // Should have valid timestamp (not nil)
      expect(parsed.timestamp).toBeGreaterThan(0);

      // Should not be nil KSUID
      expect(parsed.isNil()).toBe(false);

      // Should have valid payload
      expect(parsed.payload).toBeDefined();
      expect(parsed.payload.length).toBe(16);

      // Should convert back to same string
      expect(parsed.toString()).toBe(ksuid);
    });

    test("generates different KSUIDs even with same prefix", () => {
      const prefix = "same_prefix_";
      const ksuid1 = generateKSUID(prefix);
      const ksuid2 = generateKSUID(prefix);

      expect(ksuid1).not.toBe(ksuid2);
      expect(ksuid1.startsWith(prefix)).toBeTruthy();
      expect(ksuid2.startsWith(prefix)).toBeTruthy();
    });
  });

  describe("Edge Cases and Error Handling", () => {
    test("handles very long prefixes", () => {
      const longPrefix = "a".repeat(1000);
      const ksuid = generateKSUID(longPrefix);

      expect(ksuid).toBeDefined();
      expect(ksuid.startsWith(longPrefix)).toBeTruthy();
      expect(ksuid.length).toBe(longPrefix.length + 27);
    });

    test("handles prefix with newlines and special whitespace", () => {
      const weirdPrefix = "prefix\n\t\r ";
      const ksuid = generateKSUID(weirdPrefix);

      expect(ksuid).toBeDefined();
      expect(ksuid.startsWith(weirdPrefix)).toBeTruthy();
      expect(ksuid.length).toBe(weirdPrefix.length + 27);
    });

    test("maintains consistent behavior across multiple calls", () => {
      const testCases = ["", "test_", "user_", "product_", "order_item_"];

      testCases.forEach((prefix) => {
        const results = Array.from({ length: 5 }, () => generateKSUID(prefix));

        // All should start with prefix
        results.forEach((result) => {
          expect(result.startsWith(prefix)).toBeTruthy();
          expect(result.length).toBe(prefix.length + 27);
        });

        // All should be unique
        const uniqueResults = new Set(results);
        expect(uniqueResults.size).toBe(results.length);
      });
    });
  });
});
