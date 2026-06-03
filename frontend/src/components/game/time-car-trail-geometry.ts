import * as THREE from "three";
import {
  CURVE_GROWTH_EXPONENT,
  CURVE_SEGMENTS,
  PARTICLE_COUNT,
} from "./time-car-trail-constants";
import { getEdgeHoldProgress } from "./time-car-trail-frame";
import { getVisibleT, hash } from "./time-car-trail-math";
import type {
  AxisFrame,
  TimeCarTrail,
  TimeCarTrailUpdateInput,
  TimeCarTrailUpdateResult,
} from "./time-car-trail-types";

export function updateCurveGeometry(
  geometry: THREE.BufferGeometry,
  axis: AxisFrame,
  input: TimeCarTrailUpdateInput,
) {
  const position = geometry.getAttribute("position") as THREE.BufferAttribute;

  forEachCurvePoint(axis, input, (index, point) => {
    position.setXYZ(index, point.x, point.y, 0.06);
  });

  position.needsUpdate = true;
  geometry.computeBoundingSphere();
}

export function updateAreaGeometry(
  geometry: THREE.BufferGeometry,
  axis: AxisFrame,
  input: TimeCarTrailUpdateInput,
) {
  const position = geometry.getAttribute("position") as THREE.BufferAttribute;

  forEachCurvePoint(axis, input, (index, point) => {
    const vertex = index * 2;

    position.setXYZ(vertex, point.x, point.y, 0.025);
    position.setXYZ(vertex + 1, point.x, 0, 0.025);
  });

  position.needsUpdate = true;
  geometry.computeBoundingSphere();
}

export function updateParticleGeometry(
  geometry: THREE.BufferGeometry,
  axis: AxisFrame,
  input: TimeCarTrailUpdateInput,
) {
  const position = geometry.getAttribute("position") as THREE.BufferAttribute;
  const motion = input.reducedMotion ? 0 : input.time * 1.2;

  for (let index = 0; index < PARTICLE_COUNT; index += 1) {
    const lane = index / Math.max(1, PARTICLE_COUNT - 1);
    const t = getVisibleT(lane, input.trail.progress);
    const jitter = input.reducedMotion
      ? 0
      : Math.sin(motion + index * 1.73) * 0.018;
    const point = getCurvePoint(t, axis, input);
    const z = 0.08 + hash(index) * 0.028;

    position.setXYZ(index, point.x, point.y + jitter, z);
  }

  position.needsUpdate = true;
  geometry.computeBoundingSphere();
}

export function getCurvePoint(
  t: number,
  axis: AxisFrame,
  input: TimeCarTrailUpdateInput,
) {
  const pulse = input.reducedMotion
    ? 0
    : Math.sin(t * Math.PI) * Math.sin(input.time * 5.2) * 0.024;
  const growth = Math.pow(t, CURVE_GROWTH_EXPONENT);

  return {
    x: input.trail.width * axis.timeProgress * t,
    y: input.trail.height * axis.multiplierProgress * growth + pulse,
  };
}

function forEachCurvePoint(
  axis: AxisFrame,
  input: TimeCarTrailUpdateInput,
  callback: (index: number, point: { x: number; y: number }) => void,
) {
  for (let index = 0; index <= CURVE_SEGMENTS; index += 1) {
    const t = getVisibleT(index / CURVE_SEGMENTS, input.trail.progress);

    callback(index, getCurvePoint(t, axis, input));
  }
}

export function getTrailCarAnchor(
  trail: TimeCarTrail,
  axis: AxisFrame,
  input: TimeCarTrailUpdateInput,
): TimeCarTrailUpdateResult {
  const endpoint = getCurvePoint(1, axis, input);
  const previous = getCurvePoint(0.94, axis, input);
  const revealScaleX = trail.axisReveal.scale.x;
  const revealScaleY = trail.axisReveal.scale.y;
  const deltaX = (endpoint.x - previous.x) * revealScaleX;
  const deltaY = (endpoint.y - previous.y) * revealScaleY;

  return {
    carAnchor: [
      trail.group.position.x +
        trail.axisReveal.position.x +
        endpoint.x * revealScaleX,
      trail.group.position.y +
        trail.axisReveal.position.y +
        endpoint.y * revealScaleY,
      trail.group.position.z + trail.axisReveal.position.z + 0.14,
    ],
    edgeHoldProgress: getEdgeHoldProgress(input.trail.elapsedSeconds),
    tangentAngle: Math.atan2(deltaY, Math.max(0.001, deltaX)),
  };
}
