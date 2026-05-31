import { describe, expect, it } from "vitest";
import { formatCents, normalizeCentsInput } from "./money";

describe("money helpers", () => {
  it("formats cents as BRL currency", () => {
    expect(formatCents("1000").replace(/\s/u, " ")).toBe("R$ 10,00");
  });

  it("keeps only integer cents from user input", () => {
    expect(normalizeCentsInput("R$ 0010,50")).toBe("1050");
    expect(normalizeCentsInput("")).toBe("0");
  });
});
