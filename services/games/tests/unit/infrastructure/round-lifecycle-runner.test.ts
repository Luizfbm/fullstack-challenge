import { describe, expect, test } from "bun:test";
import type { RoundEventsPublisher } from "../../../src/application/ports/round-events.publisher";
import { AdvanceRoundLifecycleUseCase } from "../../../src/application/use-cases/advance-round-lifecycle.use-case";
import type { AdvanceRoundLifecycleResult } from "../../../src/application/use-cases/advance-round-lifecycle.types";
import { Round } from "../../../src/domain/round";
import { RoundLifecycleRunner } from "../../../src/infrastructure/lifecycle/round-lifecycle-runner";

class FakeAdvanceRoundLifecycleUseCase {
  constructor(private readonly result: AdvanceRoundLifecycleResult) {}

  async execute(): Promise<AdvanceRoundLifecycleResult> {
    return this.result;
  }
}

class FakeRoundEventsPublisher implements RoundEventsPublisher {
  public readonly events: string[] = [];

  async publishBettingStarted(): Promise<void> {
    this.events.push("round.betting_started");
  }

  async publishStarted(): Promise<void> {
    this.events.push("round.started");
  }

  async publishTick(): Promise<void> {
    this.events.push("round.tick");
  }

  async publishCrashed(): Promise<void> {
    this.events.push("round.crashed");
  }

  async publishSettled(): Promise<void> {
    this.events.push("round.settled");
  }
}

function openRound(): Round {
  return Round.openBetting({
    id: "round-1",
    bettingStartsAt: new Date("2026-05-31T10:00:00.000Z"),
    bettingEndsAt: new Date("2026-05-31T10:00:10.000Z"),
    crashPointBp: 30000,
    serverSeedHash: "server-seed-hash",
    clientSeed: "client-seed",
    nonce: 1,
    chainIndex: 1,
  });
}

async function runOnce(
  result: AdvanceRoundLifecycleResult,
): Promise<FakeRoundEventsPublisher> {
  const publisher = new FakeRoundEventsPublisher();
  const runner = new RoundLifecycleRunner(
    new FakeAdvanceRoundLifecycleUseCase(
      result,
    ) as unknown as AdvanceRoundLifecycleUseCase,
    60000,
    publisher,
  );

  await runner.onModuleInit();
  runner.onModuleDestroy();

  return publisher;
}

describe("RoundLifecycleRunner realtime events", () => {
  test("publishes betting started when a round opens", async () => {
    const publisher = await runOnce({
      action: "ROUND_OPENED",
      round: openRound(),
    });

    expect(publisher.events).toEqual(["round.betting_started"]);
  });

  test("publishes started, crashed and settled lifecycle transitions", async () => {
    const runningRound = openRound();
    runningRound.start(new Date("2026-05-31T10:00:10.000Z"));

    const crashedRound = openRound();
    crashedRound.start(new Date("2026-05-31T10:00:10.000Z"));
    crashedRound.crash(new Date("2026-05-31T10:00:12.000Z"), "server-seed");

    const settledRound = openRound();
    settledRound.start(new Date("2026-05-31T10:00:10.000Z"));
    settledRound.crash(new Date("2026-05-31T10:00:12.000Z"), "server-seed");
    settledRound.settle();

    await expect(
      runOnce({ action: "ROUND_STARTED", round: runningRound }),
    ).resolves.toHaveProperty("events", ["round.started"]);
    await expect(
      runOnce({ action: "ROUND_CRASHED", round: crashedRound }),
    ).resolves.toHaveProperty("events", ["round.crashed"]);
    await expect(
      runOnce({ action: "ROUND_SETTLED", round: settledRound }),
    ).resolves.toHaveProperty("events", ["round.settled"]);
  });

  test("publishes ticks only while a round is running", async () => {
    const bettingPublisher = await runOnce({
      action: "NOOP",
      round: openRound(),
    });

    const runningRound = openRound();
    runningRound.start(new Date("2026-05-31T10:00:10.000Z"));

    const runningPublisher = await runOnce({
      action: "NOOP",
      round: runningRound,
    });

    expect(bettingPublisher.events).toEqual([]);
    expect(runningPublisher.events).toEqual(["round.tick"]);
  });
});
