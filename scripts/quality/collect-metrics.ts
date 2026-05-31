import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import {
  collectCoverageMetrics,
  parseLcovCoverage,
} from "./coverage-metrics";
import {
  collectDuplicationMetrics,
  parseJscpdReport,
} from "./duplication-metrics";
import { collectFileMetrics } from "./file-metrics";
import type { QualityBaseline, QualityMetrics } from "./quality-gate";
import { defaultQualityPaths } from "./quality-paths";
import {
  collectSecurityMetrics,
  countSecuritySeverities,
} from "./security-metrics";

export { defaultQualityPaths } from "./quality-paths";
export { parseLcovCoverage, parseJscpdReport, countSecuritySeverities };

export async function collectQualityMetrics(
  rootDir = process.cwd(),
): Promise<QualityMetrics> {
  ensureDirectory(path.join(rootDir, "quality/reports"));

  const coverage = collectCoverageMetrics(rootDir);
  const duplication = await collectDuplicationMetrics(rootDir);
  const files = collectFileMetrics(rootDir);
  const security = collectSecurityMetrics(rootDir);

  return {
    generatedAt: new Date().toISOString(),
    coverage,
    duplication,
    files,
    security,
  };
}

export function loadBaseline(rootDir = process.cwd()): QualityBaseline {
  const baselinePath = path.join(rootDir, defaultQualityPaths.baseline);
  return JSON.parse(readFileSync(baselinePath, "utf8")) as QualityBaseline;
}

export function writeJsonFile(filePath: string, value: unknown): void {
  ensureDirectory(path.dirname(filePath));
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

export function writeTextFile(filePath: string, value: string): void {
  ensureDirectory(path.dirname(filePath));
  writeFileSync(filePath, value);
}

function ensureDirectory(dirPath: string): void {
  mkdirSync(dirPath, { recursive: true });
}
