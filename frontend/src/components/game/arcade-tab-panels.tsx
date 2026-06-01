import { Activity, History, ShieldCheck } from "lucide-react";
import type { BetResponse, RoundResponse } from "../../services/game-api";
import { formatCents } from "../../services/money";
import { Badge } from "../ui/badge";
import {
  formatRoundMultiplier,
  roundHistoryVariant,
} from "./round-formatting";

export function BetsPanel({
  bets,
  isLoading,
}: {
  bets: BetResponse[];
  isLoading: boolean;
}) {
  return (
    <section>
      <div className="mb-4 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Activity className="size-4 text-cyan-300" aria-hidden="true" />
          <h2 className="text-sm font-semibold text-zinc-100">Mesa</h2>
        </div>
        <Badge variant="chrono">{bets.length} apostas</Badge>
      </div>
      <div className="space-y-2">
        {bets.slice(0, 8).map((bet) => (
          <BetTableRow key={bet.id} bet={bet} />
        ))}
        {bets.length ? null : (
          <TableRow label={isLoading ? "sincronizando" : "apostas"} value="-" />
        )}
      </div>
    </section>
  );
}

export function RoundHistoryPanel({
  history,
  isLoading,
}: {
  history: RoundResponse[];
  isLoading: boolean;
}) {
  return (
    <section>
      <div className="mb-4 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <History className="size-4 text-amber-300" aria-hidden="true" />
          <h2 className="text-sm font-semibold text-zinc-100">Histórico</h2>
        </div>
        <ShieldCheck className="size-4 text-emerald-300" aria-hidden="true" />
      </div>
      <div className="flex flex-wrap gap-2">
        {history.map((round) => (
          <Badge key={round.id} variant={roundHistoryVariant(round)}>
            {formatRoundMultiplier(round)}
          </Badge>
        ))}
        {history.length ? null : <Badge>{isLoading ? "..." : "-"}</Badge>}
      </div>
    </section>
  );
}

function BetTableRow({ bet }: { bet: BetResponse }) {
  const payout = bet.payoutCents ? ` -> ${formatCents(bet.payoutCents)}` : "";
  const multiplier = bet.cashoutMultiplierBp
    ? ` @ ${(bet.cashoutMultiplierBp / 10000).toFixed(2)}x`
    : "";

  return (
    <TableRow
      label={bet.username}
      tone={getBetRowTone(bet)}
      value={`${bet.status} ${formatCents(bet.amountCents)}${multiplier}${payout}`}
    />
  );
}

function getBetRowTone(bet: BetResponse): "danger" | "neutral" | "success" {
  if (bet.status === "CASHED_OUT") {
    return "success";
  }

  return bet.status === "LOST" ? "danger" : "neutral";
}

function TableRow({
  label,
  tone = "neutral",
  value,
}: {
  label: string;
  tone?: "danger" | "neutral" | "success";
  value: string;
}) {
  const valueClassName =
    tone === "success"
      ? "text-emerald-200"
      : tone === "danger"
        ? "text-rose-200"
        : "text-zinc-200";

  return (
    <div className="flex min-w-0 items-center justify-between gap-3 rounded-md border border-white/5 bg-slate-950/70 px-3 py-2 text-sm">
      <span className="min-w-0 truncate text-zinc-400">{label}</span>
      <span className={`min-w-0 truncate text-right font-mono ${valueClassName}`}>
        {value}
      </span>
    </div>
  );
}
