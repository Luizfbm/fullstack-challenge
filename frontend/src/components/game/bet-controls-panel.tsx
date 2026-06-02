import { RotateCcw } from "lucide-react";
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
import { formatCents } from "../../services/money";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { ActiveBetSummary } from "./active-bet-summary";
import { BetActionButtons } from "./bet-action-buttons";
import { AutoBetSessionSummary } from "./auto-bet-session-summary";
import { AutoBetSettingsFields } from "./auto-bet-settings-fields";
import { AutoBetStrategyFields } from "./auto-bet-strategy-fields";
import { AutoCashoutControl } from "./auto-cashout-control";
import { getPotentialPayout } from "./bet-controls-model";
import { BetModeToggle, type BetMode } from "./bet-mode-toggle";
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
  const amountIsValid = BigInt(betAmountCents) > 0n;
  const activeAutoBetSession =
    autoBetSession?.status === "ACTIVE" ? autoBetSession : null;
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

  return (
    <section
      className={cn(
        "casino-action-dock rounded-lg border border-rose-300/25 p-4",
        className,
      )}
    >
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-rose-200">
            Cashier rail
          </p>
          <h2 className="mt-1 text-lg font-black text-zinc-50">Aposta</h2>
        </div>
        <Button
          aria-label="Resetar aposta"
          onClick={resetBetSlip}
          size="icon"
          type="button"
          variant="ghost"
        >
          <RotateCcw className="size-4" aria-hidden="true" />
        </Button>
      </div>

      <BetModeToggle
        disabled={Boolean(activeAutoBetSession)}
        onChange={setBetMode}
        value={selectedBetMode}
      />

      <label className="block text-xs font-medium text-zinc-400" htmlFor="bet">
        Valor em centavos
      </label>
      <Input
        className="mt-2 h-12 border-rose-300/25 bg-black/45 font-mono text-lg"
        disabled={placeBetMutation.isPending || autoBetFormDisabled}
        id="bet"
        inputMode="numeric"
        onChange={(event) => setBetAmountCents(event.target.value)}
        value={visibleBetAmountCents}
      />

      <BetStakePreview
        entryLabel={
          activeAutoBetSession ? formatCents(visibleBetAmountCents) : betAmountLabel
        }
        potentialPayout={potentialPayout}
      />

      <AutoCashoutControl
        disabled={autoBetFormDisabled}
        enabled={autoBetForm.visibleAutoCashoutEnabled}
        onEnabledChange={autoBetForm.setAutoCashoutEnabled}
        onTargetChange={autoBetForm.setAutoCashoutTarget}
        parseResult={autoBetForm.visibleAutoCashoutParseResult}
        target={autoBetForm.visibleAutoCashoutTarget}
      />

      {autoBetSession ? (
        <AutoBetSessionSummary session={autoBetSession} />
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

      {activeBet ? (
        <ActiveBetSummary
          activeBet={activeBet}
          potentialPayout={potentialPayout}
        />
      ) : null}

      {mutationError ? (
        <ToastNotice message={getApiErrorMessage(mutationError)} />
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
    </section>
  );
}
