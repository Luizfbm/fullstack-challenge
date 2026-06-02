import { describe, expect, it } from "vitest";
import type { RoundResponse } from "../../services/game-api";
import { formatRoundMultiplier, roundHistoryVariant } from "./round-formatting";

describe("round formatting", () => {
  it("colors revealed history by crash point strength", () => {
    expect(roundHistoryVariant(historyRound(12000))).toBe("danger");
    expect(roundHistoryVariant(historyRound(17000))).toBe("warning");
    expect(roundHistoryVariant(historyRound(25000))).toBe("success");
  });

  it("formats running multipliers from a smooth exponential estimate floored to 0.01x", () => {
    expect(
      formatRoundMultiplier(
        {
          ...historyRound(null),
          crashedAt: null,
          crashPointBp: null,
          currentMultiplierBp: 10000,
          startedAt: "2026-05-31T10:00:10.000Z",
          status: "RUNNING",
        },
        new Date("2026-05-31T10:00:15.000Z"),
      ),
    ).toBe("1.28x");
  });

  it("never rounds revealed multipliers upward", () => {
    expect(formatRoundMultiplier(historyRound(35353))).toBe("3.53x");
  });
});

function historyRound(crashPointBp: number | null): RoundResponse {
  return {
    bets: [],
    bettingEndsAt: "2026-05-31T10:00:10.000Z",
    bettingStartsAt: "2026-05-31T10:00:00.000Z",
    chainIndex: 1,
    clientSeed: "client-seed",
    crashedAt: "2026-05-31T10:00:12.000Z",
    crashPointBp,
    id: `round-${crashPointBp ?? "running"}`,
    multiplierBaseBp: 10000,
    multiplierCurve: "EXPONENTIAL",
    multiplierGrowthRateBpPerSecond: 500,
    nextServerSeedHash: null,
    nonce: 1,
    serverSeed: "seed",
    serverSeedHash: "hash",
    startedAt: "2026-05-31T10:00:10.000Z",
    status: "SETTLED",
  };
}
