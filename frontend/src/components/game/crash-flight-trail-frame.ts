import { easeOutCubic } from "./crash-flight-motion";
import {
  getDisplayMultiplierBp,
  getSmoothMultiplierBp,
} from "../../services/display-multiplier";
import type { DashboardRound } from "./round-formatting";
import type { TimeCarTrailFrame } from "./time-car-trail";
import type { VectorTuple } from "./crash-flight-storyboard";

export function getTrailFrame({
  carPosition,
  compact,
  crashImpact,
  crashed,
  displayMultiplier,
  eased,
  elapsedSeconds,
  multiplier,
  phaseElapsed,
  progress,
  reducedMotion,
  running,
}: {
  carPosition: VectorTuple;
  compact: boolean;
  crashImpact: number;
  crashed: boolean;
  displayMultiplier: number;
  eased: number;
  elapsedSeconds: number;
  multiplier: number;
  phaseElapsed: number;
  progress: number;
  reducedMotion: boolean;
  running: boolean;
}): TimeCarTrailFrame {
  const layout = getTrailLayout(compact);

  if (crashed) {
    return {
      axisRevealProgress: 1,
      carPosition,
      displayMultiplier,
      elapsedSeconds,
      height: layout.height,
      intensity: reducedMotion ? 0.58 : 0.76 + crashImpact * 0.22,
      multiplier,
      progress: 1,
      tone: "crash",
      visible: true,
      width: layout.width,
    };
  }

  if (running) {
    return {
      axisRevealProgress: getAxisRevealProgress(phaseElapsed, reducedMotion),
      carPosition,
      displayMultiplier,
      elapsedSeconds,
      height: layout.height,
      intensity: reducedMotion ? 0.5 : 0.62 + eased * 0.24,
      multiplier,
      progress: Math.max(0.1, progress),
      tone: "boost",
      visible: true,
      width: layout.width,
    };
  }

  return {
    axisRevealProgress: 0,
    carPosition,
    displayMultiplier,
    elapsedSeconds: 0,
    height: layout.height,
    intensity: 0,
    multiplier: 1,
    progress: 0,
    tone: "boost",
    visible: false,
    width: layout.width,
  };
}

export function getRoundMultiplier(round: DashboardRound | null, now: Date) {
  const smoothMultiplierBp = getSmoothMultiplierBp(round, now);

  if (typeof smoothMultiplierBp === "number") {
    return smoothMultiplierBp / 10000;
  }

  if (typeof round?.currentMultiplierBp === "number") {
    return round.currentMultiplierBp / 10000;
  }

  if (typeof round?.crashPointBp === "number") {
    return round.crashPointBp / 10000;
  }

  return 1;
}

export function getRoundDisplayMultiplier(
  round: DashboardRound | null,
  now: Date,
) {
  const displayMultiplierBp = getDisplayMultiplierBp(round, now);

  if (typeof displayMultiplierBp === "number") {
    return displayMultiplierBp / 10000;
  }

  return getRoundMultiplier(round, now);
}

export function getRoundElapsedSeconds(
  round: DashboardRound | null,
  now: Date,
) {
  if (!round?.startedAt) {
    return null;
  }

  const startedAtMs = new Date(round.startedAt).getTime();
  const endedAtMs = round.crashedAt
    ? new Date(round.crashedAt).getTime()
    : now.getTime();

  if (!Number.isFinite(startedAtMs) || !Number.isFinite(endedAtMs)) {
    return null;
  }

  return Math.max(0, (endedAtMs - startedAtMs) / 1000);
}

function getTrailLayout(compact: boolean): {
  height: number;
  width: number;
} {
  return {
    height: compact ? 0.72 : 0.92,
    width: compact ? 1.72 : 2.92,
  };
}

function getAxisRevealProgress(phaseElapsed: number, reducedMotion: boolean) {
  if (reducedMotion) {
    return 1;
  }

  return easeOutCubic(Math.min(1, Math.max(0, phaseElapsed / 0.7)));
}
