import { describe, expect, test } from "bun:test";
import {
  BadRequestException,
  NotFoundException,
  ServiceUnavailableException,
} from "@nestjs/common";
import {
  AutoBetSessionActiveError,
  AutoCashoutMultiplierOutOfRangeError,
  CurrentRoundNotFoundError,
  RoundNotFoundError,
  WalletOperationRejectedError,
  WalletOperationTimedOutError,
} from "../../src/application/game.errors";
import type { AutoBetSession } from "../../src/application/auto-bet/auto-bet-session";
import { Bet } from "../../src/domain/bet";
import { Round } from "../../src/domain/round";
import { AutoBetController } from "../../src/presentation/controllers/auto-bet.controller";
import { GamesController } from "../../src/presentation/controllers/games.controller";

function openRound(): Round {
  return Round.openBetting({
    id: "round-1",
    bettingStartsAt: new Date("2026-05-30T10:00:00.000Z"),
    bettingEndsAt: new Date("2026-05-30T10:00:10.000Z"),
    crashPointBp: 25000,
    serverSeedHash: "server-seed-hash",
    clientSeed: "client-seed",
    nonce: 1,
    chainIndex: 7,
    nextServerSeedHash: "next-server-seed-hash",
  });
}

function acceptedBet(
  overrides: { autoCashoutMultiplierBp?: number | null } = {},
): Bet {
  return Bet.accepted({
    id: "bet-1",
    roundId: "round-1",
    playerId: "player-1",
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
    strategy: "MARTINGALE",
    amountCents: 1000n,
    nextAmountCents: 1000n,
    autoCashoutMultiplierBp: 20000,
    maxRounds: 3,
    roundsPlayed: 0,
    martingaleMultiplier: 2,
    martingaleMaxSteps: 3,
    martingaleCurrentStep: 0,
    netProfitCents: 0n,
    stopLossCents: 3000n,
    takeProfitCents: 5000n,
    stopReason: null,
    startsAfterRoundId: "round-1",
    createdAt: new Date("2026-05-30T10:00:00.000Z"),
    updatedAt: new Date("2026-05-30T10:00:00.000Z"),
    stoppedAt: null,
    ...overrides,
  };
}

function createController(overrides: Record<string, unknown> = {}): GamesController {
  return new GamesController(
    (overrides.getCurrentRoundUseCase ?? { execute: async () => null }) as never,
    (overrides.listRoundHistoryUseCase ?? { execute: async () => [] }) as never,
    (overrides.verifyRoundUseCase ?? { execute: async () => ({}) }) as never,
    (overrides.listMyBetsUseCase ?? { execute: async () => [] }) as never,
    (overrides.listLeaderboardUseCase ?? { execute: async () => [] }) as never,
    (overrides.placeBetUseCase ?? {
      execute: async () => ({ bet: acceptedBet(), balanceCents: 99000n }),
    }) as never,
    (overrides.cashOutUseCase ?? {
      execute: async () => ({ bet: acceptedBet(), balanceCents: 101000n }),
    }) as never,
    (overrides.gameMetrics ?? {
      contentType: () => "text/plain; version=0.0.4; charset=utf-8",
      metricsText: async () => "",
    }) as never,
  );
}

function createAutoBetController(
  overrides: Record<string, unknown> = {},
): AutoBetController {
  return new AutoBetController(
    (overrides.startAutoBetSessionUseCase ?? {
      execute: async () => autoBetSessionFixture(),
    }) as never,
    (overrides.getMyAutoBetSessionUseCase ?? {
      execute: async () => null,
    }) as never,
    (overrides.stopAutoBetSessionUseCase ?? {
      execute: async () => null,
    }) as never,
  );
}

describe("GamesController", () => {
  test("returns health check payload", () => {
    const controller = createController();

    expect(controller.check()).toEqual({ status: "ok", service: "games" });
  });

  test("returns game metrics in Prometheus text format", async () => {
    const metrics = {
      contentType: () => "text/plain; version=0.0.4; charset=utf-8",
      metricsText: async () => "# HELP crash_game_bets_total Total bets\n",
    };
    const controller = createController({ gameMetrics: metrics });

    await expect(controller.metrics()).resolves.toBe(
      "# HELP crash_game_bets_total Total bets\n",
    );
  });

  test("serializes the current round", async () => {
    const round = openRound();
    round.placeBet({
      id: "bet-1",
      playerId: "player-1",
      username: "player",
      amountCents: 1000n,
    });
    const controller = createController({
      getCurrentRoundUseCase: { execute: async () => round },
    });

    await expect(controller.currentRound()).resolves.toMatchObject({
      id: "round-1",
      status: "BETTING",
      crashPointBp: null,
      multiplierBaseBp: 10000,
      multiplierCurve: "EXPONENTIAL",
      multiplierGrowthRateBpPerSecond: 1200,
      bets: [
        {
          id: "bet-1",
          amountCents: "1000",
          status: "ACCEPTED",
        },
      ],
    });
  });

  test("reveals the crash point only after server seed reveal", async () => {
    const round = openRound();
    round.start(new Date("2026-05-30T10:00:10.000Z"));
    round.crash(new Date("2026-05-30T10:00:12.000Z"), "server-seed");
    const controller = createController({
      getCurrentRoundUseCase: { execute: async () => round },
    });

    await expect(controller.currentRound()).resolves.toMatchObject({
      crashPointBp: 25000,
      serverSeed: "server-seed",
      status: "CRASHED",
    });
  });

  test("places a bet for the authenticated user", async () => {
    const controller = createController({
      placeBetUseCase: {
        execute: async (input: {
          playerId: string;
          amountCents: string;
          autoCashoutMultiplierBp?: number | null;
        }) => {
          expect(input).toMatchObject({
            playerId: "player-1",
            amountCents: "1000",
            autoCashoutMultiplierBp: 20000,
          });

          return {
            bet: acceptedBet({ autoCashoutMultiplierBp: 20000 }),
            balanceCents: 99000n,
          };
        },
      },
    });

    const response = await controller.placeBet(
      { playerId: "player-1", username: "player" },
      { amountCents: "1000", autoCashoutMultiplierBp: 20000 },
    );

    expect(response.amountCents).toBe("1000");
    expect(response.status).toBe("ACCEPTED");
    expect(response.autoCashoutMultiplierBp).toBe(20000);
  });

  test("rejects invalid auto cashout targets", async () => {
    const controller = createController({
      placeBetUseCase: {
        execute: async () => {
          throw new AutoCashoutMultiplierOutOfRangeError();
        },
      },
    });

    try {
      await controller.placeBet(
        { playerId: "player-1", username: "player" },
        { amountCents: "1000", autoCashoutMultiplierBp: 10099 },
      );
      throw new Error("Expected invalid auto cashout target to reject");
    } catch (error) {
      expect(error).toBeInstanceOf(BadRequestException);
      expect((error as BadRequestException).getResponse()).toMatchObject({
        message: "Auto cashout multiplier must be between 1.01x and 1000.00x",
      });
    }
  });

  test("rejects invalid pagination limits", async () => {
    const controller = createController();

    await expect(controller.roundHistory("0")).rejects.toThrow(
      BadRequestException,
    );
  });

  test("lists round history and my bets with parsed limits", async () => {
    const round = openRound();
    const bet = acceptedBet();
    const controller = createController({
      listMyBetsUseCase: {
        execute: async (input: { limit?: number; playerId: string }) => {
          expect(input).toEqual({ playerId: "player-1", limit: 5 });

          return [bet];
        },
      },
      listRoundHistoryUseCase: {
        execute: async (input: { limit?: number }) => {
          expect(input).toEqual({ limit: 2 });

          return [round];
        },
      },
    });

    await expect(controller.roundHistory("2")).resolves.toHaveLength(1);
    await expect(
      controller.myBets({ playerId: "player-1", username: "player" }, "5"),
    ).resolves.toMatchObject([{ id: "bet-1", status: "ACCEPTED" }]);
  });

  test("lists public leaderboard with default and explicit query values", async () => {
    const calls: unknown[] = [];
    const controller = createController({
      listLeaderboardUseCase: {
        execute: async (input: unknown) => {
          calls.push(input);

          return [
            {
              betsCount: 2,
              payoutCents: 3000n,
              playerId: "player-1",
              profitCents: 1000n,
              rank: 1,
              username: "player",
              wageredCents: 2000n,
            },
          ];
        },
      },
    });

    await expect(controller.leaderboard(undefined, undefined)).resolves.toEqual([
      {
        betsCount: 2,
        payoutCents: "3000",
        playerId: "player-1",
        profitCents: "1000",
        rank: 1,
        username: "player",
        wageredCents: "2000",
      },
    ]);
    await expect(controller.leaderboard("7d", "5")).resolves.toHaveLength(1);
    expect(calls).toEqual([
      { limit: 10, period: "24h" },
      { limit: 5, period: "7d" },
    ]);
  });

  test("rejects invalid leaderboard query values", async () => {
    const controller = createController();

    await expect(controller.leaderboard("bad", "10")).rejects.toThrow(
      BadRequestException,
    );
    await expect(controller.leaderboard("24h", "51")).rejects.toThrow(
      BadRequestException,
    );
    await expect(controller.leaderboard("24h", "0")).rejects.toThrow(
      BadRequestException,
    );
  });

  test("starts an auto bet session for the authenticated user", async () => {
    const controller = createAutoBetController({
      startAutoBetSessionUseCase: {
        execute: async (input: unknown) => {
          expect(input).toEqual({
            amountCents: "1000",
            autoCashoutMultiplierBp: 20000,
            martingaleMaxSteps: 3,
            martingaleMultiplier: 2,
            maxRounds: 3,
            playerId: "player-1",
            strategy: "MARTINGALE",
            stopLossCents: "3000",
            takeProfitCents: "5000",
            username: "player",
          });

          return autoBetSessionFixture();
        },
      },
    });

    await expect(
      controller.startSession(
        { playerId: "player-1", username: "player" },
        {
          amountCents: "1000",
          autoCashoutMultiplierBp: 20000,
          martingaleMaxSteps: 3,
          martingaleMultiplier: 2,
          maxRounds: 3,
          strategy: "MARTINGALE",
          stopLossCents: "3000",
          takeProfitCents: "5000",
        },
      ),
    ).resolves.toMatchObject({
      id: "auto-session-1",
      amountCents: "1000",
      martingaleCurrentStep: 0,
      martingaleMaxSteps: 3,
      martingaleMultiplier: 2,
      nextAmountCents: "1000",
      status: "ACTIVE",
      strategy: "MARTINGALE",
      stopLossCents: "3000",
      takeProfitCents: "5000",
    });
  });

  test("gets and idempotently stops the authenticated user's auto bet session", async () => {
    const controller = createAutoBetController({
      getMyAutoBetSessionUseCase: {
        execute: async () => autoBetSessionFixture(),
      },
      stopAutoBetSessionUseCase: {
        execute: async () =>
          autoBetSessionFixture({ status: "STOPPED", stopReason: "MANUAL" }),
      },
    });

    await expect(
      controller.mySession({ playerId: "player-1", username: "player" }),
    ).resolves.toMatchObject({ id: "auto-session-1", status: "ACTIVE" });
    await expect(
      controller.stopSession({ playerId: "player-1", username: "player" }),
    ).resolves.toMatchObject({ status: "STOPPED", stopReason: "MANUAL" });
  });

  test("maps auto bet errors to bad request responses", async () => {
    const controller = createAutoBetController({
      startAutoBetSessionUseCase: {
        execute: async () => {
          throw new AutoBetSessionActiveError();
        },
      },
    });

    await expect(
      controller.startSession(
        { playerId: "player-1", username: "player" },
        { amountCents: "1000", maxRounds: 3 },
      ),
    ).rejects.toThrow(BadRequestException);
  });

  test("verifies a round and cashes out the authenticated user", async () => {
    const controller = createController({
      cashOutUseCase: {
        execute: async (input: { playerId: string }) => {
          expect(input).toEqual({ playerId: "player-1" });

          return { bet: acceptedBet(), balanceCents: 101000n };
        },
      },
      verifyRoundUseCase: {
        execute: async (input: { roundId: string }) => {
          expect(input).toEqual({ roundId: "round-1" });

          return { roundId: "round-1", fair: true };
        },
      },
    });

    await expect(controller.verifyRound("round-1")).resolves.toEqual({
      roundId: "round-1",
      fair: true,
    });
    await expect(
      controller.cashOut({ playerId: "player-1", username: "player" }),
    ).resolves.toMatchObject({ id: "bet-1", status: "ACCEPTED" });
  });

  test("maps game domain errors to documented HTTP exceptions", async () => {
    const badRequestController = createController({
      placeBetUseCase: {
        execute: async () => {
          throw new WalletOperationRejectedError(
            "INSUFFICIENT_FUNDS",
            "Insufficient funds",
          );
        },
      },
    });
    const notFoundController = createController({
      verifyRoundUseCase: {
        execute: async () => {
          throw new RoundNotFoundError("round-missing");
        },
      },
    });
    const walletNotFoundController = createController({
      placeBetUseCase: {
        execute: async () => {
          throw new WalletOperationRejectedError(
            "WALLET_NOT_FOUND",
            "Wallet not found",
          );
        },
      },
    });
    const timeoutController = createController({
      cashOutUseCase: {
        execute: async () => {
          throw new WalletOperationTimedOutError(250);
        },
      },
    });
    const currentRoundController = createController({
      cashOutUseCase: {
        execute: async () => {
          throw new CurrentRoundNotFoundError();
        },
      },
    });

    await expect(
      badRequestController.placeBet(
        { playerId: "player-1", username: "player" },
        { amountCents: "1000" },
      ),
    ).rejects.toThrow(BadRequestException);
    await expect(notFoundController.verifyRound("round-missing")).rejects.toThrow(
      NotFoundException,
    );
    await expect(
      walletNotFoundController.placeBet(
        { playerId: "player-1", username: "player" },
        { amountCents: "1000" },
      ),
    ).rejects.toThrow(NotFoundException);
    await expect(
      timeoutController.cashOut({ playerId: "player-1", username: "player" }),
    ).rejects.toThrow(ServiceUnavailableException);
    await expect(
      currentRoundController.cashOut({
        playerId: "player-1",
        username: "player",
      }),
    ).rejects.toThrow(NotFoundException);
  });
});
