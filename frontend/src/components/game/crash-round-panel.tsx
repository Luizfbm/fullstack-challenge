import { Clock3, Wifi, WifiOff } from "lucide-react";
import { useNow } from "../../hooks/use-now";
import {
  getCrashCurveFormula,
  getCrashCurveHumanRate,
} from "../../services/crash-curve";
import { getRoundTimerLabel } from "../../services/round-timing";
import { Badge } from "../ui/badge";
import { CrashCurveChart } from "./crash-curve-chart";
import {
  type DashboardRound,
  roundBadgeVariant,
} from "./round-formatting";

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
    <section className="min-w-0 rounded-md border border-zinc-800 bg-zinc-900/70 p-4">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-zinc-100">Rodada</h2>
          <p className="mt-1 text-xs text-zinc-500">
            {formatRoundIdentity(round, isLoading)}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={connectionStatus === "connected" ? "success" : "neutral"}>
            {connectionStatus === "connected" ? (
              <Wifi className="size-3.5" aria-hidden="true" />
            ) : (
              <WifiOff className="size-3.5" aria-hidden="true" />
            )}
            {connectionStatus === "connected" ? "LIVE" : "REST"}
          </Badge>
          <Badge variant={roundBadgeVariant(round?.status)}>
            <Clock3 className="size-3.5" aria-hidden="true" />
            {round?.status ?? "SYNC"}
          </Badge>
        </div>
      </div>

      <CrashCurveChart isLoading={isLoading} now={now} round={round} />

      <div className="mt-4 rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-300">
        {getRoundTimerLabel(round, now)}
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
    <p>
      {label}:{" "}
      <span className="break-words font-mono text-zinc-300">{value}</span>
    </p>
  );
}

function formatRoundIdentity(round: DashboardRound | null, isLoading: boolean) {
  if (round) {
    return `#${round.chainIndex} / nonce ${round.nonce}`;
  }

  return isLoading ? "Carregando rodada" : "Sem rodada ativa";
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
