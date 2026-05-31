export function toCents(value: bigint | number | string): bigint {
  if (typeof value === "bigint") {
    return value;
  }

  if (typeof value === "number") {
    if (!Number.isInteger(value)) {
      throw new Error("Amount in cents must be an integer");
    }

    return BigInt(value);
  }

  if (!/^-?\d+$/.test(value)) {
    throw new Error("Amount in cents must be an integer string");
  }

  return BigInt(value);
}
