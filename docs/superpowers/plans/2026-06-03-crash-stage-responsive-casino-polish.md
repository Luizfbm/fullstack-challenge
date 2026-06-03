# Crash Stage Responsive Casino Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep the 3D crash stage framed on narrow screens and remove old red/rose ambient styling from non-crash stage states.

**Architecture:** Use focused frontend TDD slices. First lock the visible bug with unit contracts around HUD bounds and stage chrome, then update the trail layout math and stage styles, then verify through browser viewport regression.

**Tech Stack:** React, TypeScript, Three.js, Tailwind CSS, Vitest, Playwright.

---

## Source Spec

- `docs/superpowers/specs/2026-06-03-crash-stage-responsive-casino-polish.md`

## Constraints

- Do not edit `README.md`.
- Do not touch:
  - `docs/superpowers/plans/2026-06-02-auto-bet-backend.md`
  - `docs/superpowers/specs/2026-06-02-auto-bet-backend-design.md`
- Do not remove, disable, or weaken tests.
- Keep branch `crash-game-implementation`.
- No push, PR, merge, or destructive git commands.

## File Structure

- Modify `frontend/src/components/game/crash-flight-scene.test.ts`
  - Add unit regressions for narrow camera framing and stage/trail colors.

- Modify `frontend/src/components/game/time-car-trail-frame.ts`
  - Bound HUD dimensions to safe camera viewport at narrow aspect ratios.

- Modify `frontend/src/components/game/crash-flight-trail-frame.ts`
  - Keep compact guide dimensions conservative enough for mobile.

- Modify `frontend/src/components/game/crash-flight-storyboard.ts`
  - Use a wider compact threshold if needed.

- Modify `frontend/src/components/game/crash-flight-storyboard-frames.ts`
  - Keep camera follow and zoom from pushing the trail anchor offscreen.

- Modify `frontend/src/components/game/time-car-trail-materials.ts`
  - Use emerald/gold for boost/non-crash guide and rose only for crash.

- Modify `frontend/src/components/game/chrono-stage.tsx`
  - Replace non-crashed border/shadow with amber/felt and keep crash red.

- Modify `frontend/src/styles.css`
  - Replace old red ambient gradients in `.chrono-arena`, `.chrono-grid`, and
    `.chrono-rift`.

- Modify `frontend/src/components/game/casino-surface-contracts.test.tsx`
  - Extend CSS contracts for the stage background.

- Modify `tests/browser/responsive-layout.spec.ts`
  - Add stage chrome/canvas checks if unit tests do not cover the browser symptom.

## Task 1: Lock Narrow Stage Framing Contracts

- [ ] Add a unit test in `crash-flight-scene.test.ts` that creates a narrow
  `THREE.PerspectiveCamera(42, 0.72, 0.1, 100)`, updates the running trail, and
  asserts that `trail.group.position.x`, the curve endpoint, and returned
  `carAnchor[0]` remain inside the visible HUD bounds.

- [ ] Run:
  `cd frontend && bun run test src/components/game/crash-flight-scene.test.ts`

- [ ] Expected RED:
  the test fails because the current HUD uses `Math.max(frame.width, safeWidth)`
  and lets the guide exceed the narrow camera width.

## Task 2: Keep HUD Bounds Inside the Camera

- [ ] Update `getHudFrame` in `time-car-trail-frame.ts` to compute safe width and
  height, reserve label/car margins, and clamp effective HUD size to the safe
  viewport.

- [ ] If needed, lower compact trail dimensions in `crash-flight-trail-frame.ts`
  so mobile has enough breathing room.

- [ ] Run the focused test again until it passes.

## Task 3: Remove Old Red Ambient Stage Styling

- [ ] Add RED tests:
  - `ChronoStage` non-crashed class does not contain `rose`.
  - CSS blocks `.chrono-arena`, `.chrono-grid`, `.chrono-rift` do not contain
    `rgba(244, 63, 94)`.

- [ ] Update `chrono-stage.tsx` and `styles.css` to use felt/gold/emerald for
  normal stage chrome.

- [ ] Keep crash-state red in the crashed branch.

- [ ] Run:
  `cd frontend && bun run test src/components/game/chrono-stage.test.tsx src/components/game/casino-surface-contracts.test.tsx`

## Task 4: Verify Browser Responsive Behavior

- [ ] Rebuild frontend container:
  `docker compose up -d --build frontend`

- [ ] Run:
  `bunx playwright test tests/browser/responsive-layout.spec.ts`

- [ ] Use the in-app browser to inspect `http://localhost:8000/` and confirm
  the stage no longer has non-crash red ambient fade.

## Task 5: Final Verification

- [ ] Run:
  `cd frontend && bun run test`

- [ ] Run:
  `cd frontend && bun run build`

- [ ] Run:
  `bun run lint`

- [ ] Run:
  `git diff --check`

- [ ] Optional if time permits:
  `bun run test:e2e:browser`

## Commit Guidance

Because several target files are already modified in the working tree from
prior work, do not blindly stage whole dirty files unless the diff belongs to
this task. If clean staging is not possible without mixing unrelated changes,
leave the work uncommitted and report that explicitly.
