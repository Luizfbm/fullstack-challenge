# Auto Bet Martingale Frontend Design

## Goal

Expose the existing backend Martingale auto bet strategy in the Crash Game UI so
players can configure, start, inspect, and stop fixed or Martingale auto bet
sessions from the frontend.

## Scope

This slice updates only the frontend contract, form controls, active-session
summary, and tests. Backend behavior is already implemented and remains the
source of truth for validation and execution.

In scope:

- Add frontend API types for `strategy`, `nextAmountCents`,
  `martingaleMultiplier`, `martingaleMaxSteps`, `martingaleCurrentStep`, and
  Martingale stop reasons.
- Add an Auto Bet strategy selector with `Valor fixo` and `Martingale`.
- Show Martingale fields only when `Martingale` is selected:
  - `Multiplicador Martingale`, integer from `2` to `10`, default `2`.
  - `Passos Martingale`, integer from `1` to `10`, default `3`.
- Send strategy and Martingale fields in `POST /games/auto-bet/sessions`.
- Show active-session details for strategy, next stake, current step, and
  Martingale stop reasons.
- Keep manual bet and auto cashout behavior unchanged.

Out of scope:

- Backend changes.
- New Martingale execution rules.
- Storybook.
- New audio effects.

## UX Design

The existing betting rail remains compact and operational. Martingale controls
appear inside Auto mode, below the existing max rounds and profit-limit fields,
so the player does not see extra risk controls during manual betting.

The strategy selector is a segmented control:

- `Valor fixo`: stable stake each round.
- `Martingale`: doubles the next stake after each lost auto bet, according to
  backend limits.

The active auto bet summary shows:

- Strategy label.
- Base stake.
- Next stake.
- Rounds played out of max rounds.
- Current Martingale step out of max steps when strategy is `MARTINGALE`.
- Net profit.
- Stop reason, including Martingale-specific reasons.

## Validation

Frontend validation mirrors the backend without replacing it:

- `maxRounds`: integer `1` to `100`.
- `stopLossCents` and `takeProfitCents`: optional positive integer cents.
- `martingaleMultiplier`: integer `2` to `10`.
- `martingaleMaxSteps`: integer `1` to `10`.

For fixed strategy, Martingale fields are not required for user input. The
frontend may still send backend-compatible defaults, but visible validation is
only enforced when the user selects `Martingale`.

## Testing

Tests should cover behavior through public frontend interfaces:

- `GameApi.startAutoBetSession` sends strategy and Martingale fields.
- Auto Bet form starts a Martingale session with all configured fields.
- Invalid Martingale fields disable the start button.
- Active Martingale session summary displays strategy, next stake, step, and
  stop reason.
- Existing fixed auto bet, manual bet, cashout, and auto cashout tests remain
  passing.

Because this slice changes visible frontend controls, run frontend tests, build,
and browser E2E in addition to the regular quality gates.
