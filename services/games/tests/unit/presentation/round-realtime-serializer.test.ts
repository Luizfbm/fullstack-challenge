import { describe, expect, test } from "bun:test";
import { Bet } from "../../../src/domain/bet";
import { Round } from "../../../src/domain/round";
import { RoundRealtimeSerializer } from "../../../src/presentation/realtime/round-realtime.serializer";

function runningRound(): Round {
  const round = Round.openBetting({
    id: "round-1",
    bettingStartsAt: new Date("2026-05-31T10:00:00.000Z"),
    bettingEndsAt: new Date("2026-05-31T10:00:10.000Z"),
    crashPointBp: 30000,
    serverSeedHash: "server-seed-hash",
    clientSeed: "client-seed",
    nonce: 1,
    chainIndex: 1,
    nextServerSeedHash: "next-seed-hash",
  });
  round.start(new Date("2026-05-31T10:00:10.000Z"));

  return round;
}

describe("RoundRealtimeSerializer", () => {
  test("keeps crash point and server seed hidden before reveal", () => {
    const serializer = new RoundRealtimeSerializer();

    const payload = serializer.toLifecyclePayload(
      runningRound(),
      new Date("2026-05-31T10:00:15.000Z"),
    );

    expect(payload.roundId).toBe("round-1");
    expect(payload.currentMultiplierBp).toBe(12840);
    expect(payload.crashPointBp).toBeNull();
    expect(payload.multiplierCurve).toBe("EXPONENTIAL");
    expect(payload.multiplierBaseBp).toBe(10000);
    expect(payload.multiplierGrowthRateBpPerSecond).toBe(500);
    expect(payload.serverSeed).toBeNull();
    expect(payload.serverSeedHash).toBe("server-seed-hash");
    expect(payload.nextServerSeedHash).toBe("next-seed-hash");
    expect(payload.emittedAt).toBe("2026-05-31T10:00:15.000Z");
  });

  test("reveals crash point and server seed after crash", () => {
    const serializer = new RoundRealtimeSerializer();
    const round = runningRound();
    round.crash(new Date("2026-05-31T10:00:20.000Z"), "server-seed");

    const payload = serializer.toLifecyclePayload(
      round,
      new Date("2026-05-31T10:00:20.000Z"),
    );

    expect(payload.status).toBe("CRASHED");
    expect(payload.crashPointBp).toBe(30000);
    expect(payload.serverSeed).toBe("server-seed");
    expect(payload.chainIndex).toBe(1);
    expect(payload.nonce).toBe(1);
  });

  test("serializes bet realtime payload with betId and monetary strings", () => {
    const serializer = new RoundRealtimeSerializer();
    const bet = Bet.accepted({
      id: "bet-1",
      roundId: "round-1",
      playerId: "player-1",
      username: "player",
      amountCents: 1000n,
      autoCashoutMultiplierBp: 20000,
    });

    const payload = serializer.toBetRealtimePayload(
      bet,
      new Date("2026-05-31T10:00:20.000Z"),
    );

    expect(payload).toEqual({
      id: "bet-1",
      betId: "bet-1",
      roundId: "round-1",
      playerId: "player-1",
      username: "player",
      amountCents: "1000",
      status: "ACCEPTED",
      autoCashoutMultiplierBp: 20000,
      cashoutMultiplierBp: null,
      payoutCents: null,
      rejectionReason: null,
      emittedAt: "2026-05-31T10:00:20.000Z",
    });
  });
});
