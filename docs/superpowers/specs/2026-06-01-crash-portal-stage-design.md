# Crash Portal Stage Design

Date: 2026-06-01
Status: Approved for implementation planning

## Summary

Redesign the main 3D crash stage from a generic neon arena into a `Crash Portal / Portal Gate` scene. The time-car remains the hero asset, but the stage now reads as a dramatic portal crossing: the car approaches and passes through a large circular energy gate while the multiplier stays in the upper-right corner without a box.

This is a frontend-only visual refinement. It must not change REST APIs, WebSocket payloads, DTOs, backend services, authentication, betting semantics, cashout semantics, wallet behavior, or deterministic round data.

## Goals

- Make the car stage feel like the visual centerpiece of a casino crash game.
- Give the scene a memorable event: crossing a portal that intensifies during a running round and ruptures on crash.
- Keep the multiplier readable, separated from the car, and positioned in the upper-right with adequate spacing.
- Preserve the current `Casino Neon / Arcade Arena` direction: OLED black base, rose/magenta crash tension, green payout/success, restrained cyan technical accent.
- Preserve accessibility, keyboard flows, reduced-motion handling, and existing tests around login, bet, cashout, history, current bets, and provably fair evidence.

## Non-Goals

- No landing page, marketing screen, or route change.
- No changes to game timing, multiplier math, cashout logic, or active bet rules.
- No new external asset dependency required for the portal.
- No replacement of the existing GLB car asset.
- No redesign of the action dock or technical tabs beyond spacing needed to support the stage.

## Visual Direction

The approved direction is `C1 · Portal Gate`.

The stage should contain:

- A large circular portal behind the car, centered slightly above the visual midpoint.
- One or two inner rings to create depth without clutter.
- A subtle diagonal flight/trail line leading toward the portal.
- Rose/magenta glow as the dominant energy color.
- Optional green accent only for non-crashed/live state feedback.
- The multiplier fixed in the upper-right of the stage, without a container, label, subtitle, or badge.
- Existing live/status chips in the upper-left, unless spacing forces a minor adjustment.

The portal should feel integrated with the current canvas, not like a separate card placed over it.

## State Behavior

### BETTING

- Portal is visible but quiet.
- Glow and ring opacity are low.
- Car remains parked/entering the scene.
- The scene communicates that betting is open without excessive animation.

### RUNNING

- Portal pulse becomes more visible.
- Trail intensity increases.
- Car movement should visually read as approaching or crossing the gate.
- Motion must remain restrained and should not compete with the multiplier.

### CRASHED or SETTLED

- Portal shifts to a stronger rose/red rupture state.
- A short flash or ring shockwave is acceptable.
- The stage border/glow may intensify to reinforce the crash event.
- Avoid infinite high-intensity effects after the crash.

### Reduced Motion

For `prefers-reduced-motion: reduce`:

- Disable continuous pulse, sweep, and shockwave animations.
- Keep static state colors and opacity changes.
- Preserve all information and layout.

## Implementation Boundaries

Expected files:

- `frontend/src/components/game/chrono-stage.tsx`
- `frontend/src/components/game/crash-flight-scene.tsx` only if the car/camera needs a small alignment adjustment
- `frontend/src/styles.css`

Keep the change scoped to presentation. Existing component props and game data sources should remain unchanged.

## Testing and Verification

Minimum verification after implementation:

- `bunx tsc --noEmit -p frontend/tsconfig.json`
- `cd frontend && bun run test src/components/game/game-dashboard-shell.test.tsx`
- `cd frontend && bun run build`
- Browser validation at `http://localhost:8000/`

Visual checks:

- Desktop stage has no horizontal overflow.
- Mobile stage has no horizontal overflow.
- Multiplier remains readable and does not overlap the car, chips, action dock, or stage edge.
- GLB car asset still loads.
- Canvas remains nonblank.
- Reduced-motion mode keeps the portal readable without continuous animation.

## Open Decisions

- Exact portal CSS implementation may use pseudo-elements, extra stage divs, or a small dedicated stage-layer component, whichever best preserves readability in the existing code.
- Car/camera alignment should be adjusted only if the first CSS-only portal pass makes the car miss the gate visually.
