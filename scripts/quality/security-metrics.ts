import type { QualitySecurityMetrics } from "./quality-gate";

const decoder = new TextDecoder();

export function collectSecurityMetrics(rootDir: string): QualitySecurityMetrics {
  const result = Bun.spawnSync({
    cmd: ["bun", "audit", "--json"],
    cwd: rootDir,
    stdout: "pipe",
    stderr: "pipe",
  });

  const output = decode(result.stdout).trim() || decode(result.stderr).trim();

  if (!output) {
    return emptySecurityMetrics();
  }

  try {
    return countSecuritySeverities(JSON.parse(output));
  } catch {
    return emptySecurityMetrics();
  }
}

export function countSecuritySeverities(input: unknown): QualitySecurityMetrics {
  const metrics = emptySecurityMetrics();

  visit(input, (key, value) => {
    if (key !== "severity" || typeof value !== "string") {
      return;
    }

    if (
      value === "low" ||
      value === "moderate" ||
      value === "high" ||
      value === "critical"
    ) {
      metrics[value] += 1;
    }
  });

  return metrics;
}

function emptySecurityMetrics(): QualitySecurityMetrics {
  return {
    low: 0,
    moderate: 0,
    high: 0,
    critical: 0,
  };
}

function visit(
  input: unknown,
  callback: (key: string, value: unknown) => void,
): void {
  if (Array.isArray(input)) {
    for (const value of input) {
      visit(value, callback);
    }
    return;
  }

  if (!input || typeof input !== "object") {
    return;
  }

  for (const [key, value] of Object.entries(input)) {
    callback(key, value);
    visit(value, callback);
  }
}

function decode(value: Uint8Array): string {
  return decoder.decode(value);
}
