import type { BetResponse, RoundResponse } from "./game-api";

export const gameRealtimeConfig = {
  namespace: "/games",
  path: "/games/socket.io",
} as const;

export const gameRealtimeEvents = {
  betCashedOut: "bet.cashed_out",
  betPlaced: "bet.placed",
  roundBettingStarted: "round.betting_started",
  roundCrashed: "round.crashed",
  roundSettled: "round.settled",
  roundSnapshot: "round.snapshot",
  roundStarted: "round.started",
  roundTick: "round.tick",
} as const;

export type RealtimeBetPayload = BetResponse & {
  betId: string;
};

export type RealtimeRoundPayload = Omit<RoundResponse, "bets"> & {
  roundId: string;
  currentMultiplierBp: number | null;
  bets: RealtimeBetPayload[];
};

type RealtimeEnvelope<TPayload> = TPayload & {
  emittedAt: string;
};

export type RoundSnapshotPayload = RealtimeEnvelope<{
  round: RealtimeRoundPayload | null;
}>;

export type RoundLifecyclePayload = RealtimeEnvelope<RealtimeRoundPayload>;

export type BetRealtimePayload = RealtimeEnvelope<RealtimeBetPayload>;
