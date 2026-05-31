import { describe, expect, test } from "bun:test";
import { Bet } from "../../../src/domain/bet";
import { InvalidRoundStateError } from "../../../src/domain/game.errors";
import { Round } from "../../../src/domain/round";
import { BetAmountOutOfRangeError, WalletCreditFailedError } from "../../../src/application/game.errors";
import { Clock } from "../../../src/application/ports/clock";
import { GameRepository } from "../../../src/application/ports/game.repository";
import { IdGenerator } from "../../../src/application/ports/id-generator";
import {
  RoundSeedMaterial,
  RoundSeedProvider,
} from "../../../src/application/ports/round-seed-provider";
import { WalletClient, WalletOperationInput, WalletOperationResult } from "../../../src/application/ports/wallet.client";
import { AdvanceRoundLifecycleUseCase } from "../../../src/application/use-cases/advance-round-lifecycle.use-case";
import { CashOutUseCase } from "../../../src/application/use-cases/cash-out.use-case";
import { PlaceBetUseCase } from "../../../src/application/use-cases/place-bet.use-case";
import { VerifyRoundUseCase } from "../../../src/application/use-cases/verify-round.use-case";
import { ProvablyFair } from "../../../src/domain/provably-fair";
import { HOUSE_EDGE_BP } from "../../../src/application/game.constants";

class InMemoryGameRepository implements GameRepository {
  public savedRounds: Round[] = [];
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

  async listRoundHistory(): Promise<Round[]> {
    return [...this.rounds.values()].filter(
      (round) => round.status === "CRASHED" || round.status === "SETTLED",
    );
  }

  async listBetsByPlayerId(playerId: string): Promise<Bet[]> {
    return [...this.rounds.values()].flatMap((round) =>
      round.bets.filter((bet) => bet.playerId === playerId),
    );
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
    const useCase = new PlaceBetUseCase(
      repository,
      walletClient,
      new FixedIdGenerator("bet-1"),
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
  });

  test("rejects out-of-range amounts before debiting the wallet", async () => {
    const repository = new InMemoryGameRepository(openRound());
    const walletClient = new FakeWalletClient();
    const useCase = new PlaceBetUseCase(
      repository,
      walletClient,
      new FixedIdGenerator("bet-1"),
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
    const useCase = new PlaceBetUseCase(
      repository,
      walletClient,
      new FixedIdGenerator("bet-2"),
    );

    await expect(
      useCase.execute({
        playerId: "player-1",
        username: "player",
        amountCents: 1000n,
      }),
    ).rejects.toThrow(InvalidRoundStateError);
    expect(walletClient.debits).toHaveLength(0);
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
    const useCase = new CashOutUseCase(
      repository,
      walletClient,
      new FixedClock(new Date("2026-05-30T10:00:15.000Z")),
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
    const useCase = new CashOutUseCase(
      repository,
      walletClient,
      new FixedClock(new Date("2026-05-30T10:00:15.000Z")),
    );

    await expect(
      useCase.execute({ playerId: "player-1" }),
    ).rejects.toThrow(WalletCreditFailedError);
    expect(repository.currentRound?.bets[0]?.status).toBe(
      "CASHOUT_PENDING_CREDIT",
    );
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
    );

    await expect(
      useCase.execute({ playerId: "player-1" }),
    ).rejects.toThrow(InvalidRoundStateError);
    expect(walletClient.credits).toHaveLength(0);
  });
});

describe("VerifyRoundUseCase", () => {
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
