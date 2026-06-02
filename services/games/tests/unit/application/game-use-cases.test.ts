import { describe, expect, test } from "bun:test";
import type {
  AutoBetRoundExecution,
  AutoBetSession,
} from "../../../src/application/auto-bet/auto-bet-session";
import { Bet } from "../../../src/domain/bet";
import { InvalidRoundStateError } from "../../../src/domain/game.errors";
import { Round } from "../../../src/domain/round";
import {
  AutoCashoutMultiplierOutOfRangeError,
  AutoBetSessionActiveError,
  BetAmountOutOfRangeError,
  ManualBetBlockedByAutoBetError,
  WalletCreditFailedError,
} from "../../../src/application/game.errors";
import type {
  ApplyAutoBetResultInput,
  AutoBetSessionRepository,
  NewAutoBetRoundExecution,
  NewAutoBetSession,
  StopAutoBetSessionInput,
  UpdateAutoBetProgressionInput,
} from "../../../src/application/ports/auto-bet-session.repository";
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
import type { WalletOutboxRepository } from "../../../src/application/ports/wallet-outbox.repository";
import type {
  WalletOutboxFailure,
  NewWalletOutboxMessage,
  WalletOutboxMessage,
  WalletOutboxSuccess,
} from "../../../src/application/wallet-outbox/wallet-outbox-message";
import { CashoutCreditService } from "../../../src/application/services/cashout-credit.service";
import { AdvanceRoundLifecycleUseCase } from "../../../src/application/use-cases/advance-round-lifecycle.use-case";
import { ApplyAutoBetResultUseCase } from "../../../src/application/use-cases/apply-auto-bet-result.use-case";
import { CashOutUseCase } from "../../../src/application/use-cases/cash-out.use-case";
import { ExecuteAutoBetsForRoundUseCase } from "../../../src/application/use-cases/execute-auto-bets-for-round.use-case";
import { GetMyAutoBetSessionUseCase } from "../../../src/application/use-cases/get-my-auto-bet-session.use-case";
import { GetCurrentRoundUseCase } from "../../../src/application/use-cases/get-current-round.use-case";
import { ListMyBetsUseCase } from "../../../src/application/use-cases/list-my-bets.use-case";
import { ListLeaderboardUseCase } from "../../../src/application/use-cases/list-leaderboard.use-case";
import { ListRoundHistoryUseCase } from "../../../src/application/use-cases/list-round-history.use-case";
import { PlaceBetUseCase } from "../../../src/application/use-cases/place-bet.use-case";
import { StartAutoBetSessionUseCase } from "../../../src/application/use-cases/start-auto-bet-session.use-case";
import { StopAutoBetSessionUseCase } from "../../../src/application/use-cases/stop-auto-bet-session.use-case";
import { VerifyRoundUseCase } from "../../../src/application/use-cases/verify-round.use-case";
import { ProvablyFair } from "../../../src/domain/provably-fair";
import {
  DEFAULT_ROUND_HISTORY_LIMIT,
  HOUSE_EDGE_BP,
} from "../../../src/application/game.constants";
import { rankLeaderboardBets } from "../../../src/application/leaderboard";

class InMemoryGameRepository implements GameRepository {
  public leaderboardEntries: LeaderboardEntry[] = [];
  public saveRoundError: unknown = null;
  public lastLeaderboardInput: ListLeaderboardInput | null = null;
  public savedRounds: Round[] = [];
  public savedBetStatusSnapshots: string[][] = [];
  public walletOutboxMessages: NewWalletOutboxMessage[] = [];
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
    if (this.saveRoundError) {
      throw this.saveRoundError;
    }

    this.currentRound = round;
    this.rounds.set(round.id, round);
    this.savedRounds.push(round);
    this.savedBetStatusSnapshots.push(round.bets.map((bet) => bet.status));
  }

  async saveRoundWithWalletOutbox(
    round: Round,
    message: NewWalletOutboxMessage,
  ): Promise<WalletOutboxMessage> {
    await this.saveRound(round);
    this.walletOutboxMessages.push(message);

    return {
      ...message,
      status: message.status ?? "PENDING",
      attempts: 0,
      availableAt: message.availableAt ?? new Date("2026-05-30T10:00:00.000Z"),
      responseApplied: null,
      responseBalanceCents: null,
      errorCode: null,
      errorMessage: null,
    };
  }
}

class FakeWalletOutboxRepository implements WalletOutboxRepository {
  public messages: WalletOutboxMessage[] = [];

  store(message: WalletOutboxMessage): void {
    if (!this.messages.some((stored) => stored.id === message.id)) {
      this.messages.push(message);
    }
  }

  async enqueue(
    message: NewWalletOutboxMessage,
  ): Promise<WalletOutboxMessage> {
    const stored = this.toStoredMessage(message);
    this.messages.push(stored);

    return stored;
  }

  async findById(id: string): Promise<WalletOutboxMessage | null> {
    return this.messages.find((message) => message.id === id) ?? null;
  }

  async findByReferenceId(
    referenceId: string,
  ): Promise<WalletOutboxMessage | null> {
    return (
      this.messages.find((message) => message.referenceId === referenceId) ??
      null
    );
  }

  async claimNext(): Promise<WalletOutboxMessage | null> {
    return (
      this.messages.find(
        (message) =>
          message.status === "PENDING" || message.status === "RETRYABLE",
      ) ?? null
    );
  }

  async markSucceeded(
    id: string,
    result: WalletOutboxSuccess,
  ): Promise<void> {
    this.update(id, {
      status: "SUCCEEDED",
      responseApplied: result.applied,
      responseBalanceCents: result.balanceCents,
      errorCode: null,
      errorMessage: null,
    });
  }

  async markFailed(id: string, failure: WalletOutboxFailure): Promise<void> {
    this.update(id, {
      status: "FAILED",
      errorCode: failure.code,
      errorMessage: failure.message,
    });
  }

  async releaseForRetry(
    id: string,
    failure: WalletOutboxFailure,
    availableAt: Date,
  ): Promise<void> {
    this.update(id, {
      status: "RETRYABLE",
      availableAt,
      errorCode: failure.code,
      errorMessage: failure.message,
    });
  }

  private toStoredMessage(
    message: NewWalletOutboxMessage,
  ): WalletOutboxMessage {
    return {
      ...message,
      status: message.status ?? "PENDING",
      attempts: 0,
      availableAt: message.availableAt ?? new Date("2026-05-30T10:00:00.000Z"),
      responseApplied: null,
      responseBalanceCents: null,
      errorCode: null,
      errorMessage: null,
    };
  }

  private update(
    id: string,
    patch: Partial<WalletOutboxMessage>,
  ): void {
    const index = this.messages.findIndex((message) => message.id === id);

    if (index < 0) {
      throw new Error(`Outbox message not found: ${id}`);
    }

    this.messages[index] = {
      ...this.messages[index],
      ...patch,
    };
  }
}

class FakeAutoBetSessionRepository implements AutoBetSessionRepository {
  public sessions: AutoBetSession[] = [];
  public executions: AutoBetRoundExecution[] = [];

  async create(input: NewAutoBetSession): Promise<AutoBetSession> {
    const session: AutoBetSession = {
      ...input,
      createdAt: new Date("2026-05-30T10:00:00.000Z"),
      updatedAt: new Date("2026-05-30T10:00:00.000Z"),
      stoppedAt: null,
    };
    this.sessions.push(session);

    return session;
  }

  async findActiveByPlayer(playerId: string): Promise<AutoBetSession | null> {
    return (
      this.sessions.find(
        (session) =>
          session.playerId === playerId && session.status === "ACTIVE",
      ) ?? null
    );
  }

  async findLatestByPlayer(playerId: string): Promise<AutoBetSession | null> {
    return (
      this.sessions
        .filter((session) => session.playerId === playerId)
        .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime())
        .at(0) ?? null
    );
  }

  async listActive(): Promise<AutoBetSession[]> {
    return this.sessions.filter((session) => session.status === "ACTIVE");
  }

  async stop(input: StopAutoBetSessionInput): Promise<AutoBetSession> {
    const session = this.sessions.find(
      (candidate) => candidate.id === input.sessionId,
    );

    if (!session) {
      throw new Error(`Session not found: ${input.sessionId}`);
    }

    Object.assign(session, {
      status: "STOPPED" as const,
      stopReason: input.reason,
      stoppedAt: new Date("2026-05-30T10:00:00.000Z"),
      updatedAt: new Date("2026-05-30T10:00:00.000Z"),
    });

    return session;
  }

  async findExecution(
    sessionId: string,
    roundId: string,
  ): Promise<AutoBetRoundExecution | null> {
    return (
      this.executions.find(
        (execution) =>
          execution.sessionId === sessionId && execution.roundId === roundId,
      ) ?? null
    );
  }

  async findExecutionByBetId(
    betId: string,
  ): Promise<AutoBetRoundExecution | null> {
    return (
      this.executions.find((execution) => execution.betId === betId) ?? null
    );
  }

  async recordExecution(
    input: NewAutoBetRoundExecution,
  ): Promise<AutoBetRoundExecution> {
    const execution: AutoBetRoundExecution = {
      ...input,
      createdAt: new Date("2026-05-30T10:00:00.000Z"),
      resultAppliedAt: null,
      resultDeltaCents: null,
      resultStatus: null,
    };
    this.executions.push(execution);

    return execution;
  }

  async incrementRoundsPlayed(sessionId: string): Promise<AutoBetSession> {
    const session = this.sessions.find(
      (candidate) => candidate.id === sessionId,
    );

    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    session.roundsPlayed += 1;

    return session;
  }

  async applyBetResult(
    input: ApplyAutoBetResultInput,
  ): Promise<AutoBetSession | null> {
    const execution = this.executions.find(
      (candidate) => candidate.id === input.executionId,
    );

    if (!execution || execution.resultAppliedAt) {
      return null;
    }

    const session = this.sessions.find(
      (candidate) => candidate.id === execution.sessionId,
    );

    if (!session) {
      throw new Error(`Session not found: ${execution.sessionId}`);
    }

    execution.resultStatus = input.resultStatus;
    execution.resultDeltaCents = input.deltaCents;
    execution.resultAppliedAt = new Date("2026-05-30T10:00:00.000Z");
    session.netProfitCents += input.deltaCents;

    return session;
  }

  async updateProgression(
    input: UpdateAutoBetProgressionInput,
  ): Promise<AutoBetSession> {
    const session = this.sessions.find(
      (candidate) => candidate.id === input.sessionId,
    );

    if (!session) {
      throw new Error(`Session not found: ${input.sessionId}`);
    }

    session.nextAmountCents = input.nextAmountCents;
    session.martingaleCurrentStep = input.martingaleCurrentStep;

    return session;
  }
}

class FakeWalletOutboxDispatcher {
  public dispatched: WalletOutboxMessage[] = [];
  public result: WalletOperationResult = {
    applied: true,
    balanceCents: 97500n,
  };

  constructor(private readonly outbox: FakeWalletOutboxRepository) {}

  async dispatchMessage(message: WalletOutboxMessage): Promise<void> {
    this.dispatched.push(message);
    this.outbox.store(message);
    await this.outbox.markSucceeded(message.id, this.result);
  }
}

class FixedIdGenerator implements IdGenerator {
  constructor(private readonly id: string) {}

  generate(): string {
    return this.id;
  }
}

class SequenceIdGenerator implements IdGenerator {
  constructor(private readonly ids: string[]) {}

  generate(): string {
    const id = this.ids.shift();

    if (!id) {
      throw new Error("SequenceIdGenerator ran out of ids");
    }

    return id;
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
  public debitError: unknown = null;
  public creditError: unknown = null;

  async debit(input: WalletOperationInput): Promise<WalletOperationResult> {
    this.debits.push(input);

    if (this.debitError) {
      throw this.debitError;
    }

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

class FakeGameMetrics {
  acceptedBets: bigint[] = [];
  rejectedBets = 0;
  cashouts: Array<{ mode: "manual" | "auto"; payoutCents: bigint }> = [];
  crashPoints: number[] = [];
  walletCommands: Array<{
    command: "debit" | "credit";
    durationMs: number;
    result: "succeeded" | "failed";
  }> = [];

  recordBetAccepted(amountCents: bigint): void {
    this.acceptedBets.push(amountCents);
  }

  recordBetRejected(): void {
    this.rejectedBets += 1;
  }

  recordCashout(mode: "manual" | "auto", payoutCents: bigint): void {
    this.cashouts.push({ mode, payoutCents });
  }

  recordCrashPoint(multiplier: number): void {
    this.crashPoints.push(multiplier);
  }

  recordWalletCommand(
    command: "debit" | "credit",
    durationMs: number,
    result: "succeeded" | "failed",
  ): void {
    this.walletCommands.push({ command, durationMs, result });
  }
}

class ThrowingGameMetrics extends FakeGameMetrics {
  constructor(
    private readonly throwOn: Array<"accepted" | "rejected" | "cashout">,
  ) {
    super();
  }

  recordBetAccepted(amountCents: bigint): void {
    if (this.throwOn.includes("accepted")) {
      throw new Error("accepted metric unavailable");
    }

    super.recordBetAccepted(amountCents);
  }

  recordBetRejected(): void {
    if (this.throwOn.includes("rejected")) {
      throw new Error("rejected metric unavailable");
    }

    super.recordBetRejected();
  }

  recordCashout(mode: "manual" | "auto", payoutCents: bigint): void {
    if (this.throwOn.includes("cashout")) {
      throw new Error("cashout metric unavailable");
    }

    super.recordCashout(mode, payoutCents);
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
  public publishBetPlacedError: unknown = null;
  public publishBetCashedOutError: unknown = null;

  async publishBettingStarted(): Promise<void> {}

  async publishStarted(): Promise<void> {}

  async publishTick(): Promise<void> {}

  async publishCrashed(): Promise<void> {}

  async publishSettled(): Promise<void> {}

  async publishBetPlaced(bet: Bet): Promise<void> {
    if (this.publishBetPlacedError) {
      throw this.publishBetPlacedError;
    }

    this.betPlacedEvents.push(bet);
  }

  async publishBetCashedOut(bet: Bet): Promise<void> {
    if (this.publishBetCashedOutError) {
      throw this.publishBetCashedOutError;
    }

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

function openRoundFixture(
  overrides: {
    chainIndex?: number;
    crashPointBp?: number;
    id?: string;
  } = {},
): Round {
  return Round.openBetting({
    id: overrides.id ?? "round-1",
    bettingStartsAt: new Date("2026-05-30T10:00:00.000Z"),
    bettingEndsAt: new Date("2026-05-30T10:00:10.000Z"),
    crashPointBp: overrides.crashPointBp ?? 30000,
    serverSeedHash: "seed-hash",
    clientSeed: "client-seed",
    nonce: overrides.chainIndex ?? 1,
    chainIndex: overrides.chainIndex ?? 1,
  });
}

function acceptedBetFixture(
  overrides: {
    autoCashoutMultiplierBp?: number | null;
    id?: string;
    playerId?: string;
    roundId?: string;
  } = {},
): Bet {
  return Bet.accepted({
    id: overrides.id ?? "bet-1",
    roundId: overrides.roundId ?? "round-1",
    playerId: overrides.playerId ?? "player-1",
    username: "player",
    amountCents: 1000n,
    autoCashoutMultiplierBp: overrides.autoCashoutMultiplierBp ?? null,
  });
}

function autoBetSessionFixture(
  overrides: Partial<AutoBetSession> = {},
): AutoBetSession {
  return {
    id: "auto-session-1",
    playerId: "player-1",
    username: "player",
    status: "ACTIVE",
    strategy: "FIXED",
    amountCents: 1000n,
    nextAmountCents: 1000n,
    autoCashoutMultiplierBp: null,
    maxRounds: 3,
    roundsPlayed: 0,
    martingaleMultiplier: 2,
    martingaleMaxSteps: 0,
    martingaleCurrentStep: 0,
    netProfitCents: 0n,
    stopLossCents: null,
    takeProfitCents: null,
    stopReason: null,
    startsAfterRoundId: null,
    createdAt: new Date("2026-05-30T10:00:00.000Z"),
    updatedAt: new Date("2026-05-30T10:00:00.000Z"),
    stoppedAt: null,
    ...overrides,
  };
}

function autoBetExecutionFixture(
  overrides: Partial<AutoBetRoundExecution> = {},
): AutoBetRoundExecution {
  return {
    id: "execution-1",
    sessionId: "auto-session-1",
    roundId: "round-1",
    betId: "bet-1",
    status: "BET_PLACED",
    reason: null,
    resultStatus: null,
    resultDeltaCents: null,
    resultAppliedAt: null,
    createdAt: new Date("2026-05-30T10:00:00.000Z"),
    ...overrides,
  };
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
    const metrics = new FakeGameMetrics();
    const useCase = new AdvanceRoundLifecycleUseCase(
      repository,
      new FixedIdGenerator("round-2"),
      new FixedClock(new Date("2026-05-30T10:00:12.000Z")),
      new FakeRoundSeedProvider(),
      new FakeWalletClient(),
      { bettingWindowMs: 10000 },
      undefined,
      metrics,
    );

    const result = await useCase.execute();

    expect(result.action).toBe("ROUND_CRASHED");
    expect(result.round?.status).toBe("CRASHED");
    expect(result.round?.serverSeed).toBe("server-seed-1");
    expect(metrics.crashPoints).toEqual([round.crashPointBp / 10000]);
  });

  test("automatically cashes out accepted bets at the configured target", async () => {
    const round = openRound(30000);
    round.placeBet({
      id: "bet-1",
      playerId: "player-1",
      username: "player",
      amountCents: 1000n,
      autoCashoutMultiplierBp: 15000,
    });
    round.start(new Date("2026-05-30T10:00:10.000Z"));
    const repository = new InMemoryGameRepository(round);
    const walletClient = new FakeWalletClient();
    const events = new FakeRoundEventsPublisher();
    const metrics = new FakeGameMetrics();
    const useCase = new AdvanceRoundLifecycleUseCase(
      repository,
      new FixedIdGenerator("round-2"),
      new FixedClock(new Date("2026-05-30T10:00:15.000Z")),
      new FakeRoundSeedProvider(),
      walletClient,
      { bettingWindowMs: 10000 },
      events,
      metrics,
    );

    const result = await useCase.execute();
    const bet = result.round?.bets[0];

    expect(result.action).toBe("NOOP");
    expect(bet?.status).toBe("CASHED_OUT");
    expect(bet?.cashoutMultiplierBp).toBe(15000);
    expect(bet?.payoutCents).toBe(1500n);
    expect(walletClient.credits[0]).toMatchObject({
      amountCents: 1500n,
      playerId: "player-1",
      referenceId: "round:round-1:player:player-1:cashout-credit",
      reason: "CASHOUT_PAYOUT",
    });
    expect(events.betCashedOutEvents[0]?.cashoutMultiplierBp).toBe(15000);
    expect(metrics.cashouts).toEqual([{ mode: "auto", payoutCents: 1500n }]);
  });

  test("keeps automatic cashout behavior when cashout metrics throw", async () => {
    const round = openRound(30000);
    round.placeBet({
      id: "bet-1",
      playerId: "player-1",
      username: "player",
      amountCents: 1000n,
      autoCashoutMultiplierBp: 15000,
    });
    round.start(new Date("2026-05-30T10:00:10.000Z"));
    const repository = new InMemoryGameRepository(round);
    const walletClient = new FakeWalletClient();
    const events = new FakeRoundEventsPublisher();
    const useCase = new AdvanceRoundLifecycleUseCase(
      repository,
      new FixedIdGenerator("round-2"),
      new FixedClock(new Date("2026-05-30T10:00:15.000Z")),
      new FakeRoundSeedProvider(),
      walletClient,
      { bettingWindowMs: 10000 },
      events,
      new ThrowingGameMetrics(["cashout"]),
    );

    const result = await useCase.execute();
    const bet = result.round?.bets[0];

    expect(result.action).toBe("NOOP");
    expect(bet?.status).toBe("CASHED_OUT");
    expect(walletClient.credits).toHaveLength(1);
    expect(events.betCashedOutEvents.map((eventBet) => eventBet.id)).toEqual([
      "bet-1",
    ]);
  });

  test("auto cashout wins when a tick passes target and crash point", async () => {
    const round = openRound(20400);
    round.placeBet({
      id: "bet-1",
      playerId: "player-1",
      username: "player",
      amountCents: 1000n,
      autoCashoutMultiplierBp: 20000,
    });
    round.start(new Date("2026-05-30T10:00:10.000Z"));
    const repository = new InMemoryGameRepository(round);
    const useCase = new AdvanceRoundLifecycleUseCase(
      repository,
      new FixedIdGenerator("round-2"),
      new FixedClock(new Date("2026-05-30T10:00:21.000Z")),
      new FakeRoundSeedProvider(),
      new FakeWalletClient(),
      { bettingWindowMs: 10000 },
      new FakeRoundEventsPublisher(),
    );

    const result = await useCase.execute();

    expect(result.action).toBe("ROUND_CRASHED");
    expect(result.round?.bets[0]?.status).toBe("CASHED_OUT");
    expect(result.round?.bets[0]?.cashoutMultiplierBp).toBe(20000);
  });

  test("does not auto cashout when target is at or above crash point", async () => {
    const round = openRound(20000);
    round.placeBet({
      id: "bet-1",
      playerId: "player-1",
      username: "player",
      amountCents: 1000n,
      autoCashoutMultiplierBp: 20000,
    });
    round.start(new Date("2026-05-30T10:00:10.000Z"));
    const repository = new InMemoryGameRepository(round);
    const useCase = new AdvanceRoundLifecycleUseCase(
      repository,
      new FixedIdGenerator("round-2"),
      new FixedClock(new Date("2026-05-30T10:00:20.000Z")),
      new FakeRoundSeedProvider(),
      new FakeWalletClient(),
      { bettingWindowMs: 10000 },
      new FakeRoundEventsPublisher(),
    );

    const result = await useCase.execute();

    expect(result.action).toBe("ROUND_CRASHED");
    expect(result.round?.bets[0]?.status).toBe("LOST");
  });

  test("retries a pending auto cashout credit before settlement", async () => {
    const round = openRound(16000);
    round.placeBet({
      id: "bet-1",
      playerId: "player-1",
      username: "player",
      amountCents: 1000n,
      autoCashoutMultiplierBp: 15000,
    });
    round.start(new Date("2026-05-30T10:00:10.000Z"));
    const repository = new InMemoryGameRepository(round);
    const walletClient = new FakeWalletClient();
    walletClient.creditError = new Error("wallet unavailable");
    const autoCashoutAttempt = new AdvanceRoundLifecycleUseCase(
      repository,
      new FixedIdGenerator("round-2"),
      new FixedClock(new Date("2026-05-30T10:00:15.000Z")),
      new FakeRoundSeedProvider(),
      walletClient,
      { bettingWindowMs: 10000 },
      new FakeRoundEventsPublisher(),
    );

    await expect(autoCashoutAttempt.execute()).rejects.toThrow(
      WalletCreditFailedError,
    );
    expect(repository.currentRound?.status).toBe("RUNNING");
    expect(repository.currentRound?.bets[0]?.status).toBe(
      "CASHOUT_PENDING_CREDIT",
    );

    walletClient.creditError = null;
    const metrics = new FakeGameMetrics();
    const crashRound = new AdvanceRoundLifecycleUseCase(
      repository,
      new FixedIdGenerator("round-2"),
      new FixedClock(new Date("2026-05-30T10:00:16.000Z")),
      new FakeRoundSeedProvider(),
      walletClient,
      { bettingWindowMs: 10000 },
      new FakeRoundEventsPublisher(),
    );
    const settleRound = new AdvanceRoundLifecycleUseCase(
      repository,
      new FixedIdGenerator("round-2"),
      new FixedClock(new Date("2026-05-30T10:00:21.000Z")),
      new FakeRoundSeedProvider(),
      walletClient,
      { bettingWindowMs: 10000 },
      new FakeRoundEventsPublisher(),
      metrics,
    );

    expect((await crashRound.execute()).action).toBe("ROUND_CRASHED");
    const result = await settleRound.execute();

    expect(result.action).toBe("ROUND_SETTLED");
    expect(result.round?.bets[0]?.status).toBe("CASHED_OUT");
    expect(walletClient.credits).toHaveLength(2);
    expect(metrics.cashouts).toEqual([{ mode: "auto", payoutCents: 1500n }]);
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
      new FixedClock(new Date("2026-05-30T10:00:16.000Z")),
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

  test("keeps a crashed round visible before the crash display window elapses", async () => {
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
      new FixedClock(new Date("2026-05-30T10:00:15.999Z")),
      new FakeRoundSeedProvider(),
      new FakeWalletClient(),
      { bettingWindowMs: 10000 },
    );

    const result = await useCase.execute();

    expect(result.action).toBe("NOOP");
    expect(result.round?.status).toBe("CRASHED");
    expect(repository.currentRound?.status).toBe("CRASHED");
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
    const metrics = new FakeGameMetrics();
    const useCase = new AdvanceRoundLifecycleUseCase(
      repository,
      new FixedIdGenerator("round-2"),
      new FixedClock(new Date("2026-05-30T10:00:16.000Z")),
      new FakeRoundSeedProvider(),
      walletClient,
      { bettingWindowMs: 10000 },
      undefined,
      metrics,
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
    expect(metrics.cashouts).toEqual([
      { mode: "manual", payoutCents: 1500n },
    ]);
  });

  test("classifies pending manual cashout retry as manual when auto target differs", async () => {
    const crashedRound = openRound(30000);
    crashedRound.placeBet({
      id: "bet-1",
      playerId: "player-1",
      username: "player",
      amountCents: 1000n,
      autoCashoutMultiplierBp: 20000,
    });
    crashedRound.start(new Date("2026-05-30T10:00:10.000Z"));
    crashedRound.cashOut("player-1", 15000);
    crashedRound.crash(
      new Date("2026-05-30T10:00:11.000Z"),
      "server-seed-1",
    );
    const metrics = new FakeGameMetrics();
    const useCase = new AdvanceRoundLifecycleUseCase(
      new InMemoryGameRepository(crashedRound),
      new FixedIdGenerator("round-2"),
      new FixedClock(new Date("2026-05-30T10:00:16.000Z")),
      new FakeRoundSeedProvider(),
      new FakeWalletClient(),
      { bettingWindowMs: 10000 },
      undefined,
      metrics,
    );

    await useCase.execute();

    expect(metrics.cashouts).toEqual([
      { mode: "manual", payoutCents: 1500n },
    ]);
  });

  test("does not record pending cashout retry metrics when completed state save fails", async () => {
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
    repository.saveRoundError = new Error("save failed");
    const metrics = new FakeGameMetrics();
    const useCase = new AdvanceRoundLifecycleUseCase(
      repository,
      new FixedIdGenerator("round-2"),
      new FixedClock(new Date("2026-05-30T10:00:16.000Z")),
      new FakeRoundSeedProvider(),
      new FakeWalletClient(),
      { bettingWindowMs: 10000 },
      undefined,
      metrics,
    );

    await expect(useCase.execute()).rejects.toThrow("save failed");

    expect(metrics.cashouts).toEqual([]);
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
      new FixedClock(new Date("2026-05-30T10:00:16.000Z")),
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

describe("AutoBetSession use cases", () => {
  test("starts a persistent auto bet session after the current round", async () => {
    const round = openRoundFixture();
    const gameRepository = new InMemoryGameRepository(round);
    const autoBetRepository = new FakeAutoBetSessionRepository();
    const useCase = new StartAutoBetSessionUseCase(
      gameRepository,
      autoBetRepository,
      new SequenceIdGenerator(["auto-session-1"]),
    );

    await expect(
      useCase.execute({
        amountCents: "1000",
        autoCashoutMultiplierBp: 20000,
        maxRounds: 3,
        playerId: "player-1",
        stopLossCents: "3000",
        takeProfitCents: "5000",
        username: "player",
      }),
    ).resolves.toMatchObject({
      id: "auto-session-1",
      amountCents: 1000n,
      autoCashoutMultiplierBp: 20000,
      maxRounds: 3,
      netProfitCents: 0n,
      playerId: "player-1",
      roundsPlayed: 0,
      startsAfterRoundId: round.id,
      status: "ACTIVE",
      stopLossCents: 3000n,
      takeProfitCents: 5000n,
    });
  });

  test("starts a martingale auto bet session with the base stake as next amount", async () => {
    const gameRepository = new InMemoryGameRepository(openRoundFixture());
    const autoBetRepository = new FakeAutoBetSessionRepository();
    const useCase = new StartAutoBetSessionUseCase(
      gameRepository,
      autoBetRepository,
      new SequenceIdGenerator(["auto-session-1"]),
    );

    await expect(
      useCase.execute({
        amountCents: "1000",
        martingaleMaxSteps: 3,
        martingaleMultiplier: 2,
        maxRounds: 10,
        playerId: "player-1",
        strategy: "MARTINGALE",
        username: "player",
      }),
    ).resolves.toMatchObject({
      amountCents: 1000n,
      martingaleCurrentStep: 0,
      martingaleMaxSteps: 3,
      martingaleMultiplier: 2,
      nextAmountCents: 1000n,
      strategy: "MARTINGALE",
    });
  });

  test("rejects a second active auto bet session for the same player", async () => {
    const gameRepository = new InMemoryGameRepository(openRoundFixture());
    const autoBetRepository = new FakeAutoBetSessionRepository();
    const useCase = new StartAutoBetSessionUseCase(
      gameRepository,
      autoBetRepository,
      new SequenceIdGenerator(["auto-session-1", "auto-session-2"]),
    );

    await useCase.execute({
      amountCents: "1000",
      maxRounds: 2,
      playerId: "player-1",
      username: "player",
    });

    await expect(
      useCase.execute({
        amountCents: "1000",
        maxRounds: 2,
        playerId: "player-1",
        username: "player",
      }),
    ).rejects.toThrow(AutoBetSessionActiveError);
  });

  test("gets active auto bet session or latest stopped session", async () => {
    const autoBetRepository = new FakeAutoBetSessionRepository();
    const getUseCase = new GetMyAutoBetSessionUseCase(autoBetRepository);
    const stopUseCase = new StopAutoBetSessionUseCase(autoBetRepository);

    autoBetRepository.sessions.push(
      autoBetSessionFixture({
        id: "auto-session-1",
        playerId: "player-1",
        status: "ACTIVE",
      }),
    );

    await expect(
      getUseCase.execute({ playerId: "player-1" }),
    ).resolves.toMatchObject({ id: "auto-session-1", status: "ACTIVE" });

    await stopUseCase.execute({ playerId: "player-1" });

    await expect(
      getUseCase.execute({ playerId: "player-1" }),
    ).resolves.toMatchObject({
      id: "auto-session-1",
      status: "STOPPED",
      stopReason: "MANUAL",
    });
  });

  test("auto bet executor skips the activation round and bets once on the next round", async () => {
    const autoBetRepository = new FakeAutoBetSessionRepository();
    const firstRound = openRoundFixture({ id: "round-1", chainIndex: 1 });
    autoBetRepository.sessions.push(
      autoBetSessionFixture({
        id: "auto-session-1",
        playerId: "player-1",
        startsAfterRoundId: "round-1",
        status: "ACTIVE",
      }),
    );
    const placeBetUseCase = {
      calls: [] as unknown[],
      execute: async (input: unknown) => {
        placeBetUseCase.calls.push(input);

        return {
          balanceCents: 99000n,
          bet: acceptedBetFixture({ id: "bet-1", roundId: "round-2" }),
        };
      },
    };
    const executor = new ExecuteAutoBetsForRoundUseCase(
      autoBetRepository,
      placeBetUseCase,
      new SequenceIdGenerator(["execution-1"]),
    );

    await executor.execute({ round: firstRound });
    expect(placeBetUseCase.calls).toHaveLength(0);

    await executor.execute({
      round: openRoundFixture({ id: "round-2", chainIndex: 2 }),
    });
    await executor.execute({
      round: openRoundFixture({ id: "round-2", chainIndex: 2 }),
    });

    expect(placeBetUseCase.calls).toEqual([
      {
        amountCents: 1000n,
        autoCashoutMultiplierBp: null,
        playerId: "player-1",
        source: "AUTO_BET",
        username: "player",
      },
    ]);
    expect(autoBetRepository.executions).toMatchObject([
      {
        betId: "bet-1",
        roundId: "round-2",
        sessionId: "auto-session-1",
        status: "BET_PLACED",
      },
    ]);
    expect(autoBetRepository.sessions[0]?.roundsPlayed).toBe(1);
  });

  test("auto bet executor uses the session next amount for martingale stakes", async () => {
    const autoBetRepository = new FakeAutoBetSessionRepository();
    autoBetRepository.sessions.push(
      autoBetSessionFixture({
        id: "auto-session-1",
        nextAmountCents: 2000n,
        strategy: "MARTINGALE",
      }),
    );
    const placeBetUseCase = {
      calls: [] as unknown[],
      execute: async (input: unknown) => {
        placeBetUseCase.calls.push(input);

        return {
          balanceCents: 98000n,
          bet: acceptedBetFixture({ id: "bet-1", roundId: "round-1" }),
        };
      },
    };
    const executor = new ExecuteAutoBetsForRoundUseCase(
      autoBetRepository,
      placeBetUseCase,
      new SequenceIdGenerator(["execution-1"]),
    );

    await executor.execute({
      round: openRoundFixture({ id: "round-1", chainIndex: 1 }),
    });

    expect(placeBetUseCase.calls).toEqual([
      {
        amountCents: 2000n,
        autoCashoutMultiplierBp: null,
        playerId: "player-1",
        source: "AUTO_BET",
        username: "player",
      },
    ]);
  });

  test("applies lost auto bet result once and stops on stop loss", async () => {
    const autoBetRepository = new FakeAutoBetSessionRepository();
    autoBetRepository.sessions.push(
      autoBetSessionFixture({
        id: "auto-session-1",
        amountCents: 1000n,
        netProfitCents: 0n,
        stopLossCents: 1000n,
        status: "ACTIVE",
      }),
    );
    autoBetRepository.executions.push(
      autoBetExecutionFixture({
        id: "execution-1",
        betId: "bet-1",
        sessionId: "auto-session-1",
      }),
    );
    const useCase = new ApplyAutoBetResultUseCase(autoBetRepository);

    await useCase.execute({
      amountCents: 1000n,
      betId: "bet-1",
      payoutCents: null,
      resultStatus: "LOST",
    });
    await useCase.execute({
      amountCents: 1000n,
      betId: "bet-1",
      payoutCents: null,
      resultStatus: "LOST",
    });

    expect(autoBetRepository.sessions[0]?.netProfitCents).toBe(-1000n);
    expect(autoBetRepository.sessions[0]?.status).toBe("STOPPED");
    expect(autoBetRepository.sessions[0]?.stopReason).toBe(
      "STOP_LOSS_REACHED",
    );
  });

  test("applies a lost martingale result and advances the next stake", async () => {
    const autoBetRepository = new FakeAutoBetSessionRepository();
    autoBetRepository.sessions.push(
      autoBetSessionFixture({
        id: "auto-session-1",
        amountCents: 1000n,
        martingaleCurrentStep: 0,
        martingaleMaxSteps: 3,
        martingaleMultiplier: 2,
        nextAmountCents: 1000n,
        strategy: "MARTINGALE",
        status: "ACTIVE",
      }),
    );
    autoBetRepository.executions.push(
      autoBetExecutionFixture({
        id: "execution-1",
        betId: "bet-1",
        sessionId: "auto-session-1",
      }),
    );
    const useCase = new ApplyAutoBetResultUseCase(autoBetRepository);

    await useCase.execute({
      amountCents: 1000n,
      betId: "bet-1",
      payoutCents: null,
      resultStatus: "LOST",
    });

    expect(autoBetRepository.sessions[0]).toMatchObject({
      martingaleCurrentStep: 1,
      netProfitCents: -1000n,
      nextAmountCents: 2000n,
      status: "ACTIVE",
    });
  });

  test("stops a martingale session when the next loss exceeds max steps", async () => {
    const autoBetRepository = new FakeAutoBetSessionRepository();
    autoBetRepository.sessions.push(
      autoBetSessionFixture({
        id: "auto-session-1",
        martingaleCurrentStep: 1,
        martingaleMaxSteps: 1,
        martingaleMultiplier: 2,
        nextAmountCents: 2000n,
        strategy: "MARTINGALE",
        status: "ACTIVE",
      }),
    );
    autoBetRepository.executions.push(
      autoBetExecutionFixture({
        id: "execution-1",
        betId: "bet-1",
        sessionId: "auto-session-1",
      }),
    );
    const useCase = new ApplyAutoBetResultUseCase(autoBetRepository);

    await useCase.execute({
      amountCents: 2000n,
      betId: "bet-1",
      payoutCents: null,
      resultStatus: "LOST",
    });

    expect(autoBetRepository.sessions[0]).toMatchObject({
      martingaleCurrentStep: 1,
      nextAmountCents: 2000n,
      status: "STOPPED",
      stopReason: "MARTINGALE_MAX_STEPS_REACHED",
    });
  });

  test("stops a martingale session when the next stake exceeds the bet limit", async () => {
    const autoBetRepository = new FakeAutoBetSessionRepository();
    autoBetRepository.sessions.push(
      autoBetSessionFixture({
        id: "auto-session-1",
        martingaleCurrentStep: 2,
        martingaleMaxSteps: 3,
        martingaleMultiplier: 2,
        nextAmountCents: 100000n,
        strategy: "MARTINGALE",
        status: "ACTIVE",
      }),
    );
    autoBetRepository.executions.push(
      autoBetExecutionFixture({
        id: "execution-1",
        betId: "bet-1",
        sessionId: "auto-session-1",
      }),
    );
    const useCase = new ApplyAutoBetResultUseCase(autoBetRepository);

    await useCase.execute({
      amountCents: 100000n,
      betId: "bet-1",
      payoutCents: null,
      resultStatus: "LOST",
    });

    expect(autoBetRepository.sessions[0]).toMatchObject({
      martingaleCurrentStep: 2,
      nextAmountCents: 100000n,
      status: "STOPPED",
      stopReason: "MARTINGALE_BET_LIMIT_REACHED",
    });
  });

  test("applies cashed out auto bet result and stops on take profit", async () => {
    const autoBetRepository = new FakeAutoBetSessionRepository();
    autoBetRepository.sessions.push(
      autoBetSessionFixture({
        id: "auto-session-1",
        amountCents: 1000n,
        netProfitCents: 0n,
        takeProfitCents: 500n,
        status: "ACTIVE",
      }),
    );
    autoBetRepository.executions.push(
      autoBetExecutionFixture({
        id: "execution-1",
        betId: "bet-1",
        sessionId: "auto-session-1",
      }),
    );
    const useCase = new ApplyAutoBetResultUseCase(autoBetRepository);

    await useCase.execute({
      amountCents: 1000n,
      betId: "bet-1",
      payoutCents: 1500n,
      resultStatus: "CASHED_OUT",
    });

    expect(autoBetRepository.sessions[0]?.netProfitCents).toBe(500n);
    expect(autoBetRepository.sessions[0]?.status).toBe("STOPPED");
    expect(autoBetRepository.sessions[0]?.stopReason).toBe(
      "TAKE_PROFIT_REACHED",
    );
  });

  test("applies a cashed out martingale result and resets the next stake", async () => {
    const autoBetRepository = new FakeAutoBetSessionRepository();
    autoBetRepository.sessions.push(
      autoBetSessionFixture({
        id: "auto-session-1",
        amountCents: 1000n,
        martingaleCurrentStep: 2,
        martingaleMaxSteps: 3,
        martingaleMultiplier: 2,
        nextAmountCents: 4000n,
        strategy: "MARTINGALE",
        status: "ACTIVE",
      }),
    );
    autoBetRepository.executions.push(
      autoBetExecutionFixture({
        id: "execution-1",
        betId: "bet-1",
        sessionId: "auto-session-1",
      }),
    );
    const useCase = new ApplyAutoBetResultUseCase(autoBetRepository);

    await useCase.execute({
      amountCents: 4000n,
      betId: "bet-1",
      payoutCents: 6000n,
      resultStatus: "CASHED_OUT",
    });

    expect(autoBetRepository.sessions[0]).toMatchObject({
      martingaleCurrentStep: 0,
      netProfitCents: 2000n,
      nextAmountCents: 1000n,
      status: "ACTIVE",
    });
  });
});

describe("PlaceBetUseCase", () => {
  test("persists and dispatches a wallet debit outbox message before saving an accepted bet", async () => {
    const repository = new InMemoryGameRepository(openRound());
    const walletClient = new FakeWalletClient();
    const outbox = new FakeWalletOutboxRepository();
    const outboxDispatcher = new FakeWalletOutboxDispatcher(outbox);
    const roundEventsPublisher = new FakeRoundEventsPublisher();
    const useCase = new PlaceBetUseCase(
      repository,
      walletClient,
      new FixedIdGenerator("bet-1"),
      roundEventsPublisher,
      undefined,
      outbox,
      outboxDispatcher,
    );

    const result = await useCase.execute({
      playerId: "player-1",
      username: "player",
      amountCents: 2500n,
    });

    expect(result.bet.status).toBe("ACCEPTED");
    expect(result.balanceCents).toBe(97500n);
    expect(walletClient.debits).toEqual([]);
    expect(outbox.messages[0]).toMatchObject({
      id: "bet-1",
      type: "WALLET_DEBIT",
      status: "SUCCEEDED",
      roundId: "round-1",
      betId: "bet-1",
      playerId: "player-1",
      username: "player",
      amountCents: 2500n,
      referenceId: "round:round-1:player:player-1:bet-debit",
      reason: "BET_PLACED",
      responseApplied: true,
      responseBalanceCents: 97500n,
    });
    expect(outboxDispatcher.dispatched.map((message) => message.id)).toEqual([
      "bet-1",
    ]);
    expect(repository.currentRound?.bets).toHaveLength(1);
    expect(roundEventsPublisher.betPlacedEvents.map((bet) => bet.id)).toEqual([
      "bet-1",
    ]);
  });

  test("debits the wallet with an idempotent reference and saves the accepted bet", async () => {
    const repository = new InMemoryGameRepository(openRound());
    const walletClient = new FakeWalletClient();
    const roundEventsPublisher = new FakeRoundEventsPublisher();
    const metrics = new FakeGameMetrics();
    const useCase = new PlaceBetUseCase(
      repository,
      walletClient,
      new FixedIdGenerator("bet-1"),
      roundEventsPublisher,
      metrics,
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
    expect(metrics.acceptedBets).toEqual([1000n]);
  });

  test("keeps accepted bet behavior when accepted bet metrics throw", async () => {
    const repository = new InMemoryGameRepository(openRound());
    const walletClient = new FakeWalletClient();
    const roundEventsPublisher = new FakeRoundEventsPublisher();
    const useCase = new PlaceBetUseCase(
      repository,
      walletClient,
      new FixedIdGenerator("bet-1"),
      roundEventsPublisher,
      new ThrowingGameMetrics(["accepted"]),
    );

    const result = await useCase.execute({
      playerId: "player-1",
      username: "player",
      amountCents: 1000n,
    });

    expect(result.bet.status).toBe("ACCEPTED");
    expect(result.balanceCents).toBe(99000n);
    expect(repository.currentRound?.bets).toHaveLength(1);
    expect(roundEventsPublisher.betPlacedEvents.map((bet) => bet.id)).toEqual([
      "bet-1",
    ]);
  });

  test("saves an accepted bet with an auto cashout target", async () => {
    const round = openRound();
    const repository = new InMemoryGameRepository(round);
    const walletClient = new FakeWalletClient();
    const events = new FakeRoundEventsPublisher();
    const useCase = new PlaceBetUseCase(
      repository,
      walletClient,
      new FixedIdGenerator("bet-1"),
      events,
    );

    const result = await useCase.execute({
      playerId: "player-1",
      username: "player",
      amountCents: "1000",
      autoCashoutMultiplierBp: 20000,
    });

    expect(result.bet.autoCashoutMultiplierBp).toBe(20000);
    expect(repository.savedRounds.at(-1)?.bets[0]?.autoCashoutMultiplierBp).toBe(
      20000,
    );
    expect(events.betPlacedEvents[0]?.autoCashoutMultiplierBp).toBe(20000);
  });

  test("blocks manual bet placement while an auto bet session is active", async () => {
    const round = openRoundFixture();
    const repository = new InMemoryGameRepository(round);
    const walletClient = new FakeWalletClient();
    const autoBetRepository = new FakeAutoBetSessionRepository();
    autoBetRepository.sessions.push(
      autoBetSessionFixture({ playerId: "player-1", status: "ACTIVE" }),
    );
    const useCase = new PlaceBetUseCase(
      repository,
      walletClient,
      new FixedIdGenerator("bet-1"),
      new FakeRoundEventsPublisher(),
      undefined,
      undefined,
      undefined,
      autoBetRepository,
    );

    await expect(
      useCase.execute({
        playerId: "player-1",
        username: "player",
        amountCents: "1000",
      }),
    ).rejects.toThrow(ManualBetBlockedByAutoBetError);
    expect(walletClient.debits).toHaveLength(0);
  });

  test("allows auto bet source to reuse place bet while the session is active", async () => {
    const round = openRoundFixture();
    const repository = new InMemoryGameRepository(round);
    const autoBetRepository = new FakeAutoBetSessionRepository();
    autoBetRepository.sessions.push(
      autoBetSessionFixture({ playerId: "player-1", status: "ACTIVE" }),
    );
    const useCase = new PlaceBetUseCase(
      repository,
      new FakeWalletClient(),
      new FixedIdGenerator("bet-1"),
      new FakeRoundEventsPublisher(),
      undefined,
      undefined,
      undefined,
      autoBetRepository,
    );

    await expect(
      useCase.execute({
        playerId: "player-1",
        username: "player",
        amountCents: "1000",
        source: "AUTO_BET",
      }),
    ).resolves.toMatchObject({
      bet: { status: "ACCEPTED" },
    });
  });

  test("rejects auto cashout targets outside the allowed range", async () => {
    const useCase = new PlaceBetUseCase(
      new InMemoryGameRepository(openRound()),
      new FakeWalletClient(),
      new FixedIdGenerator("bet-1"),
      new FakeRoundEventsPublisher(),
    );

    await expect(
      useCase.execute({
        playerId: "player-1",
        username: "player",
        amountCents: "1000",
        autoCashoutMultiplierBp: 10099,
      }),
    ).rejects.toThrow(AutoCashoutMultiplierOutOfRangeError);

    await expect(
      useCase.execute({
        playerId: "player-2",
        username: "player-2",
        amountCents: "1000",
        autoCashoutMultiplierBp: 10000001,
      }),
    ).rejects.toThrow(AutoCashoutMultiplierOutOfRangeError);
  });

  test("rejects out-of-range amounts before debiting the wallet", async () => {
    const repository = new InMemoryGameRepository(openRound());
    const walletClient = new FakeWalletClient();
    const metrics = new FakeGameMetrics();
    const useCase = new PlaceBetUseCase(
      repository,
      walletClient,
      new FixedIdGenerator("bet-1"),
      new FakeRoundEventsPublisher(),
      metrics,
    );

    await expect(
      useCase.execute({
        playerId: "player-1",
        username: "player",
        amountCents: 99n,
      }),
    ).rejects.toThrow(BetAmountOutOfRangeError);
    expect(walletClient.debits).toHaveLength(0);
    expect(metrics.rejectedBets).toBe(1);
  });

  test("keeps the original rejected bet error when rejection metrics throw", async () => {
    const walletClient = new FakeWalletClient();
    const useCase = new PlaceBetUseCase(
      new InMemoryGameRepository(openRound()),
      walletClient,
      new FixedIdGenerator("bet-1"),
      new FakeRoundEventsPublisher(),
      new ThrowingGameMetrics(["rejected"]),
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

  test("records a rejected bet when amount parsing fails", async () => {
    const walletClient = new FakeWalletClient();
    const metrics = new FakeGameMetrics();
    const useCase = new PlaceBetUseCase(
      new InMemoryGameRepository(openRound()),
      walletClient,
      new FixedIdGenerator("bet-1"),
      new FakeRoundEventsPublisher(),
      metrics,
    );

    await expect(
      useCase.execute({
        playerId: "player-1",
        username: "player",
        amountCents: "not-cents",
      }),
    ).rejects.toThrow("Amount in cents must be an integer string");
    expect(walletClient.debits).toHaveLength(0);
    expect(metrics.rejectedBets).toBe(1);
  });

  test("records a rejected bet when the wallet debit fails", async () => {
    const walletClient = new FakeWalletClient();
    walletClient.debitError = new Error("wallet rejected debit");
    const metrics = new FakeGameMetrics();
    const useCase = new PlaceBetUseCase(
      new InMemoryGameRepository(openRound()),
      walletClient,
      new FixedIdGenerator("bet-1"),
      new FakeRoundEventsPublisher(),
      metrics,
    );

    await expect(
      useCase.execute({
        playerId: "player-1",
        username: "player",
        amountCents: 1000n,
      }),
    ).rejects.toThrow("wallet rejected debit");
    expect(metrics.rejectedBets).toBe(1);
  });

  test("records a rejected bet when saving an accepted bet fails", async () => {
    const repository = new InMemoryGameRepository(openRound());
    repository.saveRoundError = new Error("save failed");
    const metrics = new FakeGameMetrics();
    const useCase = new PlaceBetUseCase(
      repository,
      new FakeWalletClient(),
      new FixedIdGenerator("bet-1"),
      new FakeRoundEventsPublisher(),
      metrics,
    );

    await expect(
      useCase.execute({
        playerId: "player-1",
        username: "player",
        amountCents: 1000n,
      }),
    ).rejects.toThrow("save failed");
    expect(metrics.acceptedBets).toEqual([]);
    expect(metrics.rejectedBets).toBe(1);
  });

  test("does not record a rejected bet when publishing an accepted bet fails", async () => {
    const events = new FakeRoundEventsPublisher();
    events.publishBetPlacedError = new Error("publish failed");
    const metrics = new FakeGameMetrics();
    const useCase = new PlaceBetUseCase(
      new InMemoryGameRepository(openRound()),
      new FakeWalletClient(),
      new FixedIdGenerator("bet-1"),
      events,
      metrics,
    );

    await expect(
      useCase.execute({
        playerId: "player-1",
        username: "player",
        amountCents: 1000n,
      }),
    ).rejects.toThrow("publish failed");
    expect(metrics.acceptedBets).toEqual([1000n]);
    expect(metrics.rejectedBets).toBe(0);
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
    const metrics = new FakeGameMetrics();
    const useCase = new PlaceBetUseCase(
      repository,
      walletClient,
      new FixedIdGenerator("bet-2"),
      roundEventsPublisher,
      metrics,
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
    expect(metrics.rejectedBets).toBe(1);
  });
});

describe("CashOutUseCase", () => {
  test("saves pending cashout with wallet credit outbox before completing cashout", async () => {
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
    const outbox = new FakeWalletOutboxRepository();
    const outboxDispatcher = new FakeWalletOutboxDispatcher(outbox);
    outboxDispatcher.result = {
      applied: true,
      balanceCents: 100500n,
    };
    const roundEventsPublisher = new FakeRoundEventsPublisher();
    const cashoutCreditService = new CashoutCreditService(
      repository,
      walletClient,
      new FixedIdGenerator("wallet-outbox-1"),
      outbox,
      outboxDispatcher,
    );
    const useCase = new CashOutUseCase(
      repository,
      walletClient,
      new FixedClock(new Date("2026-05-30T10:00:15.000Z")),
      roundEventsPublisher,
      undefined,
      cashoutCreditService,
    );

    const result = await useCase.execute({ playerId: "player-1" });

    expect(result.bet.status).toBe("CASHED_OUT");
    expect(result.balanceCents).toBe(100500n);
    expect(walletClient.credits).toEqual([]);
    expect(repository.walletOutboxMessages[0]).toMatchObject({
      id: "wallet-outbox-1",
      type: "WALLET_CREDIT",
      status: "IN_FLIGHT",
      roundId: "round-1",
      betId: "bet-1",
      playerId: "player-1",
      amountCents: 2117n,
      referenceId: "round:round-1:player:player-1:cashout-credit",
      reason: "CASHOUT_PAYOUT",
    });
    expect(repository.savedBetStatusSnapshots).toContainEqual([
      "CASHOUT_PENDING_CREDIT",
    ]);
    expect(repository.currentRound?.bets[0]?.status).toBe("CASHED_OUT");
    expect(
      roundEventsPublisher.betCashedOutEvents.map((bet) => bet.id),
    ).toEqual(["bet-1"]);
  });

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
    const metrics = new FakeGameMetrics();
    const useCase = new CashOutUseCase(
      repository,
      walletClient,
      new FixedClock(new Date("2026-05-30T10:00:15.000Z")),
      roundEventsPublisher,
      metrics,
    );

    const result = await useCase.execute({ playerId: "player-1" });

    expect(result.bet.status).toBe("CASHED_OUT");
    expect(result.bet.cashoutMultiplierBp).toBe(21170);
    expect(result.bet.payoutCents).toBe(2117n);
    expect(walletClient.credits).toEqual([
      {
        playerId: "player-1",
        amountCents: 2117n,
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
    expect(metrics.cashouts).toEqual([
      { mode: "manual", payoutCents: 2117n },
    ]);
  });

  test("keeps completed manual cashout behavior when cashout metrics throw", async () => {
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
      new ThrowingGameMetrics(["cashout"]),
    );

    const result = await useCase.execute({ playerId: "player-1" });

    expect(result.bet.status).toBe("CASHED_OUT");
    expect(result.balanceCents).toBe(100500n);
    expect(
      roundEventsPublisher.betCashedOutEvents.map((bet) => bet.id),
    ).toEqual(["bet-1"]);
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

  test("records a completed manual cashout before publishing realtime events", async () => {
    const round = openRound();
    round.placeBet({
      id: "bet-1",
      playerId: "player-1",
      username: "player",
      amountCents: 1000n,
    });
    round.start(new Date("2026-05-30T10:00:10.000Z"));
    const events = new FakeRoundEventsPublisher();
    events.publishBetCashedOutError = new Error("publish failed");
    const metrics = new FakeGameMetrics();
    const useCase = new CashOutUseCase(
      new InMemoryGameRepository(round),
      new FakeWalletClient(),
      new FixedClock(new Date("2026-05-30T10:00:15.000Z")),
      events,
      metrics,
    );

    await expect(
      useCase.execute({ playerId: "player-1" }),
    ).rejects.toThrow(WalletCreditFailedError);
    expect(metrics.cashouts).toEqual([
      { mode: "manual", payoutCents: 2117n },
    ]);
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
