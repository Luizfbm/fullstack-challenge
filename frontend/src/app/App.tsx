import { GameDashboardShell } from "../components/game/game-dashboard-shell";
import { AppShell } from "../components/layout/app-shell";

export function App() {
  return (
    <AppShell>
      <GameDashboardShell />
    </AppShell>
  );
}
