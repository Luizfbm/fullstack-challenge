export const coverageInputs = [
  {
    name: "services/games",
    lcovPath: "coverage/services-games/lcov.info",
  },
  {
    name: "services/wallets",
    lcovPath: "coverage/services-wallets/lcov.info",
  },
  {
    name: "frontend",
    lcovPath: "coverage/frontend/lcov.info",
  },
  {
    name: "scripts/quality",
    lcovPath: "coverage/scripts-quality/lcov.info",
  },
];

export const sourceRoots = [
  "services/games/src",
  "services/wallets/src",
  "frontend/src",
  "scripts/quality",
];

export const defaultQualityPaths = {
  baseline: "quality/baseline.json",
  currentMetrics: "quality/reports/current-metrics.json",
  summary: "quality/reports/quality-gate-summary.md",
  jscpdOutput: "quality/reports/jscpd",
};
