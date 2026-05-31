import { describe, expect, test } from "bun:test";
import { Bet } from "../../../src/domain/bet";
import { InvalidBetStateError, InvalidRoundStateError } from "../../../src/domain/game.errors";
import { calculatePayoutCents } from "../../../src/domain/multiplier";
import { ProvablyFair } from "../../../src/domain/provably-fair";
import { Round } from "../../../src/domain/round";

describe("multiplier", () => {
  test("calculates payout in cents with floor rounding", () => {
    expect(calculatePayoutCents(101n, 15000)).toBe(151n);
  });
});

describe("Bet", () => {
  test("cashes out an accepted bet", () => {
    const bet = Bet.accepted({
      id: "bet-1",
      roundId: "round-1",
      playerId: "player-1",
      username: "player",
      amountCents: 1000n,
    });

    bet.cashOut(25000);

    expect(bet.status).toBe("CASHOUT_PENDING_CREDIT");
    expect(bet.cashoutMultiplierBp).toBe(25000);
    expect(bet.payoutCents).toBe(2500n);

    bet.completeCashOut();

    expect(bet.status).toBe("CASHED_OUT");
  });

  test("does not cash out twice", () => {
    const bet = Bet.accepted({
      id: "bet-1",
      roundId: "round-1",
      playerId: "player-1",
      username: "player",
      amountCents: 1000n,
    });

    bet.cashOut(15000);

    expect(() => bet.cashOut(20000)).toThrow(InvalidBetStateError);
  });
});

describe("Round", () => {
  const bettingStartsAt = new Date("2026-05-30T10:00:00.000Z");
  const bettingEndsAt = new Date("2026-05-30T10:00:10.000Z");

  test("accepts only one bet per player while betting", () => {
    const round = Round.openBetting({
      id: "round-1",
      bettingStartsAt,
      bettingEndsAt,
      crashPointBp: 20000,
      serverSeedHash: "seed-hash",
      clientSeed: "client",
      nonce: 1,
      chainIndex: 1,
    });

    round.placeBet({
      id: "bet-1",
      playerId: "player-1",
      username: "player",
      amountCents: 1000n,
    });

    expect(() =>
      round.placeBet({
        id: "bet-2",
        playerId: "player-1",
        username: "player",
        amountCents: 2000n,
      }),
    ).toThrow(InvalidRoundStateError);
  });

  test("does not accept bets after the round starts", () => {
    const round = Round.openBetting({
      id: "round-1",
      bettingStartsAt,
      bettingEndsAt,
      crashPointBp: 20000,
      serverSeedHash: "seed-hash",
      clientSeed: "client",
      nonce: 1,
      chainIndex: 1,
    });

    round.start(new Date("2026-05-30T10:00:11.000Z"));

    expect(() =>
      round.placeBet({
        id: "bet-1",
        playerId: "player-1",
        username: "player",
        amountCents: 1000n,
      }),
    ).toThrow(InvalidRoundStateError);
  });

  test("cashout is only allowed while running", () => {
    const round = Round.openBetting({
      id: "round-1",
      bettingStartsAt,
      bettingEndsAt,
      crashPointBp: 20000,
      serverSeedHash: "seed-hash",
      clientSeed: "client",
      nonce: 1,
      chainIndex: 1,
    });
    round.placeBet({
      id: "bet-1",
      playerId: "player-1",
      username: "player",
      amountCents: 1000n,
    });

    expect(() => round.cashOut("player-1", 15000)).toThrow(
      InvalidRoundStateError,
    );

    round.start(new Date("2026-05-30T10:00:11.000Z"));
    const bet = round.cashOut("player-1", 15000);

    expect(bet.status).toBe("CASHOUT_PENDING_CREDIT");

    round.completeCashOut("player-1");

    expect(bet.status).toBe("CASHED_OUT");
  });

  test("does not allow cashout at or after crash point", () => {
    const round = Round.openBetting({
      id: "round-1",
      bettingStartsAt,
      bettingEndsAt,
      crashPointBp: 15000,
      serverSeedHash: "seed-hash",
      clientSeed: "client",
      nonce: 1,
      chainIndex: 1,
    });
    round.placeBet({
      id: "bet-1",
      playerId: "player-1",
      username: "player",
      amountCents: 1000n,
    });
    round.start(new Date("2026-05-30T10:00:11.000Z"));

    expect(() => round.cashOut("player-1", 15000)).toThrow(
      InvalidRoundStateError,
    );
  });

  test("marks non-cashed out bets as lost after crash", () => {
    const round = Round.openBetting({
      id: "round-1",
      bettingStartsAt,
      bettingEndsAt,
      crashPointBp: 20000,
      serverSeedHash: "seed-hash",
      clientSeed: "client",
      nonce: 1,
      chainIndex: 1,
    });
    round.placeBet({
      id: "bet-1",
      playerId: "player-1",
      username: "player",
      amountCents: 1000n,
    });
    round.start(new Date("2026-05-30T10:00:11.000Z"));

    round.crash(new Date("2026-05-30T10:00:12.000Z"), "server-seed");

    expect(round.status).toBe("CRASHED");
    expect(round.bets[0]?.status).toBe("LOST");
    expect(round.serverSeed).toBe("server-seed");
  });
});

describe("ProvablyFair", () => {
  test("builds a verifiable hash chain", () => {
    const chain = ProvablyFair.buildHashChain("root-seed", 3);

    expect(chain).toHaveLength(3);
    expect(chain[1]).toBe(ProvablyFair.hashSeed(chain[0]));
    expect(chain[2]).toBe(ProvablyFair.hashSeed(chain[1]));
  });

  test("calculates deterministic crash points", () => {
    const first = ProvablyFair.calculateCrashPointBp({
      serverSeed: "server-seed",
      clientSeed: "client-seed",
      nonce: 1,
      houseEdgeBp: 100,
    });
    const second = ProvablyFair.calculateCrashPointBp({
      serverSeed: "server-seed",
      clientSeed: "client-seed",
      nonce: 1,
      houseEdgeBp: 100,
    });

    expect(first).toBe(second);
    expect(first).toBeGreaterThanOrEqual(10000);
  });

  test("verifies a committed seed hash", () => {
    const serverSeed = "server-seed";
    const serverSeedHash = ProvablyFair.hashSeed(serverSeed);

    expect(ProvablyFair.verifySeed(serverSeed, serverSeedHash)).toBe(true);
    expect(ProvablyFair.verifySeed("other-seed", serverSeedHash)).toBe(false);
  });
});
