# Auto Cashout Per Bet Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add per-bet auto cashout so a player can set a target multiplier and receive payout exactly at that target when the backend lifecycle reaches it.

**Architecture:** Store an optional `autoCashoutMultiplierBp` on each Game bet. Validate it at the API/application boundary, persist it with Prisma, expose it in REST/realtime payloads, and execute automatic cashout inside `AdvanceRoundLifecycleUseCase` before crash evaluation. Keep manual cashout and wallet idempotency semantics unchanged.

**Tech Stack:** NestJS, Bun test, Prisma/PostgreSQL, RabbitMQ-backed wallet client, Socket.IO realtime, React/Vite/Tailwind, TanStack Query, Vitest, Playwright.

---

## Commit Policy For This Bonus

The user requires all tests before any commit. Do not commit during RED/GREEN
cycles. Complete the implementation, then run the full gate set and create one
implementation commit:

```bash
bun run lint
bun run check:types
bun run test:unit
cd frontend && bun run test
cd ..
cd frontend && bun run build
cd ..
bun run test:coverage && bun run quality:gate
docker compose config
docker compose up -d --build
bun scripts/ci/check-kong-health.ts
cd services/games && bun run test:e2e
cd ../..
bun run test:e2e:browser
git diff --check
```

If `services/wallets` still has no `tests/e2e` files, record that the wallets
E2E script is not applicable. No test may be deleted, skipped, disabled, or
weakened.

## Files

- Modify: `services/games/prisma/schema.prisma`
- Create: `services/games/prisma/migrations/20260601200000_add_auto_cashout_multiplier/migration.sql`
- Modify: `services/games/src/domain/bet.ts`
- Modify: `services/games/src/domain/round.ts`
- Modify: `services/games/src/application/use-cases/place-bet.use-case.ts`
- Modify: `services/games/src/application/use-cases/advance-round-lifecycle.use-case.ts`
- Create: `services/games/src/application/auto-cashout.ts`
- Modify: `services/games/src/infrastructure/prisma/game-prisma.repository.ts`
- Modify: `services/games/src/presentation/dtos/place-bet-request.dto.ts`
- Modify: `services/games/src/presentation/dtos/bet-response.dto.ts`
- Modify: `services/games/src/presentation/controllers/games.controller.ts`
- Modify: `services/games/src/presentation/round-response.mapper.ts`
- Modify: `services/games/src/presentation/realtime/round-realtime.events.ts`
- Modify: `services/games/tests/unit/domain/game-domain.test.ts`
- Modify: `services/games/tests/unit/application/game-use-cases.test.ts`
- Modify: `services/games/tests/unit/games-controller.test.ts`
- Modify: `services/games/tests/unit/presentation/round-realtime-serializer.test.ts`
- Modify: `services/games/tests/e2e/e2e-helpers.ts`
- Modify: `services/games/tests/e2e/cashout-flow.e2e.test.ts`
- Modify: `frontend/src/services/game-api.ts`
- Modify: `frontend/src/services/game-api.test.ts`
- Create: `frontend/src/services/auto-cashout.ts`
- Create: `frontend/src/services/auto-cashout.test.ts`
- Modify: `frontend/src/components/game/bet-controls-panel.tsx`
- Modify: `frontend/src/components/game/game-dashboard-shell.test.tsx`
- Modify: `tests/browser/player-flow.spec.ts`

## Task 1: Domain Field And Manual Cashout Compatibility

**Files:**
- Modify: `services/games/src/domain/bet.ts`
- Modify: `services/games/src/domain/round.ts`
- Modify: `services/games/tests/unit/domain/game-domain.test.ts`

- [ ] **Step 1: Write the failing domain tests**

Append these tests to the existing `describe("Bet", ...)` and
`describe("Round", ...)` blocks in
`services/games/tests/unit/domain/game-domain.test.ts`:

```ts
test("stores an optional auto cashout target", () => {
  const bet = Bet.accepted({
    id: "bet-1",
    roundId: "round-1",
    playerId: "player-1",
    username: "player",
    amountCents: 1000n,
    autoCashoutMultiplierBp: 20000,
  });

  expect(bet.autoCashoutMultiplierBp).toBe(20000);

  const restored = Bet.restore({
    id: "bet-2",
    roundId: "round-1",
    playerId: "player-1",
    username: "player",
    amountCents: 1000n,
    status: "ACCEPTED",
    autoCashoutMultiplierBp: 15000,
  });

  expect(restored.autoCashoutMultiplierBp).toBe(15000);
});
```

```ts
test("manual cashout still works for a bet with a future auto target", () => {
  const round = Round.openBetting({
    id: "round-1",
    bettingStartsAt,
    bettingEndsAt,
    crashPointBp: 30000,
    serverSeedHash: "seed-hash",
    clientSeed: "client",
    nonce: 1,
    chainIndex: 1,
  });
  round.placeBet({
    id: "bet-1",
    playerId: "player-1",
    username: "player",
    amountCents: 1000n,
    autoCashoutMultiplierBp: 25000,
  });
  round.start(new Date("2026-05-30T10:00:11.000Z"));

  const bet = round.cashOut("player-1", 15000);

  expect(bet.autoCashoutMultiplierBp).toBe(25000);
  expect(bet.cashoutMultiplierBp).toBe(15000);
  expect(bet.payoutCents).toBe(1500n);
});
```

- [ ] **Step 2: Verify RED**

Run:

```bash
cd services/games && bun test tests/unit/domain/game-domain.test.ts
```

Expected: fail because `autoCashoutMultiplierBp` is not accepted or exposed by
`Bet` and `Round.placeBet`.

- [ ] **Step 3: Add the field to `Bet`**

In `services/games/src/domain/bet.ts`, extend the accepted and restore params:

```ts
type AcceptedBetParams = {
  id: string;
  roundId: string;
  playerId: string;
  username: string;
  amountCents: bigint;
  autoCashoutMultiplierBp?: number | null;
};

type RestoreBetParams = AcceptedBetParams & {
  status: BetStatus;
  cashoutMultiplierBp?: number | null;
  payoutCents?: bigint | number | string | null;
  rejectionReason?: string | null;
};
```

Add storage, constructor parameter, and getter:

```ts
private constructor(
  public readonly id: string,
  public readonly roundId: string,
  public readonly playerId: string,
  public readonly username: string,
  public readonly amountCents: bigint,
  public readonly autoCashoutMultiplierBp: number | null,
  status: BetStatus,
) {
  this.currentStatus = status;
}
```

Update `accepted` and `restore` construction:

```ts
return new Bet(
  params.id,
  params.roundId,
  params.playerId,
  params.username,
  params.amountCents,
  params.autoCashoutMultiplierBp ?? null,
  "ACCEPTED",
);
```

```ts
const bet = new Bet(
  params.id,
  params.roundId,
  params.playerId,
  params.username,
  params.amountCents,
  params.autoCashoutMultiplierBp ?? null,
  params.status,
);
```

- [ ] **Step 4: Pass the field through `Round.placeBet`**

In `services/games/src/domain/round.ts`, update `PlaceBetParams`:

```ts
type PlaceBetParams = {
  id: string;
  playerId: string;
  username: string;
  amountCents: bigint;
  autoCashoutMultiplierBp?: number | null;
};
```

Pass it to `Bet.accepted`:

```ts
const bet = Bet.accepted({
  id: params.id,
  roundId: this.id,
  playerId: params.playerId,
  username: params.username,
  amountCents: params.amountCents,
  autoCashoutMultiplierBp: params.autoCashoutMultiplierBp ?? null,
});
```

- [ ] **Step 5: Verify GREEN**

Run:

```bash
cd services/games && bun test tests/unit/domain/game-domain.test.ts
```

Expected: all domain tests pass.

## Task 2: Request Validation And Place Bet Contract

**Files:**
- Modify: `services/games/src/application/use-cases/place-bet.use-case.ts`
- Create: `services/games/src/application/auto-cashout.ts`
- Modify: `services/games/src/presentation/dtos/place-bet-request.dto.ts`
- Modify: `services/games/src/presentation/controllers/games.controller.ts`
- Modify: `services/games/tests/unit/application/game-use-cases.test.ts`
- Modify: `services/games/tests/unit/games-controller.test.ts`

- [ ] **Step 1: Write failing use case tests**

In `services/games/tests/unit/application/game-use-cases.test.ts`, append to
`describe("PlaceBetUseCase", ...)`:

```ts
test("saves an accepted bet with an auto cashout target", async () => {
  const round = openRound();
  const repository = new InMemoryGameRepository(round);
  const walletClient = new FakeWalletClient();
  const events = new FakeRoundEventsPublisher();
  const useCase = new PlaceBetUseCase(
    repository,
    walletClient,
    new FixedIdGenerator("bet-1"),
    events,
  );

  const result = await useCase.execute({
    playerId: "player-1",
    username: "player",
    amountCents: "1000",
    autoCashoutMultiplierBp: 20000,
  });

  expect(result.bet.autoCashoutMultiplierBp).toBe(20000);
  expect(repository.savedRounds.at(-1)?.bets[0]?.autoCashoutMultiplierBp).toBe(
    20000,
  );
  expect(events.betPlacedEvents[0]?.autoCashoutMultiplierBp).toBe(20000);
});

test("rejects auto cashout targets outside the allowed range", async () => {
  const useCase = new PlaceBetUseCase(
    new InMemoryGameRepository(openRound()),
    new FakeWalletClient(),
    new FixedIdGenerator("bet-1"),
    new FakeRoundEventsPublisher(),
  );

  await expect(
    useCase.execute({
      playerId: "player-1",
      username: "player",
      amountCents: "1000",
      autoCashoutMultiplierBp: 10099,
    }),
  ).rejects.toThrow(BetAmountOutOfRangeError);

  await expect(
    useCase.execute({
      playerId: "player-1",
      username: "player",
      amountCents: "1000",
      autoCashoutMultiplierBp: 10000001,
    }),
  ).rejects.toThrow(BetAmountOutOfRangeError);
});
```

- [ ] **Step 2: Verify RED for use case**

Run:

```bash
cd services/games && bun test tests/unit/application/game-use-cases.test.ts
```

Expected: fail because `PlaceBetUseCase` does not accept or validate
`autoCashoutMultiplierBp`.

- [ ] **Step 3: Add auto cashout validation helper**

Create `services/games/src/application/auto-cashout.ts`:

```ts
import { BetAmountOutOfRangeError } from "./game.errors";

export const MIN_AUTO_CASHOUT_MULTIPLIER_BP = 10100;
export const MAX_AUTO_CASHOUT_MULTIPLIER_BP = 10000000;

export function parseAutoCashoutMultiplierBp(
  value: number | null | undefined,
): number | null {
  if (value === null || value === undefined) {
    return null;
  }

  if (
    !Number.isInteger(value) ||
    value < MIN_AUTO_CASHOUT_MULTIPLIER_BP ||
    value > MAX_AUTO_CASHOUT_MULTIPLIER_BP
  ) {
    throw new BetAmountOutOfRangeError();
  }

  return value;
}
```

- [ ] **Step 4: Pass the target through `PlaceBetUseCase`**

In `services/games/src/application/use-cases/place-bet.use-case.ts`, import
the helper:

```ts
import { parseAutoCashoutMultiplierBp } from "../auto-cashout";
```

Update input:

```ts
type PlaceBetInput = {
  playerId: string;
  username: string;
  amountCents: bigint | number | string;
  autoCashoutMultiplierBp?: number | null;
};
```

After amount validation, parse the target:

```ts
const autoCashoutMultiplierBp = parseAutoCashoutMultiplierBp(
  input.autoCashoutMultiplierBp,
);
```

Pass it to `round.placeBet`:

```ts
const bet = round.placeBet({
  id: betId,
  playerId: input.playerId,
  username: input.username,
  amountCents,
  autoCashoutMultiplierBp,
});
```

- [ ] **Step 5: Verify use case GREEN**

Run:

```bash
cd services/games && bun test tests/unit/application/game-use-cases.test.ts
```

Expected: use case tests pass.

- [ ] **Step 6: Write failing controller tests**

In `services/games/tests/unit/games-controller.test.ts`, update the
`places a bet for the authenticated user` test to assert forwarding:

```ts
execute: async (input: {
  playerId: string;
  amountCents: string;
  autoCashoutMultiplierBp?: number | null;
}) => {
  expect(input).toMatchObject({
    playerId: "player-1",
    amountCents: "1000",
    autoCashoutMultiplierBp: 20000,
  });

  return { bet: acceptedBet({ autoCashoutMultiplierBp: 20000 }), balanceCents: 99000n };
},
```

Call `placeBet` with:

```ts
{ amountCents: "1000", autoCashoutMultiplierBp: 20000 }
```

Add this helper signature near the existing `acceptedBet` helper:

```ts
function acceptedBet(
  overrides: { autoCashoutMultiplierBp?: number | null } = {},
): Bet {
  return Bet.accepted({
    id: "bet-1",
    roundId: "round-1",
    playerId: "player-1",
    username: "player",
    amountCents: 1000n,
    autoCashoutMultiplierBp: overrides.autoCashoutMultiplierBp ?? null,
  });
}
```

Add a new invalid request test:

```ts
test("rejects invalid auto cashout targets", async () => {
  const controller = createController({
    placeBetUseCase: {
      execute: async () => {
        throw new BetAmountOutOfRangeError();
      },
    },
  });

  await expect(
    controller.placeBet(
      { playerId: "player-1", username: "player" },
      { amountCents: "1000", autoCashoutMultiplierBp: 10099 },
    ),
  ).rejects.toThrow(BadRequestException);
});
```

Import `BetAmountOutOfRangeError` in
`services/games/tests/unit/games-controller.test.ts` with the existing game
error imports.

- [ ] **Step 7: Verify controller RED**

Run:

```bash
cd services/games && bun test tests/unit/games-controller.test.ts
```

Expected: fail because DTO/controller does not expose the field.

- [ ] **Step 8: Add DTO validation and controller forwarding**

In `services/games/src/presentation/dtos/place-bet-request.dto.ts`:

```ts
import { ApiProperty } from "@nestjs/swagger";
import {
  MAX_AUTO_CASHOUT_MULTIPLIER_BP,
  MIN_AUTO_CASHOUT_MULTIPLIER_BP,
} from "../../application/auto-cashout";

export class PlaceBetRequestDto {
  @ApiProperty({ example: "1000" })
  amountCents!: string;

  @ApiProperty({
    description: "Optional auto cashout target multiplier in basis points.",
    example: 20000,
    maximum: MAX_AUTO_CASHOUT_MULTIPLIER_BP,
    minimum: MIN_AUTO_CASHOUT_MULTIPLIER_BP,
    nullable: true,
    required: false,
  })
  autoCashoutMultiplierBp?: number | null;
}
```

In `services/games/src/presentation/controllers/games.controller.ts`, forward:

```ts
const result = await this.placeBetUseCase.execute({
  playerId: user.playerId,
  username: user.username,
  amountCents: body.amountCents,
  autoCashoutMultiplierBp: body.autoCashoutMultiplierBp ?? null,
});
```

If the use case throws `BetAmountOutOfRangeError`, the existing HTTP error
mapper already returns `BadRequestException`.

- [ ] **Step 9: Verify controller GREEN**

Run:

```bash
cd services/games && bun test tests/unit/games-controller.test.ts
```

Expected: controller tests pass.

## Task 3: Persistence And Response Mapping

**Files:**
- Modify: `services/games/prisma/schema.prisma`
- Create: `services/games/prisma/migrations/20260601200000_add_auto_cashout_multiplier/migration.sql`
- Modify: `services/games/src/infrastructure/prisma/game-prisma.repository.ts`
- Modify: `services/games/src/presentation/dtos/bet-response.dto.ts`
- Modify: `services/games/src/presentation/round-response.mapper.ts`
- Modify: `services/games/src/presentation/realtime/round-realtime.events.ts`
- Modify: `services/games/tests/unit/games-controller.test.ts`
- Modify: `services/games/tests/unit/presentation/round-realtime-serializer.test.ts`

- [ ] **Step 1: Add Prisma schema and migration**

In `services/games/prisma/schema.prisma`, add the field to `model Bet` after
`status`:

```prisma
  autoCashoutMultiplierBp Int?
```

Create a migration directory such as:

```bash
mkdir -p services/games/prisma/migrations/20260601200000_add_auto_cashout_multiplier
```

Create
`services/games/prisma/migrations/20260601200000_add_auto_cashout_multiplier/migration.sql`:

```sql
ALTER TABLE "bets" ADD COLUMN "autoCashoutMultiplierBp" INTEGER;
```

- [ ] **Step 2: Update Prisma mappings**

In `services/games/src/infrastructure/prisma/game-prisma.repository.ts`, add
the field to both `create` and `update` data inside the bet `upsert`:

```ts
autoCashoutMultiplierBp: bet.autoCashoutMultiplierBp,
```

In `toBet`, restore it:

```ts
autoCashoutMultiplierBp: bet.autoCashoutMultiplierBp,
```

- [ ] **Step 3: Expose the field in public bet responses**

In `services/games/src/presentation/dtos/bet-response.dto.ts`, add:

```ts
@ApiProperty({ nullable: true, example: 20000 })
autoCashoutMultiplierBp!: number | null;
```

In `services/games/src/presentation/round-response.mapper.ts`, include:

```ts
autoCashoutMultiplierBp: bet.autoCashoutMultiplierBp,
```

In `services/games/src/presentation/realtime/round-realtime.events.ts`, add to
`RealtimeBetPayload`:

```ts
autoCashoutMultiplierBp: number | null;
```

- [ ] **Step 4: Update response tests**

In `services/games/tests/unit/games-controller.test.ts`, update assertions that
match bet responses to include:

```ts
autoCashoutMultiplierBp: 20000,
```

In `services/games/tests/unit/presentation/round-realtime-serializer.test.ts`,
add `autoCashoutMultiplierBp` to the expected realtime bet payload:

```ts
expect(serializer.toBetRealtimePayload(bet)).toMatchObject({
  autoCashoutMultiplierBp: 20000,
});
```

If the current test creates a plain accepted bet, pass
`autoCashoutMultiplierBp: 20000` to `Bet.accepted`.

- [ ] **Step 5: Verify mappings and generated Prisma client**

Run:

```bash
cd services/games && bun run db:generate && bun test tests/unit/games-controller.test.ts tests/unit/presentation/round-realtime-serializer.test.ts
```

Expected: tests pass and Prisma client generation succeeds.

## Task 4: Backend Lifecycle Auto Cashout

**Files:**
- Modify: `services/games/src/application/use-cases/advance-round-lifecycle.use-case.ts`
- Modify: `services/games/tests/unit/application/game-use-cases.test.ts`

- [ ] **Step 1: Write failing lifecycle tests**

In `services/games/tests/unit/application/game-use-cases.test.ts`, append these
tests to `describe("AdvanceRoundLifecycleUseCase", ...)`:

```ts
test("automatically cashes out accepted bets at the configured target", async () => {
  const round = openRound(30000);
  round.placeBet({
    id: "bet-1",
    playerId: "player-1",
    username: "player",
    amountCents: 1000n,
    autoCashoutMultiplierBp: 15000,
  });
  round.start(new Date("2026-05-30T10:00:10.000Z"));
  const repository = new InMemoryGameRepository(round);
  const walletClient = new FakeWalletClient();
  const events = new FakeRoundEventsPublisher();
  const useCase = new AdvanceRoundLifecycleUseCase(
    repository,
    new FixedIdGenerator("round-2"),
    new FixedClock(new Date("2026-05-30T10:00:15.000Z")),
    new FakeRoundSeedProvider(),
    walletClient,
    { bettingWindowMs: 10000 },
    events,
  );

  const result = await useCase.execute();
  const bet = result.round?.bets[0];

  expect(result.action).toBe("NOOP");
  expect(bet?.status).toBe("CASHED_OUT");
  expect(bet?.cashoutMultiplierBp).toBe(15000);
  expect(bet?.payoutCents).toBe(1500n);
  expect(walletClient.credits[0]).toMatchObject({
    amountCents: 1500n,
    playerId: "player-1",
    referenceId: "round:round-1:player:player-1:cashout-credit",
    reason: "CASHOUT_PAYOUT",
  });
  expect(events.betCashedOutEvents[0]?.cashoutMultiplierBp).toBe(15000);
});

test("auto cashout wins when a tick passes target and crash point", async () => {
  const round = openRound(20400);
  round.placeBet({
    id: "bet-1",
    playerId: "player-1",
    username: "player",
    amountCents: 1000n,
    autoCashoutMultiplierBp: 20000,
  });
  round.start(new Date("2026-05-30T10:00:10.000Z"));
  const repository = new InMemoryGameRepository(round);
  const useCase = new AdvanceRoundLifecycleUseCase(
    repository,
    new FixedIdGenerator("round-2"),
    new FixedClock(new Date("2026-05-30T10:00:21.000Z")),
    new FakeRoundSeedProvider(),
    new FakeWalletClient(),
    { bettingWindowMs: 10000 },
    new FakeRoundEventsPublisher(),
  );

  const result = await useCase.execute();

  expect(result.action).toBe("ROUND_CRASHED");
  expect(result.round?.bets[0]?.status).toBe("CASHED_OUT");
  expect(result.round?.bets[0]?.cashoutMultiplierBp).toBe(20000);
});

test("does not auto cashout when target is at or above crash point", async () => {
  const round = openRound(20000);
  round.placeBet({
    id: "bet-1",
    playerId: "player-1",
    username: "player",
    amountCents: 1000n,
    autoCashoutMultiplierBp: 20000,
  });
  round.start(new Date("2026-05-30T10:00:10.000Z"));
  const repository = new InMemoryGameRepository(round);
  const useCase = new AdvanceRoundLifecycleUseCase(
    repository,
    new FixedIdGenerator("round-2"),
    new FixedClock(new Date("2026-05-30T10:00:20.000Z")),
    new FakeRoundSeedProvider(),
    new FakeWalletClient(),
    { bettingWindowMs: 10000 },
    new FakeRoundEventsPublisher(),
  );

  const result = await useCase.execute();

  expect(result.action).toBe("ROUND_CRASHED");
  expect(result.round?.bets[0]?.status).toBe("LOST");
});
```

- [ ] **Step 2: Verify RED**

Run:

```bash
cd services/games && bun test tests/unit/application/game-use-cases.test.ts
```

Expected: fail because `AdvanceRoundLifecycleUseCase` does not accept an events
publisher and does not auto cashout.

- [ ] **Step 3: Inject `RoundEventsPublisher` into lifecycle use case**

In `services/games/src/application/use-cases/advance-round-lifecycle.use-case.ts`,
import:

```ts
import type { RoundEventsPublisher } from "../ports/round-events.publisher";
```

Add a constructor parameter after `config`:

```ts
private readonly roundEventsPublisher?: RoundEventsPublisher,
```

Update `services/games/src/app.module.ts` lifecycle provider to pass the
existing `ROUND_EVENTS_PUBLISHER` after config:

```ts
{ bettingWindowMs: Number(process.env.ROUND_BETTING_WINDOW_MS ?? 10000) },
roundEventsPublisher,
```

If the current provider factory does not inject `ROUND_EVENTS_PUBLISHER`, add
it to the `inject` array and factory parameter list.

- [ ] **Step 4: Implement auto cashout before crash evaluation**

In `advanceRunningRound`, after `multiplierBp` is calculated and before the
crash comparison, call:

```ts
await this.applyAutoCashouts(round, multiplierBp);
```

Add this private method:

```ts
private async applyAutoCashouts(
  round: Round,
  currentMultiplierBp: number,
): Promise<void> {
  const eligibleBets = round.bets.filter(
    (bet) =>
      bet.status === "ACCEPTED" &&
      bet.autoCashoutMultiplierBp !== null &&
      bet.autoCashoutMultiplierBp < round.crashPointBp &&
      currentMultiplierBp >= bet.autoCashoutMultiplierBp,
  );

  for (const bet of eligibleBets) {
    const targetMultiplierBp = bet.autoCashoutMultiplierBp;

    if (targetMultiplierBp === null) {
      continue;
    }

    round.cashOut(bet.playerId, targetMultiplierBp);

    if (bet.payoutCents === null) {
      throw new Error("Auto cashout payout was not calculated");
    }

    await this.gameRepository.saveRound(round);

    await this.walletClient.credit({
      playerId: bet.playerId,
      amountCents: bet.payoutCents,
      referenceId: `round:${round.id}:player:${bet.playerId}:cashout-credit`,
      reason: "CASHOUT_PAYOUT",
    });

    round.completeCashOut(bet.playerId);
    await this.gameRepository.saveRound(round);
    await this.roundEventsPublisher?.publishBetCashedOut(bet);
  }
}
```

Keep the existing crash check after this method so a same-tick target below
crash gets completed before `round.crash(...)` marks remaining accepted bets as
lost.

- [ ] **Step 5: Verify lifecycle GREEN**

Run:

```bash
cd services/games && bun test tests/unit/application/game-use-cases.test.ts
```

Expected: lifecycle and use case tests pass.

## Task 5: Frontend API And Auto Cashout Helpers

**Files:**
- Modify: `frontend/src/services/game-api.ts`
- Modify: `frontend/src/services/game-api.test.ts`
- Create: `frontend/src/services/auto-cashout.ts`
- Create: `frontend/src/services/auto-cashout.test.ts`

- [ ] **Step 1: Write failing frontend service tests**

In `frontend/src/services/game-api.test.ts`, update the bet placement test:

```ts
await api.placeBet({
  amountCents: "1000",
  autoCashoutMultiplierBp: 20000,
});
```

Expected body:

```ts
body: JSON.stringify({
  amountCents: "1000",
  autoCashoutMultiplierBp: 20000,
}),
```

Create `frontend/src/services/auto-cashout.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  formatMultiplierBp,
  parseAutoCashoutMultiplierInput,
} from "./auto-cashout";

describe("auto cashout helpers", () => {
  it("parses decimal multipliers to basis points", () => {
    expect(parseAutoCashoutMultiplierInput("2.00")).toEqual({
      multiplierBp: 20000,
      valid: true,
    });
    expect(parseAutoCashoutMultiplierInput("1.50")).toEqual({
      multiplierBp: 15000,
      valid: true,
    });
  });

  it("rejects values outside the visible limits", () => {
    expect(parseAutoCashoutMultiplierInput("1.00")).toEqual({
      multiplierBp: null,
      valid: false,
    });
    expect(parseAutoCashoutMultiplierInput("1000.01")).toEqual({
      multiplierBp: null,
      valid: false,
    });
  });

  it("formats basis points for active bet display", () => {
    expect(formatMultiplierBp(20000)).toBe("2.00x");
  });
});
```

- [ ] **Step 2: Verify frontend service RED**

Run:

```bash
cd frontend && bun run test src/services/game-api.test.ts src/services/auto-cashout.test.ts
```

Expected: fail because helpers and API field do not exist.

- [ ] **Step 3: Add frontend helper**

Create `frontend/src/services/auto-cashout.ts`:

```ts
export const MIN_AUTO_CASHOUT_MULTIPLIER_BP = 10100;
export const MAX_AUTO_CASHOUT_MULTIPLIER_BP = 10000000;

export type AutoCashoutParseResult = {
  multiplierBp: number | null;
  valid: boolean;
};

export function parseAutoCashoutMultiplierInput(
  value: string,
): AutoCashoutParseResult {
  const trimmed = value.trim().replace(",", ".");

  if (!/^\d+(\.\d{1,2})?$/.test(trimmed)) {
    return { multiplierBp: null, valid: false };
  }

  const [wholePart, fractionPart = ""] = trimmed.split(".");
  const basisPoints =
    Number(wholePart) * 10000 +
    Number(fractionPart.padEnd(2, "0").slice(0, 2)) * 100;

  if (
    !Number.isInteger(basisPoints) ||
    basisPoints < MIN_AUTO_CASHOUT_MULTIPLIER_BP ||
    basisPoints > MAX_AUTO_CASHOUT_MULTIPLIER_BP
  ) {
    return { multiplierBp: null, valid: false };
  }

  return { multiplierBp: basisPoints, valid: true };
}

export function formatMultiplierBp(multiplierBp: number): string {
  return `${(multiplierBp / 10000).toFixed(2)}x`;
}
```

- [ ] **Step 4: Extend frontend API types**

In `frontend/src/services/game-api.ts`, add to `BetResponse`:

```ts
autoCashoutMultiplierBp: number | null;
```

Add to `PlaceBetInput`:

```ts
autoCashoutMultiplierBp?: number | null;
```

No special request-building is needed because `placeBet` already serializes the
input object.

- [ ] **Step 5: Verify frontend services GREEN**

Run:

```bash
cd frontend && bun run test src/services/game-api.test.ts src/services/auto-cashout.test.ts
```

Expected: tests pass.

## Task 6: Frontend Controls

**Files:**
- Modify: `frontend/src/components/game/bet-controls-panel.tsx`
- Modify: `frontend/src/components/game/game-dashboard-shell.test.tsx`

- [ ] **Step 1: Write failing UI tests**

In `frontend/src/components/game/game-dashboard-shell.test.tsx`, update
`createBet` return values to include:

```ts
autoCashoutMultiplierBp: overrides.autoCashoutMultiplierBp ?? null,
```

Add a test:

```ts
it("configures auto cashout with visible limits and presets", () => {
  render(<BetControlsPanel activeBet={null} currentRound={createRound()} />);

  expect(screen.getByText("Limite: 1.01x a 1000.00x")).toBeTruthy();

  fireEvent.click(screen.getByRole("button", { name: /Auto cashout/ }));
  fireEvent.click(screen.getByRole("button", { name: "2.00x" }));
  fireEvent.click(screen.getByRole("button", { name: "Apostar" }));

  expect(hookMocks.placeBetMutation.mutate).toHaveBeenCalledWith({
    amountCents: "1000",
    autoCashoutMultiplierBp: 20000,
  });
});

it("disables betting when auto cashout target is outside limits", () => {
  render(<BetControlsPanel activeBet={null} currentRound={createRound()} />);

  fireEvent.click(screen.getByRole("button", { name: /Auto cashout/ }));
  fireEvent.change(screen.getByLabelText("Multiplicador alvo"), {
    target: { value: "1.00" },
  });

  expect(screen.getByRole("button", { name: "Apostar" })).toHaveProperty(
    "disabled",
    true,
  );
});

it("shows the active bet auto cashout target", () => {
  render(
    <BetControlsPanel
      activeBet={createBet({ autoCashoutMultiplierBp: 20000 })}
      currentRound={createRound({ status: "RUNNING" })}
    />,
  );

  expect(screen.getByText("Auto cashout em 2.00x")).toBeTruthy();
});
```

- [ ] **Step 2: Verify UI RED**

Run:

```bash
cd frontend && bun run test src/components/game/game-dashboard-shell.test.tsx
```

Expected: fail because the controls do not exist.

- [ ] **Step 3: Add control state and validation**

In `frontend/src/components/game/bet-controls-panel.tsx`, import `useState`
and helpers:

```ts
import { useState } from "react";
import {
  formatMultiplierBp,
  parseAutoCashoutMultiplierInput,
} from "../../services/auto-cashout";
```

Inside `BetControlsPanel`, add:

```ts
const [autoCashoutEnabled, setAutoCashoutEnabled] = useState(false);
const [autoCashoutTarget, setAutoCashoutTarget] = useState("2.00");
const autoCashoutParseResult =
  parseAutoCashoutMultiplierInput(autoCashoutTarget);
const autoCashoutIsValid =
  !autoCashoutEnabled || autoCashoutParseResult.valid;
```

Update `canPlaceBet`:

```ts
const canPlaceBet =
  isAuthenticated &&
  amountIsValid &&
  autoCashoutIsValid &&
  currentRound?.status === "BETTING" &&
  !activeBet &&
  !placeBetMutation.isPending;
```

- [ ] **Step 4: Render toggle, limits, input, and presets**

Add this block below the amount summary cards:

```tsx
<div className="mt-3 rounded-md border border-cyan-300/15 bg-cyan-300/10 p-3">
  <button
    className={cn(
      "flex w-full items-center justify-between text-left text-sm font-semibold",
      autoCashoutEnabled ? "text-cyan-100" : "text-zinc-300",
    )}
    onClick={() => setAutoCashoutEnabled((enabled) => !enabled)}
    type="button"
  >
    <span>Auto cashout</span>
    <span className="font-mono text-xs">
      {autoCashoutEnabled ? "ON" : "OFF"}
    </span>
  </button>
  <p className="mt-1 text-xs text-zinc-500">Limite: 1.01x a 1000.00x</p>

  {autoCashoutEnabled ? (
    <div className="mt-3 space-y-3">
      <label
        className="block text-xs font-medium text-zinc-400"
        htmlFor="auto-cashout-target"
      >
        Multiplicador alvo
      </label>
      <Input
        className="h-10 border-cyan-300/25 bg-black/45 font-mono"
        id="auto-cashout-target"
        inputMode="decimal"
        onChange={(event) => setAutoCashoutTarget(event.target.value)}
        value={autoCashoutTarget}
      />
      <div className="grid grid-cols-3 gap-2">
        {["1.50", "2.00", "3.00"].map((preset) => (
          <Button
            key={preset}
            onClick={() => setAutoCashoutTarget(preset)}
            type="button"
            variant="ghost"
          >
            {preset}x
          </Button>
        ))}
      </div>
      {!autoCashoutParseResult.valid ? (
        <p className="text-xs text-rose-200">
          Escolha um alvo entre 1.01x e 1000.00x.
        </p>
      ) : null}
    </div>
  ) : null}
</div>
```

- [ ] **Step 5: Send target and show active target**

Update the bet click handler:

```tsx
onClick={() =>
  placeBetMutation.mutate({
    amountCents: betAmountCents,
    autoCashoutMultiplierBp: autoCashoutEnabled
      ? autoCashoutParseResult.multiplierBp
      : null,
  })
}
```

In the active bet section, add:

```tsx
{activeBet.autoCashoutMultiplierBp ? (
  <p className="mt-1 text-cyan-200">
    Auto cashout em {formatMultiplierBp(activeBet.autoCashoutMultiplierBp)}
  </p>
) : null}
```

- [ ] **Step 6: Verify UI GREEN**

Run:

```bash
cd frontend && bun run test src/components/game/game-dashboard-shell.test.tsx
```

Expected: UI tests pass.

## Task 7: E2E And Browser Coverage

**Files:**
- Modify: `services/games/tests/e2e/e2e-helpers.ts`
- Modify: `services/games/tests/e2e/cashout-flow.e2e.test.ts`
- Modify: `tests/browser/player-flow.spec.ts`

- [ ] **Step 1: Extend E2E helper payloads**

In `services/games/tests/e2e/e2e-helpers.ts`, add the response field:

```ts
export type BetResponse = {
  id: string;
  roundId: string;
  playerId: string;
  username: string;
  amountCents: string;
  status:
    | "ACCEPTED"
    | "REJECTED"
    | "CASHOUT_PENDING_CREDIT"
    | "CASHED_OUT"
    | "LOST";
  autoCashoutMultiplierBp: number | null;
  cashoutMultiplierBp: number | null;
  payoutCents: string | null;
  rejectionReason: string | null;
};
```

Update `placeBet` to accept the optional auto cashout target while preserving
existing two-argument calls:

```ts
export async function placeBet(
  token: string,
  amountCents: string,
  autoCashoutMultiplierBp?: number | null,
): Promise<BetResponse> {
  const body =
    autoCashoutMultiplierBp === undefined
      ? { amountCents }
      : { amountCents, autoCashoutMultiplierBp };

  return apiJson<BetResponse>("/games/bet", {
    method: "POST",
    token,
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
}
```

- [ ] **Step 2: Add backend E2E scenario**

In `services/games/tests/e2e/cashout-flow.e2e.test.ts`, add a second test
after the manual cashout test:

```ts
test(
  "automatically cashes out at the configured target without manual cashout",
  async () => {
    await withE2ELock(async () => {
      await ensureStackIsHealthy();
      const token = await getAccessToken();
      const beforeWallet = await getWallet(token);
      const beforeBalance = BigInt(beforeWallet.balanceCents);
      const bettingRound = await prepareBettingRound(15000);

      const bet = await placeBet(token, "1000", 15000);

      expect(bet.roundId).toBe(bettingRound.id);
      expect(bet.status).toBe("ACCEPTED");
      expect(bet.autoCashoutMultiplierBp).toBe(15000);

      await forceBettingRoundToStart(bettingRound.id);
      await waitForCurrentStatus("RUNNING");

      let latestBet = bet;

      for (let attempt = 0; attempt < 30; attempt += 1) {
        latestBet = (await listMyBets(token, 1))[0] ?? latestBet;

        if (latestBet.status === "CASHED_OUT") {
          break;
        }

        await Bun.sleep(500);
      }

      expect(latestBet.status).toBe("CASHED_OUT");
      expect(latestBet.autoCashoutMultiplierBp).toBe(15000);
      expect(latestBet.cashoutMultiplierBp).toBe(15000);
      expect(latestBet.payoutCents).toBe("1500");

      const afterWallet = await getWallet(token);

      expect(BigInt(afterWallet.balanceCents)).toBe(
        beforeBalance - 1000n + 1500n,
      );

      await forceRunningRoundToCrash(bettingRound.id);
      await waitForRoundStatus(bettingRound.id, "SETTLED");

      const verification = await verifyRound(bettingRound.id);

      expect(verification.status).toBe("SETTLED");
      expect(verification.revealed).toBe(true);
      expect(verification.serverSeedMatchesCommitment).toBe(true);
      expect(verification.fair).toBe(true);
    });
  },
  { timeout: 120000 },
);
```

- [ ] **Step 3: Verify backend E2E RED/GREEN around implementation**

After adding the test, run:

```bash
cd services/games && bun test tests/e2e/cashout-flow.e2e.test.ts
```

Expected before implementation: fail because auto cashout is not available.
Expected after Tasks 1-6: pass.

- [ ] **Step 4: Extend browser flow**

In `tests/browser/player-flow.spec.ts`, keep the existing manual cashout test
and add a second Playwright test:

```ts
test("player can use auto cashout preset without manual cashout", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { exact: true, name: "Entrar" }).click();

  await page.locator('input[name="username"]').fill("player");
  await page.locator('input[name="password"]').fill("player123");
  await page.locator('button[type="submit"]').click();

  await expect(page).toHaveURL("http://localhost:8000/");
  await expect(page.getByRole("banner").getByText("player")).toBeVisible();

  execFileSync("bun", ["run", "e2e:prepare", "cashout"], {
    stdio: "inherit",
  });

  await page.reload();

  await expect(page.getByText("LIVE").first()).toBeVisible();
  await expect(page.getByText("BETTING").first()).toBeVisible();
  await expect(page.getByText("Limite: 1.01x a 1000.00x")).toBeVisible();

  const balanceBeforeBet = await readDisplayedBalance(page);

  await page.getByRole("button", { name: /Auto cashout/ }).click();
  await page.getByRole("button", { name: "1.50x" }).click();
  await page.getByRole("button", { name: "Apostar" }).click();

  await expect(page.getByText("Auto cashout em 1.50x")).toBeVisible();
  await expect(page.getByText("CASHED_OUT")).toBeVisible({ timeout: 20000 });
  await expectTimeCarAssetLoaded(page);
  await expectCanvasHasPixels(page);
  await expect(async () => {
    const currentBalance = await readDisplayedBalance(page);

    expect(currentBalance).not.toBe(balanceBeforeBet);
  }).toPass({ timeout: 20000 });
});
```

- [ ] **Step 5: Verify browser E2E**

Run:

```bash
bun run test:e2e:browser
```

Expected: all browser E2E tests pass.

## Task 8: Full Verification And Final Commit

**Files:**
- All files changed by Tasks 1-7.

- [ ] **Step 1: Run full local gates**

Run:

```bash
bun run lint
bun run check:types
bun run test:unit
cd frontend && bun run test
cd ..
cd frontend && bun run build
cd ..
bun run test:coverage && bun run quality:gate
docker compose config
docker compose up -d --build
bun scripts/ci/check-kong-health.ts
cd services/games && bun run test:e2e
cd ../..
bun run test:e2e:browser
git diff --check
```

Expected: every command exits with code 0. If any command fails, inspect the
real failure, fix only the required scope, and rerun the relevant focused test
before restarting the full gate sequence.

- [ ] **Step 2: Confirm no tests were deleted or disabled**

Run:

```bash
git diff -- tests services frontend | rg "skip\\(|\\.only\\(|describe\\.skip|test\\.skip|it\\.skip|delete mode|^-\\s*(test|it)\\("
```

Expected: no deleted/disabled tests. If the command prints a legitimate test
edit, inspect it manually and confirm the behavioral coverage was preserved or
increased.

- [ ] **Step 3: Review final status and commit**

Run:

```bash
git status --short --branch
git diff --stat
```

Expected: only intended Auto cashout files changed.

Then commit:

```bash
git add services/games/prisma/schema.prisma \
  services/games/prisma/migrations/20260601200000_add_auto_cashout_multiplier/migration.sql \
  services/games/src/domain/bet.ts \
  services/games/src/domain/round.ts \
  services/games/src/application/auto-cashout.ts \
  services/games/src/application/use-cases/place-bet.use-case.ts \
  services/games/src/application/use-cases/advance-round-lifecycle.use-case.ts \
  services/games/src/infrastructure/prisma/game-prisma.repository.ts \
  services/games/src/presentation/dtos/place-bet-request.dto.ts \
  services/games/src/presentation/dtos/bet-response.dto.ts \
  services/games/src/presentation/controllers/games.controller.ts \
  services/games/src/presentation/round-response.mapper.ts \
  services/games/src/presentation/realtime/round-realtime.events.ts \
  services/games/tests/unit/domain/game-domain.test.ts \
  services/games/tests/unit/application/game-use-cases.test.ts \
  services/games/tests/unit/games-controller.test.ts \
  services/games/tests/unit/presentation/round-realtime-serializer.test.ts \
  services/games/tests/e2e/e2e-helpers.ts \
  services/games/tests/e2e/cashout-flow.e2e.test.ts \
  frontend/src/services/game-api.ts \
  frontend/src/services/game-api.test.ts \
  frontend/src/services/auto-cashout.ts \
  frontend/src/services/auto-cashout.test.ts \
  frontend/src/components/game/bet-controls-panel.tsx \
  frontend/src/components/game/game-dashboard-shell.test.tsx \
  tests/browser/player-flow.spec.ts
git commit -m "feat(games): add per-bet auto cashout"
```

Expected: commit succeeds only after all gates above pass.
