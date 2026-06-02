import { Clock3, ShieldCheck, Table2 } from "lucide-react";
import { cn } from "../../lib/utils";
import {
  getCrashCurveFormula,
  getCrashCurveHumanRate,
} from "../../services/crash-curve";
import type { BetResponse } from "../../services/game-api";
import { getRoundTimerLabel } from "../../services/round-timing";
import { BetsPanel } from "./arcade-tab-panels";
import {
  type DashboardRound,
  formatRoundMultiplier,
  roundBadgeVariant,
  truncateHash,
} from "./round-formatting";

export type ArcadeTab = "proof" | "state" | "table";

export function ArcadeTechnicalTabs({
  activeTab,
  bets,
  now,
  onTabChange,
  round,
  roundIsLoading,
}: {
  activeTab: ArcadeTab;
  bets: BetResponse[];
  now: Date;
  onTabChange: (tab: ArcadeTab) => void;
  round: DashboardRound | null;
  roundIsLoading: boolean;
}) {
  const tabs: Array<{
    icon: typeof ShieldCheck;
    id: ArcadeTab;
    label: string;
  }> = [
    { icon: ShieldCheck, id: "proof", label: "Provably Fair" },
    { icon: Clock3, id: "state", label: "Round State" },
    { icon: Table2, id: "table", label: "Mesa" },
  ];

  return (
    <section className="casino-tabs rounded-xl border border-white/10 p-3">
      <div
        aria-label="Evidências técnicas"
        className="grid grid-cols-1 gap-2 sm:grid-cols-3"
        role="tablist"
      >
        {tabs.map((tab) => (
          <button
            aria-selected={activeTab === tab.id}
            className={cn(
              "flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-md border px-3 text-sm font-semibold transition-colors duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-200",
              activeTab === tab.id
                ? "border-rose-300/50 bg-rose-400/15 text-rose-100 shadow-[0_0_24px_rgba(244,63,94,0.2)]"
                : "border-white/10 bg-black/25 text-zinc-400 hover:border-rose-300/30 hover:text-zinc-100",
            )}
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            role="tab"
            type="button"
          >
            <tab.icon className="size-4" aria-hidden="true" />
            {tab.label}
          </button>
        ))}
      </div>

      <div className="mt-3 rounded-lg border border-white/10 bg-black/30 p-3">
        {activeTab === "proof" ? <ProofPanel round={round} /> : null}
        {activeTab === "state" ? (
          <StatePanel isLoading={roundIsLoading} now={now} round={round} />
        ) : null}
        {activeTab === "table" ? (
          <BetsPanel bets={bets} isLoading={roundIsLoading} />
        ) : null}
      </div>
    </section>
  );
}

function ProofPanel({ round }: { round: DashboardRound | null }) {
  const revealed = Boolean(round?.serverSeed);

  return (
    <div className="grid gap-3 lg:grid-cols-2">
      <EvidenceLine
        label="serverSeedHash"
        value={truncateHash(round?.serverSeedHash)}
      />
      <EvidenceLine
        label="nextServerSeedHash"
        value={truncateHash(round?.nextServerSeedHash)}
      />
      <EvidenceLine
        label="serverSeed"
        tone={revealed ? "success" : "neutral"}
        value={round?.serverSeed ? truncateHash(round.serverSeed) : "oculto"}
      />
      <EvidenceLine
        label="crashPoint"
        tone={round?.crashPointBp ? "success" : "neutral"}
        value={round?.crashPointBp ? formatRoundMultiplier(round) : "oculto"}
      />
    </div>
  );
}

function StatePanel({
  isLoading,
  now,
  round,
}: {
  isLoading: boolean;
  now: Date;
  round: DashboardRound | null;
}) {
  const statusTone = roundBadgeVariant(round?.status) === "danger"
    ? "danger"
    : "success";

  return (
    <div className="grid gap-3 lg:grid-cols-2">
      <EvidenceLine
        label="status"
        tone={statusTone}
        value={round?.status ?? (isLoading ? "SYNC" : "-")}
      />
      <EvidenceLine label="timer" value={getRoundTimerLabel(round, now)} />
      <EvidenceLine
        label="round"
        value={round ? `chain #${round.chainIndex} / nonce ${round.nonce}` : "-"}
      />
      <EvidenceLine
        label="curve"
        value={
          round
            ? getCrashCurveFormula(
                round.multiplierBaseBp,
                round.multiplierGrowthRateBpPerSecond,
              )
            : "aguardando rodada"
        }
      />
      <EvidenceLine
        label="rate"
        value={
          round
            ? getCrashCurveHumanRate(round.multiplierGrowthRateBpPerSecond)
            : "aguardando rodada"
        }
      />
    </div>
  );
}

function EvidenceLine({
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
      ? "text-emerald-100"
      : tone === "danger"
        ? "text-rose-100"
        : "text-zinc-100";

  return (
    <div className="min-w-0 rounded-md border border-white/5 bg-slate-950/65 px-3 py-2">
      <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">{label}</p>
      <p className={cn("mt-1 break-words font-mono text-sm", valueClassName)}>
        {value}
      </p>
    </div>
  );
}
