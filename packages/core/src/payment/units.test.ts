import { describe, expect, it } from "vitest";

import { decimalToAtomicUnits } from "./units";

describe("decimalToAtomicUnits", () => {
  it("converts USDC-style amounts", () => {
    expect(decimalToAtomicUnits("25", 6)).toBe("25000000");
  });

  it("preserves fractional precision", () => {
    expect(decimalToAtomicUnits("25.50", 6)).toBe("25500000");
  });

  it("handles zero", () => {
    expect(decimalToAtomicUnits("0", 6)).toBe("0");
  });

  it("rejects excessive precision", () => {
    expect(() => decimalToAtomicUnits("1.1234567", 6)).toThrow();
  });

  it("rejects invalid values", () => {
    expect(() => decimalToAtomicUnits("1e6", 6)).toThrow();
  });
});
