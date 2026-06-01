export class CurrentRoundNotFoundError extends Error {
  constructor() {
    super("Current round not found");
    this.name = "CurrentRoundNotFoundError";
  }
}

export class RoundNotFoundError extends Error {
  constructor(roundId: string) {
    super(`Round not found: ${roundId}`);
    this.name = "RoundNotFoundError";
  }
}

export class BetAmountOutOfRangeError extends Error {
  constructor() {
    super("Bet amount is outside the allowed range");
    this.name = "BetAmountOutOfRangeError";
  }
}

export class AutoCashoutMultiplierOutOfRangeError extends Error {
  constructor() {
    super("Auto cashout multiplier must be between 1.01x and 1000.00x");
    this.name = "AutoCashoutMultiplierOutOfRangeError";
  }
}

export class WalletCreditFailedError extends Error {
  public readonly originalCause?: unknown;

  constructor(cause?: unknown) {
    super("Wallet credit failed after cashout was accepted");
    this.name = "WalletCreditFailedError";
    this.originalCause = cause;
  }
}

export class WalletOperationRejectedError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "WalletOperationRejectedError";
  }
}

export class WalletOperationTimedOutError extends Error {
  constructor(timeoutMs: number) {
    super(`Wallet operation timed out after ${timeoutMs}ms`);
    this.name = "WalletOperationTimedOutError";
  }
}
