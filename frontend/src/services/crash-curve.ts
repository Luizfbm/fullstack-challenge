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

export function getCrashCurveFormula(growthBpPerSecond: number): string {
  return `multiplierBp = ${BASE_MULTIPLIER_BP} + floor(elapsedMs * ${growthBpPerSecond} / 1000)`;
}

export function getCrashCurveHumanRate(growthBpPerSecond: number): string {
  return `1.00x + ${formatMultiplier(growthBpPerSecond)} por segundo`;
}

function formatMultiplier(multiplierBp: number): string {
  return `${(multiplierBp / BASE_MULTIPLIER_BP).toFixed(2)}x`;
}
