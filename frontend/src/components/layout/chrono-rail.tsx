import {
  Activity,
  Gauge,
  History,
  Radar,
  ShieldCheck,
  WalletCards,
} from "lucide-react";
import { cn } from "../../lib/utils";

const railItems = [
  { icon: Gauge, label: "Cockpit", active: true },
  { icon: WalletCards, label: "Wallet", active: false },
  { icon: Activity, label: "Bets", active: false },
  { icon: History, label: "History", active: false },
  { icon: Radar, label: "Realtime", active: false },
  { icon: ShieldCheck, label: "Fairness", active: false },
];

export function ChronoRail() {
  return (
    <nav
      aria-label="Chrono cockpit sections"
      className="sticky top-3 z-40 rounded-2xl border border-white/10 bg-slate-950/85 p-2 shadow-2xl shadow-black/45 backdrop-blur lg:h-[calc(100vh-2rem)] lg:w-16 lg:rounded-3xl lg:p-3"
    >
      <div className="flex items-center justify-around gap-1 lg:h-full lg:flex-col lg:justify-start lg:gap-3">
        {railItems.map(({ active, icon: Icon, label }) => (
          <button
            aria-current={active ? "page" : undefined}
            aria-label={label}
            className={cn(
              "grid size-10 place-items-center rounded-xl border text-zinc-500 transition-colors",
              active
                ? "border-cyan-300/40 bg-cyan-300/15 text-cyan-100 shadow-[0_0_24px_rgba(34,211,238,0.22)]"
                : "border-white/5 bg-white/[0.03] hover:border-zinc-500/40 hover:text-zinc-200",
            )}
            key={label}
            type="button"
          >
            <Icon className="size-4" aria-hidden="true" />
          </button>
        ))}
      </div>
    </nav>
  );
}
