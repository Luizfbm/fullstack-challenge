import { describe, expect, test } from "bun:test";
import {
  cashOut,
  ensureStackIsHealthy,
  forceBettingRoundToStart,
  forceRunningRoundToCrash,
  getAccessToken,
  KONG_BASE_URL,
  placeBet,
  prepareDeterministicRound,
  waitForCurrentStatus,
  waitForRoundStatus,
  withE2ELock,
} from "./e2e-helpers";

describe("observability E2E", () => {
  test(
    "exposes public metrics and records bet, cashout, payout and wallet command signals",
    async () => {
      await withE2ELock(async () => {
        await ensureStackIsHealthy();
        const bettingRound = await prepareDeterministicRound("clean-betting");
        const token = await getAccessToken();

        const bet = await placeBet(token, "1000");

        expect(bet.roundId).toBe(bettingRound.id);
        expect(bet.status).toBe("ACCEPTED");

        await forceBettingRoundToStart(bettingRound.id);
        await waitForCurrentStatus("RUNNING");

        try {
          const cashedOutBet = await cashOut(token);

          expect(cashedOutBet.id).toBe(bet.id);
          expect(cashedOutBet.status).toBe("CASHED_OUT");
          expect(cashedOutBet.payoutCents).not.toBeNull();

          const gamesMetrics = await fetchMetrics("/games/metrics", (metrics) =>
            hasSeries(metrics, "crash_game_bets_total", {
              status: "accepted",
            }) &&
            hasSeries(metrics, "crash_game_bet_amount_cents_total") &&
            hasSeries(metrics, "crash_game_cashouts_total", {
              mode: "manual",
            }) &&
            hasSeries(metrics, "crash_game_payout_cents_total") &&
            hasSeries(metrics, "crash_game_wallet_command_duration_ms_count", {
              command: "debit",
            }) &&
            hasSeries(metrics, "crash_game_wallet_command_duration_ms_count", {
              command: "credit",
            }),
          );
          const walletsMetrics = await fetchMetrics(
            "/wallets/metrics",
            (metrics) =>
              hasSeries(metrics, "crash_wallet_commands_total", {
                command: "debit",
                result: "succeeded",
              }) &&
              hasSeries(metrics, "crash_wallet_commands_total", {
                command: "credit",
                result: "succeeded",
              }) &&
              hasSeries(metrics, "crash_wallet_debit_amount_cents_total") &&
              hasSeries(metrics, "crash_wallet_credit_amount_cents_total"),
          );

          expect(gamesMetrics).toContain("# HELP crash_game_bets_total");
          expect(gamesMetrics).toContain("# TYPE crash_game_bets_total counter");
          expect(walletsMetrics).toContain("# HELP crash_wallet_commands_total");
          expect(walletsMetrics).toContain(
            "# TYPE crash_wallet_commands_total counter",
          );
        } finally {
          await forceRunningRoundToCrash(bettingRound.id);
          await waitForRoundStatus(bettingRound.id, "SETTLED");
        }
      });
    },
    { timeout: 120000 },
  );
});

async function fetchMetrics(
  path: "/games/metrics" | "/wallets/metrics",
  isReady: (metrics: string) => boolean,
): Promise<string> {
  const timeoutMs = 30_000;
  const startedAt = Date.now();
  let lastFailure = "no request attempted";

  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(`${KONG_BASE_URL}${path}`, {
        signal: AbortSignal.timeout(5_000),
      });
      const body = await response.text();

      if (!response.ok) {
        lastFailure = `${response.status}: ${body.slice(0, 200)}`;
      } else if (isReady(body)) {
        return body;
      } else {
        lastFailure = `metrics response did not contain expected series: ${body.slice(0, 200)}`;
      }
    } catch (error) {
      lastFailure =
        error instanceof Error ? error.message : "unexpected metrics failure";
    }

    await Bun.sleep(500);
  }

  throw new Error(`Timed out waiting for ${path}. Last failure: ${lastFailure}`);
}

function hasSeries(
  metrics: string,
  name: string,
  labels: Record<string, string> = {},
): boolean {
  return metrics.split("\n").some((line) => {
    if (!line.startsWith(`${name}{`) && !line.startsWith(`${name} `)) {
      return false;
    }

    return Object.entries(labels).every(([key, value]) =>
      line.includes(`${key}="${value}"`),
    );
  });
}
