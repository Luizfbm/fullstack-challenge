import { ShieldCheck } from "lucide-react";
import { GameDashboardShell } from "../components/game/game-dashboard-shell";
import { AppShell } from "../components/layout/app-shell";
import { Badge } from "../components/ui/badge";

export function App() {
  return (
    <AppShell>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-50">Crash Game</h1>
          <p className="mt-1 text-sm text-zinc-400">Jungle Gaming table</p>
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
