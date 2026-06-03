import { getRoundProgress } from "../../services/round-timing";
import type { DashboardRound } from "./round-formatting";

export type StageAnimationPhase =
  | "betting"
  | "crashed"
  | "entering"
  | "idle"
  | "running";

export function usesRunningTimeCarAsset(phase: StageAnimationPhase) {
  return phase === "entering" || phase === "running" || phase === "crashed";
}

export function getPortalVisibilityForPhase(phase: StageAnimationPhase) {
  return phase === "betting" || phase === "entering";
}

export function getWormholeVisibilityForPhase(phase: StageAnimationPhase) {
  return phase === "running" || phase === "crashed";
}

export function getSceneProgress(round: DashboardRound | null, now: Date) {
  if (!round) {
    return 0;
  }

  if (round.status === "RUNNING") {
    const multiplierProgress =
      typeof round.currentMultiplierBp === "number"
        ? (round.currentMultiplierBp - 10000) / 22000
        : 0;

    return Math.min(
      1,
      Math.max(getRoundProgress(round, now), multiplierProgress),
    );
  }

  return round.status === "CRASHED" || round.status === "SETTLED" ? 1 : 0;
}

export function easeOutCubic(value: number) {
  return 1 - Math.pow(1 - Math.min(1, Math.max(0, value)), 3);
}

export function easeInOutCubic(value: number) {
  const clamped = Math.min(1, Math.max(0, value));

  return clamped < 0.5
    ? 4 * clamped * clamped * clamped
    : 1 - Math.pow(-2 * clamped + 2, 3) / 2;
}

export function getCameraShake(time: number, amplitude: number) {
  return {
    x:
      Math.sin(time * 34.3) * amplitude +
      Math.sin(time * 19.7) * amplitude * 0.45,
    y:
      Math.cos(time * 29.1) * amplitude * 0.72 +
      Math.sin(time * 41.7) * amplitude * 0.26,
  };
}

export function getTargetFov({
  crashed,
  eased,
  entering,
  running,
}: {
  crashed: boolean;
  eased: number;
  entering: boolean;
  running: boolean;
}) {
  if (running) {
    return 34;
  }

  if (entering) {
    return lerp(42, 36, eased);
  }

  return crashed ? 36 : 42;
}

export function lerp(start: number, end: number, amount: number) {
  return start + (end - start) * Math.min(1, Math.max(0, amount));
}
