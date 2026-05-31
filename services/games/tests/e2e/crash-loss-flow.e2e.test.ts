import { describe, expect, test } from "bun:test";
import {
  ensureStackIsHealthy,
  forceBettingRoundToStart,
  forceRunningRoundToCrash,
  getAccessToken,
  getWallet,
  listMyBets,
  placeBet,
  prepareBettingRound,
  verifyRound,
  waitForCurrentStatus,
  waitForRoundStatus,
  withE2ELock,
} from "./e2e-helpers";

describe("crash loss E2E", () => {
  test(
    "places a bet, skips cashout, loses at crash and keeps provably fair verification",
    async () => {
      await withE2ELock(async () => {
        await ensureStackIsHealthy();
        const token = await getAccessToken();
        const beforeWallet = await getWallet(token);
        const beforeBalance = BigInt(beforeWallet.balanceCents);
        const bettingRound = await prepareBettingRound(10000);

        const bet = await placeBet(token, "1000");

        expect(bet.roundId).toBe(bettingRound.id);
        expect(bet.status).toBe("ACCEPTED");

        await forceBettingRoundToStart(bettingRound.id);
        await waitForCurrentStatus("RUNNING");
        await forceRunningRoundToCrash(bettingRound.id);
        await waitForRoundStatus(bettingRound.id, "SETTLED");

        const latestBet = (await listMyBets(token, 1))[0];

        expect(latestBet?.id).toBe(bet.id);
        expect(latestBet?.status).toBe("LOST");
        expect(latestBet?.payoutCents).toBeNull();

        const afterWallet = await getWallet(token);

        expect(BigInt(afterWallet.balanceCents)).toBe(beforeBalance - 1000n);

        const verification = await verifyRound(bettingRound.id);

        expect(verification.status).toBe("SETTLED");
        expect(verification.revealed).toBe(true);
        expect(verification.serverSeedMatchesCommitment).toBe(true);
        expect(verification.fair).toBe(true);
      });
    },
    { timeout: 120000 },
  );
});
