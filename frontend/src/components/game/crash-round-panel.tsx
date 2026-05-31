import { useNow } from "../../hooks/use-now";
import {
  getCrashCurveFormula,
  getCrashCurveHumanRate,
} from "../../services/crash-curve";
import { ChronoTelemetry } from "./chrono-telemetry";
import { CrashCurveChart } from "./crash-curve-chart";
import type { DashboardRound } from "./round-formatting";

type CrashRoundPanelProps = {
  connectionStatus: string;
  isLoading: boolean;
  round: DashboardRound | null;
};

export function CrashRoundPanel({
  connectionStatus,
  isLoading,
  round,
}: CrashRoundPanelProps) {
  const now = useNow();

  return (
    <section className="chrono-panel min-w-0 rounded-md border border-cyan-300/15 p-4">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-cyan-200">
            Chrono cockpit
          </p>
          <h2 className="mt-1 text-xl font-black text-zinc-50">Crash Game</h2>
          <p className="mt-1 max-w-xl text-sm text-zinc-400">
            Acelere a linha do tempo, aposte antes da partida e extraia o
            payout antes da ruptura.
          </p>
        </div>
        <div className="rounded-md border border-amber-300/20 bg-amber-300/10 px-3 py-2 text-right">
          <p className="text-xs uppercase tracking-[0.22em] text-amber-200">
            Flux rate
          </p>
          <p className="font-mono text-sm font-semibold text-zinc-50">
            {formatCurveRate(round)}
          </p>
        </div>
      </div>

      <CrashCurveChart isLoading={isLoading} now={now} round={round} />

      <div className="mt-4">
        <ChronoTelemetry
          connectionStatus={connectionStatus}
          isLoading={isLoading}
          now={now}
          round={round}
        />
      </div>

      <div className="mt-4 grid gap-2 text-xs text-zinc-500 md:grid-cols-2">
        <CurveLine label="Curva" value={formatCurveFormula(round)} />
        <CurveLine label="Ritmo" value={formatCurveRate(round)} />
      </div>
    </section>
  );
}

function CurveLine({ label, value }: { label: string; value: string }) {
  return (
    <p className="rounded-md border border-white/5 bg-black/20 px-3 py-2">
      {label}:{" "}
      <span className="break-words font-mono text-cyan-100">{value}</span>
    </p>
  );
}

function formatCurveFormula(round: DashboardRound | null): string {
  return round
    ? getCrashCurveFormula(round.multiplierGrowthBpPerSecond)
    : "aguardando rodada";
}

function formatCurveRate(round: DashboardRound | null): string {
  return round
    ? getCrashCurveHumanRate(round.multiplierGrowthBpPerSecond)
    : "aguardando rodada";
}
