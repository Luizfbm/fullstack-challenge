import {
  collectDefaultMetrics,
  Counter,
  Gauge,
  Histogram,
  Registry,
} from "prom-client";

const maxSafeIntegerBigInt = BigInt(Number.MAX_SAFE_INTEGER);

function toSafePrometheusNumber(value: bigint, name: string): number {
  if (value > maxSafeIntegerBigInt || value < -maxSafeIntegerBigInt) {
    throw new RangeError(`${name} must be within Number.MAX_SAFE_INTEGER`);
  }

  return Number(value);
}

export class GameMetrics {
  private readonly registry = new Registry();
  private acceptedBetAmountCents = 0;
  private payoutCents = 0;

  private readonly betsTotal = new Counter({
    name: "crash_game_bets_total",
    help: "Total crash game bets by status.",
    labelNames: ["status"],
    registers: [this.registry],
  });

  private readonly betAmountCentsTotal = new Counter({
    name: "crash_game_bet_amount_cents_total",
    help: "Total accepted crash game wager amount in cents.",
    registers: [this.registry],
  });

  private readonly cashoutsTotal = new Counter({
    name: "crash_game_cashouts_total",
    help: "Total crash game cashouts by mode.",
    labelNames: ["mode"],
    registers: [this.registry],
  });

  private readonly payoutCentsTotal = new Counter({
    name: "crash_game_payout_cents_total",
    help: "Total crash game payout amount in cents.",
    registers: [this.registry],
  });

  private readonly websocketEventsTotal = new Counter({
    name: "crash_game_websocket_events_total",
    help: "Total crash game WebSocket events by event name.",
    labelNames: ["event"],
    registers: [this.registry],
  });

  private readonly crashPointMultiplier = new Histogram({
    name: "crash_game_crash_point_multiplier",
    help: "Crash game crash point multiplier distribution.",
    buckets: [1.01, 1.5, 2, 3, 5, 10, 25, 50, 100],
    registers: [this.registry],
  });

  private readonly walletCommandFailuresTotal = new Counter({
    name: "crash_game_wallet_command_failures_total",
    help: "Total failed crash game wallet commands by command.",
    labelNames: ["command"],
    registers: [this.registry],
  });

  private readonly walletCommandDurationMs = new Histogram({
    name: "crash_game_wallet_command_duration_ms",
    help: "Crash game wallet command duration in milliseconds by command.",
    buckets: [5, 10, 25, 50, 100, 250, 500, 1000, 2000, 5000],
    labelNames: ["command"],
    registers: [this.registry],
  });

  private readonly rtpRatio = new Gauge({
    name: "crash_game_rtp_ratio",
    help: "Crash game return to player ratio based on accepted wagers and payouts.",
    collect: () => {
      const ratio =
        this.acceptedBetAmountCents === 0
          ? 0
          : this.payoutCents / this.acceptedBetAmountCents;

      this.rtpRatio.set(ratio);
    },
    registers: [this.registry],
  });

  constructor() {
    collectDefaultMetrics({
      prefix: "crash_game_process_",
      register: this.registry,
    });
  }

  contentType(): string {
    return this.registry.contentType;
  }

  metricsText(): Promise<string> {
    return this.registry.metrics();
  }

  recordBetAccepted(amountCents: bigint): void {
    const amount = toSafePrometheusNumber(amountCents, "amountCents");

    this.betsTotal.inc({ status: "accepted" });
    this.betAmountCentsTotal.inc(amount);
    this.acceptedBetAmountCents += amount;
  }

  recordBetRejected(): void {
    this.betsTotal.inc({ status: "rejected" });
  }

  recordCashout(mode: "manual" | "auto", payoutCents: bigint): void {
    const payout = toSafePrometheusNumber(payoutCents, "payoutCents");

    this.cashoutsTotal.inc({ mode });
    this.payoutCentsTotal.inc(payout);
    this.payoutCents += payout;
  }

  recordCrashPoint(multiplier: number): void {
    this.crashPointMultiplier.observe(multiplier);
  }

  recordWebSocketEvent(event: string): void {
    this.websocketEventsTotal.inc({ event });
  }

  recordWalletCommand(
    command: "debit" | "credit",
    durationMs: number,
    result: "succeeded" | "failed",
  ): void {
    this.walletCommandDurationMs.observe({ command }, durationMs);

    if (result === "failed") {
      this.walletCommandFailuresTotal.inc({ command });
    }
  }
}
