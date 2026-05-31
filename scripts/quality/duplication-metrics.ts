import { existsSync, mkdirSync, readFileSync } from "node:fs";
import path from "node:path";

import type { QualityDuplicationMetrics } from "./quality-gate";
import { defaultQualityPaths, sourceRoots } from "./quality-paths";

const decoder = new TextDecoder();

export async function collectDuplicationMetrics(
  rootDir: string,
): Promise<QualityDuplicationMetrics> {
  const outputDir = path.join(rootDir, defaultQualityPaths.jscpdOutput);
  mkdirSync(outputDir, { recursive: true });

  const result = Bun.spawnSync({
    cmd: [
      "bunx",
      "jscpd",
      "--silent",
      "--min-lines",
      "5",
      "--min-tokens",
      "50",
      "--threshold",
      "100",
      "--reporters",
      "json",
      "--output",
      defaultQualityPaths.jscpdOutput,
      "--format",
      "typescript,tsx",
      "--ignore",
      "**/*.test.ts",
      "--ignore",
      "**/*.test.tsx",
      ...sourceRoots,
    ],
    cwd: rootDir,
    stdout: "pipe",
    stderr: "pipe",
  });

  if (result.exitCode !== 0) {
    throw new Error(
      `jscpd failed with exit code ${result.exitCode}.\n${decode(result.stdout)}\n${decode(result.stderr)}`.trim(),
    );
  }

  const reportPath = path.join(outputDir, "jscpd-report.json");

  if (!existsSync(reportPath)) {
    throw new Error(`jscpd report not found: ${reportPath}`);
  }

  return parseJscpdReport(JSON.parse(readFileSync(reportPath, "utf8")));
}

export function parseJscpdReport(report: unknown): QualityDuplicationMetrics {
  const total = readObject(readObject(readObject(report).statistics).total);
  const duplicateEntries = Array.isArray(readObject(report).duplicates)
    ? (readObject(report).duplicates as unknown[])
    : [];

  return {
    percentage: readNumber(total.percentage),
    duplicatedLines: readNumber(total.duplicatedLines),
    clones: readNumber(total.clones, duplicateEntries.length),
  };
}

function readObject(input: unknown): Record<string, unknown> {
  return input && typeof input === "object" && !Array.isArray(input)
    ? (input as Record<string, unknown>)
    : {};
}

function readNumber(input: unknown, fallback = 0): number {
  return typeof input === "number" && Number.isFinite(input) ? input : fallback;
}

function decode(value: Uint8Array): string {
  return decoder.decode(value);
}
