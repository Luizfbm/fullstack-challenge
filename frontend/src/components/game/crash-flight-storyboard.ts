import {
  easeInOutCubic,
  easeOutCubic,
  getCameraShake,
  getPortalVisibilityForPhase,
  getSceneProgress,
  getTargetFov,
  getWormholeVisibilityForPhase,
  lerp,
  type StageAnimationPhase,
  usesRunningTimeCarAsset,
} from "./crash-flight-motion";
import {
  getDisplayMultiplierBp,
  getSmoothMultiplierBp,
} from "../../services/display-multiplier";
import type { DashboardRound } from "./round-formatting";
import { ENTERING_BLACK_HOLE_SECONDS } from "./stage-animation-timing";
import type { TimeCarTrailFrame } from "./time-car-trail";

type VectorTuple = [number, number, number];

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
      rotation: [compact ? 0.16 : 0.2, compact ? -0.16 : -0.24, 0],
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

function getTrailFrame({
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

function getTrailLayout(compact: boolean): {
  height: number;
  width: number;
} {
  return {
    height: compact ? 0.72 : 0.92,
    width: compact ? 1.72 : 2.92,
  };
}

function getStageLayout(compact: boolean) {
  return {
    parkedX: compact ? -0.96 : -2.28,
    parkedY: compact ? -0.58 : -0.82,
    portalX: compact ? 1.04 : 1.72,
    portalY: compact ? 0.18 : 0.12,
  };
}

function getWarpLayout(compact: boolean) {
  return {
    advance: compact ? 0.32 : 0.48,
    rise: compact ? 0.46 : 0.58,
    x: compact ? -0.08 : 0.22,
    y: compact ? -0.18 : -0.2,
  };
}

function getCarFrame({
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
  warp,
  crashImpact,
}: {
  betting: boolean;
  crashed: boolean;
  eased: number;
  entering: boolean;
  idle: number;
  layout: ReturnType<typeof getStageLayout>;
  progress: number;
  reducedMotion: boolean;
  running: boolean;
  time: number;
  warp: ReturnType<typeof getWarpLayout>;
  crashImpact: number;
}): CrashFlightStoryboard["car"] {
  if (entering) {
    return {
      followTrail: false,
      position: [
        lerp(layout.parkedX, layout.portalX, eased),
        lerp(layout.parkedY, layout.portalY, easeInOutCubic(progress)) +
          (reducedMotion ? 0 : idle),
        lerp(-0.14, -0.78, eased),
      ],
      rotation: [
        lerp(-0.06, 0.1, eased),
        lerp(0.24, 0.72, eased),
        lerp(-0.08, 0.32, eased),
      ],
      scale: [1, 1, 1],
    };
  }

  if (running || crashed) {
    const speedJitter = reducedMotion ? 0 : Math.sin(time * 22) * 0.035;
    const scale = 0.42;

    return {
      followTrail: true,
      position: [
        warp.x + eased * warp.advance + Math.sin(time * 2.8) * 0.08,
        warp.y + eased * warp.rise + speedJitter,
        -1.02 - eased * 0.26,
      ],
      rotation: [
        0.12 + Math.sin(time * 6) * 0.03,
        0.58 + Math.sin(time * 3.2) * 0.08,
        0.28 + Math.sin(time * 9) * 0.05 + crashImpact * 0.18,
      ],
      scale: [scale, scale, scale],
    };
  }

  return {
    followTrail: false,
    position: [layout.parkedX, layout.parkedY + (betting ? idle : 0), -0.14],
    rotation: [-0.06, 0.24, -0.08],
    scale: [1, 1, 1],
  };
}

function getRoundMultiplier(round: DashboardRound | null, now: Date) {
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

function getRoundDisplayMultiplier(round: DashboardRound | null, now: Date) {
  const displayMultiplierBp = getDisplayMultiplierBp(round, now);

  if (typeof displayMultiplierBp === "number") {
    return displayMultiplierBp / 10000;
  }

  return getRoundMultiplier(round, now);
}

function getRoundElapsedSeconds(round: DashboardRound | null, now: Date) {
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

function getAxisRevealProgress(phaseElapsed: number, reducedMotion: boolean) {
  if (reducedMotion) {
    return 1;
  }

  return easeOutCubic(Math.min(1, Math.max(0, phaseElapsed / 0.7)));
}

function getRunningCameraShakeAmplitude(phaseElapsed: number) {
  const launchProgress = clamp(phaseElapsed / 0.68, 0, 1);
  const launchBoost = Math.pow(1 - launchProgress, 1.6) * 0.09;

  return 0.028 + launchBoost;
}

function getCameraFrame({
  cameraZoom,
  carPosition,
  compact,
  crashed,
  eased,
  entering,
  running,
  shake,
}: {
  cameraZoom: number;
  carPosition: VectorTuple;
  compact: boolean;
  crashed: boolean;
  eased: number;
  entering: boolean;
  running: boolean;
  shake: { x: number; y: number };
}): CrashFlightStoryboard["camera"] {
  const followActive = running || crashed;
  const followX = followActive ? clamp(carPosition[0] * 0.08, -0.18, 0.22) : 0;
  const followY = followActive ? clamp(carPosition[1] * 0.06, -0.1, 0.16) : 0;

  return {
    lookAt: [
      (compact ? 0.1 : 0.02) + cameraZoom * 0.22 + followX + shake.x * 0.6,
      0.08 + cameraZoom * 0.2 + followY + shake.y * 0.6,
      -0.42,
    ],
    position: [
      (compact ? 0.1 + cameraZoom * 0.2 : 0.05 + cameraZoom * 0.34) +
        followX * 0.7 +
        shake.x,
      (compact ? 1.18 + cameraZoom * 0.02 : 1.18 + cameraZoom * 0.04) +
        followY * 0.35 +
        shake.y,
      compact ? lerp(6.45, 5.25, cameraZoom) : lerp(5.55, 4.22, cameraZoom),
    ],
    targetFov: getTargetFov({ crashed, eased, entering, running }),
  };
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
