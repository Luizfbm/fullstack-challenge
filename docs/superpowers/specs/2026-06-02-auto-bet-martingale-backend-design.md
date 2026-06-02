# Auto Bet Martingale Backend Design

## Goal

Extend the existing persistent Auto Bet backend so an active session can run with either a fixed stake or a Martingale stake progression. The current fixed-value behavior remains the default and stays compatible with the frontend already merged.

## Scope

This recut is backend-only. It updates the Games service domain model, API contract, Prisma schema, repository mapping, unit tests, and Games E2E coverage. It does not change the frontend UI; the frontend can keep sending the existing payload and will receive the new fields in responses.

## Public Contract

`POST /games/auto-bet/sessions` accepts these additional optional fields:

```json
{
  "strategy": "MARTINGALE",
  "martingaleMultiplier": 2,
  "martingaleMaxSteps": 3
}
```

Defaults:

- `strategy`: `FIXED`
- `martingaleMultiplier`: `2`
- `martingaleMaxSteps`: `0` for `FIXED`, `3` for `MARTINGALE` when omitted

`AutoBetSessionResponse` includes:

- `strategy`
- `nextAmountCents`
- `martingaleMultiplier`
- `martingaleMaxSteps`
- `martingaleCurrentStep`

## Domain Rules

- `amountCents` remains the base stake.
- `nextAmountCents` is the stake used by the executor for the next automatic bet.
- `FIXED` never changes `nextAmountCents`; it remains equal to `amountCents`.
- `MARTINGALE` multiplies `nextAmountCents` by `martingaleMultiplier` after a lost auto bet.
- `MARTINGALE` resets `nextAmountCents` to `amountCents` and `martingaleCurrentStep` to `0` after a cashed-out auto bet.
- Stop-loss and take-profit are evaluated after applying each auto bet result, preserving current behavior.
- A Martingale session stops when the next progression would exceed `martingaleMaxSteps` or the configured maximum bet amount.
- Wallet failures keep the current behavior: record a failed execution and stop the session with the existing wallet stop reason.

## Persistence

`AutoBetSession` gains:

- `strategy String`
- `nextAmountCents BigInt`
- `martingaleMultiplier Int`
- `martingaleMaxSteps Int`
- `martingaleCurrentStep Int`

Existing rows are migrated to fixed strategy:

- `strategy = 'FIXED'`
- `nextAmountCents = amountCents`
- `martingaleMultiplier = 2`
- `martingaleMaxSteps = 0`
- `martingaleCurrentStep = 0`

## Testing

The implementation follows TDD:

- Start session unit tests cover fixed defaults and Martingale config parsing.
- Executor unit tests prove the placed auto bet uses `nextAmountCents`.
- Result application unit tests prove loss progression, cashout reset, max-step stop, and max-bet stop.
- Controller tests prove request fields are forwarded and response fields are serialized.
- E2E proves a Martingale session persists and places the progressed stake on the next eligible round.

## Non-Goals

- No frontend Martingale controls in this recut.
- No variable multipliers beyond integer `2` through `10`.
- No bankroll-aware prediction beyond the existing wallet rejection/stop behavior.
