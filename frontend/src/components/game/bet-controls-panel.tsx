import { useState } from "react";
import { useAuth } from "../../hooks/use-auth";
import { useBetSlip } from "../../hooks/use-bet-slip";
import {
  useCashOutMutation,
  usePlaceBetMutation,
  useStartAutoBetSessionMutation,
  useStopAutoBetSessionMutation,
} from "../../hooks/use-game-rest";
import { cn } from "../../lib/utils";
import { getApiErrorMessage } from "../../services/api-errors";
import type {
  AutoBetSessionResponse,
  BetResponse,
} from "../../services/game-api";
import {
  formatCents,
  formatCentsForRealInput,
  parseRealInputToCents,
} from "../../services/money";
import { Button } from "../ui/button";
import { ActiveBetSummary } from "./active-bet-summary";
import { AutoBetSessionSummary } from "./auto-bet-session-summary";
import { AutoBetSettingsFields } from "./auto-bet-settings-fields";
import { AutoBetStrategyFields } from "./auto-bet-strategy-fields";
import { AutoCashoutControl } from "./auto-cashout-control";
import { BetActionButtons } from "./bet-action-buttons";
import { getPotentialPayout } from "./bet-controls-model";
import { BetModeToggle, type BetMode } from "./bet-mode-toggle";
import { BetSlipAmountField } from "./bet-slip-amount-field";
import { BetSlipHeader } from "./bet-slip-header";
import { BetStakePreview } from "./bet-stake-preview";
import type { DashboardRound } from "./round-formatting";
import { ToastNotice } from "./toast-notice";
import { useAutoBetForm } from "./use-auto-bet-form";

type BetControlsPanelProps = {
  activeBet: BetResponse | null;
  autoBetSession?: AutoBetSessionResponse | null;
  className?: string;
  currentRound: DashboardRound | null;
  now?: Date;
};

export function BetControlsPanel({
  activeBet,
  autoBetSession = null,
  className,
  currentRound,
  now = new Date(),
}: BetControlsPanelProps) {
  const { isAuthenticated, login } = useAuth();
  const { betAmountCents, betAmountLabel, resetBetSlip, setBetAmountCents } =
    useBetSlip();
  const placeBetMutation = usePlaceBetMutation();
  const cashOutMutation = useCashOutMutation();
  const startAutoBetSessionMutation = useStartAutoBetSessionMutation();
  const stopAutoBetSessionMutation = useStopAutoBetSessionMutation();
  const [betMode, setBetMode] = useState<BetMode>("manual");
  const [detailsOpen, setDetailsOpen] = useState(false);
  const amountIsValid = BigInt(betAmountCents) > 0n;
  const activeAutoBetSession =
    autoBetSession?.status === "ACTIVE" ? autoBetSession : null;
  const stoppedAutoBetSession =
    autoBetSession && autoBetSession.status !== "ACTIVE" ? autoBetSession : null;
  const autoBetForm = useAutoBetForm({
    activeSession: activeAutoBetSession,
    amountCents: betAmountCents,
  });
  const selectedBetMode: BetMode = activeAutoBetSession ? "auto" : betMode;
  const visibleBetAmountCents =
    activeAutoBetSession?.amountCents ?? betAmountCents;
  const autoBetFormDisabled =
    Boolean(activeAutoBetSession) ||
    startAutoBetSessionMutation.isPending ||
    stopAutoBetSessionMutation.isPending;
  const canStartAutoBet =
    isAuthenticated &&
    amountIsValid &&
    autoBetForm.autoCashoutIsValid &&
    autoBetForm.autoBetConfigValid &&
    !activeAutoBetSession &&
    !startAutoBetSessionMutation.isPending;
  const canPlaceBet =
    selectedBetMode === "manual" &&
    isAuthenticated &&
    amountIsValid &&
    autoBetForm.autoCashoutIsValid &&
    currentRound?.status === "BETTING" &&
    !activeBet &&
    !activeAutoBetSession &&
    !placeBetMutation.isPending;
  const canCashOut =
    isAuthenticated &&
    currentRound?.status === "RUNNING" &&
    activeBet?.status === "ACCEPTED" &&
    !cashOutMutation.isPending;
  const mutationError =
    placeBetMutation.error ??
    cashOutMutation.error ??
    startAutoBetSessionMutation.error ??
    stopAutoBetSessionMutation.error;
  const potentialPayout = getPotentialPayout(activeBet, currentRound, now);

  function placeBet() {
    placeBetMutation.mutate(
      autoBetForm.autoCashoutEnabled
        ? {
            amountCents: betAmountCents,
            autoCashoutMultiplierBp:
              autoBetForm.autoCashoutParseResult.multiplierBp,
          }
        : { amountCents: betAmountCents },
    );
  }

  return (
    <section
      className={cn(
        "casino-bet-slip rounded-lg border border-amber-200/25 p-3 sm:p-4",
        className,
      )}
      data-testid="bet-slip-panel"
    >
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
          onPlaceBet={placeBet}
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
    </section>
  );
}
