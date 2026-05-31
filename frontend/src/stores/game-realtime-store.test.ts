import { beforeEach, describe, expect, it } from "vitest";
import type { RoundResponse } from "../services/game-api";
import type {
  BetRealtimePayload,
  RoundLifecyclePayload,
} from "../services/realtime-events";
import { useGameRealtimeStore } from "./game-realtime-store";

describe("useGameRealtimeStore", () => {
  beforeEach(() => {
    useGameRealtimeStore.setState({
      connectionStatus: "idle",
      errorMessage: null,
      lastEventAt: null,
      round: null,
    });
  });

  it("hydrates the realtime round from REST without requiring socket data", () => {
    useGameRealtimeStore.getState().hydrateFromRest(restRound("BETTING"));

    expect(useGameRealtimeStore.getState().round).toMatchObject({
      currentMultiplierBp: null,
      id: "round-1",
      roundId: "round-1",
      status: "BETTING",
    });
  });

  it("hydrates intermediate REST round payloads without bets", () => {
    const roundWithoutBets = restRound("BETTING") as Partial<RoundResponse>;
    delete roundWithoutBets.bets;

    useGameRealtimeStore
      .getState()
      .hydrateFromRest(roundWithoutBets as RoundResponse);

    expect(useGameRealtimeStore.getState().round?.bets).toEqual([]);
  });

  it("keeps socket multiplier data when REST refetches the same connected round", () => {
    useGameRealtimeStore.getState().markConnected();
    useGameRealtimeStore.getState().applyRoundEvent(
      realtimeRound({
        currentMultiplierBp: 12345,
        emittedAt: "2026-05-31T10:00:01.000Z",
        status: "RUNNING",
      }),
    );

    useGameRealtimeStore.getState().hydrateFromRest(restRound("RUNNING"));

    expect(useGameRealtimeStore.getState().round).toMatchObject({
      currentMultiplierBp: 12345,
      status: "RUNNING",
    });
  });

  it("upserts bet events for the current round", () => {
    useGameRealtimeStore.getState().applySnapshot({
      emittedAt: "2026-05-31T10:00:00.000Z",
      round: realtimeRound({ status: "BETTING" }),
    });

    useGameRealtimeStore.getState().applyBetEvent(betEvent("ACCEPTED"));
    useGameRealtimeStore.getState().applyBetEvent(betEvent("CASHED_OUT"));

    expect(useGameRealtimeStore.getState().round?.bets).toEqual([
      expect.objectContaining({
        id: "bet-1",
        status: "CASHED_OUT",
      }),
    ]);
  });
});

function restRound(status: RoundResponse["status"]): RoundResponse {
  return {
    bets: [],
    bettingEndsAt: "2026-05-31T10:00:10.000Z",
    bettingStartsAt: "2026-05-31T10:00:00.000Z",
    chainIndex: 1,
    clientSeed: "client-seed",
    crashedAt: null,
    crashPointBp: null,
    id: "round-1",
    multiplierGrowthBpPerSecond: 1000,
    nextServerSeedHash: null,
    nonce: 1,
    serverSeed: null,
    serverSeedHash: "hash",
    startedAt: status === "RUNNING" ? "2026-05-31T10:00:10.000Z" : null,
    status,
  };
}

function realtimeRound(
  overrides: Partial<RoundLifecyclePayload>,
): RoundLifecyclePayload {
  return {
    ...restRound(overrides.status ?? "BETTING"),
    bets: [],
    currentMultiplierBp: null,
    emittedAt: "2026-05-31T10:00:00.000Z",
    roundId: "round-1",
    ...overrides,
  };
}

function betEvent(status: BetRealtimePayload["status"]): BetRealtimePayload {
  return {
    amountCents: "1000",
    betId: "bet-1",
    cashoutMultiplierBp: status === "CASHED_OUT" ? 12000 : null,
    emittedAt: "2026-05-31T10:00:02.000Z",
    id: "bet-1",
    payoutCents: status === "CASHED_OUT" ? "1200" : null,
    playerId: "player-1",
    rejectionReason: null,
    roundId: "round-1",
    status,
    username: "player",
  };
}
