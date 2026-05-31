export type QualityGateStatus = "passed" | "failed";
export type QualityGateSeverity = "failure" | "warning";

export interface CoverageTotals {
  covered: number;
  total: number;
  pct: number;
}

export interface QualityCoverageMetrics {
  global: CoverageTotals;
  packages: Record<string, CoverageTotals>;
}

export interface QualityDuplicationMetrics {
  percentage: number;
  duplicatedLines: number;
  clones: number;
}

export interface LargestFileMetric {
  path: string;
  lineCount: number;
}

export interface QualityFileMetrics {
  sourceFiles: number;
  lineLimit: number;
  filesOverLimit: number;
  largestFile: LargestFileMetric;
}

export interface QualitySecurityMetrics {
  low: number;
  moderate: number;
  high: number;
  critical: number;
}

export interface QualityMetrics {
  generatedAt: string;
  coverage: QualityCoverageMetrics;
  duplication: QualityDuplicationMetrics;
  files: QualityFileMetrics;
  security: QualitySecurityMetrics;
}

export interface QualityBaseline {
  version: 1;
  description: string;
  generatedAt: string;
  metrics: QualityMetrics;
}

export interface QualityGateFinding {
  severity: QualityGateSeverity;
  metric: string;
  message: string;
  baseline?: number;
  current?: number;
}

export interface QualityGateResult {
  status: QualityGateStatus;
  failures: QualityGateFinding[];
  warnings: QualityGateFinding[];
}

const EPSILON = 0.0001;

export function compareQualityMetrics(
  baseline: QualityMetrics,
  current: QualityMetrics,
): QualityGateResult {
  const failures: QualityGateFinding[] = [];
  const warnings: QualityGateFinding[] = [];

  addMinimumFailure({
    findings: failures,
    metric: "coverage.global.lines.pct",
    message: "Global line coverage regressed.",
    baseline: baseline.coverage.global.pct,
    current: current.coverage.global.pct,
  });

  for (const [packageName, packageBaseline] of Object.entries(
    baseline.coverage.packages,
  )) {
    const packageCurrent = current.coverage.packages[packageName];

    if (!packageCurrent) {
      failures.push({
        severity: "failure",
        metric: `coverage.packages.${packageName}.lines.pct`,
        message: `Coverage package '${packageName}' is missing in current metrics.`,
        baseline: packageBaseline.pct,
      });
      continue;
    }

    addMinimumFailure({
      findings: failures,
      metric: `coverage.packages.${packageName}.lines.pct`,
      message: `Line coverage for package '${packageName}' regressed.`,
      baseline: packageBaseline.pct,
      current: packageCurrent.pct,
    });
  }

  addMaximumFailure({
    findings: failures,
    metric: "duplication.percentage",
    message: "Duplicated code percentage increased.",
    baseline: baseline.duplication.percentage,
    current: current.duplication.percentage,
  });

  addMaximumFailure({
    findings: failures,
    metric: "duplication.duplicatedLines",
    message: "Duplicated lines increased.",
    baseline: baseline.duplication.duplicatedLines,
    current: current.duplication.duplicatedLines,
  });

  addMaximumFailure({
    findings: failures,
    metric: "duplication.clones",
    message: "Duplicated clone count increased.",
    baseline: baseline.duplication.clones,
    current: current.duplication.clones,
  });

  addMaximumFailure({
    findings: failures,
    metric: "files.largestFile.lineCount",
    message: "Largest source file got larger.",
    baseline: baseline.files.largestFile.lineCount,
    current: current.files.largestFile.lineCount,
  });

  addMaximumFailure({
    findings: failures,
    metric: "files.filesOverLimit",
    message: "Number of source files over the line limit increased.",
    baseline: baseline.files.filesOverLimit,
    current: current.files.filesOverLimit,
  });

  if (current.security.critical > 0) {
    failures.push({
      severity: "failure",
      metric: "security.critical",
      message: "Critical package vulnerabilities are present.",
      baseline: 0,
      current: current.security.critical,
    });
  }

  if (current.security.high > 0) {
    warnings.push({
      severity: "warning",
      metric: "security.high",
      message: "High package vulnerabilities are present.",
      baseline: 0,
      current: current.security.high,
    });
  }

  return {
    status: failures.length === 0 ? "passed" : "failed",
    failures,
    warnings,
  };
}

function addMinimumFailure(input: {
  findings: QualityGateFinding[];
  metric: string;
  message: string;
  baseline: number;
  current: number;
}): void {
  if (input.current + EPSILON < input.baseline) {
    input.findings.push({
      severity: "failure",
      metric: input.metric,
      message: input.message,
      baseline: input.baseline,
      current: input.current,
    });
  }
}

function addMaximumFailure(input: {
  findings: QualityGateFinding[];
  metric: string;
  message: string;
  baseline: number;
  current: number;
}): void {
  if (input.current > input.baseline + EPSILON) {
    input.findings.push({
      severity: "failure",
      metric: input.metric,
      message: input.message,
      baseline: input.baseline,
      current: input.current,
    });
  }
}
