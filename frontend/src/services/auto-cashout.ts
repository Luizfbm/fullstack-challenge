export const MIN_AUTO_CASHOUT_MULTIPLIER_BP = 10100;
export const MAX_AUTO_CASHOUT_MULTIPLIER_BP = 10000000;

export type AutoCashoutParseResult = {
  multiplierBp: number | null;
  valid: boolean;
};

export function parseAutoCashoutMultiplierInput(
  value: string,
): AutoCashoutParseResult {
  const trimmed = value.trim().replace(",", ".");

  if (!/^\d+(\.\d{1,2})?$/.test(trimmed)) {
    return { multiplierBp: null, valid: false };
  }

  const [wholePart, fractionPart = ""] = trimmed.split(".");
  const multiplierBp =
    Number(wholePart) * 10000 +
    Number(fractionPart.padEnd(2, "0").slice(0, 2)) * 100;

  if (
    !Number.isInteger(multiplierBp) ||
    multiplierBp < MIN_AUTO_CASHOUT_MULTIPLIER_BP ||
    multiplierBp > MAX_AUTO_CASHOUT_MULTIPLIER_BP
  ) {
    return { multiplierBp: null, valid: false };
  }

  return { multiplierBp, valid: true };
}

export function formatMultiplierBp(multiplierBp: number): string {
  return `${(multiplierBp / 10000).toFixed(2)}x`;
}
