import * as THREE from "three";

export const CURVE_SEGMENTS = 24;
export const PARTICLE_COUNT = 28;
export const BOOST_COLOR = new THREE.Color("#22d3ee");
export const BOOST_FILL_COLOR = new THREE.Color("#14b8a6");
export const BOOST_PARTICLE_COLOR = new THREE.Color("#34d399");
export const CRASH_COLOR = new THREE.Color("#fb7185");
export const CRASH_FILL_COLOR = new THREE.Color("#f43f5e");
export const CRASH_PARTICLE_COLOR = new THREE.Color("#f472b6");
export const HUD_DISTANCE = 3.45;
export const BASE_TIME_AXIS_SECONDS = 10;
export const EDGE_HOLD_GROWTH_SECONDS = 16;
export const INITIAL_MULTIPLIER_AXIS_MAX = 2.5;
export const AXIS_CURRENT_MAX_PROGRESS = 0.9;
export const CURVE_GROWTH_EXPONENT = 3.1;
export const Y_AXIS_TICKS = [
  { label: "1×", value: 0 },
  { label: "1.50×", value: 1 / 3 },
  { label: "2×", value: 2 / 3 },
  { label: "2.50×", value: 1 },
] as const;
export const X_AXIS_TICKS = [
  { label: "0s", value: 0 },
  { label: "5s", value: 0.5 },
  { label: "10s", value: 1 },
] as const;
export const AXIS_SEGMENTS = 2 + Y_AXIS_TICKS.length + X_AXIS_TICKS.length;
