import { describe, expect, test } from "bun:test";
import {
  DETERMINISTIC_ROUND_FIXTURES,
  ensureStackIsHealthy,
  getRoundCrashPointBp,
  prepareDeterministicRound,
  verifyRound,
  withE2ELock,
} from "./e2e-helpers";

describe("deterministic seed E2E fixtures", () => {
  test(
    "prepares reproducible clean and fast-crash betting rounds",
    async () => {
      await withE2ELock(async () => {
        await ensureStackIsHealthy();

        const cleanRound = await prepareDeterministicRound("clean-betting");
        const cleanFixture = DETERMINISTIC_ROUND_FIXTURES["clean-betting"];

        expect(cleanRound.chainIndex).toBe(cleanFixture.chainIndex);
        expect(cleanRound.status).toBe("BETTING");
        expect(cleanRound.bets).toEqual([]);
        expect(cleanRound.crashPointBp).toBeNull();
        expect(await getRoundCrashPointBp(cleanRound.id)).toBe(
          cleanFixture.crashPointBp,
        );

        const cleanVerification = await verifyRound(cleanRound.id);

        expect(cleanVerification.revealed).toBe(false);
        expect(cleanVerification.crashPointBp).toBeNull();

        const fastCrashRound = await prepareDeterministicRound("fast-crash");
        const fastCrashFixture = DETERMINISTIC_ROUND_FIXTURES["fast-crash"];

        expect(fastCrashRound.chainIndex).toBe(fastCrashFixture.chainIndex);
        expect(fastCrashRound.status).toBe("BETTING");
        expect(fastCrashRound.bets).toEqual([]);
        expect(await getRoundCrashPointBp(fastCrashRound.id)).toBe(
          fastCrashFixture.crashPointBp,
        );
      });
    },
    { timeout: 120000 },
  );
});
