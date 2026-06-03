import * as THREE from "three";
import {
  BOOST_COLOR,
  BOOST_FILL_COLOR,
  BOOST_PARTICLE_COLOR,
  CRASH_COLOR,
  CRASH_FILL_COLOR,
  CRASH_PARTICLE_COLOR,
} from "./time-car-trail-constants";
import type { TimeCarTrail, TimeCarTrailFrame } from "./time-car-trail-types";

export function updateTrailMaterials(
  trail: TimeCarTrail,
  frame: TimeCarTrailFrame,
) {
  const boost = frame.tone === "boost";
  const curveMaterial = trail.curve.material as THREE.LineBasicMaterial;
  const ribbonMaterial = trail.ribbon.material as THREE.MeshBasicMaterial;
  const particleMaterial = trail.particles.material as THREE.PointsMaterial;
  const tickMaterial = trail.axisTicks.material as THREE.LineBasicMaterial;
  const timeMaterial = trail.timeAxis.material as THREE.LineBasicMaterial;

  curveMaterial.color.copy(boost ? BOOST_COLOR : CRASH_COLOR);
  curveMaterial.opacity = Math.min(0.86, 0.24 + frame.intensity * 0.56);
  curveMaterial.needsUpdate = true;

  ribbonMaterial.color.copy(boost ? BOOST_FILL_COLOR : CRASH_FILL_COLOR);
  ribbonMaterial.opacity = boost
    ? Math.min(0.34, 0.08 + frame.intensity * 0.24)
    : Math.min(0.48, 0.15 + frame.intensity * 0.28);
  ribbonMaterial.needsUpdate = true;

  particleMaterial.color.copy(
    boost ? BOOST_PARTICLE_COLOR : CRASH_PARTICLE_COLOR,
  );
  particleMaterial.opacity = Math.min(0.68, 0.14 + frame.intensity * 0.46);
  particleMaterial.size = boost ? 0.042 : 0.055;
  particleMaterial.needsUpdate = true;

  timeMaterial.opacity = boost ? 0.24 + frame.intensity * 0.18 : 0.18;
  timeMaterial.needsUpdate = true;

  tickMaterial.color.set(boost ? "#93c5fd" : "#fda4af");
  tickMaterial.opacity = boost ? 0.34 : 0.28;
  tickMaterial.needsUpdate = true;

  for (const label of trail.axisLabels.children) {
    const material = (label as THREE.Sprite).material as THREE.SpriteMaterial;

    material.color.set(boost ? "#ffffff" : "#fff1f2");
    material.opacity = boost ? 0.82 : 0.76;
    material.needsUpdate = true;
  }
}
