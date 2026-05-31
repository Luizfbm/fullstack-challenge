import type { RoundResponse, RoundStatus } from "../../services/game-api";
import type { RealtimeRoundPayload } from "../../services/realtime-events";

export type DashboardRound = (RoundResponse | RealtimeRoundPayload) & {
  currentMultiplierBp?: number | null;
};

export function formatRoundMultiplier(round: DashboardRound | null): string {
  if (!round) {
    return "1.00x";
  }

  if (typeof round.currentMultiplierBp === "number") {
    return `${(round.currentMultiplierBp / 10000).toFixed(2)}x`;
  }

  if (round.status === "CRASHED" || round.status === "SETTLED") {
    return round.crashPointBp
      ? `${(round.crashPointBp / 10000).toFixed(2)}x`
      : "CRASHED";
  }

  return round.status === "RUNNING" ? "RUNNING" : "1.00x";
}

export function roundBadgeVariant(status?: RoundStatus) {
  if (status === "RUNNING") {
    return "success";
  }

  if (status === "CRASHED") {
    return "danger";
  }

  if (status === "SETTLED") {
    return "neutral";
  }

  return "warning";
}

export function roundHistoryVariant(round: DashboardRound) {
  if (typeof round.crashPointBp !== "number") {
    return roundBadgeVariant(round.status);
  }

  if (round.crashPointBp < 15000) {
    return "danger";
  }

  return round.crashPointBp >= 20000 ? "success" : "warning";
}

export function truncateHash(value?: string | null): string {
  if (!value) {
    return "-";
  }

  return `${value.slice(0, 10)}...${value.slice(-8)}`;
}
