import * as THREE from "three";
import { formatCurrentTimeTick, formatMultiplierTick } from "./time-car-trail-frame";
import { updateAxisLabelSprite } from "./time-car-trail-labels";
import { easeOutCubic, setSegment } from "./time-car-trail-math";
import type {
  AxisFrame,
  TimeCarTrail,
  TimeCarTrailFrame,
} from "./time-car-trail-types";

export function updateAxisReveal(
  axisReveal: TimeCarTrail["axisReveal"],
  frame: TimeCarTrailFrame,
) {
  const progress = easeOutCubic(frame.axisRevealProgress);
  const offset = 1 - progress;

  axisReveal.position.set(-0.34 * offset, -0.22 * offset, 0);
  axisReveal.scale.set(0.88 + progress * 0.12, 0.88 + progress * 0.12, 1);
}

export function updateTimeAxis(
  timeAxis: TimeCarTrail["timeAxis"],
  frame: TimeCarTrailFrame,
) {
  const position = timeAxis.geometry.getAttribute(
    "position",
  ) as THREE.BufferAttribute;

  position.setXYZ(0, 0, 0, 0);
  position.setXYZ(1, frame.width, 0, 0);
  position.needsUpdate = true;
  timeAxis.geometry.computeBoundingSphere();
}

export function updateAxisTicks(
  axisTicks: TimeCarTrail["axisTicks"],
  frame: TimeCarTrailFrame,
  axis: AxisFrame,
) {
  const position = axisTicks.geometry.getAttribute(
    "position",
  ) as THREE.BufferAttribute;
  let point = 0;

  point = setSegment(position, point, 0, 0, 0, frame.width, 0, 0);
  point = setSegment(position, point, 0, 0, 0, 0, frame.height, 0);

  for (const tick of axis.timeTicks) {
    const x = tick.value * frame.width;

    point = setSegment(
      position,
      point,
      x,
      -0.035,
      0,
      x,
      tick.value <= axis.timeProgress ? 0.08 : -0.035,
      0,
    );
  }

  for (const tick of axis.multiplierTicks) {
    const y = tick.value * frame.height;

    point = setSegment(
      position,
      point,
      -0.045,
      y,
      0,
      tick.value <= axis.multiplierProgress ? 0.1 : -0.045,
      y,
      0,
    );
  }

  position.needsUpdate = true;
  axisTicks.geometry.computeBoundingSphere();
}

export function updateAxisLabels(
  axisLabels: TimeCarTrail["axisLabels"],
  frame: TimeCarTrailFrame,
  axis: AxisFrame,
) {
  let labelIndex = 0;

  for (const tick of axis.multiplierTicks) {
    const label = axisLabels.children[labelIndex] as THREE.Sprite;

    updateAxisLabelSprite(label, tick.label);
    label.position.set(0.2, tick.value * frame.height, 0.055);
    label.scale.set(0.34, 0.09, 1);
    labelIndex += 1;
  }

  for (const tick of axis.timeTicks) {
    const label = axisLabels.children[labelIndex] as THREE.Sprite;

    updateAxisLabelSprite(label, tick.label);
    label.position.set(tick.value * frame.width, -0.13, 0.055);
    label.scale.set(0.26, 0.09, 1);
    labelIndex += 1;
  }
}

export function updateMultiplierPillar(pillar: TimeCarTrail["multiplierPillar"]) {
  const material = pillar.material as THREE.MeshBasicMaterial;

  pillar.visible = false;
  material.opacity = 0;
  material.needsUpdate = true;
}

export function updateCurrentMultiplierIndicator(
  trail: TimeCarTrail,
  frame: TimeCarTrailFrame,
  point: { x: number; y: number },
) {
  const position = trail.currentMultiplierGuide.geometry.getAttribute(
    "position",
  ) as THREE.BufferAttribute;
  const guideMaterial = trail.currentMultiplierGuide.material as THREE.LineBasicMaterial;
  const labelMaterial = trail.currentMultiplierLabel.material as THREE.SpriteMaterial;
  const boost = frame.tone === "boost";

  position.setXYZ(0, 0, point.y, 0.058);
  position.setXYZ(1, point.x, point.y, 0.058);
  position.needsUpdate = true;
  trail.currentMultiplierGuide.geometry.computeBoundingSphere();

  updateAxisLabelSprite(
    trail.currentMultiplierLabel,
    formatMultiplierTick(frame.displayMultiplier ?? frame.multiplier),
  );
  trail.currentMultiplierLabel.position.set(0.24, point.y, 0.08);
  trail.currentMultiplierLabel.scale.set(0.42, 0.115, 1);

  guideMaterial.color.set(boost ? "#bae6fd" : "#fecdd3");
  guideMaterial.opacity = boost ? 0.2 + frame.intensity * 0.14 : 0.24;
  guideMaterial.needsUpdate = true;
  labelMaterial.color.set(boost ? "#ffffff" : "#fff1f2");
  labelMaterial.opacity = boost ? 0.96 : 0.9;
  labelMaterial.needsUpdate = true;
}

export function updateCurrentTimeIndicator(
  trail: TimeCarTrail,
  frame: TimeCarTrailFrame,
  point: { x: number; y: number },
) {
  const position = trail.currentTimeGuide.geometry.getAttribute(
    "position",
  ) as THREE.BufferAttribute;
  const guideMaterial = trail.currentTimeGuide.material as THREE.LineBasicMaterial;
  const labelMaterial = trail.currentTimeLabel.material as THREE.SpriteMaterial;
  const boost = frame.tone === "boost";
  const labelX = Math.min(
    Math.max(point.x, 0.24),
    Math.max(0.24, frame.width - 0.24),
  );

  position.setXYZ(0, point.x, 0, 0.057);
  position.setXYZ(1, point.x, point.y, 0.057);
  position.needsUpdate = true;
  trail.currentTimeGuide.geometry.computeBoundingSphere();

  updateAxisLabelSprite(
    trail.currentTimeLabel,
    formatCurrentTimeTick(frame.elapsedSeconds),
  );
  trail.currentTimeLabel.position.set(labelX, -0.2, 0.08);
  trail.currentTimeLabel.scale.set(0.36, 0.1, 1);

  guideMaterial.color.set(boost ? "#bae6fd" : "#fecdd3");
  guideMaterial.opacity = boost ? 0.18 + frame.intensity * 0.12 : 0.22;
  guideMaterial.needsUpdate = true;
  labelMaterial.color.set(boost ? "#ffffff" : "#fff1f2");
  labelMaterial.opacity = boost ? 0.94 : 0.88;
  labelMaterial.needsUpdate = true;
}
