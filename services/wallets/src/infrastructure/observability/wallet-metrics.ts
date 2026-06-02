import { collectDefaultMetrics, Counter, Histogram, Registry } from "prom-client";

export type WalletCommand = "debit" | "credit";
export type WalletCommandResult = "succeeded" | "failed";

const maxSafeIntegerBigInt = BigInt(Number.MAX_SAFE_INTEGER);

function toSafePrometheusNumber(value: bigint, name: string): number {
  if (value < 0n) {
    throw new RangeError(`${name} must be non-negative`);
  }

  if (value > maxSafeIntegerBigInt) {
    throw new RangeError(`${name} must be within Number.MAX_SAFE_INTEGER`);
  }

  return Number(value);
}

export class WalletMetrics {
  private readonly registry = new Registry();

  private readonly commandsTotal = new Counter({
    name: "crash_wallet_commands_total",
    help: "Total wallet commands by command and result.",
    labelNames: ["command", "result"],
    registers: [this.registry],
  });

  private readonly debitAmountCentsTotal = new Counter({
    name: "crash_wallet_debit_amount_cents_total",
    help: "Total successful wallet debit amount in cents.",
    registers: [this.registry],
  });

  private readonly creditAmountCentsTotal = new Counter({
    name: "crash_wallet_credit_amount_cents_total",
    help: "Total successful wallet credit amount in cents.",
    registers: [this.registry],
  });

  private readonly commandFailuresTotal = new Counter({
    name: "crash_wallet_command_failures_total",
    help: "Total failed wallet commands by command and reason.",
    labelNames: ["command", "reason"],
    registers: [this.registry],
  });

  private readonly commandDurationMs = new Histogram({
    name: "crash_wallet_command_duration_ms",
    help: "Wallet command duration in milliseconds by command and result.",
    buckets: [5, 10, 25, 50, 100, 250, 500, 1000, 2000, 5000],
    labelNames: ["command", "result"],
    registers: [this.registry],
  });

  constructor() {
    collectDefaultMetrics({
      prefix: "crash_wallet_process_",
      register: this.registry,
    });
  }

  contentType(): string {
    return this.registry.contentType;
  }

  metricsText(): Promise<string> {
    return this.registry.metrics();
  }

  recordCommand(
    command: WalletCommand,
    result: WalletCommandResult,
    durationMs: number,
    amountCents: bigint | null,
    failureReason = "none",
  ): void {
    this.commandsTotal.inc({ command, result });
    this.commandDurationMs.observe({ command, result }, durationMs);

    if (result === "failed") {
      this.commandFailuresTotal.inc({ command, reason: failureReason });
      return;
    }

    const amount =
      amountCents !== null
        ? toSafePrometheusNumber(amountCents, "amountCents")
        : null;

    if (amount !== null) {
      if (command === "debit") {
        this.debitAmountCentsTotal.inc(amount);
      } else {
        this.creditAmountCentsTotal.inc(amount);
      }
    }
  }
}
