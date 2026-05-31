import { describe, expect, test } from "bun:test";

import {
  compareQualityMetrics,
  type QualityMetrics,
} from "./quality-gate";
import { renderQualityGateMarkdown } from "./quality-gate-report";

describe("quality gate ratchet", () => {
  test("passes when metrics are equal to the baseline", () => {
    const baseline = createMetrics();

    const result = compareQualityMetrics(baseline, createMetrics());

    expect(result.status).toBe("passed");
    expect(result.failures).toHaveLength(0);
  });

  test("passes when metrics improve", () => {
    const baseline = createMetrics();
    const current = createMetrics({
      globalCoverage: 91,
      gamesCoverage: 92,
      duplicatedLines: 8,
      duplicationClones: 0,
      duplicationPercentage: 1.5,
      largestFileLineCount: 118,
      filesOverLimit: 0,
    });

    const result = compareQualityMetrics(baseline, current);

    expect(result.status).toBe("passed");
    expect(result.failures).toHaveLength(0);
  });

  test("fails when global or package coverage regresses", () => {
    const baseline = createMetrics();
    const current = createMetrics({
      globalCoverage: 89.9,
      gamesCoverage: 89.8,
    });

    const result = compareQualityMetrics(baseline, current);

    expect(result.status).toBe("failed");
    expect(result.failures.map((finding) => finding.metric)).toEqual([
      "coverage.global.lines.pct",
      "coverage.packages.services/games.lines.pct",
    ]);
  });

  test("fails when duplicated code regresses", () => {
    const baseline = createMetrics();
    const current = createMetrics({
      duplicationPercentage: 2.51,
      duplicatedLines: 11,
      duplicationClones: 2,
    });

    const result = compareQualityMetrics(baseline, current);

    expect(result.status).toBe("failed");
    expect(result.failures.map((finding) => finding.metric)).toEqual([
      "duplication.percentage",
      "duplication.duplicatedLines",
      "duplication.clones",
    ]);
  });

  test("fails when source file size metrics regress", () => {
    const baseline = createMetrics();
    const current = createMetrics({
      largestFileLineCount: 121,
      filesOverLimit: 2,
    });

    const result = compareQualityMetrics(baseline, current);

    expect(result.status).toBe("failed");
    expect(result.failures.map((finding) => finding.metric)).toEqual([
      "files.largestFile.lineCount",
      "files.filesOverLimit",
    ]);
  });

  test("blocks critical vulnerabilities and warns on high vulnerabilities", () => {
    const baseline = createMetrics();
    const current = createMetrics({
      criticalVulnerabilities: 1,
      highVulnerabilities: 2,
    });

    const result = compareQualityMetrics(baseline, current);

    expect(result.status).toBe("failed");
    expect(result.failures.map((finding) => finding.metric)).toEqual([
      "security.critical",
    ]);
    expect(result.warnings.map((finding) => finding.metric)).toEqual([
      "security.high",
    ]);
  });

  test("renders actionable markdown feedback", () => {
    const baseline = createMetrics();
    const current = createMetrics({
      globalCoverage: 88,
      highVulnerabilities: 1,
    });

    const result = compareQualityMetrics(baseline, current);
    const markdown = renderQualityGateMarkdown(result, baseline, current);

    expect(markdown).toContain("# Quality Gate Failed");
    expect(markdown).toContain("| Metric | Baseline | Current | Delta | Status |");
    expect(markdown).toContain("| coverage.global.lines.pct | 90 | 88 | -2 | fail |");
    expect(markdown).toContain("coverage.global.lines.pct");
    expect(markdown).toContain("security.high");
    expect(markdown).toContain("Baseline: 90");
    expect(markdown).toContain("Current: 88");
  });
});

function createMetrics(overrides: Partial<{
  globalCoverage: number;
  gamesCoverage: number;
  walletsCoverage: number;
  frontendCoverage: number;
  duplicationPercentage: number;
  duplicatedLines: number;
  duplicationClones: number;
  largestFileLineCount: number;
  filesOverLimit: number;
  highVulnerabilities: number;
  criticalVulnerabilities: number;
}> = {}): QualityMetrics {
  const gamesCoverage = overrides.gamesCoverage ?? 90;
  const walletsCoverage = overrides.walletsCoverage ?? 90;
  const frontendCoverage = overrides.frontendCoverage ?? 90;
  const globalCoverage = overrides.globalCoverage ?? 90;

  return {
    generatedAt: "2026-05-31T00:00:00.000Z",
    coverage: {
      global: coverage(globalCoverage),
      packages: {
        "services/games": coverage(gamesCoverage),
        "services/wallets": coverage(walletsCoverage),
        frontend: coverage(frontendCoverage),
      },
    },
    duplication: {
      percentage: overrides.duplicationPercentage ?? 2.5,
      duplicatedLines: overrides.duplicatedLines ?? 10,
      clones: overrides.duplicationClones ?? 1,
    },
    files: {
      sourceFiles: 20,
      lineLimit: 300,
      filesOverLimit: overrides.filesOverLimit ?? 1,
      largestFile: {
        path: "services/games/src/example.ts",
        lineCount: overrides.largestFileLineCount ?? 120,
      },
    },
    security: {
      low: 0,
      moderate: 0,
      high: overrides.highVulnerabilities ?? 0,
      critical: overrides.criticalVulnerabilities ?? 0,
    },
  };
}

function coverage(pct: number) {
  return {
    covered: pct,
    total: 100,
    pct,
  };
}
