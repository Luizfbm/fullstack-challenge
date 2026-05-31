import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { getRoundProgress } from "../../services/round-timing";
import { createFlightStage, disposeObject } from "./crash-flight-stage";
import { createGrowthTrail, updateGrowthTrail } from "./growth-trail";
import { createTimeCarModel } from "./time-car-model";
import type { DashboardRound } from "./round-formatting";

type CrashFlightSceneProps = {
  isLoading: boolean;
  now: Date;
  round: DashboardRound | null;
};

type SceneState = {
  isLoading: boolean;
  now: Date;
  round: DashboardRound | null;
};

export function CrashFlightScene({
  isLoading,
  now,
  round,
}: CrashFlightSceneProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const stateRef = useRef<SceneState>({ isLoading, now, round });
  const [fallbackVisible, setFallbackVisible] = useState(false);

  useEffect(() => {
    stateRef.current = { isLoading, now, round };
  }, [isLoading, now, round]);

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
    const car = createTimeCarModel();
    const trail = createGrowthTrail();
    let frameId = 0;

    renderer.setClearColor(0x000000, 0);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    renderer.shadowMap.enabled = true;
    scene.add(stage.group, trail.group, car);
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
      const status = current.round?.status;
      const crashed = status === "CRASHED" || status === "SETTLED";
      const running = status === "RUNNING";
      const betting = status === "BETTING";
      const progress = getSceneProgress(current.round, new Date());
      const eased = easeOutCubic(progress);
      const time = performance.now() / 1000;
      const idle = Math.sin(time * 2.6) * 0.025;
      const compact = camera.aspect < 0.82;
      const parkedX = compact ? -0.92 : -1.95;
      const parkedY = compact ? -0.58 : -0.82;
      const travelX = compact ? 2.42 : 3.65;
      const liftY = compact ? 2.05 : 2.42;

      if (running || crashed) {
        car.position.set(
          parkedX + eased * travelX,
          parkedY + Math.pow(eased, 1.26) * liftY + (reducedMotion ? 0 : idle),
          -0.15 - eased * 0.46,
        );
        car.rotation.set(
          -0.08 + eased * 0.14,
          0.22 + eased * 0.28,
          -0.1 + eased * 0.48,
        );
      } else {
        car.position.set(parkedX, parkedY + (betting ? idle : 0), -0.14);
        car.rotation.set(-0.06, 0.24, -0.08);
      }

      stage.engineLight.intensity = running ? 2.5 + Math.sin(time * 8) * 0.7 : 1.2;
      stage.redFlash.material.opacity = crashed
        ? 0.2 + Math.sin(time * 7) * 0.08
        : 0;
      stage.road.material.opacity = crashed ? 0.38 : 0.62;
      updateGrowthTrail(trail, running || crashed ? progress : 0.02, crashed);

      camera.position.lerp(
        new THREE.Vector3(
          compact ? 0.12 + eased * 0.2 : 0.05 + eased * 0.42,
          compact ? 1.16 + eased * 0.1 : 1.18 + eased * 0.12,
          compact ? 6.45 : 5.35,
        ),
        reducedMotion ? 1 : 0.035,
      );
      camera.lookAt(
        compact ? 0.15 + eased * 0.22 : 0.02 + eased * 0.36,
        compact ? 0.16 + eased * 0.46 : 0.18 + eased * 0.58,
        -0.3,
      );
      renderer.render(scene, camera);
      frameId = requestAnimationFrame(animate);
    };

    resize();
    animate();
    window.addEventListener("resize", resize);

    return () => {
      cancelAnimationFrame(frameId);
      window.removeEventListener("resize", resize);
      disposeObject(scene);
      renderer.dispose();
    };
  }, []);

  return (
    <div className="absolute inset-0" data-testid="crash-flight-scene">
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

function getSceneProgress(round: DashboardRound | null, now: Date) {
  if (!round) {
    return 0;
  }

  if (round.status === "RUNNING") {
    const multiplierProgress =
      typeof round.currentMultiplierBp === "number"
        ? (round.currentMultiplierBp - 10000) / 22000
        : 0;

    return Math.min(1, Math.max(getRoundProgress(round, now), multiplierProgress));
  }

  return round.status === "CRASHED" || round.status === "SETTLED" ? 1 : 0;
}

function easeOutCubic(value: number) {
  return 1 - Math.pow(1 - Math.min(1, Math.max(0, value)), 3);
}

function FlightFallback() {
  return (
    <div
      className="absolute inset-4 grid place-items-center rounded-md border border-cyan-300/20 bg-slate-950/80 text-center"
      data-testid="crash-flight-fallback"
    >
      <div>
        <div className="mx-auto h-2 w-44 rounded-full bg-gradient-to-r from-zinc-500 via-cyan-200 to-transparent" />
        <div className="mt-4 h-12 w-28 skew-x-[-14deg] rounded-sm border border-zinc-300/60 bg-zinc-300/30 shadow-[0_0_36px_rgba(125,211,252,0.34)]" />
        <p className="mt-4 text-xs uppercase tracking-[0.28em] text-cyan-100">
          WebGL fallback
        </p>
      </div>
    </div>
  );
}
