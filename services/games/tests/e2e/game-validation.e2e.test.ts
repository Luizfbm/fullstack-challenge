import { describe, expect, test } from "bun:test";
import {
  apiResponse,
  cashOut,
  ensureStackIsHealthy,
  forceBettingRoundToStart,
  forceRunningRoundToCrash,
  getAccessToken,
  getWallet,
  placeBet,
  prepareBettingRound,
  setWalletBalance,
  waitForCurrentStatus,
  waitForRoundStatus,
  withE2ELock,
} from "./e2e-helpers";

async function postBet(token: string, amountCents: string): Promise<Response> {
  return apiResponse("/games/bet", {
    method: "POST",
    token,
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ amountCents }),
  });
}

async function postCashOut(token: string): Promise<Response> {
  return apiResponse("/games/bet/cashout", {
    method: "POST",
    token,
  });
}

describe("game validation E2E", () => {
  test(
    "rejects insufficient funds without changing the low wallet balance",
    async () => {
      await withE2ELock(async () => {
        await ensureStackIsHealthy();
        const token = await getAccessToken();
        const originalWallet = await getWallet(token);
        const bettingRound = await prepareBettingRound(10000);

        try {
          await setWalletBalance(500n);

          const response = await postBet(token, "1000");
          const walletAfterRejection = await getWallet(token);

          expect(response.status).toBe(400);
          expect(BigInt(walletAfterRejection.balanceCents)).toBe(500n);
          expect(BigInt(walletAfterRejection.balanceCents) >= 0n).toBe(true);
        } finally {
          await setWalletBalance(BigInt(originalWallet.balanceCents));
          await forceBettingRoundToStart(bettingRound.id);
          const runningRound = await waitForCurrentStatus("RUNNING");
          await forceRunningRoundToCrash(runningRound.id);
          await waitForRoundStatus(runningRound.id, "SETTLED");
        }
      });
    },
    { timeout: 120000 },
  );

  test(
    "rejects duplicate bet without a second wallet debit",
    async () => {
      await withE2ELock(async () => {
        await ensureStackIsHealthy();
        const token = await getAccessToken();
        const beforeWallet = await getWallet(token);
        const beforeBalance = BigInt(beforeWallet.balanceCents);
        const bettingRound = await prepareBettingRound(10000);

        const acceptedBet = await placeBet(token, "100");
        const duplicateResponse = await postBet(token, "100");
        const afterWallet = await getWallet(token);

        expect(acceptedBet.status).toBe("ACCEPTED");
        expect(duplicateResponse.status).toBe(400);
        expect(BigInt(afterWallet.balanceCents)).toBe(beforeBalance - 100n);
        expect(BigInt(afterWallet.balanceCents) >= 0n).toBe(true);

        await forceBettingRoundToStart(bettingRound.id);
        await waitForCurrentStatus("RUNNING");
        await forceRunningRoundToCrash(bettingRound.id);
        await waitForRoundStatus(bettingRound.id, "SETTLED");
      });
    },
    { timeout: 120000 },
  );

  test(
    "rejects betting while the round is already running",
    async () => {
      await withE2ELock(async () => {
        await ensureStackIsHealthy();
        const token = await getAccessToken();
        const beforeWallet = await getWallet(token);
        const bettingRound = await prepareBettingRound(10000);

        await forceBettingRoundToStart(bettingRound.id);
        await waitForCurrentStatus("RUNNING");

        const response = await postBet(token, "1000");
        const afterWallet = await getWallet(token);

        expect(response.status).toBe(400);
        expect(afterWallet.balanceCents).toBe(beforeWallet.balanceCents);

        await forceRunningRoundToCrash(bettingRound.id);
        await waitForRoundStatus(bettingRound.id, "SETTLED");
      });
    },
    { timeout: 120000 },
  );

  test(
    "rejects cashout without a bet during a running round",
    async () => {
      await withE2ELock(async () => {
        await ensureStackIsHealthy();
        const token = await getAccessToken();
        const beforeWallet = await getWallet(token);
        const bettingRound = await prepareBettingRound(20000);

        await forceBettingRoundToStart(bettingRound.id);
        await waitForCurrentStatus("RUNNING");

        const response = await postCashOut(token);
        const afterWallet = await getWallet(token);

        expect(response.status).toBe(400);
        expect(afterWallet.balanceCents).toBe(beforeWallet.balanceCents);

        await forceRunningRoundToCrash(bettingRound.id);
        await waitForRoundStatus(bettingRound.id, "SETTLED");
      });
    },
    { timeout: 120000 },
  );

  test(
    "rejects cashout outside the running phase",
    async () => {
      await withE2ELock(async () => {
        await ensureStackIsHealthy();
        const token = await getAccessToken();
        const beforeWallet = await getWallet(token);
        const bettingRound = await prepareBettingRound(10000);

        const response = await postCashOut(token);
        const afterWallet = await getWallet(token);

        expect(response.status).toBe(400);
        expect(afterWallet.balanceCents).toBe(beforeWallet.balanceCents);

        await forceBettingRoundToStart(bettingRound.id);
        const runningRound = await waitForCurrentStatus("RUNNING");
        await forceRunningRoundToCrash(runningRound.id);
        await waitForRoundStatus(runningRound.id, "SETTLED");
      });
    },
    { timeout: 120000 },
  );
});
