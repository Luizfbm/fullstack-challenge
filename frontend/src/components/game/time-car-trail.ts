import * as THREE from "three";
import {
  updateAxisLabels,
  updateAxisReveal,
  updateAxisTicks,
  updateCurrentMultiplierIndicator,
  updateCurrentTimeIndicator,
  updateMultiplierPillar,
  updateTimeAxis,
} from "./time-car-trail-axis";
import {
  getAxisFrame,
  getHudFrame,
  normalizeFrame,
} from "./time-car-trail-frame";
import {
  getCurvePoint,
  getTrailCarAnchor,
  updateAreaGeometry,
  updateCurveGeometry,
  updateParticleGeometry,
} from "./time-car-trail-geometry";
import { createAxisLabelSprite, createAxisLabels } from "./time-car-trail-labels";
import { updateTrailMaterials } from "./time-car-trail-materials";
import {
  createAxisTicks,
  createCurrentMultiplierGuide,
  createCurrentTimeGuide,
  createGrowthArea,
  createGrowthCurve,
  createGrowthParticles,
  createMultiplierPillar,
  createTimeAxis,
} from "./time-car-trail-objects";
import type {
  TimeCarTrail,
  TimeCarTrailUpdateInput,
  TimeCarTrailUpdateResult,
} from "./time-car-trail-types";

export type {
  TimeCarTrail,
  TimeCarTrailFrame,
  TimeCarTrailUpdateResult,
} from "./time-car-trail-types";

export function createTimeCarTrail(): TimeCarTrail {
  const group = new THREE.Group();
  const axisReveal = new THREE.Group();
  const ribbon = createGrowthArea();
  const curve = createGrowthCurve();
  const timeAxis = createTimeAxis();
  const axisTicks = createAxisTicks();
  const axisLabels = createAxisLabels();
  const currentMultiplierGuide = createCurrentMultiplierGuide();
  const currentMultiplierLabel = createCurrentLabel(
    "time-car-growth-guide-current-multiplier-label",
    "1×",
  );
  const currentTimeGuide = createCurrentTimeGuide();
  const currentTimeLabel = createCurrentLabel(
    "time-car-growth-guide-current-time-label",
    "0s",
  );
  const multiplierPillar = createMultiplierPillar();
  const particles = createGrowthParticles();

  group.name = "time-car-growth-guide";
  axisReveal.name = "time-car-growth-guide-axis-reveal";
  group.visible = false;
  axisReveal.add(
    ribbon,
    curve,
    timeAxis,
    axisTicks,
    multiplierPillar,
    currentMultiplierGuide,
    currentTimeGuide,
    particles,
    axisLabels,
    currentMultiplierLabel,
    currentTimeLabel,
  );
  group.add(axisReveal);

  return {
    axisLabels,
    axisReveal,
    axisTicks,
    curve,
    currentMultiplierGuide,
    currentMultiplierLabel,
    currentTimeGuide,
    currentTimeLabel,
    group,
    multiplierPillar,
    particles,
    ribbon,
    timeAxis,
  };
}

export function updateTimeCarTrail(
  trail: TimeCarTrail,
  input: TimeCarTrailUpdateInput,
): TimeCarTrailUpdateResult | null {
  const frame = normalizeFrame(input.trail);

  trail.group.visible = frame.visible && frame.intensity > 0;

  if (!trail.group.visible) {
    return null;
  }

  const hud = getHudFrame(input.camera, frame);
  const displayFrame = { ...frame, height: hud.height, width: hud.width };
  const displayInput = { ...input, trail: displayFrame };
  const axis = getAxisFrame(displayFrame);
  const endpoint = getCurvePoint(1, axis, displayInput);

  trail.group.position.set(hud.x, hud.y, hud.z);
  trail.group.rotation.set(0, 0, 0);
  updateAxisReveal(trail.axisReveal, displayFrame);
  updateTimeAxis(trail.timeAxis, displayFrame);
  updateAxisTicks(trail.axisTicks, displayFrame, axis);
  updateAxisLabels(trail.axisLabels, displayFrame, axis);
  updateMultiplierPillar(trail.multiplierPillar);
  updateCurveGeometry(trail.curve.geometry, axis, displayInput);
  updateAreaGeometry(trail.ribbon.geometry, axis, displayInput);
  updateParticleGeometry(trail.particles.geometry, axis, displayInput);
  updateTrailMaterials(trail, displayFrame);
  updateCurrentMultiplierIndicator(trail, displayFrame, endpoint);
  updateCurrentTimeIndicator(trail, displayFrame, endpoint);

  return getTrailCarAnchor(trail, axis, displayInput);
}

function createCurrentLabel(name: string, label: string) {
  const sprite = createAxisLabelSprite(label);

  sprite.name = name;
  sprite.renderOrder = 9;

  return sprite;
}
