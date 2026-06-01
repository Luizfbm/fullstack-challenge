import { describe, expect, test } from "bun:test";
import { Bet } from "../../../src/domain/bet";
import { InvalidRoundStateError } from "../../../src/domain/game.errors";
import { Round } from "../../../src/domain/round";
import { BetAmountOutOfRangeError, WalletCreditFailedError } from "../../../src/application/game.errors";
import { Clock } from "../../../src/application/ports/clock";
import {
  GameRepository,
  LeaderboardEntry,
  ListLeaderboardInput,
} from "../../../src/application/ports/game.repository";
import { IdGenerator } from "../../../src/application/ports/id-generator";
import type { RoundEventsPublisher } from "../../../src/application/ports/round-events.publisher";
import {
  RoundSeedMaterial,
  RoundSeedProvider,
} from "../../../src/application/ports/round-seed-provider";
import { WalletClient, WalletOperationInput, WalletOperationResult } from "../../../src/application/ports/wallet.client";
import { AdvanceRoundLifecycleUseCase } from "../../../src/application/use-cases/advance-round-lifecycle.use-case";
import { CashOutUseCase } from "../../../src/application/use-cases/cash-out.use-case";
import { GetCurrentRoundUseCase } from "../../../src/application/use-cases/get-current-round.use-case";
import { ListMyBetsUseCase } from "../../../src/application/use-cases/list-my-bets.use-case";
import { ListLeaderboardUseCase } from "../../../src/application/use-cases/list-leaderboard.use-case";
import { ListRoundHistoryUseCase } from "../../../src/application/use-cases/list-round-history.use-case";
import { PlaceBetUseCase } from "../../../src/application/use-cases/place-bet.use-case";
import { VerifyRoundUseCase } from "../../../src/application/use-cases/verify-round.use-case";
import { ProvablyFair } from "../../../src/domain/provably-fair";
import {
  DEFAULT_ROUND_HISTORY_LIMIT,
  HOUSE_EDGE_BP,
} from "../../../src/application/game.constants";
import { rankLeaderboardBets } from "../../../src/application/leaderboard";

class InMemoryGameRepository implements GameRepository {
  public leaderboardEntries: LeaderboardEntry[] = [];
  public lastLeaderboardInput: ListLeaderboardInput | null = null;
  public savedRounds: Round[] = [];
  public lastBetsByPlayerIdInput: { playerId: string; limit: number } | null =
    null;
  public lastRoundHistoryLimit: number | null = null;
  private readonly rounds = new Map<string, Round>();

  constructor(public currentRound: Round | null) {
    if (currentRound) {
      this.rounds.set(currentRound.id, currentRound);
    }
  }

  async findCurrentRound(): Promise<Round | null> {
    return (
      [...this.rounds.values()]
        .filter((round) => round.status === "BETTING" || round.status === "RUNNING")
        .sort((left, right) => right.chainIndex - left.chainIndex)[0] ?? null
    );
  }

  async findLatestRound(): Promise<Round | null> {
    return (
      [...this.rounds.values()].sort(
        (left, right) => right.chainIndex - left.chainIndex,
      )[0] ?? null
    );
  }

  async findRoundById(roundId: string): Promise<Round | null> {
    return this.rounds.get(roundId) ?? null;
  }

  async listRoundHistory(limit: number): Promise<Round[]> {
    this.lastRoundHistoryLimit = limit;

    return [...this.rounds.values()].filter(
      (round) => round.status === "CRASHED" || round.status === "SETTLED",
    );
  }

  async listBetsByPlayerId(playerId: string, limit: number): Promise<Bet[]> {
    this.lastBetsByPlayerIdInput = { playerId, limit };

    return [...this.rounds.values()].flatMap((round) =>
      round.bets.filter((bet) => bet.playerId === playerId),
    );
  }

  async listLeaderboard(
    input: ListLeaderboardInput,
  ): Promise<LeaderboardEntry[]> {
    this.lastLeaderboardInput = input;

    return this.leaderboardEntries.slice(0, input.limit);
  }

  async saveRound(round: Round): Promise<void> {
    this.currentRound = round;
    this.rounds.set(round.id, round);
    this.savedRounds.push(round);
  }
}

class FixedIdGenerator implements IdGenerator {
  constructor(private readonly id: string) {}

  generate(): string {
    return this.id;
  }
}

class FixedClock implements Clock {
  constructor(private readonly date: Date) {}

  now(): Date {
    return this.date;
  }
}

class FakeWalletClient implements WalletClient {
  public debits: WalletOperationInput[] = [];
  public credits: WalletOperationInput[] = [];
  public creditError: unknown = null;

  async debit(input: WalletOperationInput): Promise<WalletOperationResult> {
    this.debits.push(input);

    return { applied: true, balanceCents: 99000n };
  }

  async credit(input: WalletOperationInput): Promise<WalletOperationResult> {
    this.credits.push(input);

    if (this.creditError) {
      throw this.creditError;
    }

    return { applied: true, balanceCents: 100500n };
  }
}

class FakeRoundSeedProvider implements RoundSeedProvider {
  getRoundSeed(chainIndex: number): RoundSeedMaterial {
    return {
      serverSeed: `server-seed-${chainIndex}`,
      serverSeedHash: `server-seed-hash-${chainIndex}`,
      clientSeed: "client-seed",
      nonce: chainIndex,
      crashPointBp: 12000,
      nextServerSeedHash: null,
    };
  }

  getServerSeed(chainIndex: number): string {
    return `server-seed-${chainIndex}`;
  }
}

class FakeRoundEventsPublisher implements RoundEventsPublisher {
  public betPlacedEvents: Bet[] = [];
  public betCashedOutEvents: Bet[] = [];

  async publishBettingStarted(): Promise<void> {}

  async publishStarted(): Promise<void> {}

  async publishTick(): Promise<void> {}

  async publishCrashed(): Promise<void> {}

  async publishSettled(): Promise<void> {}

  async publishBetPlaced(bet: Bet): Promise<void> {
    this.betPlacedEvents.push(bet);
  }

  async publishBetCashedOut(bet: Bet): Promise<void> {
    this.betCashedOutEvents.push(bet);
  }
}

function openRound(crashPointBp = 30000): Round {
  return Round.openBetting({
    id: "round-1",
    bettingStartsAt: new Date("2026-05-30T10:00:00.000Z"),
    bettingEndsAt: new Date("2026-05-30T10:00:10.000Z"),
    crashPointBp,
    serverSeedHash: "seed-hash",
    clientSeed: "client-seed",
    nonce: 1,
    chainIndex: 1,
  });
}

function leaderboardBet(
  overrides: {
    amountCents: bigint;
    payoutCents?: bigint | null;
    playerId: string;
    status?: "ACCEPTED" | "CASHED_OUT" | "LOST";
    username: string;
  },
) {
  return {
    amountCents: overrides.amountCents,
    payoutCents: overrides.payoutCents === undefined ? 0n : overrides.payoutCents,
    playerId: overrides.playerId,
    status: overrides.status ?? "CASHED_OUT",
    username: overrides.username,
  };
}

describe("read game use cases", () => {
  test("loads the current round from the repository", async () => {
    const round = openRound();
    const repository = new InMemoryGameRepository(round);
    const useCase = new GetCurrentRoundUseCase(repository);

    await expect(useCase.execute()).resolves.toBe(round);
  });

  test("uses the default history limit when none is provided", async () => {
    const repository = new InMemoryGameRepository(openRound());
    const useCase = new ListRoundHistoryUseCase(repository);

    await useCase.execute();

    expect(repository.lastRoundHistoryLimit).toBe(DEFAULT_ROUND_HISTORY_LIMIT);
  });

  test("uses the requested player bet limit", async () => {
    const repository = new InMemoryGameRepository(openRound());
    const useCase = new ListMyBetsUseCase(repository);

    await useCase.execute({ playerId: "player-1", limit: 3 });

    expect(repository.lastBetsByPlayerIdInput).toEqual({
      playerId: "player-1",
      limit: 3,
    });
  });

  test("lists 24h leaderboard entries by net profit", async () => {
    const repository = new InMemoryGameRepository(openRound());
    repository.leaderboardEntries = [
      {
        betsCount: 2,
        payoutCents: 3000n,
        playerId: "player-1",
        profitCents: 1000n,
        rank: 1,
        username: "alpha",
        wageredCents: 2000n,
      },
    ];
    const useCase = new ListLeaderboardUseCase(
      repository,
      new FixedClock(new Date("2026-06-01T12:00:00.000Z")),
    );

    await expect(
      useCase.execute({ period: "24h", limit: 10 }),
    ).resolves.toEqual(repository.leaderboardEntries);
    expect(repository.lastLeaderboardInput).toEqual({
      limit: 10,
      since: new Date("2026-05-31T12:00:00.000Z"),
    });
  });

  test("lists 7d leaderboard entries from the last seven days", async () => {
    const repository = new InMemoryGameRepository(openRound());
    const useCase = new ListLeaderboardUseCase(
      repository,
      new FixedClock(new Date("2026-06-01T12:00:00.000Z")),
    );

    await useCase.execute({ period: "7d", limit: 25 });

    expect(repository.lastLeaderboardInput).toEqual({
      limit: 25,
      since: new Date("2026-05-25T12:00:00.000Z"),
    });
  });
});

describe("leaderboard ranking", () => {
  test("aggregates only resolved bets by net profit", () => {
    const entries = rankLeaderboardBets(
      [
        leaderboardBet({
          amountCents: 1000n,
          payoutCents: 2500n,
          playerId: "player-1",
          status: "CASHED_OUT",
          username: "alpha",
        }),
        leaderboardBet({
          amountCents: 500n,
          payoutCents: null,
          playerId: "player-1",
          status: "LOST",
          username: "alpha",
        }),
        leaderboardBet({
          amountCents: 900n,
          payoutCents: null,
          playerId: "player-2",
          status: "ACCEPTED",
          username: "beta",
        }),
        leaderboardBet({
          amountCents: 900n,
          payoutCents: null,
          playerId: "player-3",
          status: "CASHED_OUT",
          username: "gamma",
        }),
      ],
      10,
    );

    expect(entries).toEqual([
      {
        betsCount: 2,
        payoutCents: 2500n,
        playerId: "player-1",
        profitCents: 1000n,
        rank: 1,
        username: "alpha",
        wageredCents: 1500n,
      },
    ]);
  });

  test("uses deterministic tie-breaks and applies the requested limit", () => {
    const entries = rankLeaderboardBets(
      [
        leaderboardBet({
          amountCents: 1000n,
          payoutCents: 3000n,
          playerId: "player-2",
          username: "zulu",
        }),
        leaderboardBet({
          amountCents: 2000n,
          payoutCents: 4000n,
          playerId: "player-1",
          username: "alpha",
        }),
        leaderboardBet({
          amountCents: 2000n,
          payoutCents: 4000n,
          playerId: "player-3",
          username: "bravo",
        }),
      ],
      2,
    );

    expect(entries.map((entry) => entry.playerId)).toEqual([
      "player-1",
      "player-3",
    ]);
    expect(entries.map((entry) => entry.rank)).toEqual([1, 2]);
  });
});

describe("AdvanceRoundLifecycleUseCase", () => {
  test("opens a betting round when there is no current round", async () => {
    const repository = new InMemoryGameRepository(null);
    const useCase = new AdvanceRoundLifecycleUseCase(
      repository,
      new FixedIdGenerator("round-1"),
      new FixedClock(new Date("2026-05-30T10:00:00.000Z")),
      new FakeRoundSeedProvider(),
      new FakeWalletClient(),
      { bettingWindowMs: 10000 },
    );

    const result = await useCase.execute();

    expect(result.action).toBe("ROUND_OPENED");
    expect(result.round?.status).toBe("BETTING");
    expect(result.round?.chainIndex).toBe(1);
    expect(result.round?.serverSeedHash).toBe("server-seed-hash-1");
    expect(result.round?.bettingEndsAt.toISOString()).toBe(
      "2026-05-30T10:00:10.000Z",
    );
  });

  test("starts a betting round after the betting window ends", async () => {
    const repository = new InMemoryGameRepository(openRound());
    const useCase = new AdvanceRoundLifecycleUseCase(
      repository,
      new FixedIdGenerator("round-2"),
      new FixedClock(new Date("2026-05-30T10:00:10.000Z")),
      new FakeRoundSeedProvider(),
      new FakeWalletClient(),
      { bettingWindowMs: 10000 },
    );

    const result = await useCase.execute();

    expect(result.action).toBe("ROUND_STARTED");
    expect(result.round?.status).toBe("RUNNING");
    expect(result.round?.startedAt?.toISOString()).toBe(
      "2026-05-30T10:00:10.000Z",
    );
  });

  test("crashes a running round when multiplier reaches the crash point", async () => {
    const round = openRound(12000);
    round.start(new Date("2026-05-30T10:00:10.000Z"));
    const repository = new InMemoryGameRepository(round);
    const useCase = new AdvanceRoundLifecycleUseCase(
      repository,
      new FixedIdGenerator("round-2"),
      new FixedClock(new Date("2026-05-30T10:00:12.000Z")),
      new FakeRoundSeedProvider(),
      new FakeWalletClient(),
      { bettingWindowMs: 10000 },
    );

    const result = await useCase.execute();

    expect(result.action).toBe("ROUND_CRASHED");
    expect(result.round?.status).toBe("CRASHED");
    expect(result.round?.serverSeed).toBe("server-seed-1");
  });

  test("settles a crashed round before opening the next round", async () => {
    const crashedRound = openRound(10000);
    crashedRound.start(new Date("2026-05-30T10:00:10.000Z"));
    crashedRound.crash(
      new Date("2026-05-30T10:00:11.000Z"),
      "server-seed-1",
    );
    const repository = new InMemoryGameRepository(crashedRound);
    const useCase = new AdvanceRoundLifecycleUseCase(
      repository,
      new FixedIdGenerator("round-2"),
      new FixedClock(new Date("2026-05-30T10:00:12.000Z")),
      new FakeRoundSeedProvider(),
      new FakeWalletClient(),
      { bettingWindowMs: 10000 },
    );

    const settled = await useCase.execute();
    const opened = await useCase.execute();

    expect(settled.action).toBe("ROUND_SETTLED");
    expect(settled.round?.status).toBe("SETTLED");
    expect(opened.action).toBe("ROUND_OPENED");
    expect(opened.round?.id).toBe("round-2");
    expect(opened.round?.chainIndex).toBe(2);
  });

  test("retries pending cashout credits before settlement", async () => {
    const crashedRound = openRound(30000);
    crashedRound.placeBet({
      id: "bet-1",
      playerId: "player-1",
      username: "player",
      amountCents: 1000n,
    });
    crashedRound.start(new Date("2026-05-30T10:00:10.000Z"));
    crashedRound.cashOut("player-1", 15000);
    crashedRound.crash(
      new Date("2026-05-30T10:00:11.000Z"),
      "server-seed-1",
    );
    const repository = new InMemoryGameRepository(crashedRound);
    const walletClient = new FakeWalletClient();
    const useCase = new AdvanceRoundLifecycleUseCase(
      repository,
      new FixedIdGenerator("round-2"),
      new FixedClock(new Date("2026-05-30T10:00:12.000Z")),
      new FakeRoundSeedProvider(),
      walletClient,
      { bettingWindowMs: 10000 },
    );

    const result = await useCase.execute();

    expect(result.action).toBe("ROUND_SETTLED");
    expect(result.round?.bets[0]?.status).toBe("CASHED_OUT");
    expect(walletClient.credits).toEqual([
      {
        playerId: "player-1",
        amountCents: 1500n,
        referenceId: "round:round-1:player:player-1:cashout-credit",
        reason: "CASHOUT_PAYOUT",
      },
    ]);
  });

  test("keeps a crashed round unsettled when pending cashout retry fails", async () => {
    const crashedRound = openRound(30000);
    crashedRound.placeBet({
      id: "bet-1",
      playerId: "player-1",
      username: "player",
      amountCents: 1000n,
    });
    crashedRound.start(new Date("2026-05-30T10:00:10.000Z"));
    crashedRound.cashOut("player-1", 15000);
    crashedRound.crash(
      new Date("2026-05-30T10:00:11.000Z"),
      "server-seed-1",
    );
    const repository = new InMemoryGameRepository(crashedRound);
    const walletClient = new FakeWalletClient();
    walletClient.creditError = new Error("wallet unavailable");
    const useCase = new AdvanceRoundLifecycleUseCase(
      repository,
      new FixedIdGenerator("round-2"),
      new FixedClock(new Date("2026-05-30T10:00:12.000Z")),
      new FakeRoundSeedProvider(),
      walletClient,
      { bettingWindowMs: 10000 },
    );

    await expect(useCase.execute()).rejects.toThrow("wallet unavailable");

    expect(repository.currentRound?.status).toBe("CRASHED");
    expect(repository.currentRound?.bets[0]?.status).toBe(
      "CASHOUT_PENDING_CREDIT",
    );
  });
});

describe("PlaceBetUseCase", () => {
  test("debits the wallet with an idempotent reference and saves the accepted bet", async () => {
    const repository = new InMemoryGameRepository(openRound());
    const walletClient = new FakeWalletClient();
    const roundEventsPublisher = new FakeRoundEventsPublisher();
    const useCase = new PlaceBetUseCase(
      repository,
      walletClient,
      new FixedIdGenerator("bet-1"),
      roundEventsPublisher,
    );

    const result = await useCase.execute({
      playerId: "player-1",
      username: "player",
      amountCents: 1000n,
    });

    expect(result.bet.status).toBe("ACCEPTED");
    expect(result.balanceCents).toBe(99000n);
    expect(walletClient.debits).toEqual([
      {
        playerId: "player-1",
        amountCents: 1000n,
        referenceId: "round:round-1:player:player-1:bet-debit",
        reason: "BET_PLACED",
      },
    ]);
    expect(repository.currentRound?.bets).toHaveLength(1);
    expect(roundEventsPublisher.betPlacedEvents.map((bet) => bet.id)).toEqual([
      "bet-1",
    ]);
  });

  test("rejects out-of-range amounts before debiting the wallet", async () => {
    const repository = new InMemoryGameRepository(openRound());
    const walletClient = new FakeWalletClient();
    const useCase = new PlaceBetUseCase(
      repository,
      walletClient,
      new FixedIdGenerator("bet-1"),
      new FakeRoundEventsPublisher(),
    );

    await expect(
      useCase.execute({
        playerId: "player-1",
        username: "player",
        amountCents: 99n,
      }),
    ).rejects.toThrow(BetAmountOutOfRangeError);
    expect(walletClient.debits).toHaveLength(0);
  });

  test("does not debit the wallet when the player already has a bet", async () => {
    const round = openRound();
    round.placeBet({
      id: "existing-bet",
      playerId: "player-1",
      username: "player",
      amountCents: 1000n,
    });
    const repository = new InMemoryGameRepository(round);
    const walletClient = new FakeWalletClient();
    const roundEventsPublisher = new FakeRoundEventsPublisher();
    const useCase = new PlaceBetUseCase(
      repository,
      walletClient,
      new FixedIdGenerator("bet-2"),
      roundEventsPublisher,
    );

    await expect(
      useCase.execute({
        playerId: "player-1",
        username: "player",
        amountCents: 1000n,
      }),
    ).rejects.toThrow(InvalidRoundStateError);
    expect(walletClient.debits).toHaveLength(0);
    expect(roundEventsPublisher.betPlacedEvents).toHaveLength(0);
  });
});

describe("CashOutUseCase", () => {
  test("credits the calculated payout and completes the cashout", async () => {
    const round = openRound();
    round.placeBet({
      id: "bet-1",
      playerId: "player-1",
      username: "player",
      amountCents: 1000n,
    });
    round.start(new Date("2026-05-30T10:00:10.000Z"));
    const repository = new InMemoryGameRepository(round);
    const walletClient = new FakeWalletClient();
    const roundEventsPublisher = new FakeRoundEventsPublisher();
    const useCase = new CashOutUseCase(
      repository,
      walletClient,
      new FixedClock(new Date("2026-05-30T10:00:15.000Z")),
      roundEventsPublisher,
    );

    const result = await useCase.execute({ playerId: "player-1" });

    expect(result.bet.status).toBe("CASHED_OUT");
    expect(result.bet.cashoutMultiplierBp).toBe(15000);
    expect(result.bet.payoutCents).toBe(1500n);
    expect(walletClient.credits).toEqual([
      {
        playerId: "player-1",
        amountCents: 1500n,
        referenceId: "round:round-1:player:player-1:cashout-credit",
        reason: "CASHOUT_PAYOUT",
      },
    ]);
    expect(
      roundEventsPublisher.betCashedOutEvents.map((bet) => bet.id),
    ).toEqual(["bet-1"]);
    expect(roundEventsPublisher.betCashedOutEvents[0]?.status).toBe(
      "CASHED_OUT",
    );
  });

  test("preserves pending cashout when wallet credit fails", async () => {
    const round = openRound();
    round.placeBet({
      id: "bet-1",
      playerId: "player-1",
      username: "player",
      amountCents: 1000n,
    });
    round.start(new Date("2026-05-30T10:00:10.000Z"));
    const repository = new InMemoryGameRepository(round);
    const walletClient = new FakeWalletClient();
    walletClient.creditError = new Error("wallet unavailable");
    const roundEventsPublisher = new FakeRoundEventsPublisher();
    const useCase = new CashOutUseCase(
      repository,
      walletClient,
      new FixedClock(new Date("2026-05-30T10:00:15.000Z")),
      roundEventsPublisher,
    );

    await expect(
      useCase.execute({ playerId: "player-1" }),
    ).rejects.toThrow(WalletCreditFailedError);
    expect(repository.currentRound?.bets[0]?.status).toBe(
      "CASHOUT_PENDING_CREDIT",
    );
    expect(roundEventsPublisher.betCashedOutEvents).toHaveLength(0);
  });

  test("does not credit cashout at or after the crash point", async () => {
    const round = openRound(15000);
    round.placeBet({
      id: "bet-1",
      playerId: "player-1",
      username: "player",
      amountCents: 1000n,
    });
    round.start(new Date("2026-05-30T10:00:10.000Z"));
    const repository = new InMemoryGameRepository(round);
    const walletClient = new FakeWalletClient();
    const useCase = new CashOutUseCase(
      repository,
      walletClient,
      new FixedClock(new Date("2026-05-30T10:00:15.000Z")),
      new FakeRoundEventsPublisher(),
    );

    await expect(
      useCase.execute({ playerId: "player-1" }),
    ).rejects.toThrow(InvalidRoundStateError);
    expect(walletClient.credits).toHaveLength(0);
  });
});

describe("VerifyRoundUseCase", () => {
  test("keeps the crash point hidden before server seed reveal", async () => {
    const round = openRound(25000);
    const useCase = new VerifyRoundUseCase(new InMemoryGameRepository(round));

    const result = await useCase.execute({ roundId: "round-1" });

    expect(result.revealed).toBe(false);
    expect(result.crashPointBp).toBeNull();
    expect(result.recalculatedCrashPointBp).toBeNull();
    expect(result.fair).toBeNull();
  });

  test("recalculates the crash point after the server seed is revealed", async () => {
    const serverSeed = "server-seed";
    const crashPointBp = ProvablyFair.calculateCrashPointBp({
      serverSeed,
      clientSeed: "client-seed",
      nonce: 1,
      houseEdgeBp: HOUSE_EDGE_BP,
    });
    const round = Round.openBetting({
      id: "round-1",
      bettingStartsAt: new Date("2026-05-30T10:00:00.000Z"),
      bettingEndsAt: new Date("2026-05-30T10:00:10.000Z"),
      crashPointBp,
      serverSeedHash: ProvablyFair.hashSeed(serverSeed),
      clientSeed: "client-seed",
      nonce: 1,
      chainIndex: 1,
    });
    round.start(new Date("2026-05-30T10:00:10.000Z"));
    round.crash(new Date("2026-05-30T10:00:12.000Z"), serverSeed);
    const useCase = new VerifyRoundUseCase(new InMemoryGameRepository(round));

    const result = await useCase.execute({ roundId: "round-1" });

    expect(result.revealed).toBe(true);
    expect(result.serverSeedMatchesCommitment).toBe(true);
    expect(result.recalculatedCrashPointBp).toBe(crashPointBp);
    expect(result.fair).toBe(true);
  });
});
