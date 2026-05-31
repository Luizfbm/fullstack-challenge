import { InvalidBetStateError } from "./game.errors";
import { calculatePayoutCents } from "./multiplier";

export type BetStatus =
  | "ACCEPTED"
  | "REJECTED"
  | "CASHOUT_PENDING_CREDIT"
  | "CASHED_OUT"
  | "LOST";

type AcceptedBetParams = {
  id: string;
  roundId: string;
  playerId: string;
  username: string;
  amountCents: bigint;
};

type RestoreBetParams = AcceptedBetParams & {
  status: BetStatus;
  cashoutMultiplierBp?: number | null;
  payoutCents?: bigint | number | string | null;
  rejectionReason?: string | null;
};

export class Bet {
  private currentStatus: BetStatus;
  private currentCashoutMultiplierBp: number | null = null;
  private currentPayoutCents: bigint | null = null;
  private currentRejectionReason: string | null = null;

  private constructor(
    public readonly id: string,
    public readonly roundId: string,
    public readonly playerId: string,
    public readonly username: string,
    public readonly amountCents: bigint,
    status: BetStatus,
  ) {
    this.currentStatus = status;
  }

  static accepted(params: AcceptedBetParams): Bet {
    if (params.amountCents <= 0n) {
      throw new InvalidBetStateError("Bet amount must be positive");
    }

    return new Bet(
      params.id,
      params.roundId,
      params.playerId,
      params.username,
      params.amountCents,
      "ACCEPTED",
    );
  }

  static restore(params: RestoreBetParams): Bet {
    const bet = new Bet(
      params.id,
      params.roundId,
      params.playerId,
      params.username,
      params.amountCents,
      params.status,
    );

    bet.currentCashoutMultiplierBp = params.cashoutMultiplierBp ?? null;
    bet.currentPayoutCents =
      params.payoutCents === null || params.payoutCents === undefined
        ? null
        : BigInt(params.payoutCents);
    bet.currentRejectionReason = params.rejectionReason ?? null;

    return bet;
  }

  get status(): BetStatus {
    return this.currentStatus;
  }

  get cashoutMultiplierBp(): number | null {
    return this.currentCashoutMultiplierBp;
  }

  get payoutCents(): bigint | null {
    return this.currentPayoutCents;
  }

  get rejectionReason(): string | null {
    return this.currentRejectionReason;
  }

  cashOut(multiplierBp: number): void {
    if (this.currentStatus !== "ACCEPTED") {
      throw new InvalidBetStateError("Only accepted bets can cash out");
    }

    this.currentStatus = "CASHOUT_PENDING_CREDIT";
    this.currentCashoutMultiplierBp = multiplierBp;
    this.currentPayoutCents = calculatePayoutCents(
      this.amountCents,
      multiplierBp,
    );
  }

  completeCashOut(): void {
    if (this.currentStatus !== "CASHOUT_PENDING_CREDIT") {
      throw new InvalidBetStateError("Only pending cashouts can be completed");
    }

    this.currentStatus = "CASHED_OUT";
  }

  markLost(): void {
    if (this.currentStatus === "ACCEPTED") {
      this.currentStatus = "LOST";
    }
  }
}
