const BASE_MULTIPLIER_BP = 10000;

export function getCrashCurveFormula(growthBpPerSecond: number): string {
  return `multiplierBp = ${BASE_MULTIPLIER_BP} + floor(elapsedMs * ${growthBpPerSecond} / 1000)`;
}

export function getCrashCurveHumanRate(growthBpPerSecond: number): string {
  return `1.00x + ${formatMultiplier(growthBpPerSecond)} por segundo`;
}

function formatMultiplier(multiplierBp: number): string {
  return `${(multiplierBp / BASE_MULTIPLIER_BP).toFixed(2)}x`;
}
