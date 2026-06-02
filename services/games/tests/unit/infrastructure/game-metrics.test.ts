import { describe, expect, test } from "bun:test";

import { GameMetrics } from "../../../src/infrastructure/observability/game-metrics";

describe("GameMetrics", () => {
  test("exports accepted bets, wagered amount, manual cashouts, payouts and RTP", async () => {
    const metrics = new GameMetrics();

    metrics.recordBetAccepted(1000n);
    metrics.recordCashout("manual", 1500n);

    const text = await metrics.metricsText();

    expect(text).toContain('crash_game_bets_total{status="accepted"} 1');
    expect(text).toContain("crash_game_bet_amount_cents_total 1000");
    expect(text).toContain('crash_game_cashouts_total{mode="manual"} 1');
    expect(text).toContain("crash_game_payout_cents_total 1500");
    expect(text).toContain("crash_game_rtp_ratio 1.5");
  });

  test("exports zero RTP before accepted bets and rejects unsafe integer money amounts", async () => {
    const metrics = new GameMetrics();

    await expect(metrics.metricsText()).resolves.toContain(
      "crash_game_rtp_ratio 0",
    );

    const unsafeAmount = BigInt(Number.MAX_SAFE_INTEGER) + 1n;

    expect(() => metrics.recordBetAccepted(unsafeAmount)).toThrow(RangeError);
    expect(() => metrics.recordCashout("manual", unsafeAmount)).toThrow(
      RangeError,
    );
  });

  test("exports rejected bets, crash point buckets and WebSocket events", async () => {
    const metrics = new GameMetrics();

    metrics.recordBetRejected();
    metrics.recordCrashPoint(2.25);
    metrics.recordWebSocketEvent("round.tick");

    const text = await metrics.metricsText();

    expect(text).toContain('crash_game_bets_total{status="rejected"} 1');
    expect(text).toContain(
      'crash_game_crash_point_multiplier_bucket{le="3"} 1',
    );
    expect(text).toContain("crash_game_crash_point_multiplier_sum 2.25");
    expect(text).toContain("crash_game_crash_point_multiplier_count 1");
    expect(text).toContain(
      'crash_game_websocket_events_total{event="round.tick"} 1',
    );
  });

  test("exports wallet command latency and failures", async () => {
    const metrics = new GameMetrics();

    metrics.recordWalletCommand("debit", 125, "failed");

    const text = await metrics.metricsText();

    expect(text).toContain(
      'crash_game_wallet_command_failures_total{command="debit"} 1',
    );
    expect(text).toContain(
      'crash_game_wallet_command_duration_ms_bucket{le="250",command="debit"} 1',
    );
    expect(text).toContain(
      'crash_game_wallet_command_duration_ms_sum{command="debit"} 125',
    );
    expect(text).toContain(
      'crash_game_wallet_command_duration_ms_count{command="debit"} 1',
    );
  });

  test("exports auto bet session, placement and failure counters", async () => {
    const metrics = new GameMetrics();

    metrics.recordAutoBetSessionStarted();
    metrics.recordAutoBetPlaced();
    metrics.recordAutoBetFailure("WALLET_REJECTED");
    metrics.recordAutoBetSessionStopped("MAX_ROUNDS_REACHED");

    const text = await metrics.metricsText();

    expect(text).toContain("crash_auto_bet_sessions_started_total 1");
    expect(text).toContain("crash_auto_bets_placed_total 1");
    expect(text).toContain(
      'crash_auto_bet_failures_total{reason="WALLET_REJECTED"} 1',
    );
    expect(text).toContain(
      'crash_auto_bet_sessions_stopped_total{reason="MAX_ROUNDS_REACHED"} 1',
    );
  });
});
