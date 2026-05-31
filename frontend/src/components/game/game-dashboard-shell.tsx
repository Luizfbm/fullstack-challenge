import { Activity, Clock3, Coins, History, Users } from "lucide-react";
import { useAuth } from "../../hooks/use-auth";
import { Badge } from "../ui/badge";
import { BetControlsPanel } from "./bet-controls-panel";

export function GameDashboardShell() {
  const { errorMessage, isAuthenticated, username } = useAuth();

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_21rem]">
      <section className="rounded-md border border-zinc-800 bg-zinc-900/70 p-4">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-zinc-100">Rodada</h2>
            <p className="mt-1 text-xs text-zinc-500">Aguardando snapshot</p>
          </div>
          <Badge variant="warning">
            <Clock3 className="size-3.5" aria-hidden="true" />
            BETTING
          </Badge>
        </div>

        <div className="grid min-h-[22rem] place-items-center rounded-md border border-zinc-800 bg-zinc-950">
          <div className="text-center">
            <p className="text-6xl font-semibold tracking-normal text-zinc-50">
              1.00x
            </p>
            <p className="mt-3 font-mono text-xs text-zinc-500">
              serverSeedHash: -
            </p>
          </div>
        </div>
      </section>

      <aside className="space-y-4">
        <section className="grid grid-cols-2 gap-3">
          <MetricCard icon={Coins} label="Saldo" value="-" />
          <MetricCard
            icon={Users}
            label="Jogador"
            value={isAuthenticated ? username ?? "-" : "-"}
          />
        </section>

        {errorMessage ? <AuthError message={errorMessage} /> : null}

        <BetControlsPanel />

        <section className="rounded-md border border-zinc-800 bg-zinc-900/70 p-4">
          <div className="mb-4 flex items-center gap-2">
            <Activity className="size-4 text-sky-300" aria-hidden="true" />
            <h2 className="text-sm font-semibold text-zinc-100">Mesa</h2>
          </div>
          <div className="space-y-2">
            <TableRow label="player" value="-" />
            <TableRow label="cashout" value="-" />
            <TableRow label="payout" value="-" />
          </div>
        </section>

        <section className="rounded-md border border-zinc-800 bg-zinc-900/70 p-4">
          <div className="mb-4 flex items-center gap-2">
            <History className="size-4 text-emerald-300" aria-hidden="true" />
            <h2 className="text-sm font-semibold text-zinc-100">Histórico</h2>
          </div>
          <div className="flex flex-wrap gap-2">
            {["-", "-", "-", "-", "-"].map((item, index) => (
              <Badge key={`${item}-${index}`}>{item}</Badge>
            ))}
          </div>
        </section>
      </aside>
    </div>
  );
}

function AuthError({ message }: { message: string }) {
  return (
    <div className="rounded-md border border-rose-400/30 bg-rose-400/10 p-3 text-sm text-rose-100">
      {message}
    </div>
  );
}

type MetricCardProps = {
  icon: typeof Coins;
  label: string;
  value: string;
};

function MetricCard({ icon: Icon, label, value }: MetricCardProps) {
  return (
    <section className="rounded-md border border-zinc-800 bg-zinc-900/70 p-4">
      <Icon className="mb-3 size-4 text-emerald-300" aria-hidden="true" />
      <p className="text-xs text-zinc-500">{label}</p>
      <p className="mt-1 text-lg font-semibold text-zinc-50">{value}</p>
    </section>
  );
}

type TableRowProps = {
  label: string;
  value: string;
};

function TableRow({ label, value }: TableRowProps) {
  return (
    <div className="flex items-center justify-between rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm">
      <span className="text-zinc-400">{label}</span>
      <span className="font-mono text-zinc-200">{value}</span>
    </div>
  );
}
