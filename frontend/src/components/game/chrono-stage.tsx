import { Gauge, RadioTower, ShieldCheck, Zap } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "../../lib/utils";
import { CrashFlightScene } from "./crash-flight-scene";
import {
  type DashboardRound,
  formatRoundMultiplier,
  roundBadgeVariant,
  truncateHash,
} from "./round-formatting";

type ChronoStageProps = {
  isLoading: boolean;
  now: Date;
  round: DashboardRound | null;
};

export function ChronoStage({ isLoading, now, round }: ChronoStageProps) {
  const crashed = round?.status === "CRASHED" || round?.status === "SETTLED";
  const running = round?.status === "RUNNING";

  return (
    <div
      aria-busy={isLoading}
      className={cn(
        "chrono-arena chrono-scanline relative min-h-[34rem] min-w-0 overflow-hidden rounded-lg border",
        crashed
          ? "border-rose-300/40 shadow-[0_0_90px_rgba(251,113,133,0.22)]"
          : "border-cyan-300/25 shadow-[0_0_90px_rgba(34,211,238,0.16)]",
      )}
      data-testid="chrono-stage"
    >
      <div className="chrono-grid absolute inset-0 opacity-35" />
      <div className="chrono-rift absolute -right-20 top-1/4 h-56 w-[28rem] rotate-[-18deg]" />
      <CrashFlightScene isLoading={isLoading} now={now} round={round} />
      <div
        className={cn(
          "pointer-events-none absolute inset-x-[12%] bottom-[24%] z-10 h-px origin-left -rotate-12 bg-gradient-to-r from-zinc-300/10 via-zinc-200/70 to-transparent",
          running && "chrono-trail-breathe",
          crashed && "via-rose-200/80",
        )}
        data-testid="chrono-stage-curve"
      />

      <div className="absolute left-4 top-4 z-20 flex flex-wrap gap-2">
        <StageChip tone={crashed ? "rose" : "cyan"}>
          <RadioTower className="size-3.5" aria-hidden="true" />
          {running ? "LIVE" : round?.status ?? "SYNC"}
        </StageChip>
        <StageChip tone="amber">
          <Zap className="size-3.5" aria-hidden="true" />
          Flux drive
        </StageChip>
      </div>

      <div className="absolute right-4 top-4 z-20 hidden max-w-[18rem] min-w-0 rounded-md border border-white/10 bg-black/35 p-3 text-right backdrop-blur-xl sm:block">
        <p className="text-xs uppercase tracking-[0.24em] text-zinc-400">
          Commit reveal
        </p>
        <p className="mt-1 break-all font-mono text-xs text-cyan-100">
          {truncateHash(round?.serverSeedHash)}
        </p>
      </div>

      <div className="relative z-20 flex min-h-[34rem] flex-col justify-between px-5 py-16">
        <div className="mx-auto mt-10 max-w-xl text-center">
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-cyan-300/25 bg-cyan-300/10 px-3 py-1 text-xs font-black uppercase tracking-[0.3em] text-cyan-100 shadow-[0_0_30px_rgba(34,211,238,0.18)]">
            <Gauge className="size-3.5" aria-hidden="true" />
            Chrono drive
          </div>
          <p
            className={cn(
              "text-[clamp(4.5rem,14vw,8.6rem)] font-black leading-none tracking-normal text-zinc-50 drop-shadow-[0_12px_0_rgba(0,0,0,0.32)]",
              running && "chrono-pulse",
              crashed && "text-rose-100",
            )}
          >
            {isLoading ? "..." : formatRoundMultiplier(round)}
          </p>
          <p className="mx-auto mt-4 max-w-xl font-mono text-xs uppercase tracking-[0.24em] text-zinc-400">
            {running ? "temporal ascent" : crashed ? "timeline rupture" : "launch bay"}
          </p>
        </div>

        <div className="hidden gap-3 sm:grid md:grid-cols-3">
          <StageMetric
            label="Round"
            value={round ? `#${round.chainIndex} / nonce ${round.nonce}` : "-"}
          />
          <StageMetric
            label="Status"
            tone={roundBadgeVariant(round?.status)}
            value={round?.status ?? "SYNC"}
          />
          <StageMetric
            label="Reveal"
            value={crashed && round?.crashPointBp ? formatRoundMultiplier(round) : "oculto"}
          />
        </div>
      </div>

      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-28 bg-gradient-to-t from-black via-slate-950/70 to-transparent" />
    </div>
  );
}

function StageChip({
  children,
  tone,
}: {
  children: ReactNode;
  tone: "amber" | "cyan" | "rose";
}) {
  const className =
    tone === "cyan"
      ? "border-cyan-300/30 bg-cyan-300/10 text-cyan-100"
      : tone === "rose"
        ? "border-rose-300/30 bg-rose-300/10 text-rose-100"
        : "border-amber-300/30 bg-amber-300/10 text-amber-100";

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

function StageMetric({
  label,
  tone = "neutral",
  value,
}: {
  label: string;
  tone?: "danger" | "neutral" | "success" | "warning";
  value: string;
}) {
  const toneClassName =
    tone === "success"
      ? "text-emerald-200"
      : tone === "danger"
        ? "text-rose-200"
        : tone === "warning"
          ? "text-amber-200"
          : "text-zinc-100";

  return (
    <div className="rounded-md border border-white/10 bg-black/35 px-3 py-2 backdrop-blur-xl">
      <div className="flex items-center gap-2 text-xs uppercase tracking-[0.22em] text-zinc-500">
        <ShieldCheck className="size-3" aria-hidden="true" />
        {label}
      </div>
      <p className={cn("mt-1 truncate font-mono text-sm font-semibold", toneClassName)}>
        {value}
      </p>
    </div>
  );
}
