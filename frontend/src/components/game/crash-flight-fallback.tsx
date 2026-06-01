export function FlightFallback() {
  return (
    <div
      className="absolute inset-4 grid place-items-center rounded-md border border-cyan-300/20 bg-slate-950/80 text-center"
      data-testid="crash-flight-fallback"
    >
      <div>
        <div className="mx-auto h-2 w-44 rounded-full bg-gradient-to-r from-zinc-500 via-cyan-200 to-transparent" />
        <div className="mt-4 h-12 w-28 skew-x-[-14deg] rounded-sm border border-zinc-300/60 bg-zinc-300/30 shadow-[0_0_36px_rgba(125,211,252,0.34)]" />
        <p className="mt-4 text-xs uppercase tracking-[0.28em] text-cyan-100">
          WebGL fallback
        </p>
      </div>
    </div>
  );
}
