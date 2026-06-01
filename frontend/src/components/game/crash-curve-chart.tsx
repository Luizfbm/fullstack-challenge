import { ChronoStage } from "./chrono-stage";
import type { DashboardRound } from "./round-formatting";

type CrashCurveChartProps = {
  isLoading: boolean;
  now: Date;
  round: DashboardRound | null;
};

export function CrashCurveChart({
  isLoading,
  now,
  round,
}: CrashCurveChartProps) {
  return <ChronoStage isLoading={isLoading} now={now} round={round} />;
}
