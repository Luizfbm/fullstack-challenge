import { ShieldCheck, Sparkles } from "lucide-react";
import { GameDashboardShell } from "../components/game/game-dashboard-shell";
import { AppShell } from "../components/layout/app-shell";
import { Badge } from "../components/ui/badge";

export function App() {
  return (
    <AppShell>
      <div className="chrono-panel mb-4 flex flex-wrap items-end justify-between gap-3 rounded-lg border border-white/10 p-4">
        <div>
          <p className="mb-2 inline-flex items-center gap-2 rounded-full border border-amber-300/25 bg-amber-300/10 px-3 py-1 text-xs font-black uppercase tracking-[0.24em] text-amber-100">
            <Sparkles className="size-3.5" aria-hidden="true" />
            Temporal arena
          </p>
          <h1 className="text-3xl font-black text-zinc-50 sm:text-4xl">
            Chrono Crash
          </h1>
          <h2 className="sr-only">Crash Game</h2>
        </div>

        <Badge variant="success">
          <ShieldCheck className="size-3.5" aria-hidden="true" />
          Hash chain
        </Badge>
      </div>

      <GameDashboardShell />
    </AppShell>
  );
}
