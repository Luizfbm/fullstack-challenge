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
      phaseElapsed: 1.4,
      reducedMotion: true,
      time: 1,
      visible: true,
    });

    expect(portal.visible).toBe(true);
    expect(portal.scale.x).toBeGreaterThan(1);

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

  it("builds a procedural time-car trail that shifts from boost to crash flare", () => {
    const trail = createTimeCarTrail();

    expect(trail.group.name).toBe("time-car-trail");
    expect(trail.ribbon.name).toBe("time-car-trail-ribbon");
    expect(trail.particles.name).toBe("time-car-trail-particles");
    expect(trail.group.visible).toBe(false);

    updateTimeCarTrail(trail, {
      carPosition: [0.4, 0.2, -1.1],
      carRotation: [0.1, 0.5, 0.2],
      reducedMotion: true,
      time: 2,
      trail: {
        intensity: 0.7,
        length: 2.2,
        spread: 0.34,
        tone: "boost",
        visible: true,
      },
    });

    expect(trail.group.visible).toBe(true);
    expect(trail.group.position.x).toBeCloseTo(0.4);
    expect(
      (trail.ribbon.material as THREE.MeshBasicMaterial).color.getHexString(),
    ).toBe("22d3ee");
    expect(
      (trail.ribbon.material as THREE.MeshBasicMaterial).opacity,
    ).toBeGreaterThan(0.25);

    updateTimeCarTrail(trail, {
      carPosition: [0.4, 0.2, -1.1],
      carRotation: [0.1, 0.5, 0.2],
      reducedMotion: true,
      time: 3,
      trail: {
        intensity: 1,
        length: 2.5,
        spread: 0.56,
        tone: "crash",
        visible: true,
      },
    });

    expect(
      (trail.ribbon.material as THREE.MeshBasicMaterial).color.getHexString(),
    ).toBe("fb7185");
    expect(
      (trail.particles.material as THREE.PointsMaterial).opacity,
    ).toBeGreaterThan(0.3);

    disposeObject(trail.group);
  });

  it("uses the fire-detail model only while entering or running", () => {
    expect(usesRunningTimeCarAsset("entering")).toBe(true);
    expect(usesRunningTimeCarAsset("running")).toBe(true);
    expect(usesRunningTimeCarAsset("betting")).toBe(false);
    expect(usesRunningTimeCarAsset("crashed")).toBe(false);
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

    const runningFrame = getCrashFlightStoryboard({
      cameraAspect: 1.2,
      phase: "running",
      phaseElapsed: 2,
      reducedMotion: true,
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
    expect(runningFrame.trail.length).toBeGreaterThan(2);

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

  it("creates and disposes the glass arena stage resources", () => {
    const stage = createFlightStage();

    expect(stage.group.children.length).toBeGreaterThan(4);
    expect(stage.group.children).not.toContain(stage.road);
    expect(stage.engineLight.intensity).toBeGreaterThan(0);
    expect(stage.redFlash.material.opacity).toBe(0);

    expect(() => disposeObject(stage.group)).not.toThrow();
  });
});
