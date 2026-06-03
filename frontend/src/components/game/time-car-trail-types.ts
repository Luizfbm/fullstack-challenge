import * as THREE from "three";

export type TimeCarTrailFrame = {
  axisRevealProgress: number;
  carPosition: [number, number, number];
  displayMultiplier?: number;
  elapsedSeconds: number;
  height: number;
  intensity: number;
  multiplier: number;
  progress: number;
  tone: "boost" | "crash";
  visible: boolean;
  width: number;
};

export type TimeCarTrail = {
  axisLabels: THREE.Group;
  axisReveal: THREE.Group;
  axisTicks: THREE.LineSegments<THREE.BufferGeometry, THREE.LineBasicMaterial>;
  curve: THREE.Line<THREE.BufferGeometry, THREE.LineBasicMaterial>;
  currentMultiplierGuide: THREE.Line<THREE.BufferGeometry, THREE.LineBasicMaterial>;
  currentMultiplierLabel: THREE.Sprite;
  currentTimeGuide: THREE.Line<THREE.BufferGeometry, THREE.LineBasicMaterial>;
  currentTimeLabel: THREE.Sprite;
  group: THREE.Group;
  multiplierPillar: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>;
  particles: THREE.Points<THREE.BufferGeometry, THREE.PointsMaterial>;
  ribbon: THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>;
  timeAxis: THREE.Line<THREE.BufferGeometry, THREE.LineBasicMaterial>;
};

export type TimeCarTrailUpdateInput = {
  camera: THREE.PerspectiveCamera;
  reducedMotion: boolean;
  time: number;
  trail: TimeCarTrailFrame;
};

export type TimeCarTrailUpdateResult = {
  carAnchor: [number, number, number];
  edgeHoldProgress: number;
  tangentAngle: number;
};

export type AxisFrame = {
  multiplierMax: number;
  multiplierProgress: number;
  multiplierTicks: Array<{ label: string; value: number }>;
  timeMax: number;
  timeProgress: number;
  timeTicks: Array<{ label: string; value: number }>;
};
