import { ChevronDown, ChevronUp, Medal, Trophy } from "lucide-react";
import { cn } from "../../lib/utils";
import type {
  LeaderboardEntry,
  LeaderboardPeriod,
} from "../../services/game-api";
import { formatCents } from "../../services/money";
import { Button } from "../ui/button";

type LeaderboardPanelProps = {
  className?: string;
  currentPlayerUsername: string | null;
  entries: LeaderboardEntry[];
  errorMessage?: string | null;
  isCollapsed?: boolean;
  isLoading: boolean;
  onPeriodChange: (period: LeaderboardPeriod) => void;
  onToggleCollapse?: () => void;
  period: LeaderboardPeriod;
};

export function LeaderboardPanel({
  className,
  currentPlayerUsername,
  entries,
  errorMessage,
  isCollapsed = false,
  isLoading,
  onPeriodChange,
  onToggleCollapse,
  period,
}: LeaderboardPanelProps) {
  return (
    <section
      className={cn(
        "casino-mini-panel min-w-0 rounded-lg border border-amber-200/20 bg-black/45 p-3 shadow-[0_0_50px_rgba(251,191,36,0.12)]",
        className,
      )}
    >
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-amber-200">
            Net profit
          </p>
          <h2 className="mt-1 flex items-center gap-2 text-lg font-black text-zinc-50">
            <Trophy className="size-4 text-amber-200" aria-hidden="true" />
            Leaderboard
          </h2>
        </div>
        {onToggleCollapse ? (
          <Button
            aria-label={isCollapsed ? "Abrir leaderboard" : "Fechar leaderboard"}
            className="hidden md:inline-flex xl:hidden"
            onClick={onToggleCollapse}
            size="icon"
            type="button"
            variant="ghost"
          >
            {isCollapsed ? (
              <ChevronDown className="size-4" aria-hidden="true" />
            ) : (
              <ChevronUp className="size-4" aria-hidden="true" />
            )}
          </Button>
        ) : null}
      </div>

      {isCollapsed ? null : (
        <>
          <div className="mb-3 grid grid-cols-2 gap-2">
            <PeriodButton
              active={period === "24h"}
              label="24h"
              onClick={() => onPeriodChange("24h")}
            />
            <PeriodButton
              active={period === "7d"}
              label="7d"
              onClick={() => onPeriodChange("7d")}
            />
          </div>

          {errorMessage ? (
            <p className="rounded-md border border-rose-400/30 bg-rose-400/10 p-3 text-sm text-rose-100">
              {errorMessage}
            </p>
          ) : isLoading ? (
            <p className="rounded-md border border-white/10 bg-white/[0.03] p-3 text-sm text-zinc-400">
              Carregando ranking...
            </p>
          ) : entries.length === 0 ? (
            <p className="rounded-md border border-white/10 bg-white/[0.03] p-3 text-sm text-zinc-400">
              Nenhum resultado fechado neste periodo.
            </p>
          ) : (
            <ol className="space-y-2">
              {entries.map((entry) => (
                <LeaderboardRow
                  currentPlayerUsername={currentPlayerUsername}
                  entry={entry}
                  key={`${entry.rank}-${entry.playerId}`}
                />
              ))}
            </ol>
          )}
        </>
      )}
    </section>
  );
}

function PeriodButton({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: LeaderboardPeriod;
  onClick: () => void;
}) {
  return (
    <button
      className={cn(
        "h-9 rounded-md border text-sm font-semibold transition",
        active
          ? "border-amber-200/60 bg-amber-200/15 text-amber-100"
          : "border-white/10 bg-white/[0.03] text-zinc-400 hover:border-amber-200/30 hover:text-zinc-100",
      )}
      onClick={onClick}
      type="button"
    >
      {label}
    </button>
  );
}

function LeaderboardRow({
  currentPlayerUsername,
  entry,
}: {
  currentPlayerUsername: string | null;
  entry: LeaderboardEntry;
}) {
  const isCurrentPlayer = currentPlayerUsername === entry.username;
  const topThree = entry.rank <= 3;

  return (
    <li
      className={cn(
        "rounded-md border bg-black/35 p-3",
        topThree ? "border-amber-200/30" : "border-white/10",
        isCurrentPlayer && "bg-emerald-300/10 ring-1 ring-emerald-300/30",
      )}
    >
      <div className="flex items-start gap-3">
        <span
          className={cn(
            "flex size-8 shrink-0 items-center justify-center rounded-md border font-mono text-sm font-black",
            topThree
              ? "border-amber-200/40 bg-amber-200/15 text-amber-100"
              : "border-white/10 bg-white/[0.03] text-zinc-300",
          )}
        >
          {topThree ? <Medal className="size-4" aria-hidden="true" /> : entry.rank}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <p className="truncate text-sm font-bold text-zinc-50">
              {entry.username}
            </p>
            <p
              className={cn(
                "shrink-0 font-mono text-sm font-bold",
                BigInt(entry.profitCents) >= 0n
                  ? "text-emerald-200"
                  : "text-rose-200",
              )}
            >
              {formatCents(entry.profitCents)}
            </p>
          </div>
          <p className="mt-1 text-xs text-zinc-500">
            {entry.betsCount} apostas · {formatCents(entry.wageredCents)} em
            volume
          </p>
        </div>
      </div>
    </li>
  );
}
