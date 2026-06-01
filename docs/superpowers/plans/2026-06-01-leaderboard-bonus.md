# Crash Game Leaderboard Bonus Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the README Leaderboard bonus as a public 24h/7d net-profit ranking with a responsive left-side frontend panel.

**Architecture:** Keep leaderboard ownership inside the Game bounded context because it aggregates game bets, not wallet ledger entries. Add a small read use case over a repository leaderboard query, expose it through a public REST endpoint, then consume it from the React dashboard with TanStack Query. Do not change wallet behavior, bet settlement, realtime payloads, or provably fair data.

**Tech Stack:** NestJS, Bun test, Prisma, TypeScript, Swagger/OpenAPI, React, Vite, Tailwind CSS v4, TanStack Query, Vitest.

---

## Commit Policy For This Bonus

The user requires all tests before any commit. For this bonus, implement in
TDD slices and defer commit until after the full required gate set passes:

```bash
bun run lint
bun run check:types
bun run test:unit
cd frontend && bun run build
cd ..
bun run test:coverage && bun run quality:gate
docker compose config
docker compose up -d --build
bun scripts/ci/check-kong-health.ts
cd services/games && bun test tests/e2e
cd ../..
bun run test:e2e:browser
git diff --check
```

No test may be deleted, skipped, disabled, or weakened.

## Files

- Create: `services/games/src/application/use-cases/list-leaderboard.use-case.ts`
- Modify: `services/games/src/application/ports/game.repository.ts`
- Modify: `services/games/src/infrastructure/prisma/game-prisma.repository.ts`
- Modify: `services/games/src/app.module.ts`
- Create: `services/games/src/presentation/dtos/leaderboard-response.dto.ts`
- Modify: `services/games/src/presentation/controllers/games.controller.ts`
- Modify: `services/games/tests/unit/application/game-use-cases.test.ts`
- Modify: `services/games/tests/unit/games-controller.test.ts`
- Modify: `frontend/src/services/api-routes.ts`
- Modify: `frontend/src/services/game-api.ts`
- Modify: `frontend/src/services/game-api.test.ts`
- Modify: `frontend/src/hooks/use-game-rest.ts`
- Create: `frontend/src/components/game/leaderboard-panel.tsx`
- Modify: `frontend/src/components/game/game-dashboard-shell.tsx`
- Modify: `frontend/src/components/game/game-dashboard-shell.test.tsx`

## Task 1: Backend Use Case Contract

**Files:**
- Create: `services/games/src/application/use-cases/list-leaderboard.use-case.ts`
- Modify: `services/games/src/application/ports/game.repository.ts`
- Modify: `services/games/tests/unit/application/game-use-cases.test.ts`

- [ ] **Step 1: Write the failing use case tests**

Append tests to `services/games/tests/unit/application/game-use-cases.test.ts`
covering:

```ts
test("lists 24h leaderboard entries by net profit", async () => {
  const repository = new InMemoryGameRepository(openRound());
  repository.leaderboardEntries = [
    {
      betsCount: 2,
      payoutCents: 3000n,
      playerId: "player-1",
      profitCents: 1000n,
      rank: 1,
      username: "alpha",
      wageredCents: 2000n,
    },
  ];
  const useCase = new ListLeaderboardUseCase(
    repository,
    new FixedClock(new Date("2026-06-01T12:00:00.000Z")),
  );

  await expect(useCase.execute({ period: "24h", limit: 10 })).resolves.toEqual(
    repository.leaderboardEntries,
  );
  expect(repository.lastLeaderboardInput).toEqual({
    since: new Date("2026-05-31T12:00:00.000Z"),
    limit: 10,
  });
});
```

Also add a 7d test expecting `since: new Date("2026-05-25T12:00:00.000Z")`.

- [ ] **Step 2: Verify RED**

Run:

```bash
cd services/games && bun test tests/unit/application/game-use-cases.test.ts
```

Expected: fail because `ListLeaderboardUseCase` and repository leaderboard
types do not exist.

- [ ] **Step 3: Implement minimal use case and repository port types**

Add to `services/games/src/application/ports/game.repository.ts`:

```ts
export type LeaderboardPeriod = "24h" | "7d";

export type LeaderboardEntry = {
  rank: number;
  playerId: string;
  username: string;
  profitCents: bigint;
  wageredCents: bigint;
  payoutCents: bigint;
  betsCount: number;
};

export type ListLeaderboardInput = {
  since: Date;
  limit: number;
};
```

Add `listLeaderboard(input: ListLeaderboardInput): Promise<LeaderboardEntry[]>`
to `GameRepository`.

Create `ListLeaderboardUseCase` with:

```ts
const PERIOD_MS = {
  "24h": 24 * 60 * 60 * 1000,
  "7d": 7 * 24 * 60 * 60 * 1000,
} as const;
```

It computes `since` from `clock.now()` and delegates to the repository.

- [ ] **Step 4: Verify GREEN**

Run:

```bash
cd services/games && bun test tests/unit/application/game-use-cases.test.ts
```

Expected: use case tests pass.

## Task 2: Prisma Leaderboard Aggregation

**Files:**
- Modify: `services/games/src/infrastructure/prisma/game-prisma.repository.ts`
- Modify: `services/games/tests/unit/application/game-use-cases.test.ts`

- [ ] **Step 1: Extend in-memory test repository**

Update `InMemoryGameRepository` in `game-use-cases.test.ts` with:

```ts
public leaderboardEntries: LeaderboardEntry[] = [];
public lastLeaderboardInput: ListLeaderboardInput | null = null;

async listLeaderboard(input: ListLeaderboardInput): Promise<LeaderboardEntry[]> {
  this.lastLeaderboardInput = input;
  return this.leaderboardEntries.slice(0, input.limit);
}
```

- [ ] **Step 2: Implement Prisma repository method**

Add `listLeaderboard` to `GamePrismaRepository`. It should fetch resolved bets:

```ts
const bets = await this.prisma.bet.findMany({
  where: {
    createdAt: { gte: input.since },
    OR: [
      { status: "LOST" },
      { status: "CASHED_OUT", payoutCents: { not: null } },
    ],
  },
  orderBy: [{ username: "asc" }, { playerId: "asc" }],
});
```

Aggregate with bigint in application code:

```ts
profitCents = payoutCents - wageredCents;
```

Sort by profit, payout, wagered, username, playerId; assign sequential ranks;
return `slice(0, input.limit)`.

- [ ] **Step 3: Verify typecheck for backend**

Run:

```bash
bunx tsc --noEmit -p services/games/tsconfig.json
```

Expected: command exits with code 0.

## Task 3: Public Controller and Swagger DTO

**Files:**
- Create: `services/games/src/presentation/dtos/leaderboard-response.dto.ts`
- Modify: `services/games/src/presentation/controllers/games.controller.ts`
- Modify: `services/games/src/app.module.ts`
- Modify: `services/games/tests/unit/games-controller.test.ts`

- [ ] **Step 1: Write failing controller tests**

Add tests that call:

```ts
await controller.leaderboard(undefined, undefined);
await controller.leaderboard("7d", "5");
await expect(controller.leaderboard("bad", "10")).rejects.toThrow(
  BadRequestException,
);
await expect(controller.leaderboard("24h", "51")).rejects.toThrow(
  BadRequestException,
);
```

Expected use case inputs:

```ts
{ period: "24h", limit: 10 }
{ period: "7d", limit: 5 }
```

- [ ] **Step 2: Verify RED**

Run:

```bash
cd services/games && bun test tests/unit/games-controller.test.ts
```

Expected: fail because `leaderboard` controller method does not exist.

- [ ] **Step 3: Add DTO and controller method**

Create DTO:

```ts
export class LeaderboardEntryDto {
  rank!: number;
  playerId!: string;
  username!: string;
  profitCents!: string;
  wageredCents!: string;
  payoutCents!: string;
  betsCount!: number;
}
```

Add public route:

```ts
@Get("leaderboard")
async leaderboard(
  @Query("period") period?: string,
  @Query("limit") limit?: string,
): Promise<LeaderboardEntryDto[]> {
  const entries = await this.listLeaderboardUseCase.execute({
    period: this.parseLeaderboardPeriod(period),
    limit: this.parseLeaderboardLimit(limit),
  });

  return entries.map(toLeaderboardEntryDto);
}
```

Add private parsers:

```ts
private parseLeaderboardPeriod(period?: string): "24h" | "7d" {
  if (!period) return "24h";
  if (period === "24h" || period === "7d") return period;
  throw new BadRequestException("period must be 24h or 7d");
}

private parseLeaderboardLimit(limit?: string): number {
  if (!limit) return 10;
  const parsed = this.parseLimit(limit);
  if (parsed > 50) {
    throw new BadRequestException("limit must be between 1 and 50");
  }
  return parsed;
}
```

Wire `ListLeaderboardUseCase` into `AppModule`.

- [ ] **Step 4: Verify GREEN**

Run:

```bash
cd services/games && bun test tests/unit/games-controller.test.ts
```

Expected: controller tests pass.

## Task 4: Frontend API and Query Hook

**Files:**
- Modify: `frontend/src/services/api-routes.ts`
- Modify: `frontend/src/services/game-api.ts`
- Modify: `frontend/src/services/game-api.test.ts`
- Modify: `frontend/src/hooks/use-game-rest.ts`

- [ ] **Step 1: Write failing API client test**

Add to `game-api.test.ts`:

```ts
it("loads leaderboard with period and limit", async () => {
  const client = createClient([]);
  const api = new GameApi(client);

  await api.getLeaderboard({ period: "7d", limit: 25 });

  expect(client.requests[0]).toEqual({
    path: "/games/leaderboard?period=7d&limit=25",
    options: undefined,
  });
});
```

- [ ] **Step 2: Verify RED**

Run:

```bash
cd frontend && bun run test src/services/game-api.test.ts
```

Expected: fail because `getLeaderboard` does not exist.

- [ ] **Step 3: Add frontend types, route, API method, query key and hook**

Add:

```ts
leaderboard: "/games/leaderboard",
```

Add types:

```ts
export type LeaderboardPeriod = "24h" | "7d";
export type LeaderboardEntry = {
  rank: number;
  playerId: string;
  username: string;
  profitCents: string;
  wageredCents: string;
  payoutCents: string;
  betsCount: number;
};
```

Add `GameApi.getLeaderboard({ period = "24h", limit = 10 })`.

Add hook:

```ts
useLeaderboardQuery(period: LeaderboardPeriod, limit = 10)
```

with `refetchInterval: 5000`.

- [ ] **Step 4: Verify GREEN**

Run:

```bash
cd frontend && bun run test src/services/game-api.test.ts
```

Expected: API client tests pass.

## Task 5: Frontend Leaderboard Panel

**Files:**
- Create: `frontend/src/components/game/leaderboard-panel.tsx`
- Modify: `frontend/src/components/game/game-dashboard-shell.tsx`
- Modify: `frontend/src/components/game/game-dashboard-shell.test.tsx`

- [ ] **Step 1: Write failing render test**

Mock `useLeaderboardQuery` in `game-dashboard-shell.test.tsx` and add data:

```ts
leaderboardQuery: {
  data: [
    {
      betsCount: 3,
      payoutCents: "9000",
      playerId: "player-1",
      profitCents: "4000",
      rank: 1,
      username: "player",
      wageredCents: "5000",
    },
  ],
  error: null,
  isLoading: false,
}
```

Assert:

```ts
expect(screen.getByText("Leaderboard")).toBeTruthy();
expect(screen.getByText("player")).toBeTruthy();
expect(screen.getByText("R$ 40,00")).toBeTruthy();
```

- [ ] **Step 2: Verify RED**

Run:

```bash
cd frontend && bun run test src/components/game/game-dashboard-shell.test.tsx
```

Expected: fail because the panel is not rendered.

- [ ] **Step 3: Implement panel and layout**

Create `LeaderboardPanel` with props:

```ts
type LeaderboardPanelProps = {
  currentPlayerUsername: string | null;
  entries: LeaderboardEntry[];
  errorMessage?: string | null;
  isLoading: boolean;
  onPeriodChange: (period: LeaderboardPeriod) => void;
  period: LeaderboardPeriod;
};
```

Use compact rows, top 3 treatment, `24h`/`7d` buttons, and `formatCents`.

Update `GameDashboardShell` to own leaderboard period state and render:

- left panel always visible on large screens;
- collapsible summary on medium screens;
- normal flow section on mobile.

Use existing Tailwind utilities and avoid changing the 3D stage internals.

- [ ] **Step 4: Verify GREEN**

Run:

```bash
cd frontend && bun run test src/components/game/game-dashboard-shell.test.tsx
cd frontend && bun run build
```

Expected: component tests and frontend build pass.

## Task 6: Full Verification and Commit

**Files:**
- All files changed by Tasks 1-5.

- [ ] **Step 1: Run all required gates**

Run:

```bash
bun run lint
bun run check:types
bun run test:unit
cd frontend && bun run build
cd ..
bun run test:coverage && bun run quality:gate
docker compose config
docker compose up -d --build
bun scripts/ci/check-kong-health.ts
cd services/games && bun test tests/e2e
cd ../..
bun run test:e2e:browser
git diff --check
```

Expected: all commands exit with code 0.

- [ ] **Step 2: Browser validation**

Open `http://localhost:8000/` and verify:

- leaderboard visible on large desktop left side;
- medium layout can collapse leaderboard;
- mobile has no horizontal overflow;
- 3D stage remains visible and nonblank;
- betting and cashout controls are not covered.

- [ ] **Step 3: Commit only after all gates pass**

Run:

```bash
git add docs/superpowers/specs/2026-06-01-leaderboard-bonus-design.md \
  docs/superpowers/plans/2026-06-01-leaderboard-bonus.md \
  services/games/src/application/use-cases/list-leaderboard.use-case.ts \
  services/games/src/application/ports/game.repository.ts \
  services/games/src/infrastructure/prisma/game-prisma.repository.ts \
  services/games/src/app.module.ts \
  services/games/src/presentation/dtos/leaderboard-response.dto.ts \
  services/games/src/presentation/controllers/games.controller.ts \
  services/games/tests/unit/application/game-use-cases.test.ts \
  services/games/tests/unit/games-controller.test.ts \
  frontend/src/services/api-routes.ts \
  frontend/src/services/game-api.ts \
  frontend/src/services/game-api.test.ts \
  frontend/src/hooks/use-game-rest.ts \
  frontend/src/components/game/leaderboard-panel.tsx \
  frontend/src/components/game/game-dashboard-shell.tsx \
  frontend/src/components/game/game-dashboard-shell.test.tsx
git commit -m "feat(games): add leaderboard bonus"
```

Expected: commit succeeds only if all gates above passed.
