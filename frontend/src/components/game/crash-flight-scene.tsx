import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { FlightFallback } from "./crash-flight-fallback";
import { createFlightStage, disposeObject } from "./crash-flight-stage";
import {
  easeInOutCubic,
  easeOutCubic,
  getCameraShake,
  getSceneProgress,
  getTargetFov,
  lerp,
  type StageAnimationPhase,
  usesRunningTimeCarAsset,
} from "./crash-flight-motion";
import { createGrowthTrail, updateGrowthTrail } from "./growth-trail";
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

const ENTERING_BLACK_HOLE_SECONDS = 1.4;

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
    let frameId = 0;
    let disposed = false;
    let activePhase = stateRef.current.animationPhase;
    let phaseStartedAt = performance.now();

    renderer.setClearColor(0x000000, 0);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    renderer.shadowMap.enabled = true;
    car.name = "time-car-variant-root";
    parkedCar.name = "time-car-model-parked";
    runningCar.name = "time-car-model-running";
    car.add(parkedCar, runningCar);
    scene.add(stage.group, trail.group, car);
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
      const showRunningCar = usesRunningTimeCarAsset(phase);
      const crashed = phase === "crashed";
      const entering = phase === "entering";
      const running = phase === "running";
      const betting = current.round?.status === "BETTING";
      const nowMs = performance.now();

      if (phase !== activePhase) {
        activePhase = phase;
        phaseStartedAt = nowMs;
      }

      parkedCar.visible = !showRunningCar;
      runningCar.visible = showRunningCar;

      const phaseElapsed = (nowMs - phaseStartedAt) / 1000;
      const enteringProgress = Math.min(
        1,
        Math.max(0, phaseElapsed / ENTERING_BLACK_HOLE_SECONDS),
      );
      const crashImpact = crashed ? Math.max(0, 1 - phaseElapsed / 1.1) : 0;
      const progress = entering
        ? enteringProgress
        : getSceneProgress(current.round, new Date());
      const eased = easeOutCubic(progress);
      const time = performance.now() / 1000;
      animateTimeCarFire(runningCar, time, showRunningCar && !reducedMotion);
      const idle = Math.sin(time * 2.6) * 0.025;
      const compact = camera.aspect < 0.82;
      const parkedX = compact ? -0.96 : -2.28;
      const parkedY = compact ? -0.58 : -0.82;
      const portalX = compact ? 1.04 : 1.72;
      const portalY = compact ? 0.18 : 0.12;
      const warpX = compact ? -0.08 : 0.22;
      const warpY = compact ? -0.18 : -0.2;
      const warpAdvance = compact ? 0.32 : 0.48;
      const warpRise = compact ? 0.46 : 0.58;
      const shake = reducedMotion
        ? { x: 0, y: 0 }
        : getCameraShake(time, running ? 0.028 : crashImpact * 0.1);

      if (entering) {
        car.position.set(
          lerp(parkedX, portalX, eased),
          lerp(parkedY, portalY, easeInOutCubic(progress)) +
            (reducedMotion ? 0 : idle),
          lerp(-0.14, -0.78, eased),
        );
        car.rotation.set(
          lerp(-0.06, 0.1, eased),
          lerp(0.24, 0.72, eased),
          lerp(-0.08, 0.32, eased),
        );
      } else if (running || crashed) {
        const speedJitter = reducedMotion ? 0 : Math.sin(time * 22) * 0.035;

        car.position.set(
          warpX + eased * warpAdvance + Math.sin(time * 2.8) * 0.08,
          warpY + eased * warpRise + speedJitter,
          -0.82 - eased * 0.18,
        );
        car.rotation.set(
          0.1 + Math.sin(time * 6) * 0.025,
          0.62 + Math.sin(time * 3.2) * 0.08,
          0.32 + Math.sin(time * 9) * 0.05 + crashImpact * 0.18,
        );
      } else {
        car.position.set(parkedX, parkedY + (betting ? idle : 0), -0.14);
        car.rotation.set(-0.06, 0.24, -0.08);
      }

      stage.engineLight.intensity =
        running || entering ? 3 + Math.sin(time * 10) * 0.9 : 1.2;
      stage.redFlash.material.opacity = crashed
        ? 0.18 + crashImpact * 0.35 + Math.sin(time * 7) * 0.06
        : 0;
      stage.road.material.opacity = crashed ? 0.28 : running ? 0.18 : 0.52;
      updateGrowthTrail(
        trail,
        running || crashed || entering ? Math.max(progress, 0.15) : 0.02,
        crashed,
      );

      const cameraZoom = entering ? eased : running || crashed ? 1 : 0;
      const targetFov = getTargetFov({ crashed, eased, entering, running });
      const targetCamera = new THREE.Vector3(
        compact ? 0.1 + cameraZoom * 0.2 : 0.05 + cameraZoom * 0.34,
        compact ? 1.18 + cameraZoom * 0.02 : 1.18 + cameraZoom * 0.04,
        compact ? lerp(6.45, 5.25, cameraZoom) : lerp(5.55, 4.22, cameraZoom),
      );
      targetCamera.x += shake.x;
      targetCamera.y += shake.y;

      camera.position.lerp(targetCamera, reducedMotion ? 1 : 0.08);
      camera.fov = lerp(camera.fov, targetFov, reducedMotion ? 1 : 0.08);
      camera.updateProjectionMatrix();
      camera.lookAt(
        (compact ? 0.1 : 0.02) + cameraZoom * 0.22 + shake.x * 0.6,
        (compact ? 0.08 : 0.08) + cameraZoom * 0.2 + shake.y * 0.6,
        -0.42,
      );
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
