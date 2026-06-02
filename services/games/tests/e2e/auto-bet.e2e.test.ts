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
});
