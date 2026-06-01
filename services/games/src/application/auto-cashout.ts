import { AutoCashoutMultiplierOutOfRangeError } from "./game.errors";

export const MIN_AUTO_CASHOUT_MULTIPLIER_BP = 10100;
export const MAX_AUTO_CASHOUT_MULTIPLIER_BP = 10000000;

export function parseAutoCashoutMultiplierBp(
  value: number | null | undefined,
): number | null {
  if (value === null || value === undefined) {
    return null;
  }

  if (
    !Number.isInteger(value) ||
    value < MIN_AUTO_CASHOUT_MULTIPLIER_BP ||
    value > MAX_AUTO_CASHOUT_MULTIPLIER_BP
  ) {
    throw new AutoCashoutMultiplierOutOfRangeError();
  }

  return value;
}
