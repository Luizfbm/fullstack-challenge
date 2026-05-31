import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { createFlightStage, disposeObject } from "./crash-flight-stage";
import { createGrowthTrail, updateGrowthTrail } from "./growth-trail";
import { createTimeCarModel } from "./time-car-model";

describe("crash flight scene primitives", () => {
  it("builds a procedural time car without external assets", () => {
    const car = createTimeCarModel();

    expect(car.name).toBe("time-car-model");
    expect(car.children.length).toBeGreaterThan(8);
    expect(car.children.every((child) => child instanceof THREE.Mesh)).toBe(
      true,
    );
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
