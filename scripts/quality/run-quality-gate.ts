import path from "node:path";

import {
  collectQualityMetrics,
  defaultQualityPaths,
  loadBaseline,
  writeJsonFile,
  writeTextFile,
} from "./collect-metrics";
import {
  compareQualityMetrics,
  renderQualityGateMarkdown,
} from "./quality-gate";

const rootDir = process.cwd();
const baseline = loadBaseline(rootDir);
const current = await collectQualityMetrics(rootDir);
const result = compareQualityMetrics(baseline.metrics, current);
const summary = renderQualityGateMarkdown(result, current);

writeJsonFile(path.join(rootDir, defaultQualityPaths.currentMetrics), current);
writeTextFile(path.join(rootDir, defaultQualityPaths.summary), summary);

console.log(summary);

if (result.status === "failed") {
  process.exit(1);
}
