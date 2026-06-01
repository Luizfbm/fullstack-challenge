import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { createFlightStage, disposeObject } from "./crash-flight-stage";
import { createGrowthTrail, updateGrowthTrail } from "./growth-trail";
import {
  createTimeCarModel,
  normalizeTimeCarAssetForScene,
  TIME_CAR_ASSET_PATH,
  TIME_CAR_ASSET_ROTATION_Y,
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

  it("points the runtime scene at the bundled low-poly time-machine asset", () => {
    expect(TIME_CAR_ASSET_PATH).toBe("/models/time-machine-low-poly.glb");
  });

  it("orients the imported time car with its front facing right", () => {
    const model = new THREE.Group();
    const frontMarker = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.1));
    const rearMarker = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.1));

    frontMarker.position.x = -2;
    rearMarker.position.x = 1;
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
