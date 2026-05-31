import type {
  QualityGateFinding,
  QualityGateResult,
  QualityMetrics,
} from "./quality-gate";

type MetricPolicy = "min" | "max" | "warn-max";

interface MetricRow {
  metric: string;
  baseline: number;
  current: number;
  policy: MetricPolicy;
}

export function renderQualityGateMarkdown(
  result: QualityGateResult,
  baseline: QualityMetrics,
  current: QualityMetrics,
): string {
  const lines = [
    `# Quality Gate ${result.status === "passed" ? "Passed" : "Failed"}`,
    "",
    `Generated at: ${current.generatedAt}`,
    "",
    "## Metric Ratchet",
    "",
    "| Metric | Baseline | Current | Delta | Status |",
    "| --- | ---: | ---: | ---: | --- |",
    ...buildMetricRows(baseline, current).map((row) =>
      renderMetricRow(row, result),
    ),
    "",
    "## Current Metrics",
    "",
    `- Largest source file: ${current.files.largestFile.path} (${current.files.largestFile.lineCount} lines)`,
    `- Files over ${current.files.lineLimit} lines: ${current.files.filesOverLimit}`,
    `- Vulnerabilities: critical=${current.security.critical}, high=${current.security.high}, moderate=${current.security.moderate}, low=${current.security.low}`,
    "",
  ];

  appendFindings(lines, "Failures", result.failures);
  appendFindings(lines, "Warnings", result.warnings);

  if (result.failures.length === 0 && result.warnings.length === 0) {
    lines.push("No regressions or warnings were detected.");
  }

  return `${lines.join("\n")}\n`;
}

function buildMetricRows(
  baseline: QualityMetrics,
  current: QualityMetrics,
): MetricRow[] {
  return [
    row(
      "coverage.global.lines.pct",
      baseline.coverage.global.pct,
      current.coverage.global.pct,
      "min",
    ),
    ...Object.entries(baseline.coverage.packages).map(
      ([packageName, packageBaseline]) =>
        row(
          `coverage.packages.${packageName}.lines.pct`,
          packageBaseline.pct,
          current.coverage.packages[packageName]?.pct ?? 0,
          "min",
        ),
    ),
    row(
      "duplication.percentage",
      baseline.duplication.percentage,
      current.duplication.percentage,
      "max",
    ),
    row(
      "duplication.duplicatedLines",
      baseline.duplication.duplicatedLines,
      current.duplication.duplicatedLines,
      "max",
    ),
    row(
      "duplication.clones",
      baseline.duplication.clones,
      current.duplication.clones,
      "max",
    ),
    row(
      "files.largestFile.lineCount",
      baseline.files.largestFile.lineCount,
      current.files.largestFile.lineCount,
      "max",
    ),
    row(
      "files.filesOverLimit",
      baseline.files.filesOverLimit,
      current.files.filesOverLimit,
      "max",
    ),
    row("security.critical", 0, current.security.critical, "max"),
    row("security.high", 0, current.security.high, "warn-max"),
  ];
}

function row(
  metric: string,
  baseline: number,
  current: number,
  policy: MetricPolicy,
): MetricRow {
  return { metric, baseline, current, policy };
}

function renderMetricRow(row: MetricRow, result: QualityGateResult): string {
  const finding = findFinding(row.metric, result);
  const status = finding
    ? finding.severity === "failure"
      ? "fail"
      : "warn"
    : passesPolicy(row)
      ? "pass"
      : "info";

  return `| ${row.metric} | ${formatNumber(row.baseline)} | ${formatNumber(row.current)} | ${formatDelta(row.current - row.baseline)} | ${status} |`;
}

function findFinding(
  metric: string,
  result: QualityGateResult,
): QualityGateFinding | undefined {
  return [...result.failures, ...result.warnings].find(
    (finding) => finding.metric === metric,
  );
}

function passesPolicy(row: MetricRow): boolean {
  if (row.policy === "min") {
    return row.current >= row.baseline;
  }

  return row.current <= row.baseline;
}

function appendFindings(
  lines: string[],
  title: string,
  findings: QualityGateFinding[],
): void {
  lines.push(`## ${title}`, "");

  if (findings.length === 0) {
    lines.push(`No ${title.toLowerCase()}.`, "");
    return;
  }

  for (const finding of findings) {
    const comparison =
      finding.baseline === undefined || finding.current === undefined
        ? ""
        : ` Baseline: ${formatNumber(finding.baseline)}. Current: ${formatNumber(finding.current)}.`;

    lines.push(`- **${finding.metric}**: ${finding.message}${comparison}`);
  }

  lines.push("");
}

function formatDelta(value: number): string {
  return value > 0 ? `+${formatNumber(value)}` : formatNumber(value);
}

function formatNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}
