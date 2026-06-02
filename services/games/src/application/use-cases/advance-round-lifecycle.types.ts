import type { Round } from "../../domain/round";
import type { GameMetrics } from "../../infrastructure/observability/game-metrics";

export type GameMetricsPort = Pick<GameMetrics, "recordCashout" | "recordCrashPoint">;

export type CashoutMetric = {
  mode: "manual" | "auto";
  payoutCents: bigint;
};

export const DEFAULT_CRASH_DISPLAY_MS = 5000;

export type AdvanceRoundLifecycleConfig = {
  bettingWindowMs: number;
  crashDisplayMs?: number;
};

export type AdvanceRoundLifecycleAction =
  | "ROUND_OPENED"
  | "ROUND_STARTED"
  | "ROUND_CRASHED"
  | "ROUND_SETTLED"
  | "NOOP";

export type AdvanceRoundLifecycleResult = {
  action: AdvanceRoundLifecycleAction;
  round: Round | null;
};

export function assertAdvanceRoundLifecycleConfig(
  config: AdvanceRoundLifecycleConfig,
): void {
  if (
    !Number.isInteger(config.bettingWindowMs) ||
    config.bettingWindowMs <= 0
  ) {
    throw new Error("Betting window must be a positive integer");
  }

  if (
    config.crashDisplayMs !== undefined &&
    (!Number.isInteger(config.crashDisplayMs) || config.crashDisplayMs < 0)
  ) {
    throw new Error("Crash display duration must be a non-negative integer");
  }
}
