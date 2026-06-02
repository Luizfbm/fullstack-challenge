# 3D Portal Wormhole Stage Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current CSS black-hole portal with the provided GLB portal inside the Three.js canvas, then show the car flying inside a procedural wormhole during `RUNNING` and `CRASHED`.

**Architecture:** Keep the change frontend-only. Add a focused portal model module for GLB loading/fallback/normalization and a focused wormhole module for procedural tunnel primitives, then compose both inside `CrashFlightScene`. Remove the old CSS portal DOM as the visual source of truth while preserving light atmospheric CSS layers.

**Tech Stack:** Vite, React, TypeScript, Three.js, GLTFLoader, Vitest, Playwright, Bun.

---

## Execution Rules

- Work on branch `crash-game-implementation`.
- Before any code change, run `git status --short --branch`.
- Do not alter backend, API contracts, README, wallet/game business logic, observability, or Docker except tests/validation require running Docker.
- Do not commit this plan or the approved spec by themselves. Commit `docs/superpowers/specs/2026-06-02-3d-portal-wormhole-stage-design.md`, this plan, and implementation files together in the implementation commit.
- Use TDD: write one failing test, run it, implement the smallest code, rerun it.
- Keep `crash-flight-scene.tsx` from growing beyond the quality gate line limit. Put new logic in small modules.

## Files

- Create: `frontend/src/components/game/blackhole-portal-model.ts`
  - Owns `BLACKHOLE_PORTAL_ASSET_PATH`, procedural fallback portal, GLB loading, animation mixer setup, normalization, material preparation, and disposal helpers.
- Create: `frontend/src/components/game/wormhole-tunnel.ts`
  - Owns procedural wormhole object creation and per-frame updates for `running` and `crashed`.
- Copy: `/Users/luiz_fbm/Downloads/blackhole_pixel_pass_3.glb`
  - Destination: `frontend/public/models/blackhole_pixel_pass_3.glb`.
- Create: `frontend/public/models/blackhole-pixel-pass-attribution.txt`
  - Short attribution/source note for the imported model.
- Modify: `frontend/src/components/game/crash-flight-scene.tsx`
  - Add portal and wormhole groups to the scene; update visibility/animation by phase; keep car motion responsive.
- Modify: `frontend/src/components/game/chrono-stage.tsx`
  - Remove portal DOM nodes (`black-hole-gate`, rings/core/accretion/shockwave/debris explosion) while keeping atmospheric starfield/speed-lines/flight-line.
- Modify: `frontend/src/styles.css`
  - Remove old portal CSS selectors/keyframes for gate/rings/core/accretion/shockwave/debris; keep starfield and speed-line atmosphere.
- Modify: `frontend/src/components/game/crash-flight-scene.test.ts`
  - Add unit tests for portal asset/fallback/normalization and wormhole phase updates.
- Modify: `tests/browser/player-flow.spec.ts`
  - Assert the browser loads `/models/blackhole_pixel_pass_3.glb` and keeps canvas nonblank.

## Task 1: Add Portal Asset Contract and Fallback

**Files:**
- Create: `frontend/src/components/game/blackhole-portal-model.ts`
- Modify: `frontend/src/components/game/crash-flight-scene.test.ts`
- Copy: `frontend/public/models/blackhole_pixel_pass_3.glb`
- Create: `frontend/public/models/blackhole-pixel-pass-attribution.txt`

- [ ] **Step 1: Copy the GLB asset**

Run:

```bash
cp /Users/luiz_fbm/Downloads/blackhole_pixel_pass_3.glb frontend/public/models/blackhole_pixel_pass_3.glb
```

Expected: file exists at `frontend/public/models/blackhole_pixel_pass_3.glb`.

- [ ] **Step 2: Add attribution file**

Create `frontend/public/models/blackhole-pixel-pass-attribution.txt`:

```text
Blackhole pixel pass GLB asset used for the Chrono Crash portal stage.
Source file supplied locally at /Users/luiz_fbm/Downloads/blackhole_pixel_pass_3.glb.
```

- [ ] **Step 3: Write the failing portal contract test**

Add imports to `frontend/src/components/game/crash-flight-scene.test.ts`:

```ts
import {
  BLACKHOLE_PORTAL_ASSET_PATH,
  createBlackholePortalFallback,
  normalizeBlackholePortalForScene,
} from "./blackhole-portal-model";
```

Add tests:

```ts
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
```

- [ ] **Step 4: Run the focused test and verify RED**

Run:

```bash
cd frontend && bun run test src/components/game/crash-flight-scene.test.ts
```

Expected: fail because `./blackhole-portal-model` does not exist.

- [ ] **Step 5: Create the minimal portal module**

Create `frontend/src/components/game/blackhole-portal-model.ts`:

```ts
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

export const BLACKHOLE_PORTAL_ASSET_PATH =
  "/models/blackhole_pixel_pass_3.glb";
const BLACKHOLE_PORTAL_TARGET_DIAMETER = 2.9;

export type LoadedBlackholePortal = {
  actions: THREE.AnimationAction[];
  group: THREE.Group;
  mixer: THREE.AnimationMixer | null;
};

export function createBlackholePortalFallback(): THREE.Group {
  const group = new THREE.Group();
  group.name = "blackhole-portal-fallback";

  const outer = new THREE.Mesh(
    new THREE.TorusGeometry(1.15, 0.08, 12, 72),
    glowMaterial("#38bdf8", 0.78),
  );
  const middle = new THREE.Mesh(
    new THREE.TorusGeometry(0.78, 0.045, 10, 64),
    glowMaterial("#a855f7", 0.66),
  );
  const core = new THREE.Mesh(
    new THREE.CircleGeometry(0.5, 48),
    new THREE.MeshBasicMaterial({
      color: "#020617",
      opacity: 0.84,
      transparent: true,
    }),
  );

  outer.rotation.x = Math.PI / 2;
  middle.rotation.x = Math.PI / 2;
  core.rotation.x = -Math.PI / 2;
  group.add(outer, middle, core);

  return group;
}

export async function loadBlackholePortalAsset(
  assetPath = BLACKHOLE_PORTAL_ASSET_PATH,
  isCancelled = () => false,
): Promise<LoadedBlackholePortal> {
  const loader = new GLTFLoader();
  const gltf = await loader.loadAsync(assetPath);
  const group = new THREE.Group();
  const model = gltf.scene;

  group.name = "blackhole-portal-model";
  model.name = "blackhole-portal-glb-model";
  prepareBlackholePortalMaterials(model);
  normalizeBlackholePortalForScene(model);

  if (isCancelled()) {
    disposeImportedObject(model);
    return { actions: [], group: createBlackholePortalFallback(), mixer: null };
  }

  group.add(model);

  const mixer = gltf.animations.length > 0 ? new THREE.AnimationMixer(model) : null;
  const actions = mixer
    ? gltf.animations.map((clip) => {
        const action = mixer.clipAction(clip);
        action.play();
        return action;
      })
    : [];

  return { actions, group, mixer };
}

export function normalizeBlackholePortalForScene(model: THREE.Object3D) {
  model.rotation.set(-Math.PI / 2, 0, 0);

  const box = new THREE.Box3().setFromObject(model);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const diameter = Math.max(size.x, size.z, 0.001);
  const scale = BLACKHOLE_PORTAL_TARGET_DIAMETER / diameter;

  model.scale.setScalar(scale);
  model.position.set(-center.x * scale, -center.y * scale, -center.z * scale);
}

export function updateBlackholePortal(
  portal: THREE.Object3D,
  input: {
    crashImpact: number;
    entering: boolean;
    phaseElapsed: number;
    reducedMotion: boolean;
    time: number;
    visible: boolean;
  },
) {
  portal.visible = input.visible;

  if (!input.visible) {
    return;
  }

  const idlePulse = input.reducedMotion ? 1 : 1 + Math.sin(input.time * 1.8) * 0.025;
  const enteringScale = input.entering ? 1 + Math.min(1, input.phaseElapsed / 1.4) * 0.28 : 1;
  const crashScale = 1 + input.crashImpact * 0.08;

  portal.scale.setScalar(idlePulse * enteringScale * crashScale);
  portal.rotation.z = input.reducedMotion ? portal.rotation.z : input.time * 0.18;
}

function prepareBlackholePortalMaterials(model: THREE.Object3D) {
  model.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) {
      return;
    }

    child.castShadow = false;
    child.receiveShadow = false;

    const materials = Array.isArray(child.material)
      ? child.material
      : [child.material];

    materials.forEach((material) => {
      material.transparent = true;

      if (material instanceof THREE.MeshStandardMaterial) {
        material.emissive = material.color.clone();
        material.emissiveIntensity = Math.max(material.emissiveIntensity, 0.18);
        material.roughness = Math.min(material.roughness, 0.46);
      }
    });
  });
}

function glowMaterial(color: string, opacity: number) {
  return new THREE.MeshStandardMaterial({
    color,
    emissive: color,
    emissiveIntensity: 0.7,
    opacity,
    roughness: 0.28,
    transparent: true,
  });
}

function disposeImportedObject(object: THREE.Object3D) {
  object.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) {
      return;
    }

    child.geometry.dispose();

    if (Array.isArray(child.material)) {
      child.material.forEach((material) => material.dispose());
      return;
    }

    child.material.dispose();
  });
}
```

- [ ] **Step 6: Run the focused test and verify GREEN**

Run:

```bash
cd frontend && bun run test src/components/game/crash-flight-scene.test.ts
```

Expected: pass.

## Task 2: Add Procedural Wormhole Module

**Files:**
- Create: `frontend/src/components/game/wormhole-tunnel.ts`
- Modify: `frontend/src/components/game/crash-flight-scene.test.ts`

- [ ] **Step 1: Write failing wormhole tests**

Add imports:

```ts
import {
  createWormholeTunnel,
  updateWormholeTunnel,
} from "./wormhole-tunnel";
```

Add tests:

```ts
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
```

- [ ] **Step 2: Run focused test and verify RED**

Run:

```bash
cd frontend && bun run test src/components/game/crash-flight-scene.test.ts
```

Expected: fail because `./wormhole-tunnel` does not exist.

- [ ] **Step 3: Create wormhole module**

Create `frontend/src/components/game/wormhole-tunnel.ts`:

```ts
import * as THREE from "three";
import type { StageAnimationPhase } from "./crash-flight-motion";

export type WormholeTunnel = {
  group: THREE.Group;
  rings: THREE.Line[];
  streaks: THREE.Line[];
};

type WormholeUpdateInput = {
  crashImpact: number;
  phase: StageAnimationPhase;
  progress: number;
  reducedMotion: boolean;
  time: number;
};

const RING_COUNT = 7;
const STREAK_COUNT = 24;

export function createWormholeTunnel(): WormholeTunnel {
  const group = new THREE.Group();
  const rings = Array.from({ length: RING_COUNT }, (_, index) =>
    createRing(index),
  );
  const streaks = Array.from({ length: STREAK_COUNT }, (_, index) =>
    createStreak(index),
  );

  group.name = "wormhole-tunnel";
  group.visible = false;
  group.add(...rings, ...streaks);

  return { group, rings, streaks };
}

export function updateWormholeTunnel(
  wormhole: WormholeTunnel,
  input: WormholeUpdateInput,
) {
  const active = input.phase === "running" || input.phase === "crashed";
  const crashed = input.phase === "crashed";
  const color = crashed ? new THREE.Color("#fb7185") : new THREE.Color("#22d3ee");
  const accent = crashed ? new THREE.Color("#f43f5e") : new THREE.Color("#a855f7");
  const baseOpacity = crashed ? 0.54 + input.crashImpact * 0.32 : 0.38;

  wormhole.group.visible = active;

  if (!active) {
    return;
  }

  wormhole.rings.forEach((ring, index) => {
    const material = ring.material as THREE.LineBasicMaterial;
    const depth = index / Math.max(1, wormhole.rings.length - 1);
    const motion = input.reducedMotion ? 0 : input.time * 0.58;
    const scale = 0.72 + depth * 1.15 + Math.sin(motion + index) * 0.035;

    ring.position.z = -0.42 - depth * 2.6 + input.progress * 0.24;
    ring.rotation.z = input.reducedMotion ? ring.rotation.z : motion * (0.45 + depth);
    ring.scale.setScalar(scale);
    material.color.copy(index % 2 === 0 ? color : accent);
    material.opacity = baseOpacity * (1 - depth * 0.38);
  });

  wormhole.streaks.forEach((streak, index) => {
    const material = streak.material as THREE.LineBasicMaterial;
    const phase = index / STREAK_COUNT;
    const motion = input.reducedMotion ? 0 : input.time * 1.8;
    const radius = 0.52 + (index % 6) * 0.18;
    const angle = phase * Math.PI * 2 + motion * 0.22;

    streak.position.set(Math.cos(angle) * radius, Math.sin(angle) * radius * 0.54, -1.1);
    streak.rotation.z = angle;
    streak.rotation.y = -0.34;
    material.color.copy(crashed && index % 3 === 0 ? color : accent);
    material.opacity = crashed ? 0.48 + input.crashImpact * 0.22 : 0.34;
  });
}

function createRing(index: number): THREE.Line {
  const points = Array.from({ length: 96 }, (_, pointIndex) => {
    const angle = (pointIndex / 95) * Math.PI * 2;
    const radius = 1;

    return new THREE.Vector3(
      Math.cos(angle) * radius,
      Math.sin(angle) * radius * 0.58,
      0,
    );
  });
  const geometry = new THREE.BufferGeometry().setFromPoints(points);
  const material = new THREE.LineBasicMaterial({
    color: index % 2 === 0 ? "#22d3ee" : "#a855f7",
    opacity: 0.38,
    transparent: true,
  });
  const ring = new THREE.Line(geometry, material);

  ring.name = `wormhole-ring-${index}`;
  ring.position.z = -0.4 - index * 0.42;

  return ring;
}

function createStreak(index: number): THREE.Line {
  const geometry = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(-0.72, 0, 0),
    new THREE.Vector3(0.72, 0, 0),
  ]);
  const material = new THREE.LineBasicMaterial({
    color: index % 2 === 0 ? "#e0f2fe" : "#a855f7",
    opacity: 0.32,
    transparent: true,
  });
  const streak = new THREE.Line(geometry, material);

  streak.name = `wormhole-streak-${index}`;

  return streak;
}
```

- [ ] **Step 4: Run focused test and verify GREEN**

Run:

```bash
cd frontend && bun run test src/components/game/crash-flight-scene.test.ts
```

Expected: pass.

## Task 3: Integrate Portal and Wormhole into CrashFlightScene

**Files:**
- Modify: `frontend/src/components/game/crash-flight-scene.tsx`
- Modify: `frontend/src/components/game/crash-flight-scene.test.ts`

- [ ] **Step 1: Add integration test expectations for phase visibility helpers**

In `frontend/src/components/game/crash-flight-scene.test.ts`, add tests for exported helper functions before implementing them:

```ts
import {
  getPortalVisibilityForPhase,
  getWormholeVisibilityForPhase,
} from "./crash-flight-scene";

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
```

- [ ] **Step 2: Run focused test and verify RED**

Run:

```bash
cd frontend && bun run test src/components/game/crash-flight-scene.test.ts
```

Expected: fail because visibility helpers are not exported.

- [ ] **Step 3: Export minimal visibility helpers**

Add near the top of `frontend/src/components/game/crash-flight-scene.tsx`:

```ts
export function getPortalVisibilityForPhase(phase: StageAnimationPhase) {
  return phase === "betting" || phase === "entering";
}

export function getWormholeVisibilityForPhase(phase: StageAnimationPhase) {
  return phase === "running" || phase === "crashed";
}
```

- [ ] **Step 4: Run focused test and verify GREEN**

Run:

```bash
cd frontend && bun run test src/components/game/crash-flight-scene.test.ts
```

Expected: pass.

- [ ] **Step 5: Import portal and wormhole modules**

Add imports to `frontend/src/components/game/crash-flight-scene.tsx`:

```ts
import {
  createBlackholePortalFallback,
  loadBlackholePortalAsset,
  updateBlackholePortal,
} from "./blackhole-portal-model";
import {
  createWormholeTunnel,
  updateWormholeTunnel,
} from "./wormhole-tunnel";
```

- [ ] **Step 6: Add scene objects once during setup**

Inside the `useEffect`, after `const trail = createGrowthTrail();`, add:

```ts
const portalRoot = new THREE.Group();
let portal = createBlackholePortalFallback();
const wormhole = createWormholeTunnel();
let portalMixer: THREE.AnimationMixer | null = null;

portalRoot.name = "blackhole-portal-root";
portalRoot.add(portal);
```

Replace:

```ts
scene.add(stage.group, trail.group, car);
```

with:

```ts
scene.add(stage.group, wormhole.group, portalRoot, trail.group, car);
```

After the car asset loads, start the portal GLB load:

```ts
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
    portal.name = "blackhole-portal-fallback-active";
  });
```

- [ ] **Step 7: Position portal and update portal/wormhole per frame**

Inside `animate`, after `const portalX` and `const portalY`, add:

```ts
const portalVisible = getPortalVisibilityForPhase(phase);
const wormholeVisible = getWormholeVisibilityForPhase(phase);
```

After car movement is calculated and before stage lighting updates, add:

```ts
portalRoot.position.set(portalX, portalY, -0.86);
portalRoot.rotation.set(compact ? 0.16 : 0.2, compact ? -0.16 : -0.24, 0);
updateBlackholePortal(portalRoot, {
  crashImpact,
  entering,
  phaseElapsed,
  reducedMotion,
  time,
  visible: portalVisible,
});

portalMixer?.update(reducedMotion ? 0 : 1 / 60);

updateWormholeTunnel(wormhole, {
  crashImpact,
  phase,
  progress,
  reducedMotion,
  time,
});

wormhole.group.position.set(compact ? 0.06 : 0.2, compact ? -0.06 : -0.08, -1.05);
```

- [ ] **Step 8: Adjust running/crashed car placement to feel inside the tunnel**

In the `running || crashed` branch, keep existing motion but tune for tunnel center:

```ts
car.position.set(
  warpX + eased * warpAdvance + Math.sin(time * 2.8) * 0.08,
  warpY + eased * warpRise + speedJitter,
  -1.02 - eased * 0.26,
);
car.rotation.set(
  0.12 + Math.sin(time * 6) * 0.03,
  0.58 + Math.sin(time * 3.2) * 0.08,
  0.28 + Math.sin(time * 9) * 0.05 + crashImpact * 0.18,
);
```

Keep the existing `entering` branch so the car still flies into `portalX`/`portalY`.

- [ ] **Step 9: Run focused frontend tests**

Run:

```bash
cd frontend && bun run test src/components/game/crash-flight-scene.test.ts
```

Expected: pass.

## Task 4: Remove Old Portal DOM and CSS

**Files:**
- Modify: `frontend/src/components/game/chrono-stage.tsx`
- Modify: `frontend/src/styles.css`
- Modify: `frontend/src/components/game/game-dashboard-shell.test.tsx` only if DOM text/test expectations break

- [ ] **Step 1: Remove portal DOM from ChronoStage**

In `frontend/src/components/game/chrono-stage.tsx`, replace the `black-hole-stage-layer` body:

```tsx
<div className="black-hole-stage-layer" aria-hidden="true">
  <div className="black-hole-starfield" />
  <div className="black-hole-speed-lines black-hole-speed-lines-horizontal" />
  <div className="black-hole-speed-lines black-hole-speed-lines-radial" />
</div>
```

Remove:

```tsx
<div className="black-hole-gate">
  <div className="black-hole-ring black-hole-ring-outer" />
  <div className="black-hole-ring black-hole-ring-middle" />
  <div className="black-hole-ring black-hole-ring-inner" />
  <div className="black-hole-core" />
  <div className="black-hole-accretion" />
  <div className="black-hole-shockwave" />
</div>
<div className="black-hole-explosion">
  {Array.from({ length: 18 }, (_, index) => (
    <span
      className="black-hole-debris"
      key={index}
      style={{ "--debris-index": index } as CSSProperties}
    />
  ))}
</div>
```

Then remove the `type CSSProperties` import from React:

```ts
import {
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
```

- [ ] **Step 2: Remove obsolete CSS selectors**

In `frontend/src/styles.css`, delete CSS blocks for:

```text
.black-hole-gate
.black-hole-ring
.black-hole-ring-outer
.black-hole-ring-middle
.black-hole-ring-inner
.black-hole-core
.black-hole-accretion
.black-hole-shockwave
.black-hole-explosion
.black-hole-debris
.black-hole-betting .black-hole-gate
.black-hole-idle .black-hole-gate
.black-hole-betting .black-hole-core
.black-hole-idle .black-hole-core
.black-hole-entering .black-hole-gate
.black-hole-running .black-hole-gate
.black-hole-running .black-hole-ring-outer
.black-hole-entering .black-hole-ring-outer
.black-hole-running .black-hole-ring-middle
.black-hole-entering .black-hole-ring-middle
.black-hole-running .black-hole-core
.black-hole-entering .black-hole-core
.black-hole-crashed .black-hole-gate
.black-hole-crashed .black-hole-ring
.black-hole-crashed .black-hole-core
.black-hole-crashed .black-hole-shockwave
.black-hole-crashed .black-hole-explosion
.black-hole-crashed .black-hole-debris:nth-child(...)
@keyframes black-hole-swallow
@keyframes black-hole-ring-spin
@keyframes black-hole-core-pulse
@keyframes black-hole-shockwave
@keyframes black-hole-explosion
@keyframes black-hole-debris-*
```

Keep CSS blocks for:

```text
.black-hole-stage-layer
.black-hole-starfield
.black-hole-speed-lines
.black-hole-speed-lines-horizontal
.black-hole-speed-lines-radial
.black-hole-entering .black-hole-speed-lines-horizontal
.black-hole-running .black-hole-speed-lines-radial
@keyframes black-hole-horizontal-speed
@keyframes black-hole-radial-speed
```

Update the reduced-motion block to remove references to deleted selectors:

```css
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 1ms !important;
    animation-iteration-count: 1 !important;
    scroll-behavior: auto !important;
  }

  .black-hole-entering .black-hole-speed-lines-horizontal,
  .black-hole-running .black-hole-speed-lines-radial {
    animation: none !important;
  }
}
```

- [ ] **Step 3: Run frontend tests**

Run:

```bash
cd frontend && bun run test
```

Expected: pass.

- [ ] **Step 4: Run typecheck/build**

Run:

```bash
cd frontend && bun run build
```

Expected: pass. The existing Vite chunk-size warning is acceptable if exit code is 0.

## Task 5: Update Browser E2E for New Portal Asset

**Files:**
- Modify: `tests/browser/player-flow.spec.ts`

- [ ] **Step 1: Change asset assertion helper**

Rename `expectTimeCarAssetLoaded` to `expectStageAssetsLoaded` and require both car and portal resources:

```ts
async function expectStageAssetsLoaded(page: Page) {
  await expect(async () => {
    const loadedAssets = await page.evaluate(() =>
      performance
        .getEntriesByType("resource")
        .map((entry) => entry.name),
    );

    expect(
      loadedAssets.some((name) =>
        name.includes("/models/time-machine-low-poly.glb"),
      ),
    ).toBe(true);
    expect(
      loadedAssets.some((name) =>
        name.includes("/models/blackhole_pixel_pass_3.glb"),
      ),
    ).toBe(true);
  }).toPass();
}
```

Replace calls to:

```ts
await expectTimeCarAssetLoaded(page);
```

with:

```ts
await expectStageAssetsLoaded(page);
```

- [ ] **Step 2: Run browser E2E**

Run with stack already up:

```bash
bun run test:e2e:browser
```

Expected: 3 tests pass.

## Task 6: Visual and Quality Validation

**Files:**
- No planned source edits unless validation finds layout defects.

- [ ] **Step 1: Run focused tests and build**

Run:

```bash
cd frontend && bun run test src/components/game/crash-flight-scene.test.ts
cd frontend && bun run build
```

Expected: both pass.

- [ ] **Step 2: Run root gates**

Run:

```bash
bun run lint
bun run check:types
bun run test:unit
bun run test:coverage && bun run quality:gate
docker compose config
git diff --check
```

Expected: all pass; quality gate reports no failures.

- [ ] **Step 3: Rebuild Docker stack and run browser tests**

Run:

```bash
docker compose up -d --build
bun scripts/ci/check-kong-health.ts
bun run test:e2e:browser
```

Expected: stack healthy, browser tests pass.

- [ ] **Step 4: Run visual Playwright probe for desktop and mobile**

Run a temporary one-off script from the root:

```bash
bunx playwright test tests/browser/player-flow.spec.ts --grep "login, bet, cash out"
```

Then inspect manually in the browser or add a temporary Playwright probe that checks:

```ts
const state = await page.evaluate(() => ({
  hasCanvas: Boolean(document.querySelector('[data-testid="crash-flight-canvas"]')),
  overflowX: document.documentElement.scrollWidth > document.documentElement.clientWidth,
}));
expect(state.hasCanvas).toBe(true);
expect(state.overflowX).toBe(false);
```

Expected:

- desktop: nonblank canvas, no horizontal overflow, car visible;
- mobile: car not clipped; portal visible only in `BETTING`/`ENTERING`;
- `RUNNING`: portal absent, wormhole visible;
- `CRASHED`: portal absent, wormhole red/rose impact visible.

Do not commit the temporary visual probe unless it becomes a stable regression test.

## Task 7: Final Commit and Delivery

**Files to include in commit:**
- `docs/superpowers/specs/2026-06-02-3d-portal-wormhole-stage-design.md`
- `docs/superpowers/plans/2026-06-02-3d-portal-wormhole-stage.md`
- `frontend/public/models/blackhole_pixel_pass_3.glb`
- `frontend/public/models/blackhole-pixel-pass-attribution.txt`
- `frontend/src/components/game/blackhole-portal-model.ts`
- `frontend/src/components/game/wormhole-tunnel.ts`
- `frontend/src/components/game/crash-flight-scene.tsx`
- `frontend/src/components/game/chrono-stage.tsx`
- `frontend/src/styles.css`
- `frontend/src/components/game/crash-flight-scene.test.ts`
- `tests/browser/player-flow.spec.ts`

- [ ] **Step 1: Confirm Git status**

Run:

```bash
git status --short --branch
```

Expected: only files in this plan plus the existing unrelated untracked auto-bet docs. Do not add the unrelated auto-bet docs unless explicitly requested.

- [ ] **Step 2: Stage only this slice**

Run:

```bash
git add \
  docs/superpowers/specs/2026-06-02-3d-portal-wormhole-stage-design.md \
  docs/superpowers/plans/2026-06-02-3d-portal-wormhole-stage.md \
  frontend/public/models/blackhole_pixel_pass_3.glb \
  frontend/public/models/blackhole-pixel-pass-attribution.txt \
  frontend/src/components/game/blackhole-portal-model.ts \
  frontend/src/components/game/wormhole-tunnel.ts \
  frontend/src/components/game/crash-flight-scene.tsx \
  frontend/src/components/game/chrono-stage.tsx \
  frontend/src/styles.css \
  frontend/src/components/game/crash-flight-scene.test.ts \
  tests/browser/player-flow.spec.ts
```

- [ ] **Step 3: Commit after all gates pass**

Run:

```bash
git commit -m "feat(frontend): add 3d portal wormhole stage"
```

- [ ] **Step 4: Follow project PR workflow**

After commit:

```bash
git push origin crash-game-implementation
gh pr create --base main --head crash-game-implementation --title "feat(frontend): add 3d portal wormhole stage" --body "Adds the GLB portal to the Three.js stage, replaces the old CSS portal, and renders a procedural wormhole during running/crashed phases."
```

Then use `gh-pr-babysit` to monitor Actions until green, merge into `main`, and resync `main`, `origin/main`, `crash-game-implementation`, and `origin/crash-game-implementation`.

## Self-Review

- Spec coverage: all approved phases are covered by Tasks 1-4, E2E by Task 5, and gates by Task 6.
- Placeholder scan: no `TBD`, `TODO`, or unspecified implementation steps are intentionally left.
- Type consistency: helper names are consistent across test and implementation snippets:
  `BLACKHOLE_PORTAL_ASSET_PATH`, `createBlackholePortalFallback`,
  `normalizeBlackholePortalForScene`, `loadBlackholePortalAsset`,
  `updateBlackholePortal`, `createWormholeTunnel`, `updateWormholeTunnel`,
  `getPortalVisibilityForPhase`, and `getWormholeVisibilityForPhase`.
