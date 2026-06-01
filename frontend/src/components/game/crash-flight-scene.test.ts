import { describe, expect, it } from "vitest";
import * as THREE from "three";
import {
  easeInOutCubic,
  easeOutCubic,
  getCameraShake,
  getSceneProgress,
  getTargetFov,
  lerp,
  usesRunningTimeCarAsset,
} from "./crash-flight-motion";
import { createFlightStage, disposeObject } from "./crash-flight-stage";
import { animateTimeCarFire } from "./time-car-fire";
import { createGrowthTrail, updateGrowthTrail } from "./growth-trail";
import type { DashboardRound } from "./round-formatting";
import {
  createTimeCarModel,
  normalizeTimeCarAssetForScene,
  TIME_CAR_ASSET_PATH,
  TIME_CAR_ASSET_ROTATION_Y,
  TIME_CAR_RUNNING_ASSET_PATH,
} from "./time-car-model";

describe("crash flight scene primitives", () => {
  it("builds a procedural time car without external assets", () => {
    const car = createTimeCarModel();

    expect(car.name).toBe("time-car-model");
    expect(car.children.length).toBeGreaterThan(8);
    expect(car.children.every((child) => child instanceof THREE.Mesh)).toBe(
      true,
    );
  });

  it("points the runtime scene at the bundled low-poly time-machine assets", () => {
    expect(TIME_CAR_ASSET_PATH).toBe("/models/time-machine-low-poly.glb");
    expect(TIME_CAR_RUNNING_ASSET_PATH).toBe(
      "/models/time-machine-low-poly-running.glb",
    );
  });

  it("uses the fire-detail model only while entering or running", () => {
    expect(usesRunningTimeCarAsset("entering")).toBe(true);
    expect(usesRunningTimeCarAsset("running")).toBe(true);
    expect(usesRunningTimeCarAsset("betting")).toBe(false);
    expect(usesRunningTimeCarAsset("crashed")).toBe(false);
    expect(usesRunningTimeCarAsset("idle")).toBe(false);
  });

  it("calculates scene progress and easing helpers for storyboard motion", () => {
    const now = new Date("2026-06-01T12:00:05.000Z");
    const runningRound = {
      bettingEndsAt: "2026-06-01T12:00:00.000Z",
      currentMultiplierBp: 21000,
      multiplierGrowthBpPerSecond: 1000,
      startedAt: "2026-06-01T12:00:00.000Z",
      status: "RUNNING",
    } as DashboardRound;

    expect(getSceneProgress(null, now)).toBe(0);
    expect(getSceneProgress(runningRound, now)).toBe(0.5);
    expect(getSceneProgress({ status: "CRASHED" } as DashboardRound, now)).toBe(
      1,
    );
    expect(easeOutCubic(0.5)).toBeCloseTo(0.875);
    expect(easeInOutCubic(0.25)).toBeCloseTo(0.0625);
    expect(lerp(10, 20, 0.25)).toBe(12.5);
    expect(
      getTargetFov({
        crashed: false,
        eased: 0.5,
        entering: false,
        running: true,
      }),
    ).toBe(34);
    expect(
      getTargetFov({
        crashed: true,
        eased: 0,
        entering: false,
        running: false,
      }),
    ).toBe(36);
    expect(getCameraShake(1, 0).x).toBeCloseTo(0);
    expect(getCameraShake(1, 0).y).toBeCloseTo(0);
  });

  it("pulses only Shock fire meshes when the running car is active", () => {
    const car = new THREE.Group();
    const fire = new THREE.Mesh(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshStandardMaterial({
        emissive: "#22d3ee",
        emissiveIntensity: 1,
        opacity: 0.82,
        transparent: true,
      }),
    );
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshStandardMaterial(),
    );

    fire.name = "Shock_Shock_0";
    body.name = "Delorean_Material_0";
    car.add(fire, body);

    animateTimeCarFire(car, 0.21, true);

    expect(fire.scale.x).toBeGreaterThan(1);
    expect(body.scale.x).toBe(1);
    expect(
      (fire.material as THREE.MeshStandardMaterial).opacity,
    ).toBeGreaterThan(0.72);

    animateTimeCarFire(car, 0.21, false);

    expect(fire.scale.x).toBe(1);
    expect(fire.position.y).toBe(0);
    expect(body.scale.x).toBe(1);
  });

  it("orients the imported time car with its front facing right", () => {
    const model = new THREE.Group();
    const frontMarker = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.1));
    const rearMarker = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.1));

    frontMarker.position.z = -2;
    rearMarker.position.z = 1;
    model.add(frontMarker, rearMarker);

    normalizeTimeCarAssetForScene(model);
    model.updateMatrixWorld(true);

    const frontPosition = new THREE.Vector3().setFromMatrixPosition(
      frontMarker.matrixWorld,
    );
    const rearPosition = new THREE.Vector3().setFromMatrixPosition(
      rearMarker.matrixWorld,
    );

    expect(model.rotation.y).toBe(TIME_CAR_ASSET_ROTATION_Y);
    expect(frontPosition.x).toBeGreaterThan(rearPosition.x);
  });

  it("updates the growth trail geometry and crash color", () => {
    const trail = createGrowthTrail();

    updateGrowthTrail(trail, 0.64, true);

    expect(trail.group.children).toHaveLength(2);
    expect(trail.core.geometry.getAttribute("position").count).toBe(72);
    expect(
      (trail.core.material as THREE.LineBasicMaterial).color.getHexString(),
    ).toBe("fb7185");
  });

  it("creates and disposes the glass arena stage resources", () => {
    const stage = createFlightStage();

    expect(stage.group.children.length).toBeGreaterThan(4);
    expect(stage.engineLight.intensity).toBeGreaterThan(0);
    expect(stage.redFlash.material.opacity).toBe(0);

    expect(() => disposeObject(stage.group)).not.toThrow();
  });
});
