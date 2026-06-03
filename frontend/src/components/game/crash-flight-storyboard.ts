import {
  easeOutCubic,
  getCameraShake,
  getPortalVisibilityForPhase,
  getSceneProgress,
  getWormholeVisibilityForPhase,
  type StageAnimationPhase,
  usesRunningTimeCarAsset,
} from "./crash-flight-motion";
import {
  getCameraFrame,
  getCarFrame,
  getRunningCameraShakeAmplitude,
  getStageLayout,
  getWarpLayout,
} from "./crash-flight-storyboard-frames";
import {
  getRoundDisplayMultiplier,
  getRoundElapsedSeconds,
  getRoundMultiplier,
  getTrailFrame,
} from "./crash-flight-trail-frame";
import type { DashboardRound } from "./round-formatting";
import { ENTERING_BLACK_HOLE_SECONDS } from "./stage-animation-timing";
import type { TimeCarTrailFrame } from "./time-car-trail";

export type VectorTuple = [number, number, number];

export type CrashFlightStoryboard = {
  camera: {
    lookAt: VectorTuple;
    position: VectorTuple;
    targetFov: number;
  };
  car: {
    followTrail: boolean;
    position: VectorTuple;
    rotation: VectorTuple;
    scale: VectorTuple;
  };
  compact: boolean;
  crashImpact: number;
  crashed: boolean;
  entering: boolean;
  engineLightIntensity: number;
  portal: {
    position: VectorTuple;
    rotation: VectorTuple;
  };
  portalVisible: boolean;
  progress: number;
  redFlashOpacity: number;
  running: boolean;
  showRunningCar: boolean;
  trail: TimeCarTrailFrame;
  wormholeActive: boolean;
  wormholePosition: VectorTuple;
};

export function getCrashFlightStoryboard({
  cameraAspect,
  now = new Date(),
  displayNow = now,
  phase,
  phaseElapsed,
  reducedMotion,
  round,
  time,
}: {
  cameraAspect: number;
  displayNow?: Date;
  now?: Date;
  phase: StageAnimationPhase;
  phaseElapsed: number;
  reducedMotion: boolean;
  round: DashboardRound | null;
  time: number;
}): CrashFlightStoryboard {
  const crashed = phase === "crashed";
  const entering = phase === "entering";
  const running = phase === "running";
  const betting = round?.status === "BETTING";
  const compact = cameraAspect < 0.82;
  const enteringProgress = Math.min(
    1,
    Math.max(0, phaseElapsed / ENTERING_BLACK_HOLE_SECONDS),
  );
  const roundElapsedSeconds =
    getRoundElapsedSeconds(round, now) ?? phaseElapsed;
  const crashImpact = crashed ? Math.max(0, 1 - phaseElapsed / 1.1) : 0;
  const progress = entering ? enteringProgress : getSceneProgress(round, now);
  const eased = easeOutCubic(progress);
  const idle = Math.sin(time * 2.6) * 0.025;
  const layout = getStageLayout(compact);
  const shake = reducedMotion
    ? { x: 0, y: 0 }
    : getCameraShake(
        time,
        running
          ? getRunningCameraShakeAmplitude(phaseElapsed)
          : crashImpact * 0.1,
      );
  const cameraZoom = entering ? eased : running || crashed ? 1 : 0;
  const car = getCarFrame({
    betting,
    crashed,
    eased,
    entering,
    idle,
    layout,
    progress,
    reducedMotion,
    running,
    time,
    warp: getWarpLayout(compact),
    crashImpact,
  });

  return {
    camera: getCameraFrame({
      betting,
      cameraZoom,
      carPosition: car.position,
      compact,
      crashed,
      eased,
      entering,
      running,
      shake,
    }),
    car,
    compact,
    crashImpact,
    crashed,
    entering,
    engineLightIntensity:
      running || entering ? 3 + Math.sin(time * 10) * 0.9 : 1.2,
    portal: {
      position: [layout.portalX, layout.portalY, -0.86],
      rotation: betting
        ? [0, 0, 0]
        : [compact ? 0.16 : 0.2, compact ? -0.16 : -0.24, 0],
    },
    portalVisible: getPortalVisibilityForPhase(phase),
    progress,
    redFlashOpacity: crashed
      ? 0.18 + crashImpact * 0.35 + Math.sin(time * 7) * 0.06
      : 0,
    running,
    showRunningCar: usesRunningTimeCarAsset(phase),
    trail: getTrailFrame({
      carPosition: car.position,
      compact,
      crashImpact,
      eased,
      displayMultiplier: getRoundDisplayMultiplier(round, displayNow),
      elapsedSeconds: roundElapsedSeconds,
      multiplier: getRoundMultiplier(round, now),
      phaseElapsed,
      progress,
      reducedMotion,
      running,
      crashed,
    }),
    wormholeActive: getWormholeVisibilityForPhase(phase),
    wormholePosition: [compact ? 0.06 : 0.2, compact ? -0.06 : -0.08, -1.05],
  };
}
