import { describe, expect, it } from "vitest";
import type { BetResponse, RoundResponse } from "../../services/game-api";
import { getPotentialPayout } from "./bet-controls-model";

describe("bet controls model", () => {
  it("uses the floored visual multiplier for potential payout preview", () => {
    expect(
      getPotentialPayout(
        acceptedBet(),
        {
          ...runningRound(),
          currentMultiplierBp: 10000,
        },
        new Date("2026-05-31T10:00:15.000Z"),
      ),
    ).toBe(1280n);
  });

  it("does not round the potential payout preview upward", () => {
    expect(
      getPotentialPayout(
        acceptedBet(),
        {
          ...runningRound(),
          currentMultiplierBp: 10199,
          startedAt: null,
        },
        new Date("2026-05-31T10:00:15.000Z"),
      ),
    ).toBe(1010n);
  });
});

function acceptedBet(): BetResponse {
  return {
    amountCents: "1000",
    autoCashoutMultiplierBp: null,
    cashoutMultiplierBp: null,
    id: "bet-1",
    payoutCents: null,
    playerId: "player-1",
    rejectionReason: null,
    roundId: "round-1",
    status: "ACCEPTED",
    username: "player",
  };
}

function runningRound(): RoundResponse {
  return {
    bets: [],
    bettingEndsAt: "2026-05-31T10:00:10.000Z",
    bettingStartsAt: "2026-05-31T10:00:00.000Z",
    chainIndex: 1,
    clientSeed: "client-seed",
    crashedAt: null,
    crashPointBp: null,
    id: "round-1",
    multiplierBaseBp: 10000,
    multiplierCurve: "EXPONENTIAL",
    multiplierGrowthRateBpPerSecond: 500,
    nextServerSeedHash: null,
    nonce: 1,
    serverSeed: null,
    serverSeedHash: "hash",
    startedAt: "2026-05-31T10:00:10.000Z",
    status: "RUNNING",
  };
}
