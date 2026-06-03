import { useState } from "react";
import { useAuth } from "../../hooks/use-auth";
import { useGameRealtime } from "../../hooks/use-game-realtime";
import {
  useCurrentRoundQuery,
  useLeaderboardQuery,
  useMyAutoBetSessionQuery,
  useMyBetsQuery,
  useRoundHistoryQuery,
} from "../../hooks/use-game-rest";
import { useNow } from "../../hooks/use-now";
import { getApiErrorMessage } from "../../services/api-errors";
import type { BetResponse, RoundResponse } from "../../services/game-api";
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
  const realtime = useGameRealtime(currentRoundQuery.data ?? null);
  const currentRound = realtime.round ?? currentRoundQuery.data ?? null;
  const roundBets = getRoundBets(currentRound);
  const activeBet = findActiveBet(currentRound, myBetsQuery.data ?? []);
  const apiError = [
    currentRoundQuery.error,
    historyQuery.error,
    myBetsQuery.error,
    autoBetSessionQuery.error,
  ].find(Boolean);
  const renderLeaderboard = ({
    className,
    collapsible = false,
  }: {
    className?: string;
    collapsible?: boolean;
  } = {}) => (
    <LeaderboardPanel
      className={className}
      currentPlayerUsername={username}
      entries={leaderboardQuery.data ?? []}
      errorMessage={
        leaderboardQuery.error
          ? getApiErrorMessage(leaderboardQuery.error)
          : null
      }
      isCollapsed={collapsible ? !leaderboardOpen : false}
      isLoading={leaderboardQuery.isLoading}
      onPeriodChange={setLeaderboardPeriod}
      onToggleCollapse={
        collapsible ? () => setLeaderboardOpen((open) => !open) : undefined
      }
      period={leaderboardPeriod}
    />
  );

  return (
    <div className="arcade-dashboard min-w-0 pb-36 lg:pb-0">
      <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,22rem)] lg:items-start xl:grid-cols-[minmax(0,1fr)_20rem] xl:gap-y-3">
        <div className="order-1 min-w-0 space-y-4">
          {renderLeaderboard({
            className: "hidden md:block lg:hidden",
            collapsible: true,
          })}

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
          </main>
        </div>

        <aside
          aria-label="Desktop cashier and leaderboard"
          className="order-2 min-w-0 space-y-4 lg:sticky lg:top-4 lg:row-span-2 lg:self-start"
        >
          <BetControlsPanel
            activeBet={activeBet}
            autoBetSession={autoBetSessionQuery.data ?? null}
            className="sticky bottom-3 z-30 mx-2 mt-3 shadow-[0_0_54px_rgba(250,204,21,0.16)] lg:static lg:mx-0 lg:mt-0"
            currentRound={currentRound}
            now={now}
          />
          {renderLeaderboard({ className: "hidden lg:block" })}
        </aside>

        <div
          className="order-3 min-w-0 md:hidden"
          data-testid="mobile-leaderboard-slot"
        >
          {renderLeaderboard()}
        </div>

        <div
          className="order-4 min-w-0 lg:col-start-1 lg:row-start-2"
          data-testid="stage-technical-tabs-slot"
        >
          <ArcadeTechnicalTabs
            activeTab={activeTab}
            bets={roundBets}
            now={now}
            onTabChange={setActiveTab}
            round={currentRound}
            roundIsLoading={currentRoundQuery.isLoading}
          />
        </div>
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
