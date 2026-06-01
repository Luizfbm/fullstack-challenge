import { Gauge, RotateCcw, Sparkles } from "lucide-react";
import { useAuth } from "../../hooks/use-auth";
import { useBetSlip } from "../../hooks/use-bet-slip";
import {
  useCashOutMutation,
  usePlaceBetMutation,
} from "../../hooks/use-game-rest";
import { cn } from "../../lib/utils";
import { getApiErrorMessage } from "../../services/api-errors";
import type { BetResponse } from "../../services/game-api";
import { formatCents } from "../../services/money";
import { calculatePayoutCents } from "../../services/payout";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import type { DashboardRound } from "./round-formatting";

type BetControlsPanelProps = {
  activeBet: BetResponse | null;
  className?: string;
  currentRound: DashboardRound | null;
};

export function BetControlsPanel({
  activeBet,
  className,
  currentRound,
}: BetControlsPanelProps) {
  const { isAuthenticated, login } = useAuth();
  const { betAmountCents, betAmountLabel, resetBetSlip, setBetAmountCents } =
    useBetSlip();
  const placeBetMutation = usePlaceBetMutation();
  const cashOutMutation = useCashOutMutation();
  const amountIsValid = BigInt(betAmountCents) > 0n;
  const canPlaceBet =
    isAuthenticated &&
    amountIsValid &&
    currentRound?.status === "BETTING" &&
    !activeBet &&
    !placeBetMutation.isPending;
  const canCashOut =
    isAuthenticated &&
    currentRound?.status === "RUNNING" &&
    activeBet?.status === "ACCEPTED" &&
    !cashOutMutation.isPending;
  const mutationError = placeBetMutation.error ?? cashOutMutation.error;
  const potentialPayout = getPotentialPayout(activeBet, currentRound);

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

      <label className="block text-xs font-medium text-zinc-400" htmlFor="bet">
        Valor em centavos
      </label>
      <Input
        className="mt-2 h-12 border-rose-300/25 bg-black/45 font-mono text-lg"
        disabled={placeBetMutation.isPending}
        id="bet"
        inputMode="numeric"
        onChange={(event) => setBetAmountCents(event.target.value)}
        value={betAmountCents}
      />

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <div className="rounded-md border border-white/5 bg-black/35 px-3 py-2 text-sm text-zinc-300">
          <p className="text-xs text-zinc-500">Entrada</p>
          <p className="font-mono text-zinc-50">{betAmountLabel}</p>
        </div>
        <div className="rounded-md border border-emerald-300/15 bg-emerald-300/10 px-3 py-2 text-sm">
          <p className="text-xs text-zinc-500">Extracao estimada</p>
          <p className="font-mono text-emerald-100">
            {potentialPayout ? formatCents(potentialPayout) : "-"}
          </p>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Button
          disabled={!canPlaceBet}
          onClick={() =>
            placeBetMutation.mutate({ amountCents: betAmountCents })
          }
          type="button"
          variant="temporal"
        >
          <Sparkles className="size-4" aria-hidden="true" />
          {placeBetMutation.isPending ? "Enviando" : "Apostar"}
        </Button>
        <Button
          disabled={!canCashOut}
          onClick={() => cashOutMutation.mutate()}
          type="button"
          variant="cash"
        >
          <Gauge className="size-4" aria-hidden="true" />
          {cashOutMutation.isPending
            ? "Sacando"
            : potentialPayout
              ? `Cash Out ${formatCents(potentialPayout)}`
              : "Cash Out"}
        </Button>
      </div>

      {activeBet ? (
        <div className="mt-3 rounded-md border border-emerald-300/20 bg-emerald-300/10 px-3 py-2 text-xs text-zinc-300">
          <p>Aposta ativa: {activeBet.status}</p>
          {potentialPayout ? (
            <p className="mt-1 text-emerald-200">
              Payout potencial: {formatCents(potentialPayout)}
            </p>
          ) : null}
        </div>
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

function getPotentialPayout(
  activeBet: BetResponse | null,
  currentRound: DashboardRound | null,
): bigint | null {
  if (!activeBet || !currentRound || activeBet.status !== "ACCEPTED") {
    return null;
  }

  const multiplierBp = currentRound.currentMultiplierBp;

  if (typeof multiplierBp !== "number") {
    return null;
  }

  return calculatePayoutCents(activeBet.amountCents, multiplierBp);
}

function ToastNotice({ message }: { message: string }) {
  return (
    <div
      aria-live="polite"
      className="fixed inset-x-4 bottom-[calc(env(safe-area-inset-bottom)+15rem)] z-50 rounded-md border border-rose-400/40 bg-rose-950 px-4 py-3 text-sm text-rose-50 shadow-xl shadow-black/40 sm:left-auto sm:w-96 lg:bottom-4"
      role="alert"
    >
      {message}
    </div>
  );
}
