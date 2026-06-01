import { Clock3, Hash, RadioTower } from "lucide-react";
import { getRoundTimerLabel } from "../../services/round-timing";
import { Badge } from "../ui/badge";
import type { DashboardRound } from "./round-formatting";
import { roundBadgeVariant, truncateHash } from "./round-formatting";

type ChronoTelemetryProps = {
  connectionStatus: string;
  isLoading: boolean;
  now: Date;
  round: DashboardRound | null;
};

export function ChronoTelemetry({
  connectionStatus,
  isLoading,
  now,
  round,
}: ChronoTelemetryProps) {
  return (
    <div className="grid gap-3 md:grid-cols-[1.2fr_1fr]">
      <div className="chrono-panel rounded-md border border-cyan-300/15 p-3">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <Badge variant={connectionStatus === "connected" ? "success" : "neutral"}>
            <RadioTower className="size-3.5" aria-hidden="true" />
            {connectionStatus === "connected" ? "LIVE" : "REST"}
          </Badge>
          <Badge variant={roundBadgeVariant(round?.status)}>
            <Clock3 className="size-3.5" aria-hidden="true" />
            {round?.status ?? "SYNC"}
          </Badge>
        </div>
        <p className="font-mono text-sm text-cyan-100">
          {getRoundTimerLabel(round, now)}
        </p>
        <p className="mt-1 text-xs text-zinc-500">
          {formatRoundIdentity(round, isLoading)}
        </p>
      </div>

      <div className="chrono-panel min-w-0 rounded-md border border-amber-300/15 p-3">
        <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.22em] text-amber-200">
          <Hash className="size-3.5" aria-hidden="true" />
          Commit reveal
        </div>
        <p className="break-all font-mono text-xs text-zinc-300">
          serverSeedHash: {truncateHash(round?.serverSeedHash)}
        </p>
        <p className="mt-1 break-all font-mono text-xs text-zinc-500">
          next: {truncateHash(round?.nextServerSeedHash)}
        </p>
      </div>
    </div>
  );
}

function formatRoundIdentity(round: DashboardRound | null, isLoading: boolean) {
  if (round) {
    return `chain #${round.chainIndex} / nonce ${round.nonce}`;
  }

  return isLoading ? "Carregando rodada" : "Sem rodada ativa";
}
