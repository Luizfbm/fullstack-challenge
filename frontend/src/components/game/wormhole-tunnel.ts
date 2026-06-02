import * as THREE from "three";
import type { StageAnimationPhase } from "./crash-flight-motion";

export type WormholeTunnel = {
  group: THREE.Group;
  rings: THREE.Line[];
  streaks: THREE.Line[];
};

const RING_COUNT = 7;
const STREAK_COUNT = 24;
type WormholeUpdateInput = {
  crashImpact: number;
  phase: StageAnimationPhase;
  progress: number;
  reducedMotion: boolean;
  time: number;
};

export function createWormholeTunnel(): WormholeTunnel {
  const group = new THREE.Group();
  const rings = Array.from({ length: RING_COUNT }, (_, index) =>
    createRing(index),
  );
  const streaks = Array.from({ length: STREAK_COUNT }, (_, index) =>
    createStreak(index),
  );

  group.name = "wormhole-tunnel";
  group.visible = false;
  group.add(...rings, ...streaks);

  return { group, rings, streaks };
}

export function updateWormholeTunnel(
  wormhole: WormholeTunnel,
  input: WormholeUpdateInput,
) {
  const active = input.phase === "running" || input.phase === "crashed";
  const crashed = input.phase === "crashed";
  const color = crashed ? new THREE.Color("#fb7185") : new THREE.Color("#22d3ee");
  const accent = crashed ? new THREE.Color("#f43f5e") : new THREE.Color("#a855f7");
  const baseOpacity = crashed ? 0.54 + input.crashImpact * 0.32 : 0.38;

  wormhole.group.visible = active;

  if (!active) {
    return;
  }

  wormhole.rings.forEach((ring, index) => {
    const material = ring.material as THREE.LineBasicMaterial;
    const depth = index / Math.max(1, wormhole.rings.length - 1);
    const motion = input.reducedMotion ? 0 : input.time * 0.58;
    const scale = 0.72 + depth * 1.15 + Math.sin(motion + index) * 0.035;

    ring.position.z = -0.42 - depth * 2.6 + input.progress * 0.24;
    ring.rotation.z = input.reducedMotion
      ? ring.rotation.z
      : motion * (0.45 + depth);
    ring.scale.setScalar(scale);
    material.color.copy(index % 2 === 0 ? color : accent);
    material.opacity = baseOpacity * (1 - depth * 0.38);
  });

  wormhole.streaks.forEach((streak, index) => {
    const material = streak.material as THREE.LineBasicMaterial;
    const phase = index / STREAK_COUNT;
    const motion = input.reducedMotion ? 0 : input.time * 1.8;
    const radius = 0.52 + (index % 6) * 0.18;
    const angle = phase * Math.PI * 2 + motion * 0.22;

    streak.position.set(
      Math.cos(angle) * radius,
      Math.sin(angle) * radius * 0.54,
      -1.1,
    );
    streak.rotation.z = angle;
    streak.rotation.y = -0.34;
    material.color.copy(crashed && index % 3 === 0 ? color : accent);
    material.opacity = crashed ? 0.48 + input.crashImpact * 0.22 : 0.34;
  });
}

function createRing(index: number): THREE.Line {
  const points = Array.from({ length: 96 }, (_, pointIndex) => {
    const angle = (pointIndex / 95) * Math.PI * 2;

    return new THREE.Vector3(Math.cos(angle), Math.sin(angle) * 0.58, 0);
  });
  const geometry = new THREE.BufferGeometry().setFromPoints(points);
  const material = new THREE.LineBasicMaterial({
    color: index % 2 === 0 ? "#22d3ee" : "#a855f7",
    opacity: 0.38,
    transparent: true,
  });
  const ring = new THREE.Line(geometry, material);

  ring.name = `wormhole-ring-${index}`;
  ring.position.z = -0.4 - index * 0.42;

  return ring;
}

function createStreak(index: number): THREE.Line {
  const geometry = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(-0.72, 0, 0),
    new THREE.Vector3(0.72, 0, 0),
  ]);
  const material = new THREE.LineBasicMaterial({
    color: index % 2 === 0 ? "#e0f2fe" : "#a855f7",
    opacity: 0.32,
    transparent: true,
  });
  const streak = new THREE.Line(geometry, material);

  streak.name = `wormhole-streak-${index}`;

  return streak;
}
