import { describe, expect, it } from "vitest";
import type { RoundResponse } from "./game-api";
import { getRoundProgress, getRoundTimerLabel } from "./round-timing";

describe("round timing helpers", () => {
  it("renders countdown and progress for betting rounds", () => {
    const round = roundFixture({
      status: "BETTING",
    });
    const now = new Date("2026-05-31T10:00:04.000Z");

    expect(getRoundTimerLabel(round, now)).toBe("Apostas fecham em 6s");
    expect(getRoundProgress(round, now)).toBe(0.4);
  });

  it("renders elapsed running time", () => {
    const round = roundFixture({
      startedAt: "2026-05-31T10:00:10.000Z",
      status: "RUNNING",
    });

    expect(getRoundTimerLabel(round, new Date("2026-05-31T10:00:13.900Z"))).toBe(
      "Rodando ha 3s",
    );
  });
});

function roundFixture(overrides: Partial<RoundResponse>): RoundResponse {
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
    startedAt: null,
    status: "BETTING",
    ...overrides,
  };
}
