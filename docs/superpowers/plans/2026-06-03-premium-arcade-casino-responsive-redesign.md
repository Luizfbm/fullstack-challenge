# Premium Arcade Casino Responsive Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the Chrono Crash game screen so it is responsive on mobile/tablet/desktop and reads as a premium arcade casino instead of a sci-fi technical dashboard.

**Architecture:** Keep the existing React/Vite/Tailwind component structure and behavior. Implement the redesign as focused frontend slices: first lock responsive contracts with tests, then adjust shell layout, then refactor the bet slip, then apply casino visual tokens to panels and browser visual validation.

**Tech Stack:** React, TypeScript, Vite, Tailwind CSS utilities, Vitest/Testing Library, Playwright browser E2E.

**Git rule for this project:** The user approved commits along completed task checkpoints. Do not push, merge, or open PRs unless the user explicitly asks.

---

## Source Spec

- `docs/superpowers/specs/2026-06-03-premium-arcade-casino-responsive-redesign.md`

## Non-Negotiable Constraints

- Do not edit `README.md`.
- Do not touch these old untracked docs:
  - `docs/superpowers/plans/2026-06-02-auto-bet-backend.md`
  - `docs/superpowers/specs/2026-06-02-auto-bet-backend-design.md`
- Do not remove, disable, or reduce tests.
- Do not reintroduce the old metric cards:
  - `LIVE` card
  - `metric-rodada`
  - `metric-saldo`
  - former metric grid
- Keep saldo in the header under `aria-label="Conta do jogador"`.
- Keep browser E2E aligned with current UI: `connected BETTING`, `Rodada inicia em`, and `/games/rounds/current` for deterministic round confirmation.

## File Structure

Modify:

- `frontend/src/components/game/game-dashboard-shell.tsx`  
  Owns responsive page layout, ordering, desktop/tablet breakpoints, leaderboard placement.

- `frontend/src/components/game/game-dashboard-shell.test.tsx`  
  Locks shell ordering, no old metric cards, single bet form, `lg` two-column layout classes, compact dock contract.

- `frontend/src/components/game/bet-controls-panel.tsx`  
  Owns stateful bet slip behavior and mutation wiring. Should become the shell around a compact mobile action area plus expandable details.

- `frontend/src/components/game/bet-action-buttons.tsx`  
  Primary/secondary action button styling and layout for bet/cashout/auto bet actions.

- `frontend/src/components/game/bet-mode-toggle.tsx`  
  Manual/Auto segmented control styling with casino gold/felt focus states.

- `frontend/src/components/game/bet-stake-preview.tsx`  
  Entry/payout preview styling for bet slip.

- `frontend/src/components/game/arcade-tab-panels.tsx`  
  Round history chips and bets table styling.

- `frontend/src/components/game/leaderboard-panel.tsx`  
  Premium casino scoreboard styling and current player highlight.

- `frontend/src/components/game/arcade-technical-tabs.tsx`  
  Make technical panels visually secondary and reserve ciano for audit/provably fair context.

- `frontend/src/components/game/crash-round-panel.tsx`  
  Integrate the stage shell with felt/gold frame language without changing the 3D scene behavior.

- `frontend/src/styles.css`  
  Add casino semantic tokens and update panel classes.

- `frontend/src/components/ui/button.tsx`  
  Adjust existing variants toward casino semantics, keeping action names and behavior.

- `tests/browser/player-flow.spec.ts`  
  Keep current flows passing; only adapt selectors if the redesign changes visible labels.

Create:

- `frontend/src/components/game/bet-slip-header.tsx`  
  Small presentational header for the bet slip with reset and mobile details toggle.

- `frontend/src/components/game/bet-slip-amount-field.tsx`  
  Presentational amount input row for the bet slip, keeping `Valor em reais` label and `inputMode="decimal"`.

- `tests/browser/responsive-layout.spec.ts`  
  Playwright viewport regression for mobile/tablet/desktop layout, overflow, canvas, and action visibility.

## Task 1: Lock Responsive Shell Contracts

**Files:**

- Modify: `frontend/src/components/game/game-dashboard-shell.test.tsx`

- [ ] **Step 1: Update the existing shell ordering test to expect `lg`, not `xl`, as the two-column breakpoint**

Replace the assertions in the test currently named `keeps cashier and mobile leaderboard before technical tabs while reserving the desktop stage row` with:

```tsx
expect(desktopSidebar.className).toContain("lg:row-span-2");
expect(technicalSlot.className).toContain("lg:col-start-1");
expect(technicalSlot.className).toContain("lg:row-start-2");
expect(desktopSidebar.className).not.toContain("xl:row-span-2");
```

Keep the document-order assertions that verify:

- arena appears before cashier in DOM;
- cashier appears before mobile leaderboard;
- mobile leaderboard appears before technical tabs.

- [ ] **Step 2: Update the desktop sidebar test to use the approved casino label**

In `places the desktop cashier rail above the desktop leaderboard without duplicating the form`, change the visible cashier lookup from:

```tsx
const cashier = within(desktopSidebar).getByText("Cashier rail");
```

to:

```tsx
const cashier = within(desktopSidebar).getByText("Mesa de aposta");
```

Keep these duplicate-safety assertions:

```tsx
expect(screen.getAllByLabelText("Valor em reais")).toHaveLength(1);
expect(screen.getAllByRole("button", { name: "Apostar" })).toHaveLength(1);
```

- [ ] **Step 3: Add a compact dock contract test**

Add this test near the existing `BetControlsPanel` tests:

```tsx
it("renders a compact mobile bet dock without duplicating the bet form", () => {
  render(<BetControlsPanel activeBet={null} currentRound={createRound()} />);

  const betSlip = screen.getByTestId("bet-slip-panel");
  const dock = within(betSlip).getByTestId("mobile-bet-dock");
  const details = within(betSlip).getByTestId("bet-slip-details");

  expect(within(dock).getByLabelText("Valor em reais")).toBeTruthy();
  expect(within(dock).getByRole("button", { name: "Apostar" })).toBeTruthy();
  expect(
    within(betSlip)
      .getByRole("button", { name: "Configurar aposta" })
      .getAttribute("aria-expanded"),
  ).toBe("false");
  expect(details.className).toContain("max-lg:hidden");
  expect(screen.getAllByLabelText("Valor em reais")).toHaveLength(1);
  expect(screen.getAllByRole("button", { name: "Apostar" })).toHaveLength(1);
});
```

- [ ] **Step 4: Add a detail toggle behavior test**

Add:

```tsx
it("expands compact bet details from the mobile dock toggle", () => {
  render(<BetControlsPanel activeBet={null} currentRound={createRound()} />);

  const betSlip = screen.getByTestId("bet-slip-panel");
  const toggle = within(betSlip).getByRole("button", {
    name: "Configurar aposta",
  });
  const details = within(betSlip).getByTestId("bet-slip-details");

  fireEvent.click(toggle);

  expect(toggle.getAttribute("aria-expanded")).toBe("true");
  expect(details.className).not.toContain("max-lg:hidden");
  expect(within(details).getByRole("button", { name: "Manual" })).toBeTruthy();
  expect(within(details).getByRole("button", { name: "Auto" })).toBeTruthy();
});
```

- [ ] **Step 5: Run focused tests and confirm they fail for the right reason**

Run:

```bash
cd frontend && bun run test src/components/game/game-dashboard-shell.test.tsx
```

Expected before implementation:

- Failures for missing `bet-slip-panel`, `mobile-bet-dock`, and `bet-slip-details`.
- Failures for `xl:` class expectations changing to `lg:`.
- No failures related to missing mocks or broken imports.

- [ ] **Step 6: Checkpoint and commit**

Run:

```bash
git diff -- frontend/src/components/game/game-dashboard-shell.test.tsx
```

Expected:

- Only test changes in `game-dashboard-shell.test.tsx`.
- No deleted tests.

## Task 2: Add Browser Responsive Regression

**Files:**

- Create: `tests/browser/responsive-layout.spec.ts`

- [ ] **Step 1: Write the failing Playwright viewport test**

Create `tests/browser/responsive-layout.spec.ts`:

```ts
import { expect, test, type Page } from "@playwright/test";

const viewports = [
  { height: 844, label: "mobile", width: 390 },
  { height: 1024, label: "tablet", width: 768 },
  { height: 768, label: "laptop", width: 1024 },
  { height: 900, label: "desktop", width: 1440 },
];

for (const viewport of viewports) {
  test(`premium casino layout fits ${viewport.label} ${viewport.width}x${viewport.height}`, async ({
    page,
  }) => {
    await page.setViewportSize({
      height: viewport.height,
      width: viewport.width,
    });
    await page.goto("/");

    await expect(page.getByRole("heading", { name: "Chrono Crash" }))
      .toBeVisible();
    await expect(page.getByLabel("Arcade arena")).toBeVisible();
    await expect(page.getByTestId("bet-slip-panel")).toBeVisible();
    await expect(page.getByTestId("crash-flight-canvas")).toBeVisible();

    const layout = await readResponsiveLayout(page);

    expect(layout.overflowX).toBe(false);
    expect(layout.stageVisible).toBe(true);
    expect(layout.betSlipVisible).toBe(true);

    if (viewport.width < 1024) {
      expect(layout.betSlipAfterStage).toBe(true);
      expect(layout.technicalTabsAfterBetSlip).toBe(true);
      expect(layout.mobileDockVisible).toBe(true);
    } else {
      expect(layout.betSlipBesideStage).toBe(true);
    }
  });
}

async function readResponsiveLayout(page: Page) {
  return page.evaluate(() => {
    const stage = document.querySelector('[aria-label="Arcade arena"]');
    const betSlip = document.querySelector('[data-testid="bet-slip-panel"]');
    const mobileDock = document.querySelector('[data-testid="mobile-bet-dock"]');
    const technicalTabs = document.querySelector(
      '[data-testid="stage-technical-tabs-slot"]',
    );
    const stageRect = stage?.getBoundingClientRect();
    const betSlipRect = betSlip?.getBoundingClientRect();
    const dockRect = mobileDock?.getBoundingClientRect();
    const technicalRect = technicalTabs?.getBoundingClientRect();

    return {
      betSlipAfterStage: Boolean(
        stageRect && betSlipRect && betSlipRect.top >= stageRect.top,
      ),
      betSlipBesideStage: Boolean(
        stageRect &&
          betSlipRect &&
          betSlipRect.left > stageRect.left &&
          betSlipRect.top < stageRect.bottom,
      ),
      betSlipVisible: Boolean(
        betSlipRect && betSlipRect.width > 0 && betSlipRect.height > 0,
      ),
      mobileDockVisible: Boolean(
        dockRect && dockRect.width > 0 && dockRect.height > 0,
      ),
      overflowX:
        document.documentElement.scrollWidth > window.innerWidth ||
        document.body.scrollWidth > window.innerWidth,
      stageVisible: Boolean(
        stageRect && stageRect.width > 0 && stageRect.height > 0,
      ),
      technicalTabsAfterBetSlip: Boolean(
        betSlipRect && technicalRect && technicalRect.top >= betSlipRect.top,
      ),
    };
  });
}
```

- [ ] **Step 2: Run the new browser test and confirm it fails before implementation**

Run:

```bash
bunx playwright test tests/browser/responsive-layout.spec.ts
```

Expected before implementation:

- Fails because `data-testid="bet-slip-panel"` and `data-testid="mobile-bet-dock"` do not exist.
- May also fail at `1024x768` because the current cashier is below the stage instead of beside it.

- [ ] **Step 3: Checkpoint and commit**

Run:

```bash
git diff -- tests/browser/responsive-layout.spec.ts
```

Expected:

- One new Playwright test file.
- No changes to existing browser flows yet.

## Task 3: Implement `lg` Two-Column Shell Layout

**Files:**

- Modify: `frontend/src/components/game/game-dashboard-shell.tsx`
- Modify: `frontend/src/components/game/game-dashboard-shell.test.tsx`

- [ ] **Step 1: Update the main grid breakpoint**

In `GameDashboardShell`, change the root dashboard grid from `xl`-only columns to `lg` columns.

Replace:

```tsx
<div className="grid min-w-0 gap-4 xl:grid-cols-[18rem_minmax(0,1fr)] xl:gap-y-3">
```

with:

```tsx
<div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,22rem)] lg:items-start xl:grid-cols-[minmax(0,1fr)_20rem] xl:gap-y-3">
```

- [ ] **Step 2: Keep main stage column first and switch medium leaderboard visibility**

Change the first column wrapper from:

```tsx
<div className="order-1 min-w-0 space-y-4 xl:order-2">
```

to:

```tsx
<div className="order-1 min-w-0 space-y-4">
```

Change the collapsible medium leaderboard class from:

```tsx
className: "hidden md:block xl:hidden",
```

to:

```tsx
className: "hidden md:block lg:hidden",
```

- [ ] **Step 3: Move the betting rail into the `lg` sidebar**

Change the `<aside>` class from:

```tsx
className="order-2 min-w-0 space-y-4 xl:sticky xl:top-4 xl:order-1 xl:row-span-2 xl:self-start"
```

to:

```tsx
className="order-2 min-w-0 space-y-4 lg:sticky lg:top-4 lg:row-span-2 lg:self-start"
```

Change the `BetControlsPanel` class from the current sticky mobile/desktop mix to:

```tsx
className="sticky bottom-3 z-30 mx-2 mt-3 shadow-[0_0_54px_rgba(250,204,21,0.16)] lg:static lg:mx-0 lg:mt-0"
```

Change the sidebar leaderboard class from:

```tsx
className: "hidden xl:block",
```

to:

```tsx
className: "hidden lg:block",
```

- [ ] **Step 4: Move technical tabs to the stage column at `lg`**

Change the technical slot class from:

```tsx
className="order-4 min-w-0 xl:col-start-2 xl:row-start-2"
```

to:

```tsx
className="order-4 min-w-0 lg:col-start-1 lg:row-start-2"
```

- [ ] **Step 5: Run focused shell tests**

Run:

```bash
cd frontend && bun run test src/components/game/game-dashboard-shell.test.tsx
```

Expected after this task:

- The `lg` shell layout assertions pass.
- Compact dock tests from Task 1 still fail because the bet slip has not been refactored yet.

- [ ] **Step 6: Checkpoint and commit**

Run:

```bash
git diff -- frontend/src/components/game/game-dashboard-shell.tsx frontend/src/components/game/game-dashboard-shell.test.tsx
```

Expected:

- `GameDashboardShell` uses `lg:` for the two-column layout.
- No change to backend files.

## Task 4: Add Compact Mobile Bet Dock Without Duplicating the Form

**Files:**

- Create: `frontend/src/components/game/bet-slip-header.tsx`
- Create: `frontend/src/components/game/bet-slip-amount-field.tsx`
- Modify: `frontend/src/components/game/bet-controls-panel.tsx`
- Modify: `frontend/src/components/game/bet-action-buttons.tsx`
- Modify: `frontend/src/components/game/game-dashboard-shell.test.tsx`

- [ ] **Step 1: Create the bet slip header component**

Create `frontend/src/components/game/bet-slip-header.tsx`:

```tsx
import { ChevronDown, ChevronUp, RotateCcw } from "lucide-react";
import { Button } from "../ui/button";

type BetSlipHeaderProps = {
  detailsOpen: boolean;
  onDetailsToggle: () => void;
  onReset: () => void;
};

export function BetSlipHeader({
  detailsOpen,
  onDetailsToggle,
  onReset,
}: BetSlipHeaderProps) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <div className="min-w-0">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-200">
          Mesa de aposta
        </p>
        <h2 className="mt-1 truncate text-lg font-black text-zinc-50">
          Bet slip
        </h2>
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        <Button
          aria-expanded={detailsOpen}
          aria-label="Configurar aposta"
          className="lg:hidden"
          onClick={onDetailsToggle}
          size="icon"
          type="button"
          variant="ghost"
        >
          {detailsOpen ? (
            <ChevronUp className="size-4" aria-hidden="true" />
          ) : (
            <ChevronDown className="size-4" aria-hidden="true" />
          )}
        </Button>
        <Button
          aria-label="Resetar aposta"
          onClick={onReset}
          size="icon"
          type="button"
          variant="ghost"
        >
          <RotateCcw className="size-4" aria-hidden="true" />
        </Button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create the amount field component**

Create `frontend/src/components/game/bet-slip-amount-field.tsx`:

```tsx
import { Input } from "../ui/input";

type BetSlipAmountFieldProps = {
  disabled: boolean;
  onValueChange: (value: string) => void;
  value: string;
};

export function BetSlipAmountField({
  disabled,
  onValueChange,
  value,
}: BetSlipAmountFieldProps) {
  return (
    <div>
      <label className="block text-xs font-medium text-amber-100/80" htmlFor="bet">
        Valor em reais
      </label>
      <div className="mt-2 flex h-12 items-center rounded-md border border-amber-200/15 bg-black/35 px-3 transition-colors focus-within:border-amber-200/60 focus-within:shadow-[0_0_24px_rgba(250,204,21,0.14)]">
        <span className="mr-2 shrink-0 font-mono text-lg font-semibold text-amber-100">
          R$
        </span>
        <Input
          className="h-auto border-0 bg-transparent px-0 font-mono text-lg shadow-none focus:border-transparent focus:shadow-none"
          disabled={disabled}
          id="bet"
          inputMode="decimal"
          onChange={(event) => onValueChange(event.target.value)}
          value={value}
        />
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Refactor `BetControlsPanel` around one compact top area and one details area**

In `frontend/src/components/game/bet-controls-panel.tsx`:

Remove these imports:

```tsx
import { RotateCcw } from "lucide-react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
```

Add:

```tsx
import { Button } from "../ui/button";
import { BetSlipAmountField } from "./bet-slip-amount-field";
import { BetSlipHeader } from "./bet-slip-header";
```

Add state near `betMode`:

```tsx
const [detailsOpen, setDetailsOpen] = useState(false);
```

Change the `<section>` opening to:

```tsx
<section
  className={cn(
    "casino-bet-slip rounded-lg border border-amber-200/25 p-3 sm:p-4",
    className,
  )}
  data-testid="bet-slip-panel"
>
```

Replace the current header, mode toggle, label, input, preview, auto cashout, summaries, fields, and action button ordering with this structure:

```tsx
<div data-testid="mobile-bet-dock">
  <BetSlipHeader
    detailsOpen={detailsOpen}
    onDetailsToggle={() => setDetailsOpen((open) => !open)}
    onReset={resetBetSlip}
  />

  <BetSlipAmountField
    disabled={placeBetMutation.isPending || autoBetFormDisabled}
    onValueChange={(value) =>
      setBetAmountCents(parseRealInputToCents(value))
    }
    value={formatCentsForRealInput(visibleBetAmountCents)}
  />

  <BetStakePreview
    entryLabel={
      activeAutoBetSession
        ? formatCents(visibleBetAmountCents)
        : betAmountLabel
    }
    potentialPayout={potentialPayout}
  />

  <BetActionButtons
    activeAutoBetSession={Boolean(activeAutoBetSession)}
    betMode={selectedBetMode}
    canCashOut={canCashOut}
    canPlaceBet={canPlaceBet}
    canStartAutoBet={canStartAutoBet}
    cashOutIsPending={cashOutMutation.isPending}
    onCashOut={() => cashOutMutation.mutate()}
    onPlaceBet={() =>
      placeBetMutation.mutate(
        autoBetForm.autoCashoutEnabled
          ? {
              amountCents: betAmountCents,
              autoCashoutMultiplierBp:
                autoBetForm.autoCashoutParseResult.multiplierBp,
            }
          : { amountCents: betAmountCents },
      )
    }
    onStartAutoBet={() =>
      startAutoBetSessionMutation.mutate(autoBetForm.autoBetPayload)
    }
    onStopAutoBet={() => stopAutoBetSessionMutation.mutate()}
    placeBetIsPending={placeBetMutation.isPending}
    potentialPayout={potentialPayout}
    startAutoBetIsPending={startAutoBetSessionMutation.isPending}
    stopAutoBetIsPending={stopAutoBetSessionMutation.isPending}
  />
</div>

{activeBet ? (
  <ActiveBetSummary
    activeBet={activeBet}
    potentialPayout={potentialPayout}
  />
) : null}

<div
  className={cn("mt-4", !detailsOpen && "max-lg:hidden")}
  data-testid="bet-slip-details"
>
  <BetModeToggle
    disabled={Boolean(activeAutoBetSession)}
    onChange={setBetMode}
    value={selectedBetMode}
  />

  <AutoCashoutControl
    disabled={autoBetFormDisabled}
    enabled={autoBetForm.visibleAutoCashoutEnabled}
    onEnabledChange={autoBetForm.setAutoCashoutEnabled}
    onTargetChange={autoBetForm.setAutoCashoutTarget}
    parseResult={autoBetForm.visibleAutoCashoutParseResult}
    target={autoBetForm.visibleAutoCashoutTarget}
  />

  {activeAutoBetSession ? (
    <AutoBetSessionSummary session={activeAutoBetSession} />
  ) : null}

  {selectedBetMode === "auto" ? (
    <>
      <AutoBetSettingsFields
        disabled={autoBetFormDisabled}
        maxRounds={autoBetForm.visibleMaxRounds}
        onMaxRoundsChange={autoBetForm.onMaxRoundsChange}
        onStopLossChange={autoBetForm.onStopLossChange}
        onTakeProfitChange={autoBetForm.onTakeProfitChange}
        stopLossCents={autoBetForm.visibleStopLossCents}
        takeProfitCents={autoBetForm.visibleTakeProfitCents}
      />
      <AutoBetStrategyFields
        disabled={autoBetFormDisabled}
        martingaleMaxSteps={autoBetForm.visibleMartingaleMaxSteps}
        martingaleMultiplier={autoBetForm.visibleMartingaleMultiplier}
        onMartingaleMaxStepsChange={autoBetForm.onMartingaleMaxStepsChange}
        onMartingaleMultiplierChange={
          autoBetForm.onMartingaleMultiplierChange
        }
        onStrategyChange={autoBetForm.setStrategy}
        strategy={autoBetForm.visibleStrategy}
      />
    </>
  ) : null}

  {!isAuthenticated ? (
    <Button
      className="mt-3 w-full"
      onClick={() => void login()}
      type="button"
      variant="neon"
    >
      Entrar para apostar
    </Button>
  ) : null}

  {stoppedAutoBetSession ? (
    <AutoBetSessionSummary session={stoppedAutoBetSession} />
  ) : null}
</div>

{mutationError ? (
  <ToastNotice message={getApiErrorMessage(mutationError)} />
) : null}
```

Keep the existing mutation payload logic exactly as shown above. Do not duplicate `BetActionButtons`.

- [ ] **Step 4: Retune action button layout and semantics**

In `frontend/src/components/game/bet-action-buttons.tsx`, change the wrapper from:

```tsx
<div className="mt-4 grid grid-cols-1 gap-2">
```

to:

```tsx
<div className="mt-3 grid grid-cols-1 gap-2">
```

Keep both buttons full-width and do not change the button text. The primary action must still be exactly `Apostar`, `Iniciar Auto Bet`, or `Parar Auto Bet` depending on mode/session state.

- [ ] **Step 5: Run focused tests**

Run:

```bash
cd frontend && bun run test src/components/game/game-dashboard-shell.test.tsx
```

Expected:

- Compact dock tests pass.
- Existing bet placement, auto cashout, and auto bet tests still pass.
- No assertion expects `Cashier rail`.

- [ ] **Step 6: Typecheck frontend**

Run:

```bash
bunx tsc --noEmit -p frontend/tsconfig.json
```

Expected:

- No TypeScript errors from new components.

- [ ] **Step 7: Checkpoint and commit**

Run:

```bash
git diff -- frontend/src/components/game/bet-controls-panel.tsx frontend/src/components/game/bet-slip-header.tsx frontend/src/components/game/bet-slip-amount-field.tsx frontend/src/components/game/bet-action-buttons.tsx frontend/src/components/game/game-dashboard-shell.test.tsx
```

Expected:

- One bet form in DOM.
- New presentational components are focused and small.

## Task 5: Apply Felt Green + Gold Design Tokens

**Files:**

- Modify: `frontend/src/styles.css`
- Modify: `frontend/src/components/ui/button.tsx`
- Modify: `frontend/src/components/game/bet-mode-toggle.tsx`
- Modify: `frontend/src/components/game/bet-stake-preview.tsx`

- [ ] **Step 1: Add casino semantic variables**

In `frontend/src/styles.css`, extend `:root` with:

```css
  --casino-felt: #064e3b;
  --casino-felt-deep: #052e16;
  --casino-gold: #facc15;
  --casino-gold-soft: #fde68a;
  --casino-risk: #f43f5e;
  --casino-win: #22c55e;
  --casino-tech: #22d3ee;
  --casino-surface: rgba(3, 7, 18, 0.94);
```

- [ ] **Step 2: Add a premium bet slip class**

In `frontend/src/styles.css`, add:

```css
.casino-bet-slip {
  background:
    radial-gradient(circle at 12% 0%, rgba(250, 204, 21, 0.18), transparent 18rem),
    linear-gradient(145deg, rgba(6, 78, 59, 0.82), rgba(2, 6, 23, 0.96) 68%);
  backdrop-filter: blur(20px);
  box-shadow:
    inset 0 1px 0 rgba(253, 230, 138, 0.16),
    0 24px 72px rgba(0, 0, 0, 0.38);
}
```

- [ ] **Step 3: Retune shared panel classes without deleting old class names**

Keep the existing class names `.casino-mini-panel`, `.casino-tabs`, and
`.casino-stage-shell`, but retune their backgrounds toward felt/gold:

```css
.casino-mini-panel,
.casino-tabs,
.casino-stage-shell {
  background:
    linear-gradient(135deg, rgba(250, 204, 21, 0.1), transparent 34%),
    linear-gradient(180deg, rgba(6, 78, 59, 0.42), rgba(2, 6, 23, 0.86));
  backdrop-filter: blur(22px);
  box-shadow:
    inset 0 1px 0 rgba(253, 230, 138, 0.12),
    0 24px 72px rgba(0, 0, 0, 0.36);
}
```

Do not remove `.chrono-arena` or 3D stage animation classes.

- [ ] **Step 4: Retune button variants**

In `frontend/src/components/ui/button.tsx`, adjust:

- `temporal`: use gold/felt instead of rose/pink for the primary bet action.
- `cash`: keep emerald/green for cashout.
- `neon`: reduce rose dominance and use amber border for login/secondary casino accent.

Use this target for `temporal`:

```tsx
temporal:
  "border border-amber-200/70 bg-gradient-to-b from-amber-200 to-yellow-500 text-zinc-950 shadow-[0_0_34px_rgba(250,204,21,0.28)] hover:from-amber-100 hover:to-yellow-400 focus-visible:outline-amber-200",
```

- [ ] **Step 5: Retune segmented controls and stake preview**

In `frontend/src/components/game/bet-mode-toggle.tsx`, change focus and selected colors from ciano to amber/felt:

```tsx
"... focus-visible:outline-amber-200 ..."
selected
  ? "border border-amber-200/45 bg-amber-200/15 text-amber-100"
  : "text-zinc-400 hover:bg-emerald-950/55 hover:text-zinc-100"
```

In `frontend/src/components/game/bet-stake-preview.tsx`, keep entry neutral and payout emerald, but replace the entry border with amber/felt:

```tsx
<div className="min-w-0 rounded-md border border-amber-200/15 bg-black/35 px-3 py-2.5 text-sm text-zinc-300">
```

- [ ] **Step 6: Run focused frontend tests and lint**

Run:

```bash
cd frontend && bun run test src/components/game/game-dashboard-shell.test.tsx
bun run lint
```

Expected:

- Tests pass.
- Lint passes with no Fast Refresh warning from new files.

- [ ] **Step 7: Checkpoint and commit**

Run:

```bash
git diff -- frontend/src/styles.css frontend/src/components/ui/button.tsx frontend/src/components/game/bet-mode-toggle.tsx frontend/src/components/game/bet-stake-preview.tsx
```

Expected:

- Casino variables exist.
- Ciano no longer dominates bet controls.

## Task 6: Restyle History, Leaderboard, Technical Panels, and Stage Shell

**Files:**

- Modify: `frontend/src/components/game/arcade-tab-panels.tsx`
- Modify: `frontend/src/components/game/leaderboard-panel.tsx`
- Modify: `frontend/src/components/game/arcade-technical-tabs.tsx`
- Modify: `frontend/src/components/game/crash-round-panel.tsx`
- Modify: `frontend/src/components/game/game-dashboard-shell.test.tsx`

- [ ] **Step 1: Add class contract checks for history and leaderboard**

In `game-dashboard-shell.test.tsx`, extend `renders the main game screen without the former metric card grid`:

```tsx
expect(screen.getByRole("region", { name: "Histórico de rodadas" }).className)
  .toContain("casino-chip-rail");
expect(screen.getAllByText("Leaderboard").length).toBeGreaterThan(0);
```

Extend the desktop sidebar test:

```tsx
expect(desktopSidebar.className).toContain("lg:sticky");
```

- [ ] **Step 2: Run the test and confirm it fails for the missing chip rail class**

Run:

```bash
cd frontend && bun run test src/components/game/game-dashboard-shell.test.tsx
```

Expected before style implementation:

- Fails because `casino-chip-rail` is not yet present.

- [ ] **Step 3: Apply history chip rail styling**

In `frontend/src/components/game/arcade-tab-panels.tsx`, change `RoundHistoryPanel` section class to include `casino-chip-rail`:

```tsx
className="casino-chip-rail casino-mini-panel min-w-0 rounded-lg border border-amber-200/25 bg-black/45 p-2.5 shadow-[0_0_42px_rgba(250,204,21,0.12)]"
```

Keep:

```tsx
data-testid="round-history-track"
overflow-x-auto
flex-nowrap
```

- [ ] **Step 4: Retune leaderboard copy and style without changing API data**

In `frontend/src/components/game/leaderboard-panel.tsx`:

Change the eyebrow from:

```tsx
Net profit
```

to:

```tsx
Mesa VIP
```

Keep the heading text `Leaderboard` so browser/user expectations do not break.

Change the root class to:

```tsx
"casino-scoreboard casino-mini-panel min-w-0 rounded-lg border border-amber-200/25 bg-black/45 p-3 shadow-[0_0_50px_rgba(250,204,21,0.12)]"
```

Keep `currentPlayerUsername` highlight logic unchanged.

- [ ] **Step 5: Make technical tabs secondary**

In `frontend/src/components/game/arcade-technical-tabs.tsx`, change the root section class from:

```tsx
className="casino-tabs rounded-xl border border-white/10 p-3"
```

to:

```tsx
className="casino-tabs casino-audit-panel rounded-xl border border-cyan-200/10 p-3"
```

Keep tab labels exactly:

- `Provably Fair`
- `Round State`
- `Mesa`

- [ ] **Step 6: Retune the stage shell frame**

In `frontend/src/components/game/crash-round-panel.tsx`, change the root class from rose emphasis to amber/felt:

```tsx
className="casino-stage-shell min-w-0 rounded-2xl border border-amber-200/25 p-3 sm:p-4"
```

Do not change `CrashCurveChart`, `ChronoStage`, or 3D scene props in this task.

- [ ] **Step 7: Run focused tests**

Run:

```bash
cd frontend && bun run test src/components/game/game-dashboard-shell.test.tsx src/components/game/arcade-tab-panels.test.tsx
```

Expected:

- History rail ordering still passes.
- `round-history-track` still has local horizontal scrolling.
- Leaderboard still renders current player and money values.

- [ ] **Step 8: Checkpoint and commit**

Run:

```bash
git diff -- frontend/src/components/game/arcade-tab-panels.tsx frontend/src/components/game/leaderboard-panel.tsx frontend/src/components/game/arcade-technical-tabs.tsx frontend/src/components/game/crash-round-panel.tsx frontend/src/components/game/game-dashboard-shell.test.tsx
```

Expected:

- Visual classes changed.
- No data formatting or API behavior changed.

## Task 7: Pass Browser Responsive and Player Flow Tests

**Files:**

- Modify only if needed: `tests/browser/player-flow.spec.ts`
- Modify only if needed: `tests/browser/responsive-layout.spec.ts`
- Modify only if needed: frontend components from prior tasks

- [ ] **Step 1: Run responsive browser regression**

Run:

```bash
bunx playwright test tests/browser/responsive-layout.spec.ts
```

Expected after Tasks 3-6:

- `390x844`, `768x1024`, `1024x768`, and `1440x900` pass.
- `overflowX` is false for all viewports.
- At `1024x768`, `betSlipBesideStage` is true.

- [ ] **Step 2: If responsive test fails, fix the smallest layout issue**

Use these expected fixes:

- If mobile overflows horizontally, look for fixed widths or unbounded grids in `BetControlsPanel`, `LeaderboardPanel`, and `RoundHistoryPanel`.
- If `1024x768` does not place bet slip beside the stage, inspect `GameDashboardShell` `lg:grid-cols`, aside order, and `stage-technical-tabs-slot`.
- If the dock overlays content, add bottom padding to `.arcade-dashboard` or adjust the `BetControlsPanel` sticky class in `GameDashboardShell`.

After each fix, rerun:

```bash
bunx playwright test tests/browser/responsive-layout.spec.ts
```

- [ ] **Step 3: Run existing authenticated browser flows**

Run:

```bash
bun run test:e2e:browser
```

Expected:

- 3 tests pass.
- The tests continue using:
  - `connected BETTING`
  - `Rodada inicia em`
  - `Conta do jogador`
  - `/games/rounds/current`
- No selector depends on old cards.

- [ ] **Step 4: If player flow needs details expansion, update tests intentionally**

If mobile-specific selectors require opening compact details, add an explicit helper instead of weakening assertions:

```ts
async function expandBetSlipDetails(page: Page) {
  const toggle = page.getByRole("button", { name: "Configurar aposta" });

  if (await toggle.isVisible()) {
    await toggle.click();
  }
}
```

Only call this helper before interacting with controls that live in `bet-slip-details`, such as `Auto`, `Martingale`, or auto cashout presets.

- [ ] **Step 5: Checkpoint and commit**

Run:

```bash
git diff -- tests/browser/player-flow.spec.ts tests/browser/responsive-layout.spec.ts frontend/src/components/game
```

Expected:

- Browser tests cover new responsive behavior.
- Existing player flows remain strong.

## Task 8: Full Frontend and Quality Verification

**Files:**

- Modify only if needed: files touched by earlier tasks
- Modify if a real issue appears: `docs/superpowers/specs/2026-05-31-crash-game-implementation-issue-log.md`

- [ ] **Step 1: Run frontend unit suite**

Run:

```bash
cd frontend && bun run test
```

Expected:

- All frontend Vitest tests pass.
- Current known baseline before this redesign was 118 tests.

- [ ] **Step 2: Run frontend build**

Run:

```bash
cd frontend && bun run build
```

Expected:

- Build exits 0.
- If Vite warns about chunk size only, keep note but do not treat it as failure unless the command exits nonzero.

- [ ] **Step 3: Run local CI gate**

Run:

```bash
bun run ci:local
```

Expected:

- Lint passes.
- Typecheck passes.
- Unit tests pass.
- Coverage passes.
- Quality gate passes with no regression in file size or duplication.
- `docker compose config` passes.

- [ ] **Step 4: Run browser E2E**

Run:

```bash
bun run test:e2e:browser
```

Expected:

- 3 authenticated browser flows pass.

- [ ] **Step 5: Run whitespace check**

Run:

```bash
git diff --check
```

Expected:

- No output.

- [ ] **Step 6: Record real failures in the issue log**

If any command in this task fails for a real project reason, add a numbered entry to:

```text
docs/superpowers/specs/2026-05-31-crash-game-implementation-issue-log.md
```

Entry format:

```md
### 65. <short title>

- Contexto: premium arcade casino responsive redesign.
- Sintoma: `<command>` failed with `<specific failure>`.
- Causa: `<root cause discovered during diagnosis>`.
- Correcao: `<specific fix>`.
- Validacao: `<command that passed after fix>`.
- Status: resolvido.
```

Use the next available issue number if `65` is already taken.

- [ ] **Step 7: Final checkpoint without commit**

Run:

```bash
git status --short --branch
git diff --stat
```

Expected:

- Branch remains `crash-game-implementation`.
- `README.md` is not modified.
- The two old untracked docs remain untouched.
- Commits may exist for completed task checkpoints; no push, PR, or merge has been performed.

## Completion Criteria

The redesign implementation is complete only when:

- `cd frontend && bun run test` passes.
- `cd frontend && bun run build` passes.
- `bun run ci:local` passes.
- `bun run test:e2e:browser` passes.
- `bunx playwright test tests/browser/responsive-layout.spec.ts` passes.
- `git diff --check` passes.
- The browser at `http://localhost:8000/` shows felt green + gold premium casino styling.
- Mobile, tablet, laptop, and desktop viewports have no horizontal overflow.
- At `1024px`, the stage and bet slip are side by side.
- The old metric card selectors remain absent.
- No tests were removed, disabled, or weakened.
- No forbidden docs or `README.md` were touched.
