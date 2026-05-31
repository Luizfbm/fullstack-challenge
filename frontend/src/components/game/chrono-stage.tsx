import { Zap } from "lucide-react";
import { buildCrashCurvePolyline } from "../../services/crash-curve";
import { getRoundProgress } from "../../services/round-timing";
import { cn } from "../../lib/utils";
import { ChronoVehicle } from "./chrono-vehicle";
import {
  type DashboardRound,
  formatRoundMultiplier,
  truncateHash,
} from "./round-formatting";

type ChronoStageProps = {
  isLoading: boolean;
  now: Date;
  round: DashboardRound | null;
};

export function ChronoStage({ isLoading, now, round }: ChronoStageProps) {
  const progress = getRoundProgress(round, now);
  const points = buildCrashCurvePolyline(progress);
  const crashed = round?.status === "CRASHED" || round?.status === "SETTLED";
  const running = round?.status === "RUNNING";

  return (
    <div
      aria-busy={isLoading}
      className={cn(
        "chrono-scanline relative min-h-[31rem] min-w-0 overflow-hidden rounded-md border bg-[#05080d]",
        crashed
          ? "border-rose-300/35 shadow-[0_0_60px_rgba(251,113,133,0.16)]"
          : "border-cyan-300/20 shadow-[0_0_70px_rgba(34,211,238,0.12)]",
      )}
      data-testid="chrono-stage"
    >
      <div className="chrono-grid absolute inset-0 opacity-60" />
      <div className="absolute inset-x-0 bottom-0 h-[42%] bg-gradient-to-t from-black via-slate-950/88 to-transparent" />
      <CityBackdrop />
      <TimeTunnel crashed={crashed} running={running} />

      <svg
        aria-label="Chrono crash curve"
        className="absolute inset-0 z-10 size-full"
        data-testid="chrono-stage-curve"
        preserveAspectRatio="none"
        viewBox="0 0 100 100"
      >
        <polyline
          fill="none"
          points={points}
          stroke={crashed ? "#fb7185" : "#22d3ee"}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2.2"
        />
        <polyline
          fill="none"
          opacity="0.32"
          points={points}
          stroke={crashed ? "#fb7185" : "#f59e0b"}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="6"
        />
        {crashed ? (
          <line
            stroke="#fb7185"
            strokeDasharray="3 4"
            strokeWidth="1.3"
            x1="88"
            x2="88"
            y1="13"
            y2="91"
          />
        ) : null}
      </svg>

      {crashed ? <div className="chrono-burst absolute inset-8 rounded-full border border-rose-300/30" /> : null}

      <div className="absolute left-5 top-5 z-20 flex flex-wrap gap-2">
        <Chip tone="cyan">Flux stable</Chip>
        <Chip tone={crashed ? "rose" : "amber"}>
          {crashed ? "Timeline rupture" : "Temporal charge"}
        </Chip>
      </div>

      <div className="relative z-20 grid min-h-[31rem] place-items-center px-5 py-16 text-center">
        <div>
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.28em] text-cyan-100">
            <Zap className="size-3.5" aria-hidden="true" />
            Chrono drive
          </div>
          <p
            className={cn(
              "font-mono text-7xl font-black tracking-normal text-zinc-50 drop-shadow-[0_8px_0_rgba(0,0,0,0.35)] sm:text-8xl",
              running && "chrono-pulse",
              crashed && "text-rose-100",
            )}
          >
            {isLoading ? "..." : formatRoundMultiplier(round)}
          </p>
          <p className="mt-4 max-w-2xl break-all font-mono text-xs text-zinc-500">
            serverSeedHash: {truncateHash(round?.serverSeedHash)}
          </p>
        </div>
      </div>

      <ChronoVehicle crashed={crashed} running={running} />
      <div className="chrono-road absolute inset-x-0 bottom-[3.2rem] z-10 h-1 opacity-80" />
      <div className="absolute inset-x-0 bottom-0 z-10 h-[4rem] border-t border-cyan-300/15 bg-gradient-to-b from-slate-800/85 to-slate-950" />
    </div>
  );
}

function Chip({ children, tone }: { children: string; tone: "amber" | "cyan" | "rose" }) {
  const className =
    tone === "cyan"
      ? "border-cyan-300/20 bg-cyan-300/10 text-cyan-100"
      : tone === "rose"
        ? "border-rose-300/25 bg-rose-300/10 text-rose-100"
        : "border-amber-300/25 bg-amber-300/10 text-amber-100";

  return (
    <span className={cn("rounded-full border px-2.5 py-1 text-xs font-semibold", className)}>
      {children}
    </span>
  );
}

function CityBackdrop() {
  return (
    <div className="absolute inset-x-0 bottom-[4rem] z-0 h-[45%] opacity-45">
      <div className="absolute bottom-0 left-[4%] h-20 w-14 rounded-t-sm bg-slate-800" />
      <div className="absolute bottom-0 left-[14%] h-32 w-20 rounded-t bg-slate-800" />
      <div className="absolute bottom-0 left-[28%] h-24 w-24 rounded-t bg-slate-800" />
      <div className="absolute bottom-0 right-[29%] h-28 w-16 rounded-t bg-slate-800" />
      <div className="absolute bottom-0 right-[15%] h-44 w-12 rounded-t-full bg-slate-800" />
      <div className="absolute bottom-0 right-[6%] h-24 w-24 rounded-t bg-slate-800" />
    </div>
  );
}

function TimeTunnel({ crashed, running }: { crashed: boolean; running: boolean }) {
  return (
    <div
      className={cn(
        "absolute left-1/2 top-[42%] h-[22rem] w-[22rem] -translate-x-1/2 -translate-y-1/2 rounded-full border opacity-45 blur-sm",
        crashed
          ? "border-rose-300/40 shadow-[0_0_90px_rgba(251,113,133,0.34)]"
          : "border-cyan-300/35 shadow-[0_0_90px_rgba(34,211,238,0.34)]",
        running && "chrono-pulse",
      )}
    />
  );
}
