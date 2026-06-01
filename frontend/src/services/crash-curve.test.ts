import { describe, expect, it } from "vitest";
import {
  buildCrashCurvePolyline,
  getCrashCurveFormula,
  getCrashCurveHumanRate,
} from "./crash-curve";

describe("crash curve helpers", () => {
  it("renders the backend exponential multiplier formula", () => {
    expect(getCrashCurveFormula(10000, 1500)).toBe(
      "multiplierBp = floor(10000 * exp(0.15 * elapsedSeconds))",
    );
  });

  it("renders the human-readable exponential growth rate", () => {
    expect(getCrashCurveHumanRate(1500)).toBe("curva exponencial 15.00%/s");
  });

  it("builds a bounded SVG polyline for the visible curve progress", () => {
    const points = buildCrashCurvePolyline(0.5, 4);

    expect(points).toBe("8.00,88.00 50.00,53.00");
  });
});
