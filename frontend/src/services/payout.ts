export function calculatePayoutCents(
  amountCents: bigint | number | string,
  multiplierBp: number,
): bigint {
  return (BigInt(amountCents) * BigInt(multiplierBp)) / 10000n;
}
