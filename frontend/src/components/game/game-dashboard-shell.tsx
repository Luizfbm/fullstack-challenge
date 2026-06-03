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

  return (
    <div className="arcade-dashboard min-w-0 pb-36 lg:pb-0">
      <div className="grid min-w-0 gap-4 xl:grid-cols-[18rem_minmax(0,1fr)] xl:gap-y-3">
        <div className="order-1 min-w-0 space-y-4 xl:order-2">
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
          </main>
        </div>

        <aside
          aria-label="Desktop cashier and leaderboard"
          className="order-2 min-w-0 space-y-4 xl:sticky xl:top-4 xl:order-1 xl:row-span-2 xl:self-start"
        >
          <BetControlsPanel
            activeBet={activeBet}
            autoBetSession={autoBetSessionQuery.data ?? null}
            className="sticky bottom-3 z-30 mx-2 mt-3 shadow-[0_0_60px_rgba(244,63,94,0.28)] lg:static lg:mx-auto lg:-mt-10 lg:max-w-5xl xl:mx-0 xl:mt-0 xl:max-w-none"
            currentRound={currentRound}
            now={now}
          />
          <LeaderboardPanel
            className="hidden xl:block"
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
        </aside>

        <div
          className="order-3 min-w-0 md:hidden"
          data-testid="mobile-leaderboard-slot"
        >
          <LeaderboardPanel
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

        <div
          className="order-4 min-w-0 xl:col-start-2 xl:row-start-2"
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
