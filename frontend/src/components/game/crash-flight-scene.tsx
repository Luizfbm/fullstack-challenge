import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { FlightFallback } from "./crash-flight-fallback";
import {
  createBlackholePortalFallback,
  loadBlackholePortalAsset,
  updateBlackholePortal,
} from "./blackhole-portal-model";
import { createFlightStage, disposeObject } from "./crash-flight-stage";
import {
  type StageAnimationPhase,
} from "./crash-flight-motion";
import { getCrashFlightStoryboard } from "./crash-flight-storyboard";
import { createGrowthTrail, updateGrowthTrail } from "./growth-trail";
import {
  createWormholeTunnel,
  updateWormholeTunnel,
} from "./wormhole-tunnel";
import {
  createTimeCarModel,
  loadTimeCarAsset,
  TIME_CAR_ASSET_PATH,
  TIME_CAR_RUNNING_ASSET_PATH,
} from "./time-car-model";
import { animateTimeCarFire } from "./time-car-fire";
import type { DashboardRound } from "./round-formatting";
export type { StageAnimationPhase } from "./crash-flight-motion";

type CrashFlightSceneProps = {
  animationPhase: StageAnimationPhase;
  isLoading: boolean;
  now: Date;
  round: DashboardRound | null;
};

type SceneState = {
  animationPhase: StageAnimationPhase;
  isLoading: boolean;
  now: Date;
  round: DashboardRound | null;
};

export function CrashFlightScene({
  animationPhase,
  isLoading,
  now,
  round,
}: CrashFlightSceneProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const stateRef = useRef<SceneState>({
    animationPhase,
    isLoading,
    now,
    round,
  });
  const [fallbackVisible, setFallbackVisible] = useState(false);

  useEffect(() => {
    stateRef.current = { animationPhase, isLoading, now, round };
  }, [animationPhase, isLoading, now, round]);

  useEffect(() => {
    const canvas = canvasRef.current;

    if (!canvas) {
      return;
    }

    let renderer: THREE.WebGLRenderer;

    try {
      renderer = new THREE.WebGLRenderer({
        alpha: true,
        antialias: true,
        canvas,
        preserveDrawingBuffer: true,
      });
    } catch {
      queueMicrotask(() => setFallbackVisible(true));
      return;
    }

    queueMicrotask(() => setFallbackVisible(false));

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    const stage = createFlightStage();
    const car = new THREE.Group();
    const parkedCar = createTimeCarModel();
    const runningCar = createTimeCarModel();
    const trail = createGrowthTrail();
    const portalRoot = new THREE.Group();
    let portal = createBlackholePortalFallback();
    const wormhole = createWormholeTunnel();
    let portalMixer: THREE.AnimationMixer | null = null;
    let frameId = 0;
    let disposed = false;
    let activePhase = stateRef.current.animationPhase;
    let phaseStartedAt = performance.now();
    const cameraTarget = new THREE.Vector3();

    renderer.setClearColor(0x000000, 0);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    renderer.shadowMap.enabled = true;
    car.name = "time-car-variant-root";
    parkedCar.name = "time-car-model-parked";
    runningCar.name = "time-car-model-running";
    portalRoot.name = "blackhole-portal-root";
    portalRoot.add(portal);
    car.add(parkedCar, runningCar);
    scene.add(stage.group, wormhole.group, portalRoot, trail.group, car);
    loadTimeCarAsset(parkedCar, TIME_CAR_ASSET_PATH, () => disposed).catch(
      () => {
        if (!disposed) {
          parkedCar.name = "time-car-model-parked-fallback";
        }
      },
    );
    loadTimeCarAsset(
      runningCar,
      TIME_CAR_RUNNING_ASSET_PATH,
      () => disposed,
    ).catch(() => {
      if (!disposed) {
        runningCar.name = "time-car-model-running-fallback";
      }
    });
    loadBlackholePortalAsset(undefined, () => disposed)
      .then((loadedPortal) => {
        if (disposed) {
          disposeObject(loadedPortal.group);
          return;
        }

        portalRoot.remove(portal);
        disposeObject(portal);
        portal = loadedPortal.group;
        portalMixer = loadedPortal.mixer;
        portalRoot.add(portal);
      })
      .catch(() => {
        if (!disposed) {
          portal.name = "blackhole-portal-fallback-active";
        }
      });
    camera.position.set(0.2, 1.12, 5.5);

    const resize = () => {
      const parent = canvas.parentElement;
      const rect = parent?.getBoundingClientRect();
      const width = Math.max(320, Math.floor(rect?.width ?? 760));
      const height = Math.max(320, Math.floor(rect?.height ?? 460));

      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    };

    const animate = () => {
      const current = stateRef.current;
      const phase = current.animationPhase;
      const nowMs = performance.now();

      if (phase !== activePhase) {
        activePhase = phase;
        phaseStartedAt = nowMs;
      }

      const phaseElapsed = (nowMs - phaseStartedAt) / 1000;
      const time = performance.now() / 1000;
      const frame = getCrashFlightStoryboard({
        cameraAspect: camera.aspect,
        phase,
        phaseElapsed,
        reducedMotion,
        round: current.round,
        time,
      });

      parkedCar.visible = !frame.showRunningCar;
      runningCar.visible = frame.showRunningCar;
      animateTimeCarFire(runningCar, time, frame.showRunningCar && !reducedMotion);
      car.position.set(...frame.car.position);
      car.rotation.set(...frame.car.rotation);
      portalRoot.position.set(...frame.portal.position);
      portalRoot.rotation.set(
        frame.portal.rotation[0],
        frame.portal.rotation[1],
        portalRoot.rotation.z,
      );
      updateBlackholePortal(portalRoot, {
        crashImpact: frame.crashImpact,
        entering: frame.entering,
        phaseElapsed,
        reducedMotion,
        time,
        visible: frame.portalVisible,
      });
      portalMixer?.update(reducedMotion ? 0 : 1 / 60);
      updateWormholeTunnel(wormhole, {
        crashImpact: frame.crashImpact,
        phase,
        progress: frame.progress,
        reducedMotion,
        time,
      });
      wormhole.group.position.set(...frame.wormholePosition);
      stage.engineLight.intensity = frame.engineLightIntensity;
      stage.redFlash.material.opacity = frame.redFlashOpacity;
      stage.road.material.opacity = frame.roadOpacity;
      updateGrowthTrail(trail, frame.trailProgress, frame.crashed);

      cameraTarget.set(...frame.camera.position);
      camera.position.lerp(cameraTarget, reducedMotion ? 1 : 0.08);
      camera.fov +=
        (frame.camera.targetFov - camera.fov) * (reducedMotion ? 1 : 0.08);
      camera.updateProjectionMatrix();
      camera.lookAt(...frame.camera.lookAt);
      renderer.render(scene, camera);
      frameId = requestAnimationFrame(animate);
    };

    resize();
    animate();
    window.addEventListener("resize", resize);

    return () => {
      disposed = true;
      cancelAnimationFrame(frameId);
      window.removeEventListener("resize", resize);
      disposeObject(scene);
      renderer.dispose();
    };
  }, []);

  return (
    <div className="absolute inset-0 z-10" data-testid="crash-flight-scene">
      <canvas
        aria-label="Cena 3D da nave temporal do Crash"
        className="h-full w-full"
        data-testid="crash-flight-canvas"
        ref={canvasRef}
      />
      {fallbackVisible ? <FlightFallback /> : null}
    </div>
  );
}
