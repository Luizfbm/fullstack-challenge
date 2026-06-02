import { describe, expect, test } from "bun:test";

import { WalletMetrics } from "../../../src/infrastructure/observability/wallet-metrics";

describe("WalletMetrics", () => {
  test("exports successful debit and credit command totals, amounts and duration", async () => {
    const metrics = new WalletMetrics();

    metrics.recordCommand("debit", "succeeded", 12, 1000n);
    metrics.recordCommand("credit", "succeeded", 16, 1500n);

    const text = await metrics.metricsText();

    expect(text).toContain(
      'crash_wallet_commands_total{command="debit",result="succeeded"} 1',
    );
    expect(text).toContain(
      'crash_wallet_commands_total{command="credit",result="succeeded"} 1',
    );
    expect(text).toContain("crash_wallet_debit_amount_cents_total 1000");
    expect(text).toContain("crash_wallet_credit_amount_cents_total 1500");
    expect(text).toContain(
      'crash_wallet_command_duration_ms_sum{command="debit",result="succeeded"} 12',
    );
    expect(text).toContain(
      'crash_wallet_command_duration_ms_count{command="credit",result="succeeded"} 1',
    );
  });

  test("exports failed command totals and failure reasons without amount counters", async () => {
    const metrics = new WalletMetrics();

    metrics.recordCommand("debit", "failed", 9, null, "INSUFFICIENT_FUNDS");

    const text = await metrics.metricsText();

    expect(text).toContain(
      'crash_wallet_commands_total{command="debit",result="failed"} 1',
    );
    expect(text).toContain(
      'crash_wallet_command_failures_total{command="debit",reason="INSUFFICIENT_FUNDS"} 1',
    );
    expect(text).toContain("crash_wallet_debit_amount_cents_total 0");
    expect(text).toContain("crash_wallet_credit_amount_cents_total 0");
  });

  test("rejects unsafe integer money amounts after recording command telemetry", async () => {
    const metrics = new WalletMetrics();
    const unsafeAmount = BigInt(Number.MAX_SAFE_INTEGER) + 1n;

    expect(() =>
      metrics.recordCommand("debit", "succeeded", 8, unsafeAmount),
    ).toThrow(RangeError);

    const text = await metrics.metricsText();

    expect(text).toContain(
      'crash_wallet_commands_total{command="debit",result="succeeded"} 1',
    );
    expect(text).toContain(
      'crash_wallet_command_duration_ms_sum{command="debit",result="succeeded"} 8',
    );
    expect(text).toContain("crash_wallet_debit_amount_cents_total 0");
    expect(text).toContain("crash_wallet_credit_amount_cents_total 0");
  });

  test("rejects negative money amounts after recording command telemetry", async () => {
    const metrics = new WalletMetrics();

    expect(() =>
      metrics.recordCommand("credit", "succeeded", 11, -1n),
    ).toThrow(RangeError);

    const text = await metrics.metricsText();

    expect(text).toContain(
      'crash_wallet_commands_total{command="credit",result="succeeded"} 1',
    );
    expect(text).toContain(
      'crash_wallet_command_duration_ms_sum{command="credit",result="succeeded"} 11',
    );
    expect(text).toContain("crash_wallet_debit_amount_cents_total 0");
    expect(text).toContain("crash_wallet_credit_amount_cents_total 0");
  });
});
