import {
  easeInOutCubic,
  getTargetFov,
  lerp,
} from "./crash-flight-motion";
import type {
  CrashFlightStoryboard,
  VectorTuple,
} from "./crash-flight-storyboard";

export function getStageLayout(compact: boolean) {
  return {
    parkedScale: compact ? 1.06 : 1.52,
    parkedX: compact ? -0.22 : -1.02,
    parkedY: compact ? -0.62 : -0.94,
    parkedZ: compact ? 0.18 : 0.38,
    portalX: compact ? 0.84 : 1.06,
    portalY: compact ? 0.24 : 0.28,
  };
}

export function getWarpLayout(compact: boolean) {
  return {
    advance: compact ? 0.32 : 0.48,
    rise: compact ? 0.46 : 0.58,
    x: compact ? -0.08 : 0.22,
    y: compact ? -0.18 : -0.2,
  };
}

export function getCarFrame({
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
    const enteringScale = lerp(layout.parkedScale, 0.82, eased);

    return {
      followTrail: false,
      position: [
        lerp(layout.parkedX, layout.portalX, eased),
        lerp(layout.parkedY, layout.portalY, easeInOutCubic(progress)) +
          (reducedMotion ? 0 : idle),
        lerp(layout.parkedZ, -0.78, eased),
      ],
      rotation: [
        lerp(-0.06, 0.1, eased),
        lerp(0.48, 0.72, eased),
        lerp(-0.08, 0.32, eased),
      ],
      scale: [enteringScale, enteringScale, enteringScale],
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
    position: [
      layout.parkedX,
      layout.parkedY + (betting ? idle : 0),
      layout.parkedZ,
    ],
    rotation: [-0.08, 1.02, -0.1],
    scale: betting
      ? [layout.parkedScale, layout.parkedScale, layout.parkedScale]
      : [1, 1, 1],
  };
}

export function getCameraFrame({
  betting,
  cameraZoom,
  carPosition,
  compact,
  crashed,
  eased,
  entering,
  running,
  shake,
}: {
  betting: boolean;
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

  if (betting) {
    return {
      lookAt: [
        compact ? 0.28 : 0.68,
        compact ? 0.04 : -0.04,
        compact ? -0.42 : -0.5,
      ],
      position: [
        compact ? -0.14 : -0.58,
        compact ? 1.02 : 0.82,
        compact ? 5.92 : 4.52,
      ],
      targetFov: compact ? 47 : 46,
    };
  }

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

export function getRunningCameraShakeAmplitude(phaseElapsed: number) {
  const launchProgress = clamp(phaseElapsed / 0.68, 0, 1);
  const launchBoost = Math.pow(1 - launchProgress, 1.6) * 0.09;

  return 0.028 + launchBoost;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
