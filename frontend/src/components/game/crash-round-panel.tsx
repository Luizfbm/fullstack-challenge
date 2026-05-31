import { Clock3, Wifi, WifiOff } from "lucide-react";
import {
  getCrashCurveFormula,
  getCrashCurveHumanRate,
} from "../../services/crash-curve";
import { Badge } from "../ui/badge";
import {
  type DashboardRound,
  formatRoundMultiplier,
  roundBadgeVariant,
  truncateHash,
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
  return (
    <section className="rounded-md border border-zinc-800 bg-zinc-900/70 p-4">
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

      <div className="grid min-h-[22rem] place-items-center rounded-md border border-zinc-800 bg-zinc-950">
        <div className="text-center">
          <p className="text-6xl font-semibold tracking-normal text-zinc-50">
            {formatRoundMultiplier(round)}
          </p>
          <p className="mt-3 font-mono text-xs text-zinc-500">
            serverSeedHash: {truncateHash(round?.serverSeedHash)}
          </p>
          <p className="mt-1 font-mono text-xs text-zinc-600">
            next: {truncateHash(round?.nextServerSeedHash)}
          </p>
        </div>
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
      {label}: <span className="font-mono text-zinc-300">{value}</span>
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
