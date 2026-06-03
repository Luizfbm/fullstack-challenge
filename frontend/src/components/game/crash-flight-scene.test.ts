import { describe, expect, it } from "vitest";
import * as THREE from "three";
import {
  easeInOutCubic,
  easeOutCubic,
  getCameraShake,
  getPortalVisibilityForPhase,
  getSceneProgress,
  getTargetFov,
  getWormholeVisibilityForPhase,
  lerp,
  usesRunningTimeCarAsset,
} from "./crash-flight-motion";
import { createFlightStage, disposeObject } from "./crash-flight-stage";
import { animateTimeCarFire } from "./time-car-fire";
import { getCrashFlightStoryboard } from "./crash-flight-storyboard";
import type { DashboardRound } from "./round-formatting";
import {
  BLACKHOLE_PORTAL_ASSET_PATH,
  BLACKHOLE_PORTAL_ASSET_ROTATION_X,
  BLACKHOLE_PORTAL_ASSET_ROTATION_Z,
  createBlackholePortalFallback,
  getBlackholePortalAnimationDelta,
  normalizeBlackholePortalForScene,
  prepareBlackholePortalMaterialsForScene,
  updateBlackholePortal,
} from "./blackhole-portal-model";
import { createWormholeTunnel, updateWormholeTunnel } from "./wormhole-tunnel";
import {
  createTimeCarModel,
  normalizeTimeCarAssetForScene,
  TIME_CAR_ASSET_PATH,
  TIME_CAR_ASSET_ROTATION_Y,
  TIME_CAR_RUNNING_ASSET_PATH,
} from "./time-car-model";
import { createTimeCarTrail, updateTimeCarTrail } from "./time-car-trail";

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

  it("points the runtime scene at the bundled blackhole portal asset", () => {
    expect(BLACKHOLE_PORTAL_ASSET_PATH).toBe(
      "/models/blackhole_pixel_pass_3.glb",
    );
  });

  it("builds a procedural blackhole portal fallback", () => {
    const portal = createBlackholePortalFallback();

    expect(portal.name).toBe("blackhole-portal-fallback");
    expect(portal.children.length).toBeGreaterThan(2);
    expect(
      portal.children.every((child) => child instanceof THREE.Mesh),
    ).toBe(true);

    disposeObject(portal);
  });

  it("normalizes a blackhole portal model around the scene origin", () => {
    const model = new THREE.Group();
    const marker = new THREE.Mesh(new THREE.BoxGeometry(11, 2.3, 11));

    marker.position.set(4, -0.5, 3);
    model.add(marker);

    normalizeBlackholePortalForScene(model);
    model.updateMatrixWorld(true);

    const box = new THREE.Box3().setFromObject(model);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());

    expect(Math.max(size.x, size.z)).toBeCloseTo(2.9, 1);
    expect(center.x).toBeCloseTo(0, 1);
    expect(center.z).toBeCloseTo(0, 1);
  });

  it("keeps the imported blackhole portal blue face toward the stage camera", () => {
    const model = new THREE.Group();
    const marker = new THREE.Mesh(new THREE.BoxGeometry(11, 2.3, 11));

    model.add(marker);

    normalizeBlackholePortalForScene(model);
    const importedBlueFaceNormal = new THREE.Vector3(0, 1, 0).applyEuler(
      model.rotation,
    );

    expect(model.rotation.x).toBe(BLACKHOLE_PORTAL_ASSET_ROTATION_X);
    expect(model.rotation.z).toBe(BLACKHOLE_PORTAL_ASSET_ROTATION_Z);
    expect(importedBlueFaceNormal.x).toBeCloseTo(0);
    expect(importedBlueFaceNormal.y).toBeCloseTo(0);
    expect(importedBlueFaceNormal.z).toBeCloseTo(1);
  });

  it("keeps restored blackhole materials bright enough for the blue texture", () => {
    const material = new THREE.MeshStandardMaterial({
      color: "#000000",
      emissive: "#111111",
      emissiveIntensity: 0.2,
      roughness: 0.9,
    });
    const model = new THREE.Group();
    const portalMesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), material);

    material.name = "Blackhole_01";
    model.add(portalMesh);

    prepareBlackholePortalMaterialsForScene(model);

    expect(material.transparent).toBe(true);
    expect(material.color.getHexString()).toBe("ffffff");
    expect(material.emissive.getHexString()).toBe("ffffff");
    expect(material.emissiveIntensity).toBeGreaterThanOrEqual(1);
    expect(material.roughness).toBeLessThanOrEqual(0.46);

    disposeObject(model);
  });

  it("updates blackhole portal visibility and scale by phase input", () => {
    const portal = createBlackholePortalFallback();

    updateBlackholePortal(portal, {
      crashImpact: 0,
      entering: false,
      phase: "betting",
      phaseElapsed: 0,
      reducedMotion: true,
      time: 0,
      visible: false,
    });

    expect(portal.visible).toBe(false);

    updateBlackholePortal(portal, {
      crashImpact: 0,
      entering: true,
      phase: "entering",
      phaseElapsed: 0.9,
      reducedMotion: true,
      time: 1,
      visible: true,
    });

    expect(portal.visible).toBe(true);
    expect(portal.scale.x).toBeCloseTo(1.28, 2);

    disposeObject(portal);
  });

  it("gives the betting portal a smooth floating full-spin idle", () => {
    const portal = createBlackholePortalFallback();

    updateBlackholePortal(portal, {
      crashImpact: 0,
      entering: false,
      phase: "betting",
      phaseElapsed: 0,
      reducedMotion: false,
      time: 10,
      visible: true,
    });

    expect(portal.visible).toBe(true);
    expect(portal.rotation.z).toBeGreaterThan(Math.PI * 2);
    expect(Math.abs(portal.position.y)).toBeGreaterThan(0.01);
    expect(Math.hypot(portal.rotation.x, portal.rotation.y)).toBeGreaterThan(
      0.01,
    );

    disposeObject(portal);
  });

  it("slows the GLB portal animation while idling in betting", () => {
    const frameDelta = 1 / 60;

    expect(getBlackholePortalAnimationDelta("betting", frameDelta)).toBeLessThan(
      frameDelta * 0.5,
    );
    expect(getBlackholePortalAnimationDelta("entering", frameDelta)).toBe(
      frameDelta,
    );
  });

  it("creates and disposes the procedural wormhole tunnel", () => {
    const wormhole = createWormholeTunnel();

    expect(wormhole.group.name).toBe("wormhole-tunnel");
    expect(wormhole.group.children.length).toBeGreaterThan(5);
    expect(wormhole.rings.length).toBe(7);
    expect(wormhole.streaks.length).toBe(24);

    expect(() => disposeObject(wormhole.group)).not.toThrow();
  });

  it("shows the wormhole only while running or crashed", () => {
    const wormhole = createWormholeTunnel();

    updateWormholeTunnel(wormhole, {
      crashImpact: 0,
      phase: "betting",
      progress: 0,
      reducedMotion: true,
      time: 0,
    });
    expect(wormhole.group.visible).toBe(false);

    updateWormholeTunnel(wormhole, {
      crashImpact: 0,
      phase: "running",
      progress: 0.5,
      reducedMotion: true,
      time: 2,
    });
    expect(wormhole.group.visible).toBe(true);
    expect(
      (wormhole.rings[0].material as THREE.LineBasicMaterial).color.getHexString(),
    ).toBe("22d3ee");

    updateWormholeTunnel(wormhole, {
      crashImpact: 0.8,
      phase: "crashed",
      progress: 1,
      reducedMotion: true,
      time: 3,
    });
    expect(wormhole.group.visible).toBe(true);
    expect(
      (wormhole.rings[0].material as THREE.LineBasicMaterial).color.getHexString(),
    ).toBe("fb7185");

    disposeObject(wormhole.group);
  });

  it("builds an edge-mounted dynamic growth guide that reveals from the frame", () => {
    const trail = createTimeCarTrail();
    const camera = new THREE.PerspectiveCamera(42, 1.2, 0.1, 100);

    camera.position.set(0, 0, 0);
    camera.lookAt(0, 0, -1);
    camera.updateMatrixWorld(true);

    expect(trail.group.name).toBe("time-car-growth-guide");
    expect(trail.ribbon.name).toBe("time-car-growth-guide-area");
    expect(trail.curve.name).toBe("time-car-growth-guide-curve");
    expect(trail.axisLabels.name).toBe("time-car-growth-guide-axis-labels");
    expect(trail.multiplierPillar.name).toBe(
      "time-car-growth-guide-multiplier-pillar",
    );
    expect(trail.multiplierPillar.visible).toBe(false);
    expect(trail.currentMultiplierGuide.name).toBe(
      "time-car-growth-guide-current-multiplier-guide",
    );
    expect(trail.currentMultiplierLabel.name).toBe(
      "time-car-growth-guide-current-multiplier-label",
    );
    expect(trail.timeAxis.name).toBe("time-car-growth-guide-time-axis");
    expect(trail.axisReveal.name).toBe("time-car-growth-guide-axis-reveal");
    expect(
      trail.axisLabels.children.map((label) => label.userData.labelText),
    ).toEqual(
      expect.arrayContaining(["1×", "1.50×", "2×", "2.50×"]),
    );
    expect(trail.group.visible).toBe(false);

    const firstTrailState = updateTimeCarTrail(trail, {
      camera,
      reducedMotion: true,
      time: 2,
      trail: {
        axisRevealProgress: 0.25,
        carPosition: [0.35, 0.25, -4],
        elapsedSeconds: 4.2,
        height: 0.82,
        intensity: 0.7,
        multiplier: 1.82,
        progress: 0.64,
        tone: "boost",
        visible: true,
        width: 2.35,
      },
    });

    expect(trail.group.visible).toBe(true);
    expect(trail.group.position.x).toBeLessThan(0);
    expect(
      (trail.multiplierPillar.material as THREE.MeshBasicMaterial).opacity,
    ).toBe(0);
    const firstAxisTicks = trail.axisTicks.geometry.getAttribute(
      "position",
    ) as THREE.BufferAttribute;
    const firstYAxisEndpoint = new THREE.Vector3().fromBufferAttribute(
      firstAxisTicks,
      3,
    );

    expect(firstYAxisEndpoint.y).toBeGreaterThan(1.8);
    expect(trail.axisLabels.children[3].position.y).toBeCloseTo(
      firstYAxisEndpoint.y,
    );
    expect(trail.group.position.x).toBeLessThan(-1.25);
    expect(trail.group.position.y).toBeLessThan(-0.9);
    expect(trail.axisReveal.position.x).toBeLessThan(0);
    expect(trail.axisReveal.position.y).toBeLessThan(0);
    expect(
      trail.axisLabels.children.map((label) => label.userData.labelText),
    ).toEqual(expect.arrayContaining(["1×", "1.50×", "2×", "2.50×", "4s"]));
    const firstGuidePosition = trail.group.position.clone();
    const firstAxisPosition = Array.from(
      (trail.timeAxis.geometry.getAttribute("position") as THREE.BufferAttribute)
        .array,
    );
    const firstLabelPosition = trail.axisLabels.children[0].position.clone();
    const firstCurvePosition = trail.curve.geometry.getAttribute(
      "position",
    ) as THREE.BufferAttribute;
    const firstCurveEndpoint = new THREE.Vector3().fromBufferAttribute(
      firstCurvePosition,
      firstCurvePosition.count - 1,
    );

    expect(firstTrailState?.carAnchor[0]).toBeCloseTo(
      trail.group.position.x +
        trail.axisReveal.position.x +
        firstCurveEndpoint.x * trail.axisReveal.scale.x,
      3,
    );
    expect(firstTrailState?.carAnchor[1]).toBeCloseTo(
      trail.group.position.y +
        trail.axisReveal.position.y +
        firstCurveEndpoint.y * trail.axisReveal.scale.y,
      3,
    );
    expect(firstTrailState?.tangentAngle).toBeGreaterThan(0);
    expect(
      (trail.curve.material as THREE.LineBasicMaterial).color.getHexString(),
    ).toBe("22d3ee");
    expect(
      (trail.ribbon.material as THREE.MeshBasicMaterial).opacity,
    ).toBeGreaterThan(0.12);
    expect(
      (trail.ribbon.material as THREE.MeshBasicMaterial).opacity,
    ).toBeGreaterThan(0.02);

    const secondTrailState = updateTimeCarTrail(trail, {
      camera,
      reducedMotion: true,
      time: 3,
      trail: {
        axisRevealProgress: 1,
        carPosition: [0.9, 0.68, -4],
        elapsedSeconds: 12.4,
        height: 1.08,
        intensity: 1,
        multiplier: 8.4,
        progress: 1,
        tone: "crash",
        visible: true,
        width: 2.35,
      },
    });

    const secondCurveEndpoint = new THREE.Vector3().fromBufferAttribute(
      trail.curve.geometry.getAttribute("position") as THREE.BufferAttribute,
      firstCurvePosition.count - 1,
    );

    expect(trail.group.position.toArray()).toEqual(
      firstGuidePosition.toArray(),
    );
    expect(
      Array.from(
        (trail.timeAxis.geometry.getAttribute(
          "position",
        ) as THREE.BufferAttribute).array,
      ),
    ).toEqual(firstAxisPosition);
    expect(trail.axisLabels.children[0].position.toArray()).toEqual(
      firstLabelPosition.toArray(),
    );
    expect(trail.axisReveal.position.x).toBeCloseTo(0);
    expect(trail.axisReveal.position.y).toBeCloseTo(0);
    expect(
      trail.axisLabels.children.map((label) => label.userData.labelText),
    ).toEqual(expect.arrayContaining(["14s"]));
    expect(trail.currentMultiplierLabel.userData.labelText).toBe("8.40×");
    expect(secondCurveEndpoint.x).toBeGreaterThan(firstCurveEndpoint.x);
    expect(secondCurveEndpoint.y).toBeGreaterThan(firstCurveEndpoint.y);
    expect(secondTrailState?.carAnchor[0]).toBeGreaterThan(
      firstTrailState?.carAnchor[0] ?? 0,
    );
    expect(secondTrailState?.carAnchor[1]).toBeGreaterThan(
      firstTrailState?.carAnchor[1] ?? 0,
    );
    expect(
      (trail.curve.material as THREE.LineBasicMaterial).color.getHexString(),
    ).toBe("fb7185");
    expect(
      (trail.particles.material as THREE.PointsMaterial).opacity,
    ).toBeGreaterThan(0.3);

    disposeObject(trail.group);
  });

  it("keeps the trail endpoint inside the right edge after ten seconds", () => {
    const trail = createTimeCarTrail();
    const camera = new THREE.PerspectiveCamera(42, 1.2, 0.1, 100);

    camera.position.set(0, 0, 0);
    camera.lookAt(0, 0, -1);
    camera.updateMatrixWorld(true);

    const tenSecondState = updateTimeCarTrail(trail, {
      camera,
      reducedMotion: true,
      time: 10,
      trail: {
        axisRevealProgress: 1,
        carPosition: [0, 0, -4],
        elapsedSeconds: 10,
        height: 0.92,
        intensity: 0.8,
        multiplier: 1.82,
        progress: 1,
        tone: "boost",
        visible: true,
        width: 2.35,
      },
    });

    const laterStates = [10.4, 10.9, 11.1, 12.4].map((elapsedSeconds) =>
      updateTimeCarTrail(trail, {
        camera,
        reducedMotion: true,
        time: elapsedSeconds,
        trail: {
          axisRevealProgress: 1,
          carPosition: [0, 0, -4],
          elapsedSeconds,
          height: 0.92,
          intensity: 0.8,
          multiplier: 1.82,
          progress: 1,
          tone: "boost",
          visible: true,
          width: 2.35,
        },
      }),
    );
    const timeAxisPosition = trail.timeAxis.geometry.getAttribute(
      "position",
    ) as THREE.BufferAttribute;
    const timeAxisEndpoint = new THREE.Vector3().fromBufferAttribute(
      timeAxisPosition,
      1,
    );
    const guideOrigin = trail.group.position.x + trail.axisReveal.position.x;
    const rightGuideEdge =
      guideOrigin + timeAxisEndpoint.x * trail.axisReveal.scale.x;

    expect(
      ((tenSecondState?.carAnchor[0] ?? 0) - guideOrigin) /
        (rightGuideEdge - guideOrigin),
    ).toBeLessThanOrEqual(0.91);
    const normalizedPositions = [
      tenSecondState,
      ...laterStates,
    ].map(
      (state) =>
        ((state?.carAnchor[0] ?? 0) - guideOrigin) /
        (rightGuideEdge - guideOrigin),
    );

    for (const normalizedPosition of normalizedPositions) {
      expect(normalizedPosition).toBeLessThanOrEqual(0.91);
    }

    for (let index = 1; index < normalizedPositions.length; index += 1) {
      expect(normalizedPositions[index]).toBeGreaterThanOrEqual(
        normalizedPositions[index - 1] - 0.001,
      );
    }

    expect(laterStates[0]?.edgeHoldProgress).toBeGreaterThan(0);
    expect(laterStates[3]?.edgeHoldProgress).toBeGreaterThan(
      laterStates[0]?.edgeHoldProgress ?? 0,
    );
    expect(
      trail.axisLabels.children.map((label) => label.userData.labelText),
    ).toEqual(expect.arrayContaining(["14s"]));

    disposeObject(trail.group);
  });

  it("shows the current multiplier on the y axis with a subtle guide line", () => {
    const trail = createTimeCarTrail();
    const camera = new THREE.PerspectiveCamera(42, 1.2, 0.1, 100);

    camera.position.set(0, 0, 0);
    camera.lookAt(0, 0, -1);
    camera.updateMatrixWorld(true);

    const trailState = updateTimeCarTrail(trail, {
      camera,
      reducedMotion: true,
      time: 6,
      trail: {
        axisRevealProgress: 1,
        carPosition: [0, 0, -4],
        elapsedSeconds: 6,
        height: 0.92,
        intensity: 0.8,
        multiplier: 2.4,
        progress: 1,
        tone: "boost",
        visible: true,
        width: 2.35,
      },
    });
    const guidePosition = trail.currentMultiplierGuide.geometry.getAttribute(
      "position",
    ) as THREE.BufferAttribute;
    const guideStart = new THREE.Vector3().fromBufferAttribute(guidePosition, 0);
    const guideEnd = new THREE.Vector3().fromBufferAttribute(guidePosition, 1);
    const curvePosition = trail.curve.geometry.getAttribute(
      "position",
    ) as THREE.BufferAttribute;
    const curveMidpoint = new THREE.Vector3().fromBufferAttribute(
      curvePosition,
      Math.floor(curvePosition.count / 2),
    );
    const curveEndpoint = new THREE.Vector3().fromBufferAttribute(
      curvePosition,
      curvePosition.count - 1,
    );
    const carAnchorY =
      (trailState?.carAnchor[1] ?? 0) -
      trail.group.position.y -
      trail.axisReveal.position.y;

    expect(trail.currentMultiplierLabel.userData.labelText).toBe("2.40×");
    expect(trail.currentMultiplierLabel.scale.x).toBeGreaterThan(
      trail.axisLabels.children[0].scale.x,
    );
    expect(guideStart.x).toBeCloseTo(0);
    expect(guideStart.y).toBeCloseTo(carAnchorY, 3);
    expect(guideEnd.x).toBeGreaterThan(guideStart.x);
    expect(guideEnd.y).toBeCloseTo(carAnchorY, 3);
    expect(curveMidpoint.y / curveEndpoint.y).toBeLessThan(0.13);

    disposeObject(trail.group);
  });

  it("places a 1.90x running point in the upper-middle of the 2.50x y axis", () => {
    const trail = createTimeCarTrail();
    const camera = new THREE.PerspectiveCamera(42, 1.2, 0.1, 100);

    camera.position.set(0, 0, 0);
    camera.lookAt(0, 0, -1);
    camera.updateMatrixWorld(true);

    const trailState = updateTimeCarTrail(trail, {
      camera,
      reducedMotion: true,
      time: 6,
      trail: {
        axisRevealProgress: 1,
        carPosition: [0, 0, -4],
        elapsedSeconds: 6,
        height: 0.92,
        intensity: 0.8,
        multiplier: 1.9,
        progress: 1,
        tone: "boost",
        visible: true,
        width: 2.35,
      },
    });
    const axisTicks = trail.axisTicks.geometry.getAttribute(
      "position",
    ) as THREE.BufferAttribute;
    const yAxisTop = new THREE.Vector3().fromBufferAttribute(axisTicks, 3);
    const carAnchorY =
      (trailState?.carAnchor[1] ?? 0) -
      trail.group.position.y -
      trail.axisReveal.position.y;
    const normalizedY = carAnchorY / yAxisTop.y;

    expect(
      trail.axisLabels.children.map((label) => label.userData.labelText),
    ).toEqual(expect.arrayContaining(["1×", "1.50×", "2×", "2.50×"]));
    expect(trail.currentMultiplierLabel.userData.labelText).toBe("1.90×");
    expect(normalizedY).toBeGreaterThan(0.57);
    expect(normalizedY).toBeLessThan(0.63);

    disposeObject(trail.group);
  });

  it("keeps a fixed 2.50x multiplier axis before the initial y limit", () => {
    const trail = createTimeCarTrail();
    const camera = new THREE.PerspectiveCamera(42, 1.2, 0.1, 100);

    camera.position.set(0, 0, 0);
    camera.lookAt(0, 0, -1);
    camera.updateMatrixWorld(true);

    const beforeTwoState = updateTimeCarTrail(trail, {
      camera,
      reducedMotion: true,
      time: 6,
      trail: {
        axisRevealProgress: 1,
        carPosition: [0, 0, -4],
        elapsedSeconds: 6,
        height: 0.92,
        intensity: 0.8,
        multiplier: 1.999,
        progress: 1,
        tone: "boost",
        visible: true,
        width: 2.35,
      },
    });

    expect(
      trail.axisLabels.children.map((label) => label.userData.labelText),
    ).toEqual(expect.arrayContaining(["1×", "1.50×", "2×", "2.50×"]));

    const afterTwoState = updateTimeCarTrail(trail, {
      camera,
      reducedMotion: true,
      time: 6,
      trail: {
        axisRevealProgress: 1,
        carPosition: [0, 0, -4],
        elapsedSeconds: 6,
        height: 0.92,
        intensity: 0.8,
        multiplier: 2.001,
        progress: 1,
        tone: "boost",
        visible: true,
        width: 2.35,
      },
    });
    const afterTwoLabels = trail.axisLabels.children.map(
      (label) => label.userData.labelText,
    );
    const atThreeState = updateTimeCarTrail(trail, {
      camera,
      reducedMotion: true,
      time: 8,
      trail: {
        axisRevealProgress: 1,
        carPosition: [0, 0, -4],
        elapsedSeconds: 8,
        height: 0.92,
        intensity: 0.8,
        multiplier: 3.009,
        progress: 1,
        tone: "boost",
        visible: true,
        width: 2.35,
      },
    });
    const axisTicks = trail.axisTicks.geometry.getAttribute(
      "position",
    ) as THREE.BufferAttribute;
    const yAxisTop = new THREE.Vector3().fromBufferAttribute(axisTicks, 3);
    const afterTwoAnchorY =
      (afterTwoState?.carAnchor[1] ?? 0) -
      trail.group.position.y -
      trail.axisReveal.position.y;
    const atThreeAnchorY =
      (atThreeState?.carAnchor[1] ?? 0) -
      trail.group.position.y -
      trail.axisReveal.position.y;

    expect(
      afterTwoLabels,
    ).toEqual(expect.arrayContaining(["1×", "1.50×", "2×", "2.50×"]));
    expect(afterTwoState?.carAnchor[1]).toBeGreaterThan(
      beforeTwoState?.carAnchor[1] ?? 0,
    );
    expect(afterTwoAnchorY / yAxisTop.y).toBeCloseTo(2 / 3, 2);
    expect(atThreeAnchorY / yAxisTop.y).toBeLessThanOrEqual(0.91);
    expect(trail.currentMultiplierLabel.userData.labelText).toBe("3×");

    disposeObject(trail.group);
  });

  it("keeps the y-axis transition continuous when the multiplier crosses the initial limit", () => {
    const trail = createTimeCarTrail();
    const camera = new THREE.PerspectiveCamera(42, 1.2, 0.1, 100);

    camera.position.set(0, 0, 0);
    camera.lookAt(0, 0, -1);
    camera.updateMatrixWorld(true);

    const normalizedPositions = [2.34, 2.35, 2.36, 2.5, 2.8].map(
      (multiplier) => {
        const trailState = updateTimeCarTrail(trail, {
          camera,
          reducedMotion: true,
          time: 6,
          trail: {
            axisRevealProgress: 1,
            carPosition: [0, 0, -4],
            elapsedSeconds: 8,
            height: 0.92,
            intensity: 0.8,
            multiplier,
            progress: 1,
            tone: "boost",
            visible: true,
            width: 2.35,
          },
        });
        const axisTicks = trail.axisTicks.geometry.getAttribute(
          "position",
        ) as THREE.BufferAttribute;
        const yAxisTop = new THREE.Vector3().fromBufferAttribute(axisTicks, 3);
        const carAnchorY =
          (trailState?.carAnchor[1] ?? 0) -
          trail.group.position.y -
          trail.axisReveal.position.y;

        return carAnchorY / yAxisTop.y;
      },
    );

    for (const normalizedPosition of normalizedPositions) {
      expect(normalizedPosition).toBeLessThanOrEqual(0.91);
    }

    for (let index = 1; index < normalizedPositions.length; index += 1) {
      expect(normalizedPositions[index]).toBeGreaterThanOrEqual(
        normalizedPositions[index - 1] - 0.02,
      );
    }

    disposeObject(trail.group);
  });

  it("keeps sub-cent multiplier motion smooth while axis labels stay floored", () => {
    const trail = createTimeCarTrail();
    const camera = new THREE.PerspectiveCamera(42, 1.2, 0.1, 100);

    camera.position.set(0, 0, 0);
    camera.lookAt(0, 0, -1);
    camera.updateMatrixWorld(true);

    const firstState = updateTimeCarTrail(trail, {
      camera,
      reducedMotion: true,
      time: 6,
      trail: {
        axisRevealProgress: 1,
        carPosition: [0, 0, -4],
        elapsedSeconds: 6,
        height: 0.92,
        intensity: 0.8,
        multiplier: 2.001,
        progress: 1,
        tone: "boost",
        visible: true,
        width: 2.35,
      },
    });
    const firstLabels = trail.axisLabels.children.map(
      (label) => label.userData.labelText,
    );

    const secondState = updateTimeCarTrail(trail, {
      camera,
      reducedMotion: true,
      time: 6.05,
      trail: {
        axisRevealProgress: 1,
        carPosition: [0, 0, -4],
        elapsedSeconds: 6.05,
        height: 0.92,
        intensity: 0.8,
        multiplier: 2.009,
        progress: 1,
        tone: "boost",
        visible: true,
        width: 2.35,
      },
    });

    expect(trail.axisLabels.children.map((label) => label.userData.labelText)).toEqual(
      firstLabels,
    );
    expect(secondState?.carAnchor[1]).toBeGreaterThan(
      firstState?.carAnchor[1] ?? 0,
    );

    disposeObject(trail.group);
  });

  it("pins the multiplier axis top to the floored current multiplier after 4x", () => {
    const trail = createTimeCarTrail();
    const camera = new THREE.PerspectiveCamera(42, 1.2, 0.1, 100);

    camera.position.set(0, 0, 0);
    camera.lookAt(0, 0, -1);
    camera.updateMatrixWorld(true);

    const trailState = updateTimeCarTrail(trail, {
      camera,
      reducedMotion: true,
      time: 7,
      trail: {
        axisRevealProgress: 1,
        carPosition: [0, 0, -4],
        elapsedSeconds: 7,
        height: 0.92,
        intensity: 0.8,
        multiplier: 5.459,
        progress: 1,
        tone: "boost",
        visible: true,
        width: 2.35,
      },
    });
    const axisTicks = trail.axisTicks.geometry.getAttribute(
      "position",
    ) as THREE.BufferAttribute;
    const yAxisTop = new THREE.Vector3().fromBufferAttribute(axisTicks, 3);
    const carAnchorY =
      (trailState?.carAnchor[1] ?? 0) -
      trail.group.position.y -
      trail.axisReveal.position.y;

    expect(trail.currentMultiplierLabel.userData.labelText).toBe("5.45×");
    expect(
      trail.axisLabels.children.map((label) => label.userData.labelText),
    ).toEqual(expect.arrayContaining(["1×", "0s", "7s", "10s"]));
    expect(carAnchorY / yAxisTop.y).toBeLessThanOrEqual(0.91);
    expect(carAnchorY / yAxisTop.y).toBeGreaterThan(0.86);

    disposeObject(trail.group);
  });

  it("uses the fire-detail model while entering, running and crashed", () => {
    expect(usesRunningTimeCarAsset("entering")).toBe(true);
    expect(usesRunningTimeCarAsset("running")).toBe(true);
    expect(usesRunningTimeCarAsset("crashed")).toBe(true);
    expect(usesRunningTimeCarAsset("betting")).toBe(false);
    expect(usesRunningTimeCarAsset("idle")).toBe(false);
  });

  it("shows the 3D portal only before and during entry", () => {
    expect(getPortalVisibilityForPhase("idle")).toBe(false);
    expect(getPortalVisibilityForPhase("betting")).toBe(true);
    expect(getPortalVisibilityForPhase("entering")).toBe(true);
    expect(getPortalVisibilityForPhase("running")).toBe(false);
    expect(getPortalVisibilityForPhase("crashed")).toBe(false);
  });

  it("shows the procedural wormhole while running and crashed", () => {
    expect(getWormholeVisibilityForPhase("idle")).toBe(false);
    expect(getWormholeVisibilityForPhase("betting")).toBe(false);
    expect(getWormholeVisibilityForPhase("entering")).toBe(false);
    expect(getWormholeVisibilityForPhase("running")).toBe(true);
    expect(getWormholeVisibilityForPhase("crashed")).toBe(true);
  });

  it("moves the running camera subtly with the car progress", () => {
    const earlyRunningFrame = getCrashFlightStoryboard({
      cameraAspect: 1.2,
      phase: "running",
      phaseElapsed: 0.4,
      reducedMotion: true,
      round: {
        currentMultiplierBp: 12000,
        status: "RUNNING",
      } as DashboardRound,
      time: 2,
    });
    const lateRunningFrame = getCrashFlightStoryboard({
      cameraAspect: 1.2,
      phase: "running",
      phaseElapsed: 0.4,
      reducedMotion: true,
      round: {
        currentMultiplierBp: 50000,
        status: "RUNNING",
      } as DashboardRound,
      time: 2,
    });

    expect(lateRunningFrame.car.position[0]).toBeGreaterThan(
      earlyRunningFrame.car.position[0],
    );
    expect(lateRunningFrame.camera.lookAt[0]).toBeGreaterThan(
      earlyRunningFrame.camera.lookAt[0],
    );
    expect(lateRunningFrame.camera.position[0]).toBeGreaterThan(
      earlyRunningFrame.camera.position[0],
    );
  });

  it("adds a stronger camera kick at the start of running", () => {
    const round = {
      currentMultiplierBp: 16000,
      status: "RUNNING",
    } as DashboardRound;
    const time = 3.2;
    const launchFrame = getCrashFlightStoryboard({
      cameraAspect: 1.2,
      phase: "running",
      phaseElapsed: 0.12,
      reducedMotion: false,
      round,
      time,
    });
    const launchStillFrame = getCrashFlightStoryboard({
      cameraAspect: 1.2,
      phase: "running",
      phaseElapsed: 0.12,
      reducedMotion: true,
      round,
      time,
    });
    const steadyFrame = getCrashFlightStoryboard({
      cameraAspect: 1.2,
      phase: "running",
      phaseElapsed: 1.2,
      reducedMotion: false,
      round,
      time,
    });
    const steadyStillFrame = getCrashFlightStoryboard({
      cameraAspect: 1.2,
      phase: "running",
      phaseElapsed: 1.2,
      reducedMotion: true,
      round,
      time,
    });
    const launchCameraOffset = Math.hypot(
      launchFrame.camera.position[0] - launchStillFrame.camera.position[0],
      launchFrame.camera.position[1] - launchStillFrame.camera.position[1],
    );
    const steadyCameraOffset = Math.hypot(
      steadyFrame.camera.position[0] - steadyStillFrame.camera.position[0],
      steadyFrame.camera.position[1] - steadyStillFrame.camera.position[1],
    );

    expect(steadyCameraOffset).toBeGreaterThan(0);
    expect(launchCameraOffset).toBeGreaterThan(steadyCameraOffset * 1.8);
  });

  it("calculates portal, wormhole and crash flare storyboard frames", () => {
    const bettingFrame = getCrashFlightStoryboard({
      cameraAspect: 1.2,
      phase: "betting",
      phaseElapsed: 0,
      reducedMotion: true,
      round: { status: "BETTING" } as DashboardRound,
      time: 0,
    });

    expect(bettingFrame.portalVisible).toBe(true);
    expect(bettingFrame.car.position[0]).toBeLessThan(
      bettingFrame.portal.position[0],
    );
    expect(bettingFrame.wormholeActive).toBe(false);
    expect(bettingFrame.trail.visible).toBe(false);
    expect(bettingFrame.car.scale).toEqual([1, 1, 1]);

    const enteringFrame = getCrashFlightStoryboard({
      cameraAspect: 1.2,
      phase: "entering",
      phaseElapsed: 0.9,
      reducedMotion: true,
      round: { status: "RUNNING" } as DashboardRound,
      time: 2,
    });

    expect(enteringFrame.trail.visible).toBe(false);
    expect(enteringFrame.car).toMatchObject({ followTrail: false });
    expect(enteringFrame.car.position[0]).toBeCloseTo(
      enteringFrame.portal.position[0],
      2,
    );

    const runningFrame = getCrashFlightStoryboard({
      cameraAspect: 1.2,
      phase: "running",
      phaseElapsed: 0.35,
      reducedMotion: false,
      round: {
        currentMultiplierBp: 16000,
        status: "RUNNING",
      } as DashboardRound,
      time: 3,
    });

    expect(runningFrame.portalVisible).toBe(false);
    expect(runningFrame.wormholeActive).toBe(true);
    expect(runningFrame.trail.visible).toBe(true);
    expect(runningFrame.trail.tone).toBe("boost");
    expect(runningFrame.trail.carPosition).toEqual(runningFrame.car.position);
    expect(runningFrame.car).toMatchObject({ followTrail: true });
    expect(runningFrame.car.scale[0]).toBeLessThan(bettingFrame.car.scale[0]);
    expect(runningFrame.car.scale[0]).toBeLessThan(0.6);
    expect(runningFrame.trail.axisRevealProgress).toBeGreaterThan(0);
    expect(runningFrame.trail.axisRevealProgress).toBeLessThan(1);
    expect(runningFrame.trail.elapsedSeconds).toBe(0.35);
    expect(runningFrame.trail.multiplier).toBe(1.6);
    expect(runningFrame.trail.width).toBeGreaterThan(2.8);

    const smoothNow = new Date("2026-06-01T12:00:20.000Z");
    const smoothRunningFrame = getCrashFlightStoryboard({
      cameraAspect: 1.2,
      now: smoothNow,
      phase: "running",
      phaseElapsed: 0.35,
      reducedMotion: true,
      round: {
        currentMultiplierBp: 20000,
        multiplierBaseBp: 10000,
        multiplierGrowthRateBpPerSecond: 500,
        startedAt: "2026-06-01T12:00:00.000Z",
        status: "RUNNING",
      } as DashboardRound,
      time: 3,
    });

    expect(smoothRunningFrame.trail.multiplier).toBeCloseTo(2.7182);

    const longRunningFrame = getCrashFlightStoryboard({
      cameraAspect: 1.2,
      phase: "running",
      phaseElapsed: 0.2,
      reducedMotion: true,
      round: {
        currentMultiplierBp: 73900,
        startedAt: new Date(Date.now() - 12_000).toISOString(),
        status: "RUNNING",
      } as DashboardRound,
      time: 5,
    });

    expect(longRunningFrame.trail.elapsedSeconds).toBeGreaterThan(10);

    const crashedFrame = getCrashFlightStoryboard({
      cameraAspect: 1.2,
      phase: "crashed",
      phaseElapsed: 0.2,
      reducedMotion: true,
      round: { status: "CRASHED" } as DashboardRound,
      time: 4,
    });

    expect(crashedFrame.portalVisible).toBe(false);
    expect(crashedFrame.wormholeActive).toBe(true);
    expect(crashedFrame.trail.visible).toBe(true);
    expect(crashedFrame.trail.tone).toBe("crash");
    expect(crashedFrame.trail.carPosition).toEqual(crashedFrame.car.position);
    expect(crashedFrame.car).toMatchObject({ followTrail: true });
    expect(crashedFrame.car.scale).toEqual(runningFrame.car.scale);
    expect(crashedFrame.showRunningCar).toBe(true);
    expect(crashedFrame.trail.axisRevealProgress).toBe(1);
    expect(crashedFrame.redFlashOpacity).toBeGreaterThan(0.18);
    expect("roadOpacity" in crashedFrame).toBe(false);
  });

  it("calculates scene progress and easing helpers for storyboard motion", () => {
    const now = new Date("2026-06-01T12:00:05.000Z");
    const runningRound = {
      bettingEndsAt: "2026-06-01T12:00:00.000Z",
      currentMultiplierBp: 21000,
      multiplierBaseBp: 10000,
      multiplierCurve: "EXPONENTIAL",
      multiplierGrowthRateBpPerSecond: 500,
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

    expect(fire.visible).toBe(true);
    expect(fire.scale.x).toBeGreaterThan(1);
    expect(body.scale.x).toBe(1);
    expect(
      (fire.material as THREE.MeshStandardMaterial).opacity,
    ).toBeGreaterThan(0.72);

    animateTimeCarFire(car, 0.21, false);

    expect(fire.visible).toBe(false);
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

  it("creates and disposes the glass arena stage resources", () => {
    const stage = createFlightStage();

    expect(stage.group.children.length).toBeGreaterThan(4);
    expect(stage.group.children).not.toContain(stage.road);
    expect(stage.engineLight.intensity).toBeGreaterThan(0);
    expect(stage.redFlash.material.opacity).toBe(0);

    expect(() => disposeObject(stage.group)).not.toThrow();
  });
});
