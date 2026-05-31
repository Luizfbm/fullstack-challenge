import { describe, expect, it } from "vitest";
import {
  buildCrashCurvePolyline,
  getCrashCurveFormula,
  getCrashCurveHumanRate,
} from "./crash-curve";

describe("crash curve helpers", () => {
  it("renders the backend multiplier formula with the configured growth", () => {
    expect(getCrashCurveFormula(1000)).toBe(
      "multiplierBp = 10000 + floor(elapsedMs * 1000 / 1000)",
    );
  });

  it("renders the human-readable growth rate", () => {
    expect(getCrashCurveHumanRate(1000)).toBe("1.00x + 0.10x por segundo");
  });

  it("builds a bounded SVG polyline for the visible curve progress", () => {
    const points = buildCrashCurvePolyline(0.5, 4);

    expect(points).toBe("8.00,88.00 50.00,53.00");
  });
});
