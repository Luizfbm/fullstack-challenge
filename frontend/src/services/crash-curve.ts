const BASE_MULTIPLIER_BP = 10000;

export function buildCrashCurvePolyline(progress: number, steps = 24): string {
  const safeProgress = Math.min(1, Math.max(0, progress));
  const visibleSteps = Math.max(2, Math.ceil(steps * safeProgress));

  return Array.from({ length: visibleSteps }, (_, index) => {
    const ratio = visibleSteps === 1 ? 0 : index / (visibleSteps - 1);
    const x = 8 + ratio * 84 * safeProgress;
    const y = 88 - Math.pow(ratio, 1.65) * 70 * safeProgress;

    return `${x.toFixed(2)},${y.toFixed(2)}`;
  }).join(" ");
}

export function getCrashCurveFormula(
  multiplierBaseBp: number,
  growthRateBpPerSecond: number,
): string {
  return `multiplierBp = floor(${multiplierBaseBp} * exp(${formatGrowthRate(growthRateBpPerSecond)} * elapsedSeconds))`;
}

export function getCrashCurveHumanRate(growthRateBpPerSecond: number): string {
  return `curva exponencial ${formatPercent(growthRateBpPerSecond)}/s`;
}

function formatGrowthRate(growthRateBpPerSecond: number): string {
  return (growthRateBpPerSecond / BASE_MULTIPLIER_BP).toFixed(2);
}

function formatPercent(growthRateBpPerSecond: number): string {
  return `${((growthRateBpPerSecond / BASE_MULTIPLIER_BP) * 100).toFixed(2)}%`;
}
