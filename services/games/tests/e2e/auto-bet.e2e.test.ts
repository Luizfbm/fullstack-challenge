import { describe, expect, test } from "bun:test";
import {
  ensureStackIsHealthy,
  forceBettingRoundToStart,
  forceRunningRoundToCrash,
  getAccessToken,
  getCurrentRound,
  getMyAutoBetSession,
  listMyBets,
  prepareDeterministicRound,
  startAutoBetSession,
  stopAutoBetSession,
  waitFor,
  waitForCurrentRound,
  waitForCurrentStatus,
  waitForRoundStatus,
  withE2ELock,
} from "./e2e-helpers";

describe("auto bet E2E", () => {
  test(
    "persists an auto bet session and starts betting only on the next round",
    async () => {
      await withE2ELock(async () => {
        await ensureStackIsHealthy();
        const token = await getAccessToken();
        const firstRound = await prepareDeterministicRound("clean-betting");

        const session = await startAutoBetSession(token, {
          amountCents: "1000",
          autoCashoutMultiplierBp: 15000,
          maxRounds: 1,
        });

        expect(session.status).toBe("ACTIVE");
        expect(session.amountCents).toBe("1000");
        expect(session.autoCashoutMultiplierBp).toBe(15000);
        expect(session.maxRounds).toBe(1);
        expect(session.roundsPlayed).toBe(0);
        expect(session.startsAfterRoundId).toBe(firstRound.id);

        const unchangedFirstRound = await getCurrentRound();

        expect(unchangedFirstRound?.id).toBe(firstRound.id);
        expect(unchangedFirstRound?.bets).toEqual([]);

        await forceBettingRoundToStart(firstRound.id);
        await waitForCurrentStatus("RUNNING");
        await forceRunningRoundToCrash(firstRound.id);
        await waitForRoundStatus(firstRound.id, "SETTLED");

        const nextRound = await waitFor(async () => {
          const round = await waitForCurrentRound();

          return round.id !== firstRound.id && round.status === "BETTING"
            ? round
            : null;
        }, "next betting round after auto bet start");

        const autoBet = await waitFor(async () => {
          const [latestBet] = await listMyBets(token, 1);

          return latestBet?.roundId === nextRound.id ? latestBet : null;
        }, "auto bet placement on next round");

        expect(autoBet.status).toBe("ACCEPTED");
        expect(autoBet.amountCents).toBe("1000");
        expect(autoBet.autoCashoutMultiplierBp).toBe(15000);

        const stoppedSession = await waitFor(async () => {
          const latestSession = await getMyAutoBetSession(token);

          return latestSession?.status === "STOPPED" ? latestSession : null;
        }, "auto bet session stopped after maxRounds");

        expect(stoppedSession.id).toBe(session.id);
        expect(stoppedSession.roundsPlayed).toBe(1);
        expect(stoppedSession.stopReason).toBe("MAX_ROUNDS_REACHED");
      });
    },
    { timeout: 120000 },
  );

  test(
    "progresses martingale stake after a lost automatic bet",
    async () => {
      await withE2ELock(async () => {
        await ensureStackIsHealthy();
        const token = await getAccessToken();
        const firstRound = await prepareDeterministicRound("clean-betting");

        const session = await startAutoBetSession(token, {
          amountCents: "1000",
          martingaleMaxSteps: 3,
          martingaleMultiplier: 2,
          maxRounds: 3,
          strategy: "MARTINGALE",
        });

        expect(session.strategy).toBe("MARTINGALE");
        expect(session.amountCents).toBe("1000");
        expect(session.nextAmountCents).toBe("1000");
        expect(session.martingaleCurrentStep).toBe(0);

        await forceBettingRoundToStart(firstRound.id);
        await waitForCurrentStatus("RUNNING");
        await forceRunningRoundToCrash(firstRound.id);
        await waitForRoundStatus(firstRound.id, "SETTLED");

        const firstAutoBetRound = await waitFor(async () => {
          const round = await waitForCurrentRound();

          return round.id !== firstRound.id && round.status === "BETTING"
            ? round
            : null;
        }, "first martingale betting round");

        const firstAutoBet = await waitFor(async () => {
          const [latestBet] = await listMyBets(token, 1);

          return latestBet?.roundId === firstAutoBetRound.id ? latestBet : null;
        }, "first martingale auto bet");

        expect(firstAutoBet.amountCents).toBe("1000");

        await forceBettingRoundToStart(firstAutoBetRound.id);
        await waitForCurrentStatus("RUNNING");
        await forceRunningRoundToCrash(firstAutoBetRound.id);
        await waitForRoundStatus(firstAutoBetRound.id, "SETTLED");

        const progressedSession = await waitFor(async () => {
          const latestSession = await getMyAutoBetSession(token);

          return latestSession?.nextAmountCents === "2000"
            ? latestSession
            : null;
        }, "martingale session progressed after loss");

        expect(progressedSession.martingaleCurrentStep).toBe(1);
        expect(progressedSession.netProfitCents).toBe("-1000");

        const secondAutoBetRound = await waitFor(async () => {
          const round = await waitForCurrentRound();

          return round.id !== firstAutoBetRound.id && round.status === "BETTING"
            ? round
            : null;
        }, "second martingale betting round");

        const secondAutoBet = await waitFor(async () => {
          const [latestBet] = await listMyBets(token, 1);

          return latestBet?.roundId === secondAutoBetRound.id ? latestBet : null;
        }, "second martingale auto bet");

        expect(secondAutoBet.amountCents).toBe("2000");

        const stoppedSession = await stopAutoBetSession(token);

        expect(stoppedSession?.id).toBe(session.id);
        expect(stoppedSession?.status).toBe("STOPPED");
        expect(stoppedSession?.stopReason).toBe("MANUAL");

        await forceBettingRoundToStart(secondAutoBetRound.id);
        await waitForCurrentStatus("RUNNING");
        await forceRunningRoundToCrash(secondAutoBetRound.id);
        await waitForRoundStatus(secondAutoBetRound.id, "SETTLED");
      });
    },
    { timeout: 120000 },
  );
});
