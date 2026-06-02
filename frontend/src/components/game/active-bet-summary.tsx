import { formatMultiplierBp } from "../../services/auto-cashout";
import type { BetResponse } from "../../services/game-api";
import { formatCents } from "../../services/money";

type ActiveBetSummaryProps = {
  activeBet: BetResponse;
  potentialPayout: bigint | null;
};

export function ActiveBetSummary({
  activeBet,
  potentialPayout,
}: ActiveBetSummaryProps) {
  return (
    <div className="mt-3 rounded-md border border-emerald-300/20 bg-emerald-300/10 px-3 py-2 text-xs text-zinc-300">
      <p>Aposta ativa: {activeBet.status}</p>
      {activeBet.autoCashoutMultiplierBp ? (
        <p className="mt-1 text-cyan-200">
          Auto cashout em {formatMultiplierBp(activeBet.autoCashoutMultiplierBp)}
        </p>
      ) : null}
      {potentialPayout ? (
        <p className="mt-1 text-emerald-200">
          Payout potencial: {formatCents(potentialPayout)}
        </p>
      ) : null}
    </div>
  );
}
