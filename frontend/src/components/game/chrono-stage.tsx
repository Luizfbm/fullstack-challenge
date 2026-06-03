import { useEffect, useRef, useState } from "react";
import NumberFlow from "@number-flow/react";
import { cn } from "../../lib/utils";
import { getSecondsUntilRoundStart } from "../../services/round-timing";
import {
  CrashFlightScene,
  type StageAnimationPhase,
} from "./crash-flight-scene";
import {
  type DashboardRound,
  formatRoundMultiplier,
} from "./round-formatting";
import { ENTERING_BLACK_HOLE_MS } from "./stage-animation-timing";

type ChronoStageProps = {
  isLoading: boolean;
  now: Date;
  round: DashboardRound | null;
};

export function ChronoStage({ isLoading, now, round }: ChronoStageProps) {
  const betting = round?.status === "BETTING";
  const crashed = round?.status === "CRASHED" || round?.status === "SETTLED";
  const running = round?.status === "RUNNING";
  const phase = useStageAnimationPhase(round?.status);
  const bettingSeconds = betting ? getSecondsUntilRoundStart(round, now) : 0;
  const centerValue = formatRoundMultiplier(round, now);
  const centerLabel = betting ? "Rodada inicia em" : "Multiplicador atual";

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

      <div
        className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center px-5"
        data-testid="stage-multiplier"
      >
        <div
          className={cn(
            "rounded-md border border-cyan-200/25 bg-slate-950/64 px-5 py-3 text-center shadow-[0_18px_54px_rgba(8,47,73,0.35)] backdrop-blur-md",
            crashed &&
              "border-rose-200/35 bg-rose-950/42 shadow-[0_18px_64px_rgba(244,63,94,0.3)]",
          )}
          data-testid="stage-multiplier-pill"
        >
          <p
            className={cn(
              "text-[clamp(2.5rem,6vw,5rem)] font-black leading-none tracking-normal text-zinc-50 drop-shadow-[0_10px_0_rgba(0,0,0,0.38)]",
              running && "chrono-pulse",
              crashed && "text-rose-100",
            )}
            data-testid="stage-multiplier-value"
          >
            {isLoading ? (
              "..."
            ) : betting ? (
              <NumberFlow value={bettingSeconds} />
            ) : (
              centerValue
            )}
          </p>
          <p
            className={cn(
              "mt-2 text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-cyan-100/78",
              crashed && "text-rose-100/78",
            )}
          >
            {centerLabel}
          </p>
        </div>
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
