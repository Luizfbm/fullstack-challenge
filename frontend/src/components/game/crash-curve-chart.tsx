import { buildCrashCurvePolyline } from "../../services/crash-curve";
import { getRoundProgress } from "../../services/round-timing";
import {
  type DashboardRound,
  formatRoundMultiplier,
  truncateHash,
} from "./round-formatting";

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
  const progress = getRoundProgress(round, now);
  const points = buildCrashCurvePolyline(progress);
  const crashed = round?.status === "CRASHED" || round?.status === "SETTLED";

  return (
    <div
      aria-busy={isLoading}
      className="relative grid min-h-[22rem] min-w-0 overflow-hidden rounded-md border border-zinc-800 bg-zinc-950"
    >
      <div className="absolute inset-0 bg-[linear-gradient(rgba(63,63,70,0.18)_1px,transparent_1px),linear-gradient(90deg,rgba(63,63,70,0.18)_1px,transparent_1px)] bg-[size:2rem_2rem]" />
      <svg
        aria-hidden="true"
        className="absolute inset-0 size-full"
        preserveAspectRatio="none"
        viewBox="0 0 100 100"
      >
        <polyline
          fill="none"
          points={points}
          stroke={crashed ? "#fb7185" : "#34d399"}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2.5"
        />
        {crashed ? (
          <line
            stroke="#fb7185"
            strokeDasharray="3 4"
            strokeWidth="1.5"
            x1="88"
            x2="88"
            y1="18"
            y2="90"
          />
        ) : null}
      </svg>

      <div className="relative z-10 grid place-items-center p-6 text-center">
        <div>
          <p className="text-6xl font-semibold tracking-normal text-zinc-50">
            {isLoading ? "..." : formatRoundMultiplier(round)}
          </p>
          <p className="mt-3 break-all font-mono text-xs text-zinc-500">
            serverSeedHash: {truncateHash(round?.serverSeedHash)}
          </p>
          <p className="mt-1 break-all font-mono text-xs text-zinc-600">
            next: {truncateHash(round?.nextServerSeedHash)}
          </p>
        </div>
      </div>
    </div>
  );
}
