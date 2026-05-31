import { create } from "zustand";
import type { BetResponse, RoundResponse } from "../services/game-api";
import type {
  BetRealtimePayload,
  RealtimeBetPayload,
  RealtimeRoundPayload,
  RoundLifecyclePayload,
  RoundSnapshotPayload,
} from "../services/realtime-events";

export type GameRealtimeConnectionStatus =
  | "idle"
  | "connecting"
  | "connected"
  | "disconnected"
  | "error";

export type GameRealtimeState = {
  connectionStatus: GameRealtimeConnectionStatus;
  errorMessage: string | null;
  lastEventAt: string | null;
  round: RealtimeRoundPayload | null;
  applyBetEvent: (payload: BetRealtimePayload) => void;
  applyRoundEvent: (payload: RoundLifecyclePayload) => void;
  applySnapshot: (payload: RoundSnapshotPayload) => void;
  hydrateFromRest: (round: RoundResponse | null) => void;
  markConnected: () => void;
  markConnecting: () => void;
  markDisconnected: () => void;
  markError: (message: string) => void;
};

export const useGameRealtimeStore = create<GameRealtimeState>((set) => ({
  connectionStatus: "idle",
  errorMessage: null,
  lastEventAt: null,
  round: null,

  applyBetEvent: (payload) =>
    set((state) => ({
      lastEventAt: payload.emittedAt,
      round: upsertBet(state.round, payload),
    })),

  applyRoundEvent: (payload) =>
    set({
      lastEventAt: payload.emittedAt,
      round: payload,
    }),

  applySnapshot: (payload) =>
    set({
      lastEventAt: payload.emittedAt,
      round: payload.round,
    }),

  hydrateFromRest: (round) =>
    set((state) => ({
      round: mergeRestRound(state.round, round, state.connectionStatus),
    })),

  markConnected: () =>
    set({
      connectionStatus: "connected",
      errorMessage: null,
    }),

  markConnecting: () =>
    set({
      connectionStatus: "connecting",
      errorMessage: null,
    }),

  markDisconnected: () =>
    set({
      connectionStatus: "disconnected",
    }),

  markError: (message) =>
    set({
      connectionStatus: "error",
      errorMessage: message,
    }),
}));

function mergeRestRound(
  currentRound: RealtimeRoundPayload | null,
  restRound: RoundResponse | null,
  status: GameRealtimeConnectionStatus,
): RealtimeRoundPayload | null {
  if (!restRound) {
    return currentRound;
  }

  const mappedRound = mapRestRound(restRound);

  if (
    !currentRound ||
    currentRound.id !== mappedRound.id ||
    status !== "connected"
  ) {
    return mappedRound;
  }

  return {
    ...mappedRound,
    crashPointBp: currentRound.crashPointBp ?? mappedRound.crashPointBp,
    currentMultiplierBp:
      currentRound.currentMultiplierBp ?? mappedRound.currentMultiplierBp,
    serverSeed: currentRound.serverSeed ?? mappedRound.serverSeed,
  };
}

function mapRestRound(round: RoundResponse): RealtimeRoundPayload {
  return {
    ...round,
    currentMultiplierBp: null,
    roundId: round.id,
    bets: Array.isArray(round.bets) ? round.bets.map(mapRestBet) : [],
  };
}

function mapRestBet(bet: BetResponse): RealtimeBetPayload {
  return {
    ...bet,
    betId: bet.id,
  };
}

function upsertBet(
  round: RealtimeRoundPayload | null,
  bet: BetRealtimePayload,
): RealtimeRoundPayload | null {
  if (!round || round.id !== bet.roundId) {
    return round;
  }

  const existingIndex = round.bets.findIndex((item) => item.id === bet.id);
  const bets =
    existingIndex >= 0
      ? round.bets.map((item, index) => (index === existingIndex ? bet : item))
      : [...round.bets, bet];

  return {
    ...round,
    bets,
  };
}
