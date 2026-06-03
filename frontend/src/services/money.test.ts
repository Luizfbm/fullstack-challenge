import { describe, expect, it } from "vitest";
import {
  formatCents,
  formatCentsForRealInput,
  normalizeCentsInput,
  parseRealInputToCents,
} from "./money";

describe("money helpers", () => {
  it("formats cents as BRL currency", () => {
    expect(formatCents("1000").replace(/\s/u, " ")).toBe("R$ 10,00");
  });

  it("keeps only integer cents from user input", () => {
    expect(normalizeCentsInput("R$ 0010,50")).toBe("1050");
    expect(normalizeCentsInput("")).toBe("0");
  });

  it("formats stored cents for a BRL amount input", () => {
    expect(formatCentsForRealInput("1000")).toBe("10,00");
    expect(formatCentsForRealInput("100000")).toBe("1000,00");
  });

  it("parses reais typed by the player into integer cents", () => {
    expect(parseRealInputToCents("12,50")).toBe("1250");
    expect(parseRealInputToCents("12.50")).toBe("1250");
    expect(parseRealInputToCents("1000")).toBe("100000");
    expect(parseRealInputToCents("R$ 0010,05")).toBe("1005");
    expect(parseRealInputToCents("")).toBe("0");
  });
});
