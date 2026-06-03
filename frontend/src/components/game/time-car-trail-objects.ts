import * as THREE from "three";
import {
  AXIS_SEGMENTS,
  BOOST_COLOR,
  BOOST_FILL_COLOR,
  BOOST_PARTICLE_COLOR,
  CURVE_SEGMENTS,
  PARTICLE_COUNT,
} from "./time-car-trail-constants";

export function createGrowthArea() {
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array((CURVE_SEGMENTS + 1) * 2 * 3);
  const indices = Array.from({ length: CURVE_SEGMENTS }, (_, index) => {
    const base = index * 2;

    return [base, base + 1, base + 2, base + 1, base + 3, base + 2];
  }).flat();
  const material = new THREE.MeshBasicMaterial({
    blending: THREE.AdditiveBlending,
    color: BOOST_FILL_COLOR,
    depthTest: false,
    depthWrite: false,
    opacity: 0,
    side: THREE.DoubleSide,
    transparent: true,
  });
  const ribbon = new THREE.Mesh(geometry, material);

  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  ribbon.name = "time-car-growth-guide-area";
  ribbon.renderOrder = 3;

  return ribbon;
}

export function createGrowthCurve() {
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array((CURVE_SEGMENTS + 1) * 3);
  const material = new THREE.LineBasicMaterial({
    blending: THREE.AdditiveBlending,
    color: BOOST_COLOR,
    depthTest: false,
    depthWrite: false,
    opacity: 0,
    transparent: true,
  });
  const curve = new THREE.Line(geometry, material);

  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  curve.name = "time-car-growth-guide-curve";
  curve.renderOrder = 5;

  return curve;
}

export function createTimeAxis() {
  const geometry = new THREE.BufferGeometry();
  const material = new THREE.LineBasicMaterial({
    blending: THREE.AdditiveBlending,
    color: "#bae6fd",
    depthTest: false,
    depthWrite: false,
    opacity: 0.26,
    transparent: true,
  });
  const axis = new THREE.Line(geometry, material);

  geometry.setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(1, 0, 0)]);
  axis.name = "time-car-growth-guide-time-axis";
  axis.position.x = 0;
  axis.renderOrder = 4;

  return axis;
}

export function createAxisTicks() {
  const geometry = new THREE.BufferGeometry();
  const material = new THREE.LineBasicMaterial({
    blending: THREE.AdditiveBlending,
    color: "#93c5fd",
    depthTest: false,
    depthWrite: false,
    opacity: 0.34,
    transparent: true,
  });
  const ticks = new THREE.LineSegments(geometry, material);

  geometry.setAttribute(
    "position",
    new THREE.BufferAttribute(new Float32Array(AXIS_SEGMENTS * 2 * 3), 3),
  );
  ticks.name = "time-car-growth-guide-axis-ticks";
  ticks.renderOrder = 6;

  return ticks;
}

export function createCurrentMultiplierGuide() {
  const guide = createIndicatorGuide("time-car-growth-guide-current-multiplier-guide");

  guide.renderOrder = 7;

  return guide;
}

export function createCurrentTimeGuide() {
  const guide = createIndicatorGuide("time-car-growth-guide-current-time-guide");

  guide.renderOrder = 7;

  return guide;
}

export function createMultiplierPillar() {
  const material = new THREE.MeshBasicMaterial({
    blending: THREE.AdditiveBlending,
    color: BOOST_COLOR,
    depthTest: false,
    depthWrite: false,
    opacity: 0,
    transparent: true,
  });
  const pillar = new THREE.Mesh(new THREE.PlaneGeometry(0.06, 1), material);

  pillar.name = "time-car-growth-guide-multiplier-pillar";
  pillar.position.x = -0.14;
  pillar.renderOrder = 4;
  pillar.visible = false;

  return pillar;
}

export function createGrowthParticles() {
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(PARTICLE_COUNT * 3);
  const material = new THREE.PointsMaterial({
    blending: THREE.AdditiveBlending,
    color: BOOST_PARTICLE_COLOR,
    depthTest: false,
    depthWrite: false,
    opacity: 0,
    size: 0.045,
    sizeAttenuation: true,
    transparent: true,
  });
  const particles = new THREE.Points(geometry, material);

  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  particles.name = "time-car-growth-guide-particles";
  particles.renderOrder = 6;

  return particles;
}

function createIndicatorGuide(name: string) {
  const geometry = new THREE.BufferGeometry();
  const material = new THREE.LineBasicMaterial({
    blending: THREE.AdditiveBlending,
    color: "#bae6fd",
    depthTest: false,
    depthWrite: false,
    opacity: 0,
    transparent: true,
  });
  const guide = new THREE.Line(geometry, material);

  geometry.setAttribute(
    "position",
    new THREE.BufferAttribute(new Float32Array(2 * 3), 3),
  );
  guide.name = name;

  return guide;
}
