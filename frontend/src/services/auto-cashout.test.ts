import { describe, expect, it } from "vitest";
import {
  formatMultiplierBp,
  parseAutoCashoutMultiplierInput,
} from "./auto-cashout";

describe("auto cashout helpers", () => {
  it("parses decimal multipliers to basis points", () => {
    expect(parseAutoCashoutMultiplierInput("2.00")).toEqual({
      multiplierBp: 20000,
      valid: true,
    });
    expect(parseAutoCashoutMultiplierInput("1.50")).toEqual({
      multiplierBp: 15000,
      valid: true,
    });
  });

  it("rejects values outside the visible limits", () => {
    expect(parseAutoCashoutMultiplierInput("1.00")).toEqual({
      multiplierBp: null,
      valid: false,
    });
    expect(parseAutoCashoutMultiplierInput("1000.01")).toEqual({
      multiplierBp: null,
      valid: false,
    });
  });

  it("formats basis points for active bet display", () => {
    expect(formatMultiplierBp(20000)).toBe("2.00x");
  });
});
