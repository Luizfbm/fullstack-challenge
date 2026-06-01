import { Bet } from "./bet";
import { InvalidRoundStateError } from "./game.errors";

export type RoundStatus = "BETTING" | "RUNNING" | "CRASHED" | "SETTLED";

type OpenBettingParams = {
  id: string;
  bettingStartsAt: Date;
  bettingEndsAt: Date;
  crashPointBp: number;
  serverSeedHash: string;
  clientSeed: string;
  nonce: number;
  chainIndex: number;
  nextServerSeedHash?: string | null;
};

type RestoreRoundParams = OpenBettingParams & {
  status: RoundStatus;
  startedAt?: Date | null;
  crashedAt?: Date | null;
  serverSeed?: string | null;
  bets?: Bet[];
};

type PlaceBetParams = {
  id: string;
  playerId: string;
  username: string;
  amountCents: bigint;
  autoCashoutMultiplierBp?: number | null;
};

export class Round {
  private currentStatus: RoundStatus = "BETTING";
  private currentStartedAt: Date | null = null;
  private currentCrashedAt: Date | null = null;
  private currentServerSeed: string | null = null;
  private readonly acceptedBets = new Map<string, Bet>();

  private constructor(
    public readonly id: string,
    public readonly bettingStartsAt: Date,
    public readonly bettingEndsAt: Date,
    public readonly crashPointBp: number,
    public readonly serverSeedHash: string,
    public readonly clientSeed: string,
    public readonly nonce: number,
    public readonly chainIndex: number,
    public readonly nextServerSeedHash: string | null,
  ) {}

  static openBetting(params: OpenBettingParams): Round {
    if (params.crashPointBp < 10000) {
      throw new InvalidRoundStateError("Crash point must be at least 1.00x");
    }

    return new Round(
      params.id,
      params.bettingStartsAt,
      params.bettingEndsAt,
      params.crashPointBp,
      params.serverSeedHash,
      params.clientSeed,
      params.nonce,
      params.chainIndex,
      params.nextServerSeedHash ?? null,
    );
  }

  static restore(params: RestoreRoundParams): Round {
    const round = Round.openBetting(params);

    round.currentStatus = params.status;
    round.currentStartedAt = params.startedAt ?? null;
    round.currentCrashedAt = params.crashedAt ?? null;
    round.currentServerSeed = params.serverSeed ?? null;

    for (const bet of params.bets ?? []) {
      if (bet.status !== "REJECTED") {
        round.acceptedBets.set(bet.playerId, bet);
      }
    }

    return round;
  }

  get status(): RoundStatus {
    return this.currentStatus;
  }

  get startedAt(): Date | null {
    return this.currentStartedAt;
  }

  get crashedAt(): Date | null {
    return this.currentCrashedAt;
  }

  get serverSeed(): string | null {
    return this.currentServerSeed;
  }

  get bets(): Bet[] {
    return [...this.acceptedBets.values()];
  }

  placeBet(params: PlaceBetParams): Bet {
    if (this.currentStatus !== "BETTING") {
      throw new InvalidRoundStateError("Bets are only accepted while betting");
    }

    if (this.acceptedBets.has(params.playerId)) {
      throw new InvalidRoundStateError("Player already has a bet in this round");
    }

    const bet = Bet.accepted({
      id: params.id,
      roundId: this.id,
      playerId: params.playerId,
      username: params.username,
      amountCents: params.amountCents,
      autoCashoutMultiplierBp: params.autoCashoutMultiplierBp ?? null,
    });
    this.acceptedBets.set(params.playerId, bet);

    return bet;
  }

  start(startedAt: Date): void {
    if (this.currentStatus !== "BETTING") {
      throw new InvalidRoundStateError("Only betting rounds can start");
    }

    this.currentStatus = "RUNNING";
    this.currentStartedAt = startedAt;
  }

  cashOut(playerId: string, multiplierBp: number): Bet {
    if (this.currentStatus !== "RUNNING") {
      throw new InvalidRoundStateError("Cashout is only allowed while running");
    }

    if (multiplierBp >= this.crashPointBp) {
      throw new InvalidRoundStateError("Cashout is not allowed after crash point");
    }

    const bet = this.acceptedBets.get(playerId);

    if (!bet) {
      throw new InvalidRoundStateError("Player has no bet in this round");
    }

    bet.cashOut(multiplierBp);

    return bet;
  }

  completeCashOut(playerId: string): Bet {
    const bet = this.acceptedBets.get(playerId);

    if (!bet) {
      throw new InvalidRoundStateError("Player has no bet in this round");
    }

    bet.completeCashOut();

    return bet;
  }

  crash(crashedAt: Date, serverSeed: string): void {
    if (this.currentStatus !== "RUNNING") {
      throw new InvalidRoundStateError("Only running rounds can crash");
    }

    this.currentStatus = "CRASHED";
    this.currentCrashedAt = crashedAt;
    this.currentServerSeed = serverSeed;

    for (const bet of this.acceptedBets.values()) {
      bet.markLost();
    }
  }

  settle(): void {
    if (this.currentStatus !== "CRASHED") {
      throw new InvalidRoundStateError("Only crashed rounds can settle");
    }

    if (this.bets.some((bet) => bet.status === "CASHOUT_PENDING_CREDIT")) {
      throw new InvalidRoundStateError(
        "Cannot settle round with pending cashouts",
      );
    }

    this.currentStatus = "SETTLED";
  }
}
