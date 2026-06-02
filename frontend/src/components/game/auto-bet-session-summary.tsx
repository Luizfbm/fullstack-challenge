import {
  Layers2,
  Repeat,
  Target,
  TrendingUp,
  WalletCards,
} from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "../../lib/utils";
import { formatMultiplierBp } from "../../services/auto-cashout";
import type {
  AutoBetSessionResponse,
  AutoBetStopReason,
} from "../../services/game-api";
import { formatCents } from "../../services/money";

type AutoBetSessionSummaryProps = {
  session: AutoBetSessionResponse;
};

export function AutoBetSessionSummary({ session }: AutoBetSessionSummaryProps) {
  const netProfit = BigInt(session.netProfitCents);
  const netProfitLabel = `${netProfit > 0n ? "+" : ""}${formatCents(netProfit)}`;

  return (
    <div className="mt-3 rounded-md border border-cyan-300/20 bg-cyan-300/10 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold text-cyan-100">
          {session.status === "ACTIVE" ? "Auto Bet ativo" : "Ultimo Auto Bet"}
        </p>
        <div className="flex flex-wrap gap-2">
          <SummaryBadge>
            {session.strategy === "MARTINGALE" ? "Martingale" : "Valor fixo"}
          </SummaryBadge>
          {session.autoCashoutMultiplierBp ? (
            <SummaryBadge>
              Auto cashout {formatMultiplierBp(session.autoCashoutMultiplierBp)}
            </SummaryBadge>
          ) : null}
          {session.stopReason ? (
            <SummaryBadge>{formatStopReason(session.stopReason)}</SummaryBadge>
          ) : null}
        </div>
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        <SummaryMetric
          icon={Repeat}
          label="Rodadas"
          value={`${session.roundsPlayed} / ${session.maxRounds}`}
        />
        <SummaryMetric
          icon={WalletCards}
          label="Proxima aposta"
          value={formatCents(session.nextAmountCents)}
        />
        {session.strategy === "MARTINGALE" ? (
          <SummaryMetric
            icon={Layers2}
            label="Passo"
            value={`${session.martingaleCurrentStep} / ${session.martingaleMaxSteps}`}
          />
        ) : null}
        <SummaryMetric
          icon={TrendingUp}
          label="Resultado"
          tone={netProfit < 0n ? "rose" : "emerald"}
          value={netProfitLabel}
        />
        <SummaryMetric
          icon={WalletCards}
          label="Base"
          value={formatCents(session.amountCents)}
        />
        <SummaryMetric
          icon={Target}
          label="Stop-loss"
          value={session.stopLossCents ? formatCents(session.stopLossCents) : "-"}
        />
        <SummaryMetric
          icon={TrendingUp}
          label="Take-profit"
          value={
            session.takeProfitCents ? formatCents(session.takeProfitCents) : "-"
          }
        />
      </div>
    </div>
  );
}

type SummaryBadgeProps = {
  children: ReactNode;
};

function SummaryBadge({ children }: SummaryBadgeProps) {
  return (
    <p className="rounded-md border border-cyan-200/30 bg-black/35 px-2 py-1 font-mono text-xs text-cyan-100">
      {children}
    </p>
  );
}

type SummaryMetricProps = {
  icon: typeof Repeat;
  label: string;
  tone?: "cyan" | "emerald" | "rose";
  value: string;
};

function SummaryMetric({
  icon: Icon,
  label,
  tone = "cyan",
  value,
}: SummaryMetricProps) {
  const valueTone =
    tone === "emerald"
      ? "text-emerald-100"
      : tone === "rose"
        ? "text-rose-100"
        : "text-zinc-50";

  return (
    <div className="rounded-md border border-white/10 bg-black/30 px-3 py-2">
      <p className="flex items-center gap-2 text-xs text-zinc-500">
        <Icon className="size-3.5 text-cyan-200" aria-hidden="true" />
        {label}
      </p>
      <p className={cn("mt-1 font-mono text-sm", valueTone)}>{value}</p>
    </div>
  );
}

function formatStopReason(reason: AutoBetStopReason): string {
  switch (reason) {
    case "MARTINGALE_MAX_STEPS_REACHED":
      return "Maximo de passos Martingale";
    case "MARTINGALE_BET_LIMIT_REACHED":
      return "Limite de aposta Martingale";
    case "MAX_ROUNDS_REACHED":
      return "Maximo de rodadas";
    case "STOP_LOSS_REACHED":
      return "Stop-loss atingido";
    case "TAKE_PROFIT_REACHED":
      return "Take-profit atingido";
    case "WALLET_REJECTED":
      return "Carteira rejeitou";
    case "WALLET_UNAVAILABLE":
      return "Carteira indisponivel";
    case "ROUND_NOT_AVAILABLE":
      return "Rodada indisponivel";
    case "MANUAL":
      return "Parado manualmente";
  }
}
