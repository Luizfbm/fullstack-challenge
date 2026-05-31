import { RotateCcw } from "lucide-react";
import { useAuth } from "../../hooks/use-auth";
import { useBetSlip } from "../../hooks/use-bet-slip";
import {
  useCashOutMutation,
  usePlaceBetMutation,
} from "../../hooks/use-game-rest";
import { getApiErrorMessage } from "../../services/api-errors";
import type { BetResponse, RoundResponse } from "../../services/game-api";
import { Button } from "../ui/button";
import { Input } from "../ui/input";

type BetControlsPanelProps = {
  activeBet: BetResponse | null;
  currentRound: RoundResponse | null;
};

export function BetControlsPanel({
  activeBet,
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

  return (
    <section className="rounded-md border border-zinc-800 bg-zinc-900/70 p-4">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-zinc-100">Aposta</h2>
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

      <label className="block text-xs font-medium text-zinc-500" htmlFor="bet">
        Valor em centavos
      </label>
      <Input
        className="mt-2"
        disabled={placeBetMutation.isPending}
        id="bet"
        inputMode="numeric"
        onChange={(event) => setBetAmountCents(event.target.value)}
        value={betAmountCents}
      />

      <div className="mt-3 rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-300">
        {betAmountLabel}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <Button
          disabled={!canPlaceBet}
          onClick={() =>
            placeBetMutation.mutate({ amountCents: betAmountCents })
          }
          type="button"
        >
          {placeBetMutation.isPending ? "Enviando" : "Apostar"}
        </Button>
        <Button
          disabled={!canCashOut}
          onClick={() => cashOutMutation.mutate()}
          type="button"
          variant="secondary"
        >
          {cashOutMutation.isPending ? "Sacando" : "Cash Out"}
        </Button>
      </div>

      {activeBet ? (
        <p className="mt-3 text-xs text-zinc-500">
          Aposta ativa: {activeBet.status}
        </p>
      ) : null}

      {mutationError ? (
        <div className="mt-3 rounded-md border border-rose-400/30 bg-rose-400/10 p-3 text-sm text-rose-100">
          {getApiErrorMessage(mutationError)}
        </div>
      ) : null}

      {!isAuthenticated ? (
        <Button
          className="mt-3 w-full"
          onClick={() => void login()}
          type="button"
          variant="ghost"
        >
          Entrar para apostar
        </Button>
      ) : null}
    </section>
  );
}
