import type { RoundResponse } from "./game-api";
import type { RealtimeRoundPayload } from "./realtime-events";

type DisplayMultiplierRound = (RoundResponse | RealtimeRoundPayload) & {
  currentMultiplierBp?: number | null;
};

const DISPLAY_STEP_BP = 100;
const GROWTH_RATE_DENOMINATOR_BP = 10000;

export function floorMultiplierBpForDisplay(multiplierBp: number): number {
  return Math.floor(multiplierBp / DISPLAY_STEP_BP) * DISPLAY_STEP_BP;
}

export function formatDisplayMultiplierBp(multiplierBp: number): string {
  return `${(floorMultiplierBpForDisplay(multiplierBp) / 10000).toFixed(2)}x`;
}

export function getDisplayMultiplierBp(
  round: DisplayMultiplierRound | null,
  now = new Date(),
): number | null {
  const multiplierBp = getSmoothMultiplierBp(round, now);

  return typeof multiplierBp === "number"
    ? floorMultiplierBpForDisplay(multiplierBp)
    : null;
}

export function getSmoothMultiplierBp(
  round: DisplayMultiplierRound | null,
  now = new Date(),
): number | null {
  if (!round) {
    return null;
  }

  if (round.status === "RUNNING") {
    return getRunningMultiplierBp(round, now);
  }

  if (
    (round.status === "CRASHED" || round.status === "SETTLED") &&
    typeof round.crashPointBp === "number"
  ) {
    return round.crashPointBp;
  }

  return typeof round.currentMultiplierBp === "number"
    ? round.currentMultiplierBp
    : null;
}

function getRunningMultiplierBp(
  round: DisplayMultiplierRound,
  now: Date,
): number | null {
  const fallbackMultiplierBp =
    typeof round.currentMultiplierBp === "number"
      ? round.currentMultiplierBp
      : null;

  if (
    !round.startedAt ||
    !Number.isFinite(round.multiplierBaseBp) ||
    !Number.isFinite(round.multiplierGrowthRateBpPerSecond)
  ) {
    return fallbackMultiplierBp;
  }

  const elapsedMs = Math.max(0, now.getTime() - new Date(round.startedAt).getTime());
  const elapsedSeconds = elapsedMs / 1000;
  const growthRate =
    round.multiplierGrowthRateBpPerSecond / GROWTH_RATE_DENOMINATOR_BP;
  const estimatedMultiplierBp = Math.floor(
    round.multiplierBaseBp * Math.exp(growthRate * elapsedSeconds),
  );

  return fallbackMultiplierBp === null
    ? estimatedMultiplierBp
    : Math.max(fallbackMultiplierBp, estimatedMultiplierBp);
}
