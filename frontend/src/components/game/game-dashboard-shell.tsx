import { useState } from "react";
import { Activity, Coins, RadioTower, Users } from "lucide-react";
import { useAuth } from "../../hooks/use-auth";
import { useGameRealtime } from "../../hooks/use-game-realtime";
import {
  useCurrentRoundQuery,
  useLeaderboardQuery,
  useMyAutoBetSessionQuery,
  useMyBetsQuery,
  useRoundHistoryQuery,
  useWalletQuery,
} from "../../hooks/use-game-rest";
import { useNow } from "../../hooks/use-now";
import { cn } from "../../lib/utils";
import { getApiErrorMessage } from "../../services/api-errors";
import type { BetResponse, RoundResponse } from "../../services/game-api";
import { formatCents } from "../../services/money";
import {
  ArcadeTechnicalTabs,
  type ArcadeTab,
} from "./arcade-technical-tabs";
import { RoundHistoryPanel } from "./arcade-tab-panels";
import { BetControlsPanel } from "./bet-controls-panel";
import { CrashRoundPanel } from "./crash-round-panel";
import { getRoundBets } from "./game-dashboard-view-model";
import { LeaderboardPanel } from "./leaderboard-panel";
import type { LeaderboardPeriod } from "../../services/game-api";

export function GameDashboardShell() {
  const { errorMessage, isAuthenticated, username } = useAuth();
  const [activeTab, setActiveTab] = useState<ArcadeTab>("proof");
  const [leaderboardPeriod, setLeaderboardPeriod] =
    useState<LeaderboardPeriod>("24h");
  const [leaderboardOpen, setLeaderboardOpen] = useState(false);
  const now = useNow(100);
  const currentRoundQuery = useCurrentRoundQuery();
  const historyQuery = useRoundHistoryQuery(20);
  const leaderboardQuery = useLeaderboardQuery(leaderboardPeriod, 10);
  const autoBetSessionQuery = useMyAutoBetSessionQuery(isAuthenticated);
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
    autoBetSessionQuery.error,
  ].find(Boolean);

  return (
    <div className="arcade-dashboard min-w-0 pb-36 lg:pb-0">
      <div className="grid min-w-0 gap-4 xl:grid-cols-[18rem_minmax(0,1fr)]">
        <div className="order-1 min-w-0 space-y-4 xl:order-2">
          <LeaderboardPanel
            className="block md:hidden"
            currentPlayerUsername={username}
            entries={leaderboardQuery.data ?? []}
            errorMessage={
              leaderboardQuery.error
                ? getApiErrorMessage(leaderboardQuery.error)
                : null
            }
            isLoading={leaderboardQuery.isLoading}
            onPeriodChange={setLeaderboardPeriod}
            period={leaderboardPeriod}
          />

          <section className="grid min-w-0 grid-cols-2 gap-3 md:grid-cols-4">
            <MetricCard
              icon={RadioTower}
              label="Realtime"
              tone="green"
              value={
                realtime.connectionStatus === "connected" ? "LIVE" : "REST"
              }
            />
            <MetricCard icon={Coins} label="Saldo" value={balanceLabel ?? "-"} />
            <MetricCard
              icon={Users}
              label="Jogador"
              value={isAuthenticated ? username ?? "-" : "-"}
            />
            <MetricCard
              icon={Activity}
              label="Rodada"
              tone="rose"
              value={
                currentRound
                  ? `#${currentRound.chainIndex} ${currentRound.status}`
                  : "SYNC"
              }
            />
          </section>

          <LeaderboardPanel
            className="hidden md:block xl:hidden"
            currentPlayerUsername={username}
            entries={leaderboardQuery.data ?? []}
            errorMessage={
              leaderboardQuery.error
                ? getApiErrorMessage(leaderboardQuery.error)
                : null
            }
            isCollapsed={!leaderboardOpen}
            isLoading={leaderboardQuery.isLoading}
            onPeriodChange={setLeaderboardPeriod}
            onToggleCollapse={() => setLeaderboardOpen((open) => !open)}
            period={leaderboardPeriod}
          />

          {errorMessage ? <AuthError message={errorMessage} /> : null}
          {apiError ? <AuthError message={getApiErrorMessage(apiError)} /> : null}

          <main className="min-w-0 space-y-3">
            <RoundHistoryPanel
              history={historyQuery.data ?? []}
              isLoading={historyQuery.isLoading}
            />

            <CrashRoundPanel
              connectionStatus={realtime.connectionStatus}
              isLoading={currentRoundQuery.isLoading}
              now={now}
              round={currentRound}
            />

            <BetControlsPanel
              activeBet={activeBet}
              autoBetSession={autoBetSessionQuery.data ?? null}
              className="sticky bottom-3 z-30 mx-2 mt-3 shadow-[0_0_60px_rgba(244,63,94,0.28)] lg:static lg:mx-auto lg:-mt-10 lg:max-w-5xl"
              currentRound={currentRound}
              now={now}
            />
          </main>

          <ArcadeTechnicalTabs
            activeTab={activeTab}
            bets={roundBets}
            now={now}
            onTabChange={setActiveTab}
            round={currentRound}
            roundIsLoading={currentRoundQuery.isLoading}
          />
        </div>

        <LeaderboardPanel
          className="order-2 hidden self-start xl:sticky xl:top-4 xl:order-1 xl:block"
          currentPlayerUsername={username}
          entries={leaderboardQuery.data ?? []}
          errorMessage={
            leaderboardQuery.error
              ? getApiErrorMessage(leaderboardQuery.error)
              : null
          }
          isLoading={leaderboardQuery.isLoading}
          onPeriodChange={setLeaderboardPeriod}
          period={leaderboardPeriod}
        />
      </div>
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
  tone?: "cyan" | "green" | "rose";
  value: string;
};

function MetricCard({ icon: Icon, label, tone = "cyan", value }: MetricCardProps) {
  const toneClassName =
    tone === "green"
      ? "text-emerald-200"
      : tone === "rose"
        ? "text-rose-200"
        : "text-cyan-200";

  return (
    <section
      className="casino-mini-panel min-w-0 rounded-md border border-white/10 p-3"
      data-testid={`metric-${label.toLowerCase()}`}
    >
      <Icon className={cn("mb-2 size-4", toneClassName)} aria-hidden="true" />
      <p className="text-xs text-zinc-500">{label}</p>
      <p className="mt-1 text-lg font-semibold text-zinc-50">{value}</p>
    </section>
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
