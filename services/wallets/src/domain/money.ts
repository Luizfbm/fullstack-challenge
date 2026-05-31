export class Money {
  private constructor(public readonly cents: bigint) {}

  static zero(): Money {
    return new Money(0n);
  }

  static fromCents(value: bigint | number | string): Money {
    const cents = Money.toBigInt(value);

    if (cents < 0n) {
      throw new Error("Money cents cannot be negative");
    }

    return new Money(cents);
  }

  add(other: Money): Money {
    return new Money(this.cents + other.cents);
  }

  subtract(other: Money): Money {
    if (other.cents > this.cents) {
      throw new Error("Money subtraction cannot produce a negative amount");
    }

    return new Money(this.cents - other.cents);
  }

  isGreaterThan(other: Money): boolean {
    return this.cents > other.cents;
  }

  private static toBigInt(value: bigint | number | string): bigint {
    if (typeof value === "bigint") {
      return value;
    }

    if (typeof value === "number") {
      if (!Number.isInteger(value)) {
        throw new Error("Money cents must be an integer");
      }

      if (!Number.isSafeInteger(value)) {
        throw new Error("Money cents must be a safe integer");
      }

      return BigInt(value);
    }

    if (!/^-?\d+$/.test(value)) {
      throw new Error("Money cents must be an integer");
    }

    return BigInt(value);
  }
}
