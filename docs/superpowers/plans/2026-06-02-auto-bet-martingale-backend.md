# Auto Bet Martingale Backend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add backend Martingale strategy support to persistent Auto Bet sessions while preserving fixed-stake behavior as the default.

**Architecture:** Extend the Auto Bet session as the aggregate holding base stake, next stake, strategy, and Martingale step state. The executor reads `nextAmountCents`; the result application use case advances or resets the progression after each auto bet result.

**Tech Stack:** NestJS, Bun test, Prisma, PostgreSQL, RabbitMQ-backed wallet flow, existing Games service tests and E2E helpers.

---

### Task 1: Session Contract And Parsing

**Files:**
- Modify: `services/games/src/application/auto-bet/auto-bet-session.ts`
- Modify: `services/games/src/application/use-cases/start-auto-bet-session.use-case.ts`
- Test: `services/games/tests/unit/application/game-use-cases.test.ts`

- [ ] Write a failing unit test proving `strategy: "MARTINGALE"` persists `nextAmountCents`, multiplier, max steps, and current step.
- [ ] Run the focused test and confirm it fails on missing fields.
- [ ] Add `AutoBetStrategy`, Martingale fields, parser defaults, and validation.
- [ ] Populate the fields in `StartAutoBetSessionUseCase`.
- [ ] Run the focused test and confirm it passes.

### Task 2: Prisma Persistence

**Files:**
- Modify: `services/games/prisma/schema.prisma`
- Create: `services/games/prisma/migrations/20260602143000_add_auto_bet_martingale/migration.sql`
- Modify: `services/games/src/infrastructure/prisma/auto-bet-session.mapper.ts`
- Modify: `services/games/src/infrastructure/prisma/auto-bet-session-prisma.repository.ts`

- [ ] Add a failing repository-facing unit or type check proving Martingale fields map through persisted sessions.
- [ ] Add schema columns with fixed-strategy defaults for existing rows.
- [ ] Update the mapper to include new fields.
- [ ] Add repository methods to update Martingale progression atomically.
- [ ] Run Games typecheck and the focused unit test.

### Task 3: Executor Uses Next Stake

**Files:**
- Modify: `services/games/src/application/use-cases/execute-auto-bets-for-round.use-case.ts`
- Test: `services/games/tests/unit/application/game-use-cases.test.ts`

- [ ] Write a failing unit test proving an active session with `nextAmountCents: 2000n` places a 2000-cent auto bet.
- [ ] Change the executor to pass `session.nextAmountCents` to `PlaceBetUseCase`.
- [ ] Run the focused unit test and confirm it passes.

### Task 4: Martingale Result Transitions

**Files:**
- Modify: `services/games/src/application/auto-bet/auto-bet-session.ts`
- Modify: `services/games/src/application/ports/auto-bet-session.repository.ts`
- Modify: `services/games/src/application/use-cases/apply-auto-bet-result.use-case.ts`
- Modify: `services/games/src/infrastructure/prisma/auto-bet-session-prisma.repository.ts`
- Test: `services/games/tests/unit/application/game-use-cases.test.ts`

- [ ] Write a failing test proving a lost Martingale auto bet doubles `nextAmountCents` and increments the step.
- [ ] Add a progression helper for lost results.
- [ ] Update `ApplyAutoBetResultUseCase` to apply the progression after recording delta.
- [ ] Write failing tests for cashout reset and max-step stop.
- [ ] Implement reset and stop behavior.
- [ ] Run the focused tests and confirm they pass.

### Task 5: API DTOs And E2E

**Files:**
- Modify: `services/games/src/presentation/dtos/auto-bet-session-request.dto.ts`
- Modify: `services/games/src/presentation/dtos/auto-bet-session-response.dto.ts`
- Modify: `services/games/src/presentation/controllers/auto-bet.controller.ts`
- Modify: `services/games/src/presentation/auto-bet-session-response.mapper.ts`
- Modify: `services/games/tests/unit/games-controller.test.ts`
- Modify: `services/games/tests/e2e/auto-bet.e2e.test.ts`
- Modify: `services/games/tests/e2e/e2e-helpers.ts`

- [ ] Write a failing controller test proving Martingale request fields are forwarded and response fields serialize.
- [ ] Update DTOs, controller forwarding, and response mapper.
- [ ] Write an E2E test proving a Martingale session progresses the stake after a loss.
- [ ] Run controller and E2E focused tests.

### Task 6: Gates And Commit

**Files:**
- Stage only backend/code files unless docs are explicitly requested for commit.

- [ ] Run `bun run lint`.
- [ ] Run `bun run check:types`.
- [ ] Run `bun run test:unit`.
- [ ] Run `bun run test:coverage && bun run quality:gate`.
- [ ] Run `docker compose config`.
- [ ] Run `docker compose up -d --build`.
- [ ] Run `bun scripts/ci/check-kong-health.ts`.
- [ ] Run `cd services/games && bun run test:e2e`.
- [ ] Run `git diff --check`.
- [ ] Commit backend changes only after all applicable gates pass.
