# Auto Bet Martingale Frontend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add full frontend support for configuring and inspecting Martingale auto bet sessions.

**Architecture:** Keep backend execution as the source of truth. Extend the frontend API contract, move Martingale form logic into small focused helpers/components, and keep `BetControlsPanel` under the file-size ratchet by delegating new UI to dedicated files.

**Tech Stack:** React, Vite, Tailwind CSS, TanStack Query, Bun test, Vitest, Playwright.

---

### Task 1: Frontend API Contract

**Files:**
- Modify: `frontend/src/services/game-api.ts`
- Modify: `frontend/src/services/game-api.test.ts`
- Modify: `frontend/src/hooks/use-game-rest.test.tsx`

- [x] Add failing API tests proving `startAutoBetSession` serializes `strategy`, `martingaleMultiplier`, and `martingaleMaxSteps`.
- [x] Extend `AutoBetSessionResponse`, `StartAutoBetSessionInput`, and stop reason types.
- [x] Run `cd frontend && bunx vitest run src/services/game-api.test.ts src/hooks/use-game-rest.test.tsx`.

### Task 2: Martingale Form Model

**Files:**
- Modify: `frontend/src/components/game/bet-controls-model.ts`
- Test: `frontend/src/components/game/game-dashboard-shell.test.tsx`

- [x] Add failing tests for Martingale payload and invalid Martingale risk fields.
- [x] Extend `buildAutoBetPayload` to include strategy and Martingale values.
- [x] Extend `autoBetConfigIsValid` to validate Martingale fields only when selected.
- [x] Run the focused frontend test.

### Task 3: Martingale Controls

**Files:**
- Create: `frontend/src/components/game/auto-bet-strategy-fields.tsx`
- Modify: `frontend/src/components/game/bet-controls-panel.tsx`
- Test: `frontend/src/components/game/game-dashboard-shell.test.tsx`

- [x] Add a strategy selector with `Valor fixo` and `Martingale`.
- [x] Show multiplier and max step inputs only for `Martingale`.
- [x] Keep `bet-controls-panel.tsx` below the quality-gate file size limit.
- [x] Run focused frontend tests.

### Task 4: Active Session Summary

**Files:**
- Modify: `frontend/src/components/game/auto-bet-session-summary.tsx`
- Modify: `frontend/src/components/game/game-dashboard-shell.test.tsx`

- [x] Add failing tests proving active Martingale summary displays next stake, step, and strategy.
- [x] Render the new summary fields and Martingale stop reasons.
- [x] Run focused frontend tests.

### Task 5: Gates

**Files:**
- All frontend Martingale files.

- [x] Run `bun run lint`.
- [x] Run `bun run check:types`.
- [x] Run `bun run test:unit`.
- [x] Run `cd frontend && bun run build`.
- [x] Run `bun run test:coverage && bun run quality:gate`.
- [x] Run `docker compose config`.
- [x] Run `docker compose up -d --build`.
- [x] Run `bun scripts/ci/check-kong-health.ts`.
- [x] Run `bun scripts/ci/check-observability-health.ts`.
- [x] Run `bun run test:e2e:browser`.
- [x] Run `git diff --check`.

### Task 6: Commit And PR Flow

**Files:**
- Stage only this recut's frontend code, tests, spec, and plan.

- [ ] Commit spec, plan, code, and tests together.
- [ ] Push `crash-game-implementation`.
- [ ] Create PR to `main`.
- [ ] Use `gh-pr-babysit` until Actions are green.
- [ ] Merge on GitHub.
- [ ] Synchronize `main`, `origin/main`, `crash-game-implementation`, and `origin/crash-game-implementation`.
