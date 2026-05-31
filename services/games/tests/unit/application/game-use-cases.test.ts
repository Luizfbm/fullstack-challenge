import { describe, expect, test } from "bun:test";
import { Bet } from "../../../src/domain/bet";
import { InvalidRoundStateError } from "../../../src/domain/game.errors";
import { Round } from "../../../src/domain/round";
import { BetAmountOutOfRangeError, WalletCreditFailedError } from "../../../src/application/game.errors";
import { Clock } from "../../../src/application/ports/clock";
import { GameRepository } from "../../../src/application/ports/game.repository";
import { IdGenerator } from "../../../src/application/ports/id-generator";
import { WalletClient, WalletOperationInput, WalletOperationResult } from "../../../src/application/ports/wallet.client";
import { CashOutUseCase } from "../../../src/application/use-cases/cash-out.use-case";
import { PlaceBetUseCase } from "../../../src/application/use-cases/place-bet.use-case";
import { VerifyRoundUseCase } from "../../../src/application/use-cases/verify-round.use-case";
import { ProvablyFair } from "../../../src/domain/provably-fair";
import { HOUSE_EDGE_BP } from "../../../src/application/game.constants";

class InMemoryGameRepository implements GameRepository {
  public savedRounds: Round[] = [];

  constructor(public currentRound: Round | null) {}

  async findCurrentRound(): Promise<Round | null> {
    return this.currentRound;
  }

  async findRoundById(roundId: string): Promise<Round | null> {
    return this.currentRound?.id === roundId ? this.currentRound : null;
  }

  async listRoundHistory(): Promise<Round[]> {
    return this.currentRound ? [this.currentRound] : [];
  }

  async listBetsByPlayerId(playerId: string): Promise<Bet[]> {
    return this.currentRound?.bets.filter((bet) => bet.playerId === playerId) ?? [];
  }

  async saveRound(round: Round): Promise<void> {
    this.currentRound = round;
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
