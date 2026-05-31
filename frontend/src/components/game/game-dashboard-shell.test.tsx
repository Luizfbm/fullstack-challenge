import { describe, expect, it } from "vitest";
import type { BetResponse, RoundResponse } from "../../services/game-api";
import { getRoundBets } from "./game-dashboard-view-model";

describe("game dashboard helpers", () => {
  it("keeps the table render safe when a round payload has no bets array", () => {
    const roundWithoutBets = {
      id: "round-1",
      status: "RUNNING",
    } as unknown as RoundResponse;

    expect(getRoundBets(roundWithoutBets)).toEqual([]);
  });

  it("returns the current round bets when present", () => {
    const bet: BetResponse = {
      amountCents: "1000",
      cashoutMultiplierBp: null,
      id: "bet-1",
      payoutCents: null,
      playerId: "player-1",
      rejectionReason: null,
      roundId: "round-1",
      status: "ACCEPTED",
      username: "player",
    };

    expect(getRoundBets({ bets: [bet] } as RoundResponse)).toEqual([bet]);
  });
});
