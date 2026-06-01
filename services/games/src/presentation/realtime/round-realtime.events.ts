import type { BetStatus } from "../../domain/bet";
import type { RoundStatus } from "../../domain/round";

export const GAME_REALTIME_NAMESPACE = "/games";
export const ROUND_SNAPSHOT_EVENT = "round.snapshot";
export const ROUND_BETTING_STARTED_EVENT = "round.betting_started";
export const ROUND_STARTED_EVENT = "round.started";
export const ROUND_TICK_EVENT = "round.tick";
export const ROUND_CRASHED_EVENT = "round.crashed";
export const ROUND_SETTLED_EVENT = "round.settled";
export const BET_PLACED_EVENT = "bet.placed";
export const BET_CASHED_OUT_EVENT = "bet.cashed_out";

export type RealtimeBetPayload = {
  id: string;
  betId: string;
  roundId: string;
  playerId: string;
  username: string;
  amountCents: string;
  status: BetStatus;
  autoCashoutMultiplierBp: number | null;
  cashoutMultiplierBp: number | null;
  payoutCents: string | null;
  rejectionReason: string | null;
};

export type RealtimeRoundPayload = {
  id: string;
  roundId: string;
  status: RoundStatus;
  bettingStartsAt: string;
  bettingEndsAt: string;
  startedAt: string | null;
  crashedAt: string | null;
  currentMultiplierBp: number | null;
  crashPointBp: number | null;
  multiplierGrowthBpPerSecond: number;
  serverSeedHash: string;
  serverSeed: string | null;
  clientSeed: string;
  nonce: number;
  chainIndex: number;
  nextServerSeedHash: string | null;
  bets: RealtimeBetPayload[];
};

export type RoundSnapshotPayload = {
  round: RealtimeRoundPayload | null;
  emittedAt: string;
};

export type RoundLifecyclePayload = RealtimeRoundPayload & {
  emittedAt: string;
};

export type BetRealtimePayload = RealtimeBetPayload & {
  emittedAt: string;
};
