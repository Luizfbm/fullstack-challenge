import { describe, expect, test } from "bun:test";

import {
  countSecuritySeverities,
  parseJscpdReport,
  parseLcovCoverage,
} from "./collect-metrics";

describe("quality metrics collectors", () => {
  test("parses LCOV line coverage", () => {
    const coverage = parseLcovCoverage(
      ["TN:", "SF:src/example.ts", "DA:1,1", "DA:2,0", "DA:3,3", "end_of_record"].join(
        "\n",
      ),
    );

    expect(coverage).toEqual({
      covered: 2,
      total: 3,
      pct: 66.67,
    });
  });

  test("parses jscpd total statistics", () => {
    const duplication = parseJscpdReport({
      statistics: {
        total: {
          percentage: 2.25,
          duplicatedLines: 14,
          clones: 3,
        },
      },
    });

    expect(duplication).toEqual({
      percentage: 2.25,
      duplicatedLines: 14,
      clones: 3,
    });
  });

  test("counts audit severities recursively", () => {
    const security = countSecuritySeverities({
      advisories: [
        { severity: "critical" },
        { nested: { severity: "high" } },
        { severity: "moderate" },
        { severity: "low" },
      ],
    });

    expect(security).toEqual({
      critical: 1,
      high: 1,
      moderate: 1,
      low: 1,
    });
  });
});
