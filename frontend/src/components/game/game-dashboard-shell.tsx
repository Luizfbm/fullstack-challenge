import {
  Activity,
  Clock3,
  Coins,
  History,
  Users,
  Wifi,
  WifiOff,
} from "lucide-react";
import { useAuth } from "../../hooks/use-auth";
import { useGameRealtime } from "../../hooks/use-game-realtime";
import {
  useCurrentRoundQuery,
  useMyBetsQuery,
  useRoundHistoryQuery,
  useWalletQuery,
} from "../../hooks/use-game-rest";
import { getApiErrorMessage } from "../../services/api-errors";
import type {
  BetResponse,
  RoundResponse,
  RoundStatus,
} from "../../services/game-api";
import type { RealtimeRoundPayload } from "../../services/realtime-events";
import { formatCents } from "../../services/money";
import { Badge } from "../ui/badge";
import { BetControlsPanel } from "./bet-controls-panel";
import { getRoundBets } from "./game-dashboard-view-model";

export function GameDashboardShell() {
  const { errorMessage, isAuthenticated, username } = useAuth();
  const currentRoundQuery = useCurrentRoundQuery();
  const historyQuery = useRoundHistoryQuery(8);
  const myBetsQuery = useMyBetsQuery(isAuthenticated, 5);
  const walletQuery = useWalletQuery(isAuthenticated);
  const realtime = useGameRealtime(currentRoundQuery.data ?? null);
  const currentRound = realtime.round ?? currentRoundQuery.data ?? null;
  const roundBets = getRoundBets(currentRound);
  const activeBet = findActiveBet(currentRound, myBetsQuery.data ?? []);
  const apiError = [
    currentRoundQuery.error,
    historyQuery.error,
    walletQuery.error,
    myBetsQuery.error,
  ].find(Boolean);

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_21rem]">
      <section className="rounded-md border border-zinc-800 bg-zinc-900/70 p-4">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-zinc-100">Rodada</h2>
            <p className="mt-1 text-xs text-zinc-500">
              {currentRound
                ? `#${currentRound.chainIndex} / nonce ${currentRound.nonce}`
                : currentRoundQuery.isLoading
                  ? "Carregando rodada"
                  : "Sem rodada ativa"}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={realtimeBadgeVariant(realtime.connectionStatus)}>
              {realtime.connectionStatus === "connected" ? (
                <Wifi className="size-3.5" aria-hidden="true" />
              ) : (
                <WifiOff className="size-3.5" aria-hidden="true" />
              )}
              {realtime.connectionStatus === "connected" ? "LIVE" : "REST"}
            </Badge>
            <Badge variant={roundBadgeVariant(currentRound?.status)}>
              <Clock3 className="size-3.5" aria-hidden="true" />
              {currentRound?.status ?? "SYNC"}
            </Badge>
          </div>
        </div>

        <div className="grid min-h-[22rem] place-items-center rounded-md border border-zinc-800 bg-zinc-950">
          <div className="text-center">
            <p className="text-6xl font-semibold tracking-normal text-zinc-50">
              {formatRoundMultiplier(currentRound)}
            </p>
            <p className="mt-3 font-mono text-xs text-zinc-500">
              serverSeedHash: {truncateHash(currentRound?.serverSeedHash)}
            </p>
            <p className="mt-1 font-mono text-xs text-zinc-600">
              next: {truncateHash(currentRound?.nextServerSeedHash)}
            </p>
          </div>
        </div>
      </section>

      <aside className="space-y-4">
        <section className="grid grid-cols-2 gap-3">
          <MetricCard
            icon={Coins}
            label="Saldo"
            value={
              isAuthenticated
                ? walletQuery.data
                  ? formatCents(walletQuery.data.balanceCents)
                  : walletQuery.isLoading
                    ? "..."
                    : "-"
                : "-"
            }
          />
          <MetricCard
            icon={Users}
            label="Jogador"
            value={isAuthenticated ? username ?? "-" : "-"}
          />
        </section>

        {errorMessage ? <AuthError message={errorMessage} /> : null}
        {apiError ? <AuthError message={getApiErrorMessage(apiError)} /> : null}

        <BetControlsPanel activeBet={activeBet} currentRound={currentRound} />

        <section className="rounded-md border border-zinc-800 bg-zinc-900/70 p-4">
          <div className="mb-4 flex items-center gap-2">
            <Activity className="size-4 text-sky-300" aria-hidden="true" />
            <h2 className="text-sm font-semibold text-zinc-100">Mesa</h2>
          </div>
          <div className="space-y-2">
            {roundBets.slice(0, 4).map((bet) => (
              <TableRow
                key={bet.id}
                label={bet.username}
                value={`${formatCents(bet.amountCents)} / ${bet.status}`}
              />
            ))}
            {roundBets.length ? null : <TableRow label="apostas" value="-" />}
          </div>
        </section>

        <section className="rounded-md border border-zinc-800 bg-zinc-900/70 p-4">
          <div className="mb-4 flex items-center gap-2">
            <History className="size-4 text-emerald-300" aria-hidden="true" />
            <h2 className="text-sm font-semibold text-zinc-100">Histórico</h2>
          </div>
          <div className="flex flex-wrap gap-2">
            {(historyQuery.data ?? []).map((round) => (
              <Badge key={round.id} variant={roundBadgeVariant(round.status)}>
                {formatRoundMultiplier(round)}
              </Badge>
            ))}
            {historyQuery.data?.length ? null : <Badge>-</Badge>}
          </div>
        </section>
      </aside>
    </div>
  );
}

function AuthError({ message }: { message: string }) {
  return (
    <div className="rounded-md border border-rose-400/30 bg-rose-400/10 p-3 text-sm text-rose-100">
      {message}
    </div>
  );
}

type MetricCardProps = {
  icon: typeof Coins;
  label: string;
  value: string;
};

function MetricCard({ icon: Icon, label, value }: MetricCardProps) {
  return (
    <section className="rounded-md border border-zinc-800 bg-zinc-900/70 p-4">
      <Icon className="mb-3 size-4 text-emerald-300" aria-hidden="true" />
      <p className="text-xs text-zinc-500">{label}</p>
      <p className="mt-1 text-lg font-semibold text-zinc-50">{value}</p>
    </section>
  );
}

type TableRowProps = {
  label: string;
  value: string;
};

function TableRow({ label, value }: TableRowProps) {
  return (
    <div className="flex items-center justify-between rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm">
      <span className="text-zinc-400">{label}</span>
      <span className="font-mono text-zinc-200">{value}</span>
    </div>
  );
}

function findActiveBet(
  currentRound: RoundResponse | null,
  bets: BetResponse[],
): BetResponse | null {
  if (!currentRound) {
    return null;
  }

  return (
    bets.find(
      (bet) =>
        bet.roundId === currentRound.id &&
        (bet.status === "ACCEPTED" ||
          bet.status === "CASHOUT_PENDING_CREDIT"),
    ) ?? null
  );
}

type DashboardRound = (RoundResponse | RealtimeRoundPayload) & {
  currentMultiplierBp?: number | null;
};

function formatRoundMultiplier(round: DashboardRound | null): string {
  if (!round) {
    return "1.00x";
  }

  if (typeof round.currentMultiplierBp === "number") {
    return `${(round.currentMultiplierBp / 10000).toFixed(2)}x`;
  }

  if (round.status === "CRASHED" || round.status === "SETTLED") {
    return round.crashPointBp
      ? `${(round.crashPointBp / 10000).toFixed(2)}x`
      : "CRASHED";
  }

  return round.status === "RUNNING" ? "RUNNING" : "1.00x";
}

function roundBadgeVariant(status?: RoundStatus) {
  if (status === "RUNNING") {
    return "success";
  }

  if (status === "CRASHED") {
    return "danger";
  }

  if (status === "SETTLED") {
    return "neutral";
  }

  return "warning";
}

function realtimeBadgeVariant(status: string) {
  return status === "connected" ? "success" : "neutral";
}

function truncateHash(value?: string | null): string {
  if (!value) {
    return "-";
  }

  return `${value.slice(0, 10)}...${value.slice(-8)}`;
}
