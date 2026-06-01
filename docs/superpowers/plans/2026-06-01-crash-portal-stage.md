# Crash Portal Stage Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Turn the main 3D stage into the approved `Crash Portal / Portal Gate` scene while preserving current game behavior.

**Architecture:** Keep the implementation presentation-only. `chrono-stage.tsx` owns the DOM layers, storyboard phase detection, and state class composition; `styles.css` owns black-hole visuals, speed lines, explosion debris, and reduced-motion behavior; `crash-flight-scene.tsx` owns car/camera choreography, zoom, and shake. Avoid changing services, backend contracts, or game data.

**Tech Stack:** React, TypeScript, Tailwind utility classes, CSS keyframes, Three.js canvas already rendered by `CrashFlightScene`.

---

### Task 1: Add Portal DOM Layers

**Files:**
- Modify: `frontend/src/components/game/chrono-stage.tsx`

- [x] **Step 1: Add state-aware portal layer markup**

Add a state class to the stage root and insert a portal layer between the background effects and `<CrashFlightScene />`:

```tsx
const crashed = round?.status === "CRASHED" || round?.status === "SETTLED";
const running = round?.status === "RUNNING";
const betting = round?.status === "BETTING";
```

```tsx
className={cn(
  "chrono-arena chrono-scanline relative min-h-[34rem] min-w-0 overflow-hidden rounded-lg border",
  running && "portal-running",
  betting && "portal-betting",
  crashed && "portal-crashed",
  crashed
    ? "border-rose-300/60 shadow-[0_0_120px_rgba(244,63,94,0.34)]"
    : "border-rose-300/35 shadow-[0_0_120px_rgba(244,63,94,0.24)]",
)}
```

```tsx
<div className="portal-gate-layer" aria-hidden="true">
  <div className="portal-gate">
    <div className="portal-ring portal-ring-outer" />
    <div className="portal-ring portal-ring-middle" />
    <div className="portal-ring portal-ring-inner" />
    <div className="portal-core" />
    <div className="portal-shockwave" />
  </div>
</div>
```

- [x] **Step 2: Run typecheck**

Run: `bunx tsc --noEmit -p frontend/tsconfig.json`

Expected: command exits with code 0.

### Task 2: Style Portal Gate and States

**Files:**
- Modify: `frontend/src/styles.css`

- [x] **Step 1: Add portal CSS**

Add CSS classes for `.portal-gate-layer`, `.portal-gate`, `.portal-ring`, `.portal-core`, `.portal-shockwave`, and state selectors under `.portal-running`, `.portal-betting`, and `.portal-crashed`.

The CSS must:

- Position the portal behind the car canvas but above the background grid.
- Center it slightly above the visual midpoint.
- Use rose/magenta as the dominant glow.
- Keep betting quiet, running pulsing, and crashed ruptured.
- Avoid layout shifts and horizontal overflow.

- [x] **Step 2: Add reduced-motion handling**

Inside the existing `@media (prefers-reduced-motion: reduce)` block, ensure portal animations resolve to a static readable state:

```css
.portal-running .portal-ring,
.portal-running .portal-core,
.portal-crashed .portal-shockwave {
  animation: none !important;
}
```

- [x] **Step 3: Run focused dashboard test**

Run: `cd frontend && bun run test src/components/game/game-dashboard-shell.test.tsx`

Expected: 7 tests pass.

### Task 3: Validate Stage in Browser

**Files:**
- No code files expected unless visual validation reveals an overlap.

- [x] **Step 1: Rebuild frontend container**

Run: `docker compose up -d --build frontend`

Expected: frontend container starts successfully.

- [x] **Step 2: Browser checks**

Open `http://localhost:8000/` and verify:

- stage renders;
- multiplier remains upper-right with spacing;
- portal sits behind the car;
- no horizontal overflow;
- GLB asset still appears in the page asset inventory;
- mobile `390x844` has no stage overflow.

- [x] **Step 3: Run build**

Run: `cd frontend && bun run build`

Expected: build passes. The existing Vite chunk-size warning is acceptable.

### Task 4: Storyboard Animation Upgrade

**Files:**
- Modify: `frontend/src/components/game/chrono-stage.tsx`
- Modify: `frontend/src/components/game/crash-flight-scene.tsx`
- Modify: `frontend/src/styles.css`

- [x] **Step 1: Map game status to storyboard phases**

Use `BETTING`, a one-shot `entering` transition on `BETTING -> RUNNING`, persistent `running`, and `crashed`.

- [x] **Step 2: Replace static portal visuals with black-hole storyboard layers**

Add starfield, black-hole core, accretion rings, horizontal entry speed lines, radial running speed lines, shockwave, and debris.

- [x] **Step 3: Add 3D car and camera choreography**

Move the car from outside the black hole into the gate during `entering`, switch to warp flight during `running`, add camera zoom and running shake, and add stronger crash impact shake.

- [x] **Step 4: Verify**

Run:

```bash
bunx tsc --noEmit -p frontend/tsconfig.json
cd frontend && bun run test src/components/game/game-dashboard-shell.test.tsx
cd frontend && bun run build
```

Expected: all commands pass; existing Vite chunk-size warning remains acceptable.
