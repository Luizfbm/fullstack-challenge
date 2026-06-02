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
import {
  parseAutoCashoutMultiplierInput,
} from "../../services/auto-cashout";
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
import { AutoCashoutControl } from "./auto-cashout-control";
import {
  autoBetConfigIsValid,
  buildAutoBetPayload,
  formatMultiplierInput,
  getPotentialPayout,
  onlyDigits,
} from "./bet-controls-model";
import { BetModeToggle, type BetMode } from "./bet-mode-toggle";
import { BetStakePreview } from "./bet-stake-preview";
import type { DashboardRound } from "./round-formatting";
import { ToastNotice } from "./toast-notice";

type BetControlsPanelProps = {
  activeBet: BetResponse | null;
  autoBetSession?: AutoBetSessionResponse | null;
  className?: string;
  currentRound: DashboardRound | null;
};

export function BetControlsPanel({
  activeBet,
  autoBetSession = null,
  className,
  currentRound,
}: BetControlsPanelProps) {
  const { isAuthenticated, login } = useAuth();
  const { betAmountCents, betAmountLabel, resetBetSlip, setBetAmountCents } =
    useBetSlip();
  const placeBetMutation = usePlaceBetMutation();
  const cashOutMutation = useCashOutMutation();
  const startAutoBetSessionMutation = useStartAutoBetSessionMutation();
  const stopAutoBetSessionMutation = useStopAutoBetSessionMutation();
  const [betMode, setBetMode] = useState<BetMode>("manual");
  const [autoCashoutEnabled, setAutoCashoutEnabled] = useState(false);
  const [autoCashoutTarget, setAutoCashoutTarget] = useState("2.00");
  const [maxRounds, setMaxRounds] = useState("10");
  const [stopLossCents, setStopLossCents] = useState("");
  const [takeProfitCents, setTakeProfitCents] = useState("");
  const autoCashoutParseResult =
    parseAutoCashoutMultiplierInput(autoCashoutTarget);
  const autoCashoutIsValid =
    !autoCashoutEnabled || autoCashoutParseResult.valid;
  const amountIsValid = BigInt(betAmountCents) > 0n;
  const activeAutoBetSession =
    autoBetSession?.status === "ACTIVE" ? autoBetSession : null;
  const selectedBetMode: BetMode = activeAutoBetSession ? "auto" : betMode;
  const visibleBetAmountCents =
    activeAutoBetSession?.amountCents ?? betAmountCents;
  const visibleAutoCashoutEnabled = activeAutoBetSession
    ? activeAutoBetSession.autoCashoutMultiplierBp !== null
    : autoCashoutEnabled;
  const visibleAutoCashoutTarget = activeAutoBetSession?.autoCashoutMultiplierBp
    ? formatMultiplierInput(activeAutoBetSession.autoCashoutMultiplierBp)
    : autoCashoutTarget;
  const visibleAutoCashoutParseResult = activeAutoBetSession
    ?.autoCashoutMultiplierBp
    ? {
        multiplierBp: activeAutoBetSession.autoCashoutMultiplierBp,
        valid: true,
      }
    : autoCashoutParseResult;
  const visibleMaxRounds = activeAutoBetSession
    ? String(activeAutoBetSession.maxRounds)
    : maxRounds;
  const visibleStopLossCents =
    activeAutoBetSession?.stopLossCents ?? stopLossCents;
  const visibleTakeProfitCents =
    activeAutoBetSession?.takeProfitCents ?? takeProfitCents;
  const maxRoundsNumber = Number(maxRounds);
  const autoBetConfigValid = autoBetConfigIsValid({
    maxRounds: maxRoundsNumber,
    stopLossCents,
    takeProfitCents,
  });
  const autoBetFormDisabled =
    Boolean(activeAutoBetSession) ||
    startAutoBetSessionMutation.isPending ||
    stopAutoBetSessionMutation.isPending;
  const canStartAutoBet =
    isAuthenticated &&
    amountIsValid &&
    autoCashoutIsValid &&
    autoBetConfigValid &&
    !activeAutoBetSession &&
    !startAutoBetSessionMutation.isPending;
  const canPlaceBet =
    selectedBetMode === "manual" &&
    isAuthenticated &&
    amountIsValid &&
    autoCashoutIsValid &&
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
  const potentialPayout = getPotentialPayout(activeBet, currentRound);
  const autoBetPayload = buildAutoBetPayload({
    amountCents: betAmountCents,
    autoCashoutEnabled,
    autoCashoutParseResult,
    maxRounds: maxRoundsNumber,
    stopLossCents,
    takeProfitCents,
  });

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
        enabled={visibleAutoCashoutEnabled}
        onEnabledChange={setAutoCashoutEnabled}
        onTargetChange={setAutoCashoutTarget}
        parseResult={visibleAutoCashoutParseResult}
        target={visibleAutoCashoutTarget}
      />

      {activeAutoBetSession ? (
        <AutoBetSessionSummary session={activeAutoBetSession} />
      ) : null}

      {selectedBetMode === "auto" ? (
        <AutoBetSettingsFields
          disabled={autoBetFormDisabled}
          maxRounds={visibleMaxRounds}
          onMaxRoundsChange={(value) => setMaxRounds(onlyDigits(value))}
          onStopLossChange={(value) => setStopLossCents(onlyDigits(value))}
          onTakeProfitChange={(value) => setTakeProfitCents(onlyDigits(value))}
          stopLossCents={visibleStopLossCents}
          takeProfitCents={visibleTakeProfitCents}
        />
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
            autoCashoutEnabled
              ? {
                  amountCents: betAmountCents,
                  autoCashoutMultiplierBp: autoCashoutParseResult.multiplierBp,
                }
              : { amountCents: betAmountCents },
          )
        }
        onStartAutoBet={() => startAutoBetSessionMutation.mutate(autoBetPayload)}
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
