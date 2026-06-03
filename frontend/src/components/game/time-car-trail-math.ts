import * as THREE from "three";

export function clamp01(value: number) {
  return Math.min(1, Math.max(0, value));
}

export function easeOutCubic(value: number) {
  return 1 - Math.pow(1 - clamp01(value), 3);
}

export function setSegment(
  position: THREE.BufferAttribute,
  point: number,
  startX: number,
  startY: number,
  startZ: number,
  endX: number,
  endY: number,
  endZ: number,
) {
  position.setXYZ(point, startX, startY, startZ);
  position.setXYZ(point + 1, endX, endY, endZ);

  return point + 2;
}

export function getVisibleT(t: number, _progress: number) {
  return Math.min(1, Math.max(0, t));
}

export function hash(index: number) {
  return Math.abs(Math.sin(index * 12.9898) * 43758.5453) % 1;
}
