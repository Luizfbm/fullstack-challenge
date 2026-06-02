export const BASE_MULTIPLIER_BP = 10000;
export const MULTIPLIER_CURVE = "EXPONENTIAL";
export const DEFAULT_MULTIPLIER_GROWTH_RATE_BP_PER_SECOND = 1200;

export function calculatePayoutCents(
  amountCents: bigint,
  multiplierBp: number,
): bigint {
  if (amountCents < 0n) {
    throw new Error("Bet amount cannot be negative");
  }

  if (!Number.isInteger(multiplierBp) || multiplierBp < BASE_MULTIPLIER_BP) {
    throw new Error("Multiplier must be an integer greater than or equal to 1.00x");
  }

  return (amountCents * BigInt(multiplierBp)) / BigInt(BASE_MULTIPLIER_BP);
}

export function calculateCurrentMultiplierBp(
  startedAt: Date,
  now: Date,
  growthRateBpPerSecond = DEFAULT_MULTIPLIER_GROWTH_RATE_BP_PER_SECOND,
): number {
  if (!Number.isInteger(growthRateBpPerSecond) || growthRateBpPerSecond <= 0) {
    throw new Error("Multiplier growth rate must be a positive integer");
  }

  const elapsedMs = Math.max(0, now.getTime() - startedAt.getTime());
  const elapsedSeconds = elapsedMs / 1000;
  const growthRate = growthRateBpPerSecond / BASE_MULTIPLIER_BP;

  return Math.floor(BASE_MULTIPLIER_BP * Math.exp(growthRate * elapsedSeconds));
}
