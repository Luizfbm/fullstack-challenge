# Crash Game Auto Cashout Per Bet Design

Date: 2026-06-01
Status: Approved for implementation planning

## Summary

Implement the README bonus `Auto cashout` as an optional target multiplier on
each bet. When configured, the Game Service automatically cashes out the bet at
the exact target multiplier, without depending on the browser being open or on
frontend timing.

This is a per-bet feature only. It does not create a persistent player setting
or an auto-bet strategy.

## Goals

- Add optional per-bet auto cashout.
- Execute auto cashout on the backend inside the round lifecycle flow.
- Pay exactly at the configured target multiplier.
- Keep manual cashout working while the bet is still accepted.
- Make the target and valid limits clear in the frontend bet controls.
- Preserve wallet consistency, realtime events, provably fair behavior, and
  existing bet/cashout rules.

## Non-Goals

- No persistent player-level auto cashout setting.
- No auto bet or betting strategy.
- No Martingale, stop-loss, take-profit, or session automation.
- No frontend-only auto cashout trigger.
- No scheduled per-bet timer or queue job.
- No cashout at the observed tick multiplier when it exceeds the target.
- No deletion, disabling, skipping, or reduction of existing tests.

## Domain Rules

The target is stored as basis points:

```text
1.01x = 10100
2.00x = 20000
1000.00x = 10000000
```

Validation:

- `autoCashoutMultiplierBp` is optional.
- Valid values are integers from `10100` to `10000000`.
- Missing or `null` means the bet has no auto cashout.
- Invalid values return `400 Bad Request`.

Execution:

- Auto cashout is evaluated only for `ACCEPTED` bets in a `RUNNING` round.
- If `currentMultiplierBp >= autoCashoutMultiplierBp` and
  `autoCashoutMultiplierBp < crashPointBp`, the bet cashes out automatically.
- Payout is calculated exactly at `autoCashoutMultiplierBp`, not at the current
  lifecycle tick multiplier.
- If the lifecycle tick passes both the target and the crash point in the same
  cycle, auto cashout wins when the target is lower than the crash point.
- If `autoCashoutMultiplierBp >= crashPointBp`, auto cashout does not execute
  and the bet loses when the round crashes.

Manual cashout remains available while the bet is still `ACCEPTED`. Once either
manual or automatic cashout moves the bet to `CASHOUT_PENDING_CREDIT` or
`CASHED_OUT`, the other path can no longer cash it out.

## Backend Design

Extend the Game domain:

- Add `autoCashoutMultiplierBp: number | null` to `Bet`.
- Add the optional target to accepted bet creation and restore paths.
- Keep `cashoutMultiplierBp` as the actual executed cashout multiplier.
- For auto cashout, `cashoutMultiplierBp` equals the configured target.

Extend the Game persistence model:

- Add nullable `autoCashoutMultiplierBp Int?` to `Bet`.
- Create a Prisma migration for the new column.
- Update Prisma save/restore mappings.

Extend the Game application flow:

- `PlaceBetUseCase` accepts `autoCashoutMultiplierBp?: number | null`.
- Validate target bounds before saving the bet.
- `AdvanceRoundLifecycleUseCase` handles auto cashout before crash evaluation
  while a round is running.
- Reuse the same wallet credit semantics and idempotency reference used by
  manual cashout:

```text
round:{roundId}:player:{playerId}:cashout-credit
```

Because each player can only have one bet per round, this reference remains
unique for both manual and automatic cashout. If wallet credit fails after auto
cashout is accepted, the bet remains `CASHOUT_PENDING_CREDIT` and the existing
settlement retry path should complete it before settlement.

Realtime publishing:

- Continue emitting `bet.cashed_out` after wallet credit is confirmed.
- The event payload includes `autoCashoutMultiplierBp` and the executed
  `cashoutMultiplierBp`.

## API Contract

Request:

```http
POST /games/bet
Content-Type: application/json

{
  "amountCents": "1000",
  "autoCashoutMultiplierBp": 20000
}
```

`autoCashoutMultiplierBp` may be omitted or `null`.

Response bet shape adds:

```ts
type BetResponse = {
  id: string;
  roundId: string;
  playerId: string;
  username: string;
  amountCents: string;
  status: BetStatus;
  autoCashoutMultiplierBp: number | null;
  cashoutMultiplierBp: number | null;
  payoutCents: string | null;
  rejectionReason: string | null;
};
```

This field appears consistently in:

- `POST /games/bet`
- `POST /games/bet/cashout`
- `GET /games/bets/me`
- `GET /games/rounds/current`
- `GET /games/rounds/history`
- realtime round snapshots
- `bet.placed`
- `bet.cashed_out`

Swagger DTOs must document the new request and response fields, including the
valid multiplier bounds.

## Frontend Design

Extend the bet controls panel with a compact auto cashout control:

- Toggle labeled `Auto cashout`.
- When enabled, show target multiplier input in decimal form, for example
  `2.00`.
- Show quick presets: `1.50x`, `2.00x`, `3.00x`.
- Show the limits directly in the control: `Limite: 1.01x a 1000.00x`.
- Disable `Apostar` when auto cashout is enabled and the target is invalid.
- Convert decimal multiplier to basis points before calling `placeBet`.

Active bet display:

- When a bet has a configured target, show
  `Auto cashout em X.XXx`.
- Keep showing potential manual cashout payout while the bet is still accepted.
- Once cashout completes, the existing status and payout display remain the
  source of truth.

The UI must preserve the current Casino Neon / Arcade Arena direction. The new
controls should stay compact and should not compete with the 3D crash stage or
the leaderboard side panel.

## Testing Strategy

Use TDD in vertical slices. Tests must verify behavior through public
interfaces or stable domain/application APIs.

Backend tests:

- `Bet` stores a valid auto cashout target.
- `PlaceBetUseCase` accepts a valid target.
- Controller accepts optional target values.
- Controller rejects target values below `10100`.
- Controller rejects target values above `10000000`.
- Lifecycle executes auto cashout at the exact target when current multiplier
  reaches or passes it.
- Auto cashout wins when one lifecycle tick passes target and crash point, as
  long as target is lower than crash point.
- Bet loses when target is greater than or equal to crash point.
- Manual cashout still works for a bet with a future auto target.
- Pending auto cashout credit is retried before settlement, matching existing
  manual cashout behavior.

Frontend tests:

- API client sends `autoCashoutMultiplierBp` on bet placement.
- Decimal multiplier parsing converts `2.00` to `20000`.
- Invalid decimal targets disable the submit action.
- Preset buttons set `1.50x`, `2.00x`, and `3.00x`.
- The UI renders the visible limit copy.
- Active bet display shows the configured auto cashout target.

E2E/browser validation:

- Place a bet with an auto cashout target lower than the deterministic crash
  point.
- Verify the bet is cashed out without clicking manual cashout.
- Verify wallet balance receives the target-based payout.
- Verify the round remains provably fair.
- Validate the frontend control visually in desktop and mobile widths.

## Required Gates Before Commit

The project rule is that all required tests and gates must pass before any
commit:

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

If `services/wallets` still has no `tests/e2e` files, the wallets E2E script is
not applicable and must be called out explicitly.

## Rollout

Deliver this as one bonus slice after the spec and implementation plan are
approved:

1. Domain and persistence field.
2. API contract and validation.
3. Lifecycle auto cashout execution.
4. Frontend controls and active bet display.
5. Focused E2E/browser coverage and full gates.

No implementation may start until the written spec and implementation plan are
approved.
