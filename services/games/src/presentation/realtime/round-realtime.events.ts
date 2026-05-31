import type { BetStatus } from "../../domain/bet";
import type { RoundStatus } from "../../domain/round";

export const GAME_REALTIME_NAMESPACE = "/games";
export const ROUND_SNAPSHOT_EVENT = "round.snapshot";

export type RealtimeBetPayload = {
  id: string;
  roundId: string;
  playerId: string;
  username: string;
  amountCents: string;
  status: BetStatus;
  cashoutMultiplierBp: number | null;
  payoutCents: string | null;
  rejectionReason: string | null;
};

export type RealtimeRoundPayload = {
  id: string;
  status: RoundStatus;
  bettingStartsAt: string;
  bettingEndsAt: string;
  startedAt: string | null;
  crashedAt: string | null;
  currentMultiplierBp: number | null;
  crashPointBp: number | null;
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
