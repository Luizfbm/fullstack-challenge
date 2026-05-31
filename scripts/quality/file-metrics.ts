import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

import type { QualityFileMetrics } from "./quality-gate";
import { sourceRoots } from "./quality-paths";

export function collectFileMetrics(rootDir: string): QualityFileMetrics {
  const lineLimit = 300;
  const files = sourceRoots
    .flatMap((sourceRoot) => collectSourceFiles(path.join(rootDir, sourceRoot)))
    .filter((filePath) => !filePath.endsWith(".test.ts"))
    .filter((filePath) => !filePath.endsWith(".test.tsx"));

  const fileLines = files.map((filePath) => ({
    path: path.relative(rootDir, filePath),
    lineCount: countLines(readFileSync(filePath, "utf8")),
  }));

  const largestFile = fileLines.reduce(
    (largest, current) =>
      current.lineCount > largest.lineCount ? current : largest,
    { path: "", lineCount: 0 },
  );

  return {
    sourceFiles: fileLines.length,
    lineLimit,
    filesOverLimit: fileLines.filter((file) => file.lineCount > lineLimit)
      .length,
    largestFile,
  };
}

function collectSourceFiles(rootDir: string): string[] {
  if (!existsSync(rootDir)) {
    return [];
  }

  return readdirSync(rootDir).flatMap((entry) => {
    const entryPath = path.join(rootDir, entry);
    const stats = statSync(entryPath);

    if (stats.isDirectory()) {
      if (entry === "node_modules" || entry === "dist" || entry === "coverage") {
        return [];
      }

      return collectSourceFiles(entryPath);
    }

    if (!stats.isFile()) {
      return [];
    }

    return entryPath.endsWith(".ts") || entryPath.endsWith(".tsx")
      ? [entryPath]
      : [];
  });
}

function countLines(content: string): number {
  if (content.length === 0) {
    return 0;
  }

  return content.split("\n").length;
}
