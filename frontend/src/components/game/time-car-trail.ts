import * as THREE from "three";

export type TimeCarTrailFrame = {
  intensity: number;
  length: number;
  spread: number;
  tone: "boost" | "crash";
  visible: boolean;
};

export type TimeCarTrail = {
  group: THREE.Group;
  particles: THREE.Points<THREE.BufferGeometry, THREE.PointsMaterial>;
  ribbon: THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>;
};

type TimeCarTrailUpdateInput = {
  carPosition: [number, number, number];
  carRotation: [number, number, number];
  reducedMotion: boolean;
  time: number;
  trail: TimeCarTrailFrame;
};

const RIBBON_SEGMENTS = 18;
const PARTICLE_COUNT = 32;
const BOOST_COLOR = new THREE.Color("#22d3ee");
const BOOST_PARTICLE_COLOR = new THREE.Color("#34d399");
const CRASH_COLOR = new THREE.Color("#fb7185");
const CRASH_PARTICLE_COLOR = new THREE.Color("#f472b6");

export function createTimeCarTrail(): TimeCarTrail {
  const group = new THREE.Group();
  const ribbon = createTrailRibbon();
  const particles = createTrailParticles();

  group.name = "time-car-trail";
  group.visible = false;
  group.add(ribbon, particles);

  return { group, particles, ribbon };
}

export function updateTimeCarTrail(
  trail: TimeCarTrail,
  input: TimeCarTrailUpdateInput,
) {
  trail.group.visible = input.trail.visible && input.trail.intensity > 0;

  if (!trail.group.visible) {
    return;
  }

  trail.group.position.set(...input.carPosition);
  trail.group.rotation.set(
    input.carRotation[0] * 0.35,
    input.carRotation[1] * 0.28,
    input.carRotation[2],
  );

  updateRibbonGeometry(trail.ribbon.geometry, input);
  updateParticleGeometry(trail.particles.geometry, input);
  updateTrailMaterials(trail, input.trail);
}

function createTrailRibbon() {
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array((RIBBON_SEGMENTS + 1) * 2 * 3);
  const indices = Array.from({ length: RIBBON_SEGMENTS }, (_, index) => {
    const base = index * 2;

    return [base, base + 1, base + 2, base + 1, base + 3, base + 2];
  }).flat();
  const material = new THREE.MeshBasicMaterial({
    blending: THREE.AdditiveBlending,
    color: BOOST_COLOR,
    depthWrite: false,
    opacity: 0,
    side: THREE.DoubleSide,
    transparent: true,
  });
  const ribbon = new THREE.Mesh(geometry, material);

  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  ribbon.name = "time-car-trail-ribbon";
  ribbon.renderOrder = 4;

  return ribbon;
}

function createTrailParticles() {
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(PARTICLE_COUNT * 3);
  const material = new THREE.PointsMaterial({
    blending: THREE.AdditiveBlending,
    color: BOOST_PARTICLE_COLOR,
    depthWrite: false,
    opacity: 0,
    size: 0.055,
    sizeAttenuation: true,
    transparent: true,
  });
  const particles = new THREE.Points(geometry, material);

  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  particles.name = "time-car-trail-particles";
  particles.renderOrder = 5;

  return particles;
}

function updateRibbonGeometry(
  geometry: THREE.BufferGeometry,
  input: TimeCarTrailUpdateInput,
) {
  const position = geometry.getAttribute("position") as THREE.BufferAttribute;
  const motion = input.reducedMotion ? 0 : input.time;

  for (let index = 0; index <= RIBBON_SEGMENTS; index += 1) {
    const depth = index / RIBBON_SEGMENTS;
    const pulse = Math.sin(motion * 8 + depth * Math.PI * 2) * 0.035;
    const taper = Math.sin((1 - depth) * Math.PI * 0.86);
    const x = -depth * input.trail.length;
    const y = pulse + depth * input.trail.spread * 0.18;
    const z = -0.08 - depth * 0.22;
    const width =
      input.trail.spread * (0.08 + Math.max(0.08, taper) * 0.48) *
      (input.trail.tone === "crash" ? 1.16 : 1);
    const vertex = index * 2;

    position.setXYZ(vertex, x, y + width, z);
    position.setXYZ(vertex + 1, x, y - width, z);
  }

  position.needsUpdate = true;
  geometry.computeBoundingSphere();
}

function updateParticleGeometry(
  geometry: THREE.BufferGeometry,
  input: TimeCarTrailUpdateInput,
) {
  const position = geometry.getAttribute("position") as THREE.BufferAttribute;
  const motion = input.reducedMotion ? 0 : input.time * 1.4;
  const crashSpread = input.trail.tone === "crash" ? 1.45 : 1;

  for (let index = 0; index < PARTICLE_COUNT; index += 1) {
    const depth = index / Math.max(1, PARTICLE_COUNT - 1);
    const lane = ((index % 7) - 3) / 3;
    const drift = Math.sin(motion * (1.8 + index * 0.025) + index) * 0.05;
    const x = -depth * input.trail.length * (0.72 + hash(index) * 0.36);
    const y =
      lane * input.trail.spread * 0.52 * crashSpread +
      drift +
      depth * input.trail.spread * 0.18;
    const z = -0.04 - depth * 0.34 + Math.cos(index * 1.7 + motion) * 0.045;

    position.setXYZ(index, x, y, z);
  }

  position.needsUpdate = true;
  geometry.computeBoundingSphere();
}

function updateTrailMaterials(trail: TimeCarTrail, frame: TimeCarTrailFrame) {
  const ribbonMaterial = trail.ribbon.material as THREE.MeshBasicMaterial;
  const particleMaterial = trail.particles.material as THREE.PointsMaterial;
  const boost = frame.tone === "boost";

  ribbonMaterial.color.copy(boost ? BOOST_COLOR : CRASH_COLOR);
  ribbonMaterial.opacity = Math.min(0.74, 0.18 + frame.intensity * 0.52);
  ribbonMaterial.needsUpdate = true;

  particleMaterial.color.copy(boost ? BOOST_PARTICLE_COLOR : CRASH_PARTICLE_COLOR);
  particleMaterial.opacity = Math.min(0.62, 0.14 + frame.intensity * 0.42);
  particleMaterial.size = boost ? 0.052 : 0.068;
  particleMaterial.needsUpdate = true;
}

function hash(index: number) {
  return Math.abs(Math.sin(index * 12.9898) * 43758.5453) % 1;
}
