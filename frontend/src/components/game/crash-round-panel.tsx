import { CrashCurveChart } from "./crash-curve-chart";
import type { DashboardRound } from "./round-formatting";

type CrashRoundPanelProps = {
  connectionStatus: string;
  isLoading: boolean;
  now: Date;
  round: DashboardRound | null;
};

export function CrashRoundPanel({
  connectionStatus,
  isLoading,
  now,
  round,
}: CrashRoundPanelProps) {
  return (
    <section
      aria-label="Arcade arena"
      className="casino-stage-shell min-w-0 rounded-2xl border border-amber-200/25 p-3 sm:p-4"
    >
      <CrashCurveChart isLoading={isLoading} now={now} round={round} />
      <p className="sr-only">
        {connectionStatus} {isLoading ? "loading" : round?.status ?? "sync"}
      </p>
    </section>
  );
}
