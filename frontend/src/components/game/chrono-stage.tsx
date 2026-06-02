import { RadioTower, Zap } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "../../lib/utils";
import {
  CrashFlightScene,
  type StageAnimationPhase,
} from "./crash-flight-scene";
import {
  type DashboardRound,
  formatRoundMultiplier,
} from "./round-formatting";

type ChronoStageProps = {
  isLoading: boolean;
  now: Date;
  round: DashboardRound | null;
};

const ENTERING_BLACK_HOLE_MS = 1400;

export function ChronoStage({ isLoading, now, round }: ChronoStageProps) {
  const crashed = round?.status === "CRASHED" || round?.status === "SETTLED";
  const running = round?.status === "RUNNING";
  const phase = useStageAnimationPhase(round?.status);

  return (
    <div
      aria-busy={isLoading}
      className={cn(
        "chrono-arena black-hole-stage relative min-h-[34rem] min-w-0 overflow-hidden rounded-lg border",
        `black-hole-${phase}`,
        crashed
          ? "border-rose-300/60 shadow-[0_0_120px_rgba(244,63,94,0.34)]"
          : "border-rose-300/35 shadow-[0_0_120px_rgba(244,63,94,0.24)]",
      )}
      data-testid="chrono-stage"
    >
      <div className="chrono-grid absolute inset-0 opacity-35" />
      <div className="black-hole-stage-layer" aria-hidden="true">
        <div className="black-hole-starfield" />
        <div className="black-hole-speed-lines black-hole-speed-lines-horizontal" />
        <div className="black-hole-speed-lines black-hole-speed-lines-radial" />
      </div>
      <CrashFlightScene
        animationPhase={phase}
        isLoading={isLoading}
        now={now}
        round={round}
      />

      <div className="absolute left-4 top-4 z-20 flex flex-wrap gap-2">
        <StageChip tone={crashed ? "rose" : "green"}>
          <RadioTower className="size-3.5" aria-hidden="true" />
          {running ? "LIVE" : round?.status ?? "SYNC"}
        </StageChip>
        <StageChip tone="rose">
          <Zap className="size-3.5" aria-hidden="true" />
          Arcade run
        </StageChip>
      </div>

      <div className="pointer-events-none absolute right-5 top-16 z-20 flex max-w-[calc(100%-2.5rem)] justify-end sm:right-7 sm:top-7">
        <p
          className={cn(
            "text-right text-[clamp(3.25rem,8vw,7rem)] font-black leading-none tracking-normal text-zinc-50 drop-shadow-[0_12px_0_rgba(0,0,0,0.42)]",
            running && "chrono-pulse",
            crashed && "text-rose-100",
          )}
        >
          {isLoading ? "..." : formatRoundMultiplier(round, now)}
        </p>
      </div>

      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-28 bg-gradient-to-t from-black via-slate-950/70 to-transparent" />
    </div>
  );
}

function useStageAnimationPhase(
  status: DashboardRound["status"] | undefined,
): StageAnimationPhase {
  const previousStatusRef = useRef<typeof status>(status);
  const [isEntering, setIsEntering] = useState(false);

  useEffect(() => {
    const previousStatus = previousStatusRef.current;
    previousStatusRef.current = status;

    if (previousStatus === "BETTING" && status === "RUNNING") {
      setIsEntering(true);
      const timeoutId = window.setTimeout(() => {
        setIsEntering(false);
      }, ENTERING_BLACK_HOLE_MS);

      return () => window.clearTimeout(timeoutId);
    }

    return undefined;
  }, [status]);

  if (status === "CRASHED" || status === "SETTLED") {
    return "crashed";
  }

  if (status === "RUNNING") {
    return isEntering ? "entering" : "running";
  }

  return status === "BETTING" ? "betting" : "idle";
}

function StageChip({
  children,
  tone,
}: {
  children: ReactNode;
  tone: "green" | "rose";
}) {
  const className =
    tone === "green"
      ? "border-emerald-300/35 bg-emerald-300/10 text-emerald-100"
      : "border-rose-300/35 bg-rose-300/10 text-rose-100";

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-black uppercase tracking-[0.18em] backdrop-blur-xl",
        className,
      )}
    >
      {children}
    </span>
  );
}
