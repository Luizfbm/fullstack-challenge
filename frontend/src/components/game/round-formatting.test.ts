import { describe, expect, it } from "vitest";
import type { RoundResponse } from "../../services/game-api";
import { roundHistoryVariant } from "./round-formatting";

describe("round formatting", () => {
  it("colors revealed history by crash point strength", () => {
    expect(roundHistoryVariant(historyRound(12000))).toBe("danger");
    expect(roundHistoryVariant(historyRound(17000))).toBe("warning");
    expect(roundHistoryVariant(historyRound(25000))).toBe("success");
  });
});

function historyRound(crashPointBp: number): RoundResponse {
  return {
    bets: [],
    bettingEndsAt: "2026-05-31T10:00:10.000Z",
    bettingStartsAt: "2026-05-31T10:00:00.000Z",
    chainIndex: 1,
    clientSeed: "client-seed",
    crashedAt: "2026-05-31T10:00:12.000Z",
    crashPointBp,
    id: `round-${crashPointBp}`,
    multiplierGrowthBpPerSecond: 1000,
    nextServerSeedHash: null,
    nonce: 1,
    serverSeed: "seed",
    serverSeedHash: "hash",
    startedAt: "2026-05-31T10:00:10.000Z",
    status: "SETTLED",
  };
}
