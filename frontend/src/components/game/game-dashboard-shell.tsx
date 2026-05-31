import { Activity, Coins, History, ShieldCheck, Users } from "lucide-react";
import { useAuth } from "../../hooks/use-auth";
import { useGameRealtime } from "../../hooks/use-game-realtime";
import {
  useCurrentRoundQuery,
  useMyBetsQuery,
  useRoundHistoryQuery,
  useWalletQuery,
} from "../../hooks/use-game-rest";
import { getApiErrorMessage } from "../../services/api-errors";
import type { BetResponse, RoundResponse } from "../../services/game-api";
import { formatCents } from "../../services/money";
import { Badge } from "../ui/badge";
import { BetControlsPanel } from "./bet-controls-panel";
import { ChronoStatsStrip } from "./chrono-stats-strip";
import { CrashRoundPanel } from "./crash-round-panel";
import { getRoundBets } from "./game-dashboard-view-model";
import {
  formatRoundMultiplier,
  roundHistoryVariant,
} from "./round-formatting";

export function GameDashboardShell() {
  const { errorMessage, isAuthenticated, username } = useAuth();
  const currentRoundQuery = useCurrentRoundQuery();
  const historyQuery = useRoundHistoryQuery(20);
  const myBetsQuery = useMyBetsQuery(isAuthenticated, 10);
  const walletQuery = useWalletQuery(isAuthenticated);
  const realtime = useGameRealtime(currentRoundQuery.data ?? null);
  const currentRound = realtime.round ?? currentRoundQuery.data ?? null;
  const roundBets = getRoundBets(currentRound);
  const activeBet = findActiveBet(currentRound, myBetsQuery.data ?? []);
  const balanceLabel =
    isAuthenticated && walletQuery.data
      ? formatCents(walletQuery.data.balanceCents)
      : isAuthenticated && walletQuery.isLoading
        ? "..."
        : null;
  const apiError = [
    currentRoundQuery.error,
    historyQuery.error,
    walletQuery.error,
    myBetsQuery.error,
  ].find(Boolean);

  return (
    <div className="min-w-0 space-y-4">
      <div className="grid min-w-0 gap-4 xl:grid-cols-[19rem_minmax(0,1fr)_22rem]">
        <aside className="order-3 min-w-0 space-y-4 xl:order-1">
          <section className="grid grid-cols-2 gap-3 xl:grid-cols-1">
            <MetricCard
              icon={Coins}
              label="Saldo"
              value={balanceLabel ?? "-"}
            />
            <MetricCard
              icon={Users}
              label="Jogador"
              value={isAuthenticated ? username ?? "-" : "-"}
            />
          </section>

          <RoundHistoryPanel
            history={historyQuery.data ?? []}
            isLoading={historyQuery.isLoading}
          />
        </aside>

        <main className="order-1 min-w-0 xl:order-2">
          <CrashRoundPanel
            connectionStatus={realtime.connectionStatus}
            isLoading={currentRoundQuery.isLoading}
            round={currentRound}
          />
        </main>

        <aside className="order-2 min-w-0 space-y-4 xl:order-3">
          {errorMessage ? <AuthError message={errorMessage} /> : null}
          {apiError ? <AuthError message={getApiErrorMessage(apiError)} /> : null}

          <BetControlsPanel activeBet={activeBet} currentRound={currentRound} />

          <BetsPanel
            bets={roundBets}
            isLoading={currentRoundQuery.isLoading}
          />
        </aside>
      </div>

      <ChronoStatsStrip
        balanceCents={balanceLabel}
        bets={roundBets}
        connectionStatus={realtime.connectionStatus}
        round={currentRound}
      />
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
    <section
      className="chrono-panel min-w-0 rounded-md border border-cyan-300/15 p-4"
      data-testid={`metric-${label.toLowerCase()}`}
    >
      <Icon className="mb-3 size-4 text-cyan-300" aria-hidden="true" />
      <p className="text-xs text-zinc-500">{label}</p>
      <p className="mt-1 text-lg font-semibold text-zinc-50">{value}</p>
    </section>
  );
}

function BetsPanel({
  bets,
  isLoading,
}: {
  bets: BetResponse[];
  isLoading: boolean;
}) {
  return (
    <section className="chrono-panel rounded-md border border-cyan-300/15 p-4">
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

function RoundHistoryPanel({
  history,
  isLoading,
}: {
  history: RoundResponse[];
  isLoading: boolean;
}) {
  return (
    <section className="chrono-panel rounded-md border border-amber-300/15 p-4">
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

type TableRowProps = {
  label: string;
  tone?: "danger" | "neutral" | "success";
  value: string;
};

function TableRow({ label, tone = "neutral", value }: TableRowProps) {
  const valueClassName =
    tone === "success"
      ? "text-emerald-200"
      : tone === "danger"
        ? "text-rose-200"
        : "text-zinc-200";

  return (
    <div className="flex min-w-0 items-center justify-between gap-3 rounded-md border border-white/5 bg-black/25 px-3 py-2 text-sm">
      <span className="min-w-0 truncate text-zinc-400">{label}</span>
      <span className={`min-w-0 truncate text-right font-mono ${valueClassName}`}>
        {value}
      </span>
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
