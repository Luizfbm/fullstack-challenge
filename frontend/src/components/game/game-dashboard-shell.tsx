import { useState } from "react";
import { Activity, Coins, RadioTower, Users } from "lucide-react";
import { useAuth } from "../../hooks/use-auth";
import { useGameRealtime } from "../../hooks/use-game-realtime";
import {
  useCurrentRoundQuery,
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
import { BetControlsPanel } from "./bet-controls-panel";
import { CrashRoundPanel } from "./crash-round-panel";
import { getRoundBets } from "./game-dashboard-view-model";

export function GameDashboardShell() {
  const { errorMessage, isAuthenticated, username } = useAuth();
  const [activeTab, setActiveTab] = useState<ArcadeTab>("proof");
  const now = useNow();
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
    <div className="arcade-dashboard min-w-0 space-y-4 pb-36 lg:pb-0">
      <section className="grid min-w-0 grid-cols-2 gap-3 md:grid-cols-4">
        <MetricCard
          icon={RadioTower}
          label="Realtime"
          tone="green"
          value={realtime.connectionStatus === "connected" ? "LIVE" : "REST"}
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
          value={currentRound ? `#${currentRound.chainIndex} ${currentRound.status}` : "SYNC"}
        />
      </section>

      {errorMessage ? <AuthError message={errorMessage} /> : null}
      {apiError ? <AuthError message={getApiErrorMessage(apiError)} /> : null}

      <main className="min-w-0">
        <CrashRoundPanel
          connectionStatus={realtime.connectionStatus}
          isLoading={currentRoundQuery.isLoading}
          round={currentRound}
        />

        <BetControlsPanel
          activeBet={activeBet}
          className="sticky bottom-3 z-30 mx-2 mt-3 shadow-[0_0_60px_rgba(244,63,94,0.28)] lg:static lg:mx-auto lg:-mt-10 lg:max-w-5xl"
          currentRound={currentRound}
        />
      </main>

      <ArcadeTechnicalTabs
        activeTab={activeTab}
        bets={roundBets}
        history={historyQuery.data ?? []}
        historyIsLoading={historyQuery.isLoading}
        now={now}
        onTabChange={setActiveTab}
        round={currentRound}
        roundIsLoading={currentRoundQuery.isLoading}
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
