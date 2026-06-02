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
import type { DashboardRound } from "./round-formatting";
import type { TimeCarTrailFrame } from "./time-car-trail";

type VectorTuple = [number, number, number];

export type CrashFlightStoryboard = {
  camera: {
    lookAt: VectorTuple;
    position: VectorTuple;
    targetFov: number;
  };
  car: {
    position: VectorTuple;
    rotation: VectorTuple;
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

const ENTERING_BLACK_HOLE_SECONDS = 1.4;

export function getCrashFlightStoryboard({
  cameraAspect,
  phase,
  phaseElapsed,
  reducedMotion,
  round,
  time,
}: {
  cameraAspect: number;
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
  const crashImpact = crashed ? Math.max(0, 1 - phaseElapsed / 1.1) : 0;
  const progress = entering ? enteringProgress : getSceneProgress(round, new Date());
  const eased = easeOutCubic(progress);
  const idle = Math.sin(time * 2.6) * 0.025;
  const layout = getStageLayout(compact);
  const shake = reducedMotion
    ? { x: 0, y: 0 }
    : getCameraShake(time, running ? 0.028 : crashImpact * 0.1);
  const cameraZoom = entering ? eased : running || crashed ? 1 : 0;

  return {
    camera: getCameraFrame({ cameraZoom, compact, crashed, eased, entering, running, shake }),
    car: getCarFrame({
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
    }),
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
      crashImpact,
      eased,
      entering,
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
  crashImpact,
  crashed,
  eased,
  entering,
  progress,
  reducedMotion,
  running,
}: {
  crashImpact: number;
  crashed: boolean;
  eased: number;
  entering: boolean;
  progress: number;
  reducedMotion: boolean;
  running: boolean;
}): TimeCarTrailFrame {
  if (crashed) {
    return {
      intensity: reducedMotion ? 0.58 : 0.76 + crashImpact * 0.22,
      length: 2.12 + crashImpact * 0.42,
      spread: 0.48 + crashImpact * 0.16,
      tone: "crash",
      visible: true,
    };
  }

  if (running) {
    return {
      intensity: reducedMotion ? 0.5 : 0.62 + eased * 0.24,
      length: 2.04 + eased * 0.72,
      spread: 0.34 + eased * 0.12,
      tone: "boost",
      visible: true,
    };
  }

  if (entering) {
    return {
      intensity: reducedMotion ? 0.34 : 0.28 + progress * 0.42,
      length: lerp(0.62, 1.45, eased),
      spread: lerp(0.12, 0.32, eased),
      tone: "boost",
      visible: progress > 0.08,
    };
  }

  return {
    intensity: 0,
    length: 0,
    spread: 0,
    tone: "boost",
    visible: false,
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
    };
  }

  if (running || crashed) {
    const speedJitter = reducedMotion ? 0 : Math.sin(time * 22) * 0.035;

    return {
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
    };
  }

  return {
    position: [layout.parkedX, layout.parkedY + (betting ? idle : 0), -0.14],
    rotation: [-0.06, 0.24, -0.08],
  };
}

function getCameraFrame({
  cameraZoom,
  compact,
  crashed,
  eased,
  entering,
  running,
  shake,
}: {
  cameraZoom: number;
  compact: boolean;
  crashed: boolean;
  eased: number;
  entering: boolean;
  running: boolean;
  shake: { x: number; y: number };
}): CrashFlightStoryboard["camera"] {
  return {
    lookAt: [
      (compact ? 0.1 : 0.02) + cameraZoom * 0.22 + shake.x * 0.6,
      0.08 + cameraZoom * 0.2 + shake.y * 0.6,
      -0.42,
    ],
    position: [
      (compact ? 0.1 + cameraZoom * 0.2 : 0.05 + cameraZoom * 0.34) + shake.x,
      (compact ? 1.18 + cameraZoom * 0.02 : 1.18 + cameraZoom * 0.04) + shake.y,
      compact ? lerp(6.45, 5.25, cameraZoom) : lerp(5.55, 4.22, cameraZoom),
    ],
    targetFov: getTargetFov({ crashed, eased, entering, running }),
  };
}
