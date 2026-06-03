import * as THREE from "three";
import {
  AXIS_CURRENT_MAX_PROGRESS,
  BASE_TIME_AXIS_SECONDS,
  EDGE_HOLD_GROWTH_SECONDS,
  HUD_DISTANCE,
  INITIAL_MULTIPLIER_AXIS_MAX,
  Y_AXIS_TICKS,
} from "./time-car-trail-constants";
import { clamp01 } from "./time-car-trail-math";
import type { AxisFrame, TimeCarTrailFrame } from "./time-car-trail-types";

export function normalizeFrame(frame: TimeCarTrailFrame): TimeCarTrailFrame {
  return {
    ...frame,
    axisRevealProgress: clamp01(frame.axisRevealProgress),
    displayMultiplier: Math.max(1, frame.displayMultiplier ?? frame.multiplier),
    elapsedSeconds: Math.max(0, frame.elapsedSeconds),
    height: Math.max(0.04, frame.height),
    intensity: Math.min(1, Math.max(0, frame.intensity)),
    multiplier: Math.max(1, frame.multiplier),
    progress: Math.min(1, Math.max(0, frame.progress)),
    width: Math.max(0.2, frame.width),
  };
}

export function getHudFrame(
  camera: THREE.PerspectiveCamera,
  frame: TimeCarTrailFrame,
) {
  const distance = HUD_DISTANCE;
  const visibleHeight =
    2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2) * distance;
  const visibleWidth = visibleHeight * camera.aspect;
  const compact = camera.aspect < 1.1;
  const marginX = compact ? 0.2 : 0.18;
  const bottomMargin = compact ? 0.28 : 0.24;
  const topMargin = compact ? 0.22 : 0.18;
  const safeWidth = Math.max(0.2, visibleWidth - marginX * 2);

  return {
    height: Math.max(frame.height, visibleHeight - bottomMargin - topMargin),
    width: Math.min(frame.width, safeWidth),
    x: -visibleWidth / 2 + marginX,
    y: -visibleHeight / 2 + bottomMargin,
    z: -distance,
  };
}

export function getAxisFrame(frame: TimeCarTrailFrame): AxisFrame {
  const multiplier = Math.max(1, frame.multiplier);
  const elapsedSeconds = Math.max(0, frame.elapsedSeconds);
  const multiplierMax = getMultiplierAxisMax(multiplier);
  const timeMax = getTimeAxisMax(elapsedSeconds);

  return {
    multiplierMax,
    multiplierProgress: getMultiplierAxisValue(multiplier, multiplierMax),
    multiplierTicks: getMultiplierTicks(multiplierMax),
    timeMax,
    timeProgress: getTimeAxisValue(elapsedSeconds, timeMax),
    timeTicks: getTimeTicks(elapsedSeconds, timeMax),
  };
}

export function formatMultiplierTick(multiplier: number) {
  const displayMultiplier = floorMultiplierForAxis(multiplier);

  return Number.isInteger(displayMultiplier)
    ? `${displayMultiplier.toFixed(0)}×`
    : `${displayMultiplier.toFixed(2)}×`;
}

export function formatCurrentTimeTick(seconds: number) {
  const displaySeconds = floorSecondsForAxis(seconds);

  return Number.isInteger(displaySeconds)
    ? `${displaySeconds.toFixed(0)}s`
    : `${displaySeconds.toFixed(1)}s`;
}

export function getEdgeHoldProgress(elapsedSeconds: number) {
  return clamp01(
    (Math.max(0, elapsedSeconds) - BASE_TIME_AXIS_SECONDS) /
      EDGE_HOLD_GROWTH_SECONDS,
  );
}

function getMultiplierTicks(multiplierMax: number) {
  const topMultiplier = multiplierMax;

  return Y_AXIS_TICKS.map((tick) => {
    const multiplier = getMultiplierTickValue(topMultiplier, tick.value);

    return {
      label: formatMultiplierTick(multiplier),
      value: getMultiplierAxisValue(multiplier, topMultiplier),
    };
  });
}

function getTimeTicks(elapsedSeconds: number, timeMax: number) {
  if (elapsedSeconds < 1) {
    return [
      { label: "0s", value: 0 },
      {
        label: `${Math.ceil(BASE_TIME_AXIS_SECONDS / 2)}s`,
        value: getTimeAxisValue(BASE_TIME_AXIS_SECONDS / 2, timeMax),
      },
      {
        label: `${BASE_TIME_AXIS_SECONDS}s`,
        value: getTimeAxisValue(BASE_TIME_AXIS_SECONDS, timeMax),
      },
    ];
  }

  const currentSecond = Math.floor(elapsedSeconds);
  const axisMaxSecond = Math.ceil(timeMax);
  const dynamicAxis = currentSecond >= BASE_TIME_AXIS_SECONDS;

  return [
    { label: "0s", value: 0 },
    {
      label: dynamicAxis ? "5s" : `${currentSecond}s`,
      value: getTimeAxisValue(
        dynamicAxis ? BASE_TIME_AXIS_SECONDS / 2 : currentSecond,
        timeMax,
      ),
    },
    {
      label: `${dynamicAxis ? axisMaxSecond : BASE_TIME_AXIS_SECONDS}s`,
      value: getTimeAxisValue(
        dynamicAxis ? axisMaxSecond : BASE_TIME_AXIS_SECONDS,
        timeMax,
      ),
    },
  ];
}

function getMultiplierAxisMax(multiplier: number) {
  return Math.max(
    INITIAL_MULTIPLIER_AXIS_MAX,
    1 + (multiplier - 1) / AXIS_CURRENT_MAX_PROGRESS,
  );
}

function getTimeAxisMax(elapsedSeconds: number) {
  if (elapsedSeconds <= BASE_TIME_AXIS_SECONDS) {
    return BASE_TIME_AXIS_SECONDS / AXIS_CURRENT_MAX_PROGRESS;
  }

  return elapsedSeconds / AXIS_CURRENT_MAX_PROGRESS;
}

function getTimeAxisValue(elapsedSeconds: number, timeMax: number) {
  const seconds = Math.max(0, elapsedSeconds);

  return clamp01(seconds / Math.max(1, timeMax));
}

function getMultiplierAxisValue(multiplier: number, multiplierMax: number) {
  const displayMultiplier = Math.max(1, multiplier);
  const displayMax = Math.max(1.01, floorMultiplierForAxis(multiplierMax));

  return clamp01((displayMultiplier - 1) / (displayMax - 1));
}

function getMultiplierTickValue(multiplierMax: number, progress: number) {
  const displayMax = Math.max(
    INITIAL_MULTIPLIER_AXIS_MAX,
    floorMultiplierForAxis(multiplierMax),
  );

  return floorMultiplierForAxis(1 + (displayMax - 1) * progress);
}

function floorMultiplierForAxis(multiplier: number) {
  return Math.floor(Math.max(1, multiplier) * 100) / 100;
}

function floorSecondsForAxis(seconds: number) {
  return Math.floor(Math.max(0, seconds) * 10) / 10;
}
