# Crash Game Leaderboard Bonus Design

Date: 2026-06-01
Status: Approved for implementation planning

## Summary

Implement the README bonus `Leaderboard` as a public ranking of players by net
profit over two periods: last 24 hours and last 7 days.

The leaderboard should act as a visible social incentive while players are in
the crash game. On large desktop screens it appears as a left-side ranking
panel. On medium screens it becomes collapsible. On mobile it moves into the
normal page flow so it does not overlap or shrink the 3D game stage.

## Goals

- Add a public `GET /games/leaderboard` endpoint.
- Rank players by net profit, not by gross payout.
- Support `period=24h` and `period=7d`.
- Support optional `limit`, defaulting to `10` and capped at `50`.
- Keep the endpoint unauthenticated, like round history.
- Surface the ranking in the frontend as an incentive-oriented side panel.
- Preserve all existing game, wallet, realtime, auth and provably fair behavior.
- Implement with TDD, one behavior at a time.

## Non-Goals

- No cash prizes, achievements, badges, or rewards.
- No all-time leaderboard in this slice.
- No privacy settings or username masking in this slice.
- No websocket updates for leaderboard in this slice; React Query polling or
  invalidation is enough.
- No schema changes to Wallet Service.
- No changes to bet placement, cashout, settlement, or wallet ledger semantics.
- No deletion, disabling, skipping, or reduction of existing tests.

## Metric

Leaderboard rank is based on net profit:

```text
profitCents = totalPayoutCents - totalWageredCents
```

Only resolved bets count:

- `CASHED_OUT`: contributes `amountCents` to wagered and `payoutCents` to
  payout.
- `LOST`: contributes `amountCents` to wagered and `0` to payout.
- `ACCEPTED`, `REJECTED`, and `CASHOUT_PENDING_CREDIT` do not count.

If `payoutCents` is null for a `CASHED_OUT` bet, the bet should be treated as
invalid data and excluded from leaderboard aggregation. This avoids presenting
an inconsistent payout while preserving existing records.

## API Contract

Endpoint:

```http
GET /games/leaderboard?period=24h&limit=10
GET /games/leaderboard?period=7d&limit=50
```

Query parameters:

- `period`: optional, defaults to `24h`; allowed values are `24h` and `7d`.
- `limit`: optional, defaults to `10`; must be an integer from `1` to `50`.

Invalid `period` or `limit` returns `400 Bad Request`.

Response:

```ts
type LeaderboardEntry = {
  rank: number;
  playerId: string;
  username: string;
  profitCents: string;
  wageredCents: string;
  payoutCents: string;
  betsCount: number;
};
```

Ordering:

1. Higher `profitCents`.
2. Higher `payoutCents`.
3. Higher `wageredCents`.
4. `username` ascending.
5. `playerId` ascending for final deterministic tie-break.

Ranks are assigned after sorting. Ties still receive sequential ranks because
the response is a display ranking, not a competition prize table.

## Backend Design

Add a read use case in Game Service:

- `ListLeaderboardUseCase`
- input: `period`, `limit`, and `now` via injected clock
- output: `LeaderboardEntry[]`

Add a repository method owned by the Game bounded context:

- `listLeaderboard(input: { since: Date; limit: number }): Promise<LeaderboardEntry[]>`

The Prisma implementation should aggregate from the `Bet` table and filter:

- `createdAt >= since`
- `status in ("CASHED_OUT", "LOST")`

The aggregation should group by `playerId` and `username`. It should compute
string-safe bigint totals in application code if Prisma SQL aggregation returns
provider-specific numeric shapes. Money must remain integer cents and must not
use floating point arithmetic.

The controller adds:

- `GET /leaderboard`
- Swagger DTOs for response and query behavior
- `400` responses for invalid query values

Kong already routes `/games/*` to the Game Service, so no route change is
expected.

## Frontend Design

Add a leaderboard client method:

- `GameApi.getLeaderboard({ period, limit })`

Add a TanStack Query hook:

- `useLeaderboardQuery(period, limit)`

Add a leaderboard panel:

- Large desktop: always visible left-side ranking panel.
- Medium screens: collapsible panel.
- Mobile: normal section below the stage/dashboard flow.

Panel behavior:

- Default period is `24h`.
- Period segmented control: `24h` and `7d`.
- Default limit is `10`.
- Show rank, username, net profit, and a compact secondary metric such as
  bets count or total wagered.
- Highlight top 3 ranks with restrained visual treatment.
- Highlight the authenticated user row when present.
- Show loading and error states without covering the game controls.

The panel must preserve the current Casino Neon / Arcade Arena direction and
must not alter the 3D car state behavior.

## Testing Strategy

Use TDD in vertical slices. Do not write all tests first.

Backend tests:

- Use case ranks players by net profit for `24h`.
- Use case ranks players by net profit for `7d`.
- Use case ignores unresolved bets.
- Use case applies deterministic tie-breaks.
- Controller accepts default query values.
- Controller rejects invalid `period`.
- Controller rejects invalid `limit`.

Frontend tests:

- API client builds the correct leaderboard URL.
- Panel renders entries and period controls.
- Panel highlights top ranks and current player when present.
- Medium/mobile behavior should be covered by class/structure tests where
  practical, with browser validation for layout.

Required gates before any commit:

- `bun run lint`
- `bun run check:types`
- `bun run test:unit`
- `cd frontend && bun run build`
- `bun run test:coverage && bun run quality:gate`
- `docker compose config`
- `docker compose up -d --build`
- `bun scripts/ci/check-kong-health.ts`
- `cd services/games && bun test tests/e2e`
- `bun run test:e2e:browser`
- `git diff --check`

If a gate is not applicable, it must be explicitly justified before commit.

## UX Notes

The leaderboard should feel like a live casino board, not a marketing card.
It should be dense, readable, and secondary to the crash stage. The ranking is
there to create competitive pressure, but the bet and cashout controls remain
the primary interaction.

Avoid oversized headers, decorative explanations, or a landing-page style
layout. Use compact labels, icons where useful, and stable dimensions so the
ranking does not shift the stage unexpectedly.

## Rollout

Implement as a single bonus slice. Because this project now requires the full
test/gate set before any commit, this bonus may be delivered as one final
commit after all verification passes:

1. Backend use case and repository behavior.
2. Public controller/Swagger contract.
3. Frontend API/query and panel UI.
4. Browser validation and final gates.

The commit must preserve all existing tests and pass the required gates for its
scope. No test may be removed, skipped, disabled, or weakened without explicit
user authorization.
