import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import type { CoverageTotals } from "./quality-gate";
import { coverageInputs } from "./quality-paths";

export function collectCoverageMetrics(rootDir: string) {
  const packages: Record<string, CoverageTotals> = {};
  let covered = 0;
  let total = 0;

  for (const input of coverageInputs) {
    const filePath = path.join(rootDir, input.lcovPath);

    if (!existsSync(filePath)) {
      throw new Error(
        `Coverage file not found: ${input.lcovPath}. Run bun run test:coverage before the quality gate.`,
      );
    }

    const packageCoverage = parseLcovCoverage(readFileSync(filePath, "utf8"));
    packages[input.name] = packageCoverage;
    covered += packageCoverage.covered;
    total += packageCoverage.total;
  }

  return {
    global: toCoverageTotals(covered, total),
    packages,
  };
}

export function parseLcovCoverage(content: string): CoverageTotals {
  let covered = 0;
  let total = 0;

  for (const line of content.split("\n")) {
    if (!line.startsWith("DA:")) {
      continue;
    }

    const [, hitCount] = line.slice(3).split(",");
    total += 1;

    if (Number(hitCount) > 0) {
      covered += 1;
    }
  }

  return toCoverageTotals(covered, total);
}

function toCoverageTotals(covered: number, total: number): CoverageTotals {
  return {
    covered,
    total,
    pct: total === 0 ? 100 : Number(((covered / total) * 100).toFixed(2)),
  };
}
