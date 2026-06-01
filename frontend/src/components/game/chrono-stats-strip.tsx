import { Activity, CircleDollarSign, RadioTower, ShieldCheck } from "lucide-react";
import { formatCents } from "../../services/money";
import type { BetResponse } from "../../services/game-api";
import type { DashboardRound } from "./round-formatting";

type ChronoStatsStripProps = {
  balanceCents: string | null;
  bets: BetResponse[];
  connectionStatus: string;
  round: DashboardRound | null;
};

export function ChronoStatsStrip({
  balanceCents,
  bets,
  connectionStatus,
  round,
}: ChronoStatsStripProps) {
  const visibleVolume = bets.reduce(
    (total, bet) => total + BigInt(bet.amountCents),
    0n,
  );

  return (
    <section className="chrono-panel grid gap-3 rounded-md border border-white/10 p-3 sm:grid-cols-2 xl:grid-cols-4">
      <StatItem
        icon={RadioTower}
        label="Realtime"
        tone="cyan"
        value={connectionStatus === "connected" ? "LIVE" : "REST"}
      />
      <StatItem
        icon={Activity}
        label="Rodada"
        tone="amber"
        value={round ? `#${round.chainIndex} ${round.status}` : "SYNC"}
      />
      <StatItem
        icon={CircleDollarSign}
        label="Volume visivel"
        tone="green"
        value={formatCents(visibleVolume)}
      />
      <StatItem
        icon={ShieldCheck}
        label="Saldo"
        tone="cyan"
        value={balanceCents ?? "-"}
      />
    </section>
  );
}

type StatItemProps = {
  icon: typeof Activity;
  label: string;
  tone: "amber" | "cyan" | "green";
  value: string;
};

function StatItem({ icon: Icon, label, tone, value }: StatItemProps) {
  const toneClassName =
    tone === "amber"
      ? "border-amber-300/20 bg-amber-300/10 text-amber-100"
      : tone === "green"
        ? "border-emerald-300/20 bg-emerald-300/10 text-emerald-100"
        : "border-cyan-300/20 bg-cyan-300/10 text-cyan-100";

  return (
    <div className="min-w-0 rounded-md border border-white/5 bg-black/20 p-3">
      <div className="flex items-center gap-2">
        <span className={`grid size-8 place-items-center rounded-md border ${toneClassName}`}>
          <Icon className="size-4" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <p className="text-xs text-zinc-500">{label}</p>
          <p className="truncate font-mono text-sm font-semibold text-zinc-100">
            {value}
          </p>
        </div>
      </div>
    </div>
  );
}
