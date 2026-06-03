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
  const netProfitTone = netProfit < 0n ? "rose" : "emerald";

  if (session.status !== "ACTIVE") {
    return (
      <CompactAutoBetSessionSummary
        netProfitLabel={netProfitLabel}
        netProfitTone={netProfitTone}
        session={session}
      />
    );
  }

  return (
    <section
      aria-label="Resumo do auto bet ativo"
      className="mt-3 rounded-md border border-cyan-300/20 bg-cyan-300/10 p-3"
    >
      <SessionSummaryHeader session={session} title="Auto Bet ativo" />

      <div
        className="mt-3 grid grid-cols-1 gap-2 lg:grid-cols-3 xl:grid-cols-1"
        data-testid="auto-bet-session-detail-grid"
      >
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
          tone={netProfitTone}
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
    </section>
  );
}

function CompactAutoBetSessionSummary({
  netProfitLabel,
  netProfitTone,
  session,
}: {
  netProfitLabel: string;
  netProfitTone: "emerald" | "rose";
  session: AutoBetSessionResponse;
}) {
  return (
    <section
      aria-label="Resumo compacto do último auto bet"
      className="mt-3 rounded-md border border-cyan-300/20 bg-cyan-300/10 p-2.5"
    >
      <SessionSummaryHeader session={session} title="Ultimo Auto Bet" />

      <dl
        className="mt-2 grid grid-cols-2 gap-1.5"
        data-testid="compact-auto-bet-summary-grid"
      >
        <CompactMetric
          label="Rodadas"
          value={`${session.roundsPlayed} / ${session.maxRounds}`}
        />
        <CompactMetric
          label="Proxima aposta"
          value={formatCents(session.nextAmountCents)}
        />
        {session.strategy === "MARTINGALE" ? (
          <CompactMetric
            label="Passo"
            value={`${session.martingaleCurrentStep} / ${session.martingaleMaxSteps}`}
          />
        ) : null}
        <CompactMetric
          label="Resultado"
          tone={netProfitTone}
          value={netProfitLabel}
        />
        <CompactMetric label="Base" value={formatCents(session.amountCents)} />
        <CompactMetric
          label="Stop-loss"
          value={session.stopLossCents ? formatCents(session.stopLossCents) : "-"}
        />
        <CompactMetric
          label="Take-profit"
          value={
            session.takeProfitCents ? formatCents(session.takeProfitCents) : "-"
          }
        />
      </dl>
    </section>
  );
}

function SessionSummaryHeader({
  session,
  title,
}: {
  session: AutoBetSessionResponse;
  title: string;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <p className="text-sm font-semibold text-cyan-100">{title}</p>
      <div className="flex flex-wrap gap-1.5">
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
  );
}

type SummaryBadgeProps = {
  children: ReactNode;
};

function SummaryBadge({ children }: SummaryBadgeProps) {
  return (
    <p className="max-w-full rounded-md border border-cyan-200/30 bg-black/35 px-2 py-1 font-mono text-xs leading-tight text-cyan-100">
      {children}
    </p>
  );
}

type CompactMetricProps = {
  label: string;
  tone?: "cyan" | "emerald" | "rose";
  value: string;
};

function CompactMetric({ label, tone = "cyan", value }: CompactMetricProps) {
  const valueTone =
    tone === "emerald"
      ? "text-emerald-100"
      : tone === "rose"
        ? "text-rose-100"
        : "text-zinc-50";

  return (
    <div className="min-w-0 rounded border border-white/10 bg-black/25 px-2 py-1.5">
      <dt className="text-[0.64rem] leading-tight text-zinc-500">{label}</dt>
      <dd className={cn("mt-0.5 font-mono text-xs leading-tight", valueTone)}>
        {value}
      </dd>
    </div>
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
    <div className="min-w-0 rounded-md border border-white/10 bg-black/30 px-3 py-2.5">
      <p className="flex min-w-0 items-center gap-2 text-xs leading-tight text-zinc-500">
        <Icon className="size-3.5 shrink-0 text-cyan-200" aria-hidden="true" />
        {label}
      </p>
      <p className={cn("mt-1 font-mono text-sm leading-tight", valueTone)}>
        {value}
      </p>
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
