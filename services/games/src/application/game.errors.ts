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

export class WalletCreditFailedError extends Error {
  public readonly originalCause?: unknown;

  constructor(cause?: unknown) {
    super("Wallet credit failed after cashout was accepted");
    this.name = "WalletCreditFailedError";
    this.originalCause = cause;
  }
}
