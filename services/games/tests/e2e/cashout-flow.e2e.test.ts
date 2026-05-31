import { describe, expect, test } from "bun:test";
import {
  cashOut,
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

describe("cashout E2E", () => {
  test(
    "places a bet, cashes out, updates wallet, settles the round and remains provably fair",
    async () => {
      await withE2ELock(async () => {
        await ensureStackIsHealthy();
        const token = await getAccessToken();
        const beforeWallet = await getWallet(token);
        const beforeBalance = BigInt(beforeWallet.balanceCents);
        const bettingRound = await prepareBettingRound();

        const bet = await placeBet(token, "1000");

        expect(bet.roundId).toBe(bettingRound.id);
        expect(bet.status).toBe("ACCEPTED");
        expect(bet.amountCents).toBe("1000");

        await forceBettingRoundToStart(bettingRound.id);
        await waitForCurrentStatus("RUNNING");

        const cashedOutBet = await cashOut(token);

        expect(cashedOutBet.id).toBe(bet.id);
        expect(cashedOutBet.status).toBe("CASHED_OUT");
        expect(cashedOutBet.payoutCents).not.toBeNull();

        const payoutCents = BigInt(cashedOutBet.payoutCents ?? "0");
        const afterWallet = await getWallet(token);
        const expectedBalance = beforeBalance - 1000n + payoutCents;

        expect(BigInt(afterWallet.balanceCents)).toBe(expectedBalance);

        const latestBet = (await listMyBets(token, 1))[0];

        expect(latestBet?.id).toBe(bet.id);
        expect(latestBet?.status).toBe("CASHED_OUT");

        await forceRunningRoundToCrash(bettingRound.id);
        await waitForRoundStatus(bettingRound.id, "SETTLED");

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
