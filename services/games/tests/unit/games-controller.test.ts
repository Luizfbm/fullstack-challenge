import { describe, expect, test } from "bun:test";
import { BadRequestException } from "@nestjs/common";
import { Bet } from "../../src/domain/bet";
import { Round } from "../../src/domain/round";
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

function acceptedBet(): Bet {
  return Bet.accepted({
    id: "bet-1",
    roundId: "round-1",
    playerId: "player-1",
    username: "player",
    amountCents: 1000n,
  });
}

function createController(overrides: Record<string, unknown> = {}): GamesController {
  return new GamesController(
    (overrides.getCurrentRoundUseCase ?? { execute: async () => null }) as never,
    (overrides.listRoundHistoryUseCase ?? { execute: async () => [] }) as never,
    (overrides.verifyRoundUseCase ?? { execute: async () => ({}) }) as never,
    (overrides.listMyBetsUseCase ?? { execute: async () => [] }) as never,
    (overrides.placeBetUseCase ?? {
      execute: async () => ({ bet: acceptedBet(), balanceCents: 99000n }),
    }) as never,
    (overrides.cashOutUseCase ?? {
      execute: async () => ({ bet: acceptedBet(), balanceCents: 101000n }),
    }) as never,
  );
}

describe("GamesController", () => {
  test("returns health check payload", () => {
    const controller = createController();

    expect(controller.check()).toEqual({ status: "ok", service: "games" });
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
      multiplierGrowthBpPerSecond: 1000,
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
        execute: async (input: { playerId: string; amountCents: string }) => {
          expect(input).toMatchObject({
            playerId: "player-1",
            amountCents: "1000",
          });

          return { bet: acceptedBet(), balanceCents: 99000n };
        },
      },
    });

    const response = await controller.placeBet(
      { playerId: "player-1", username: "player" },
      { amountCents: "1000" },
    );

    expect(response.amountCents).toBe("1000");
    expect(response.status).toBe("ACCEPTED");
  });

  test("rejects invalid pagination limits", async () => {
    const controller = createController();

    await expect(controller.roundHistory("0")).rejects.toThrow(
      BadRequestException,
    );
  });
});
