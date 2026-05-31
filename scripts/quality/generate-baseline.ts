import path from "node:path";

import {
  collectQualityMetrics,
  defaultQualityPaths,
  writeJsonFile,
} from "./collect-metrics";
import type { QualityBaseline } from "./quality-gate";

const rootDir = process.cwd();
const metrics = await collectQualityMetrics(rootDir);
const baseline: QualityBaseline = {
  version: 1,
  description:
    "Quality gate baseline. Update this file manually only when the repository quality improves or the baseline policy changes.",
  generatedAt: metrics.generatedAt,
  metrics,
};

writeJsonFile(path.join(rootDir, defaultQualityPaths.baseline), baseline);
writeJsonFile(path.join(rootDir, defaultQualityPaths.currentMetrics), metrics);

console.log(`Quality baseline written to ${defaultQualityPaths.baseline}`);
