export const BASE_MULTIPLIER_BP = 10000;

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
  growthBpPerSecond = 1000,
): number {
  if (!Number.isInteger(growthBpPerSecond) || growthBpPerSecond <= 0) {
    throw new Error("Multiplier growth must be a positive integer");
  }

  const elapsedMs = Math.max(0, now.getTime() - startedAt.getTime());

  return (
    BASE_MULTIPLIER_BP +
    Math.floor((elapsedMs * growthBpPerSecond) / 1000)
  );
}
