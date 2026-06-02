import { describe, expect, test } from "bun:test";
import { GetCurrentRoundUseCase } from "../../../src/application/use-cases/get-current-round.use-case";
import { Round } from "../../../src/domain/round";
import {
  BET_CASHED_OUT_EVENT,
  BET_PLACED_EVENT,
  GAME_REALTIME_NAMESPACE,
  ROUND_SNAPSHOT_EVENT,
  BetRealtimePayload,
  RoundSnapshotPayload,
} from "../../../src/presentation/realtime/round-realtime.events";
import { RoundRealtimeSerializer } from "../../../src/presentation/realtime/round-realtime.serializer";
import { RoundsGateway } from "../../../src/presentation/realtime/rounds.gateway";

type EmittedEvent = {
  event: string;
  payload: unknown;
};

class FakeSocket {
  public readonly emitted: EmittedEvent[] = [];

  emit(event: string, payload: unknown): void {
    this.emitted.push({ event, payload });
  }
}

class FakeNamespace {
  public readonly emitted: EmittedEvent[] = [];

  emit(event: string, payload: unknown): void {
    this.emitted.push({ event, payload });
  }
}

class FakeGetCurrentRoundUseCase {
  constructor(
    private readonly round: Round | null,
    private readonly error: Error | null = null,
  ) {}

  async execute(): Promise<Round | null> {
    if (this.error) {
      throw this.error;
    }

    return this.round;
  }
}

class FakeGameMetrics {
  public readonly websocketEvents: string[] = [];

  recordWebSocketEvent(event: string): void {
    this.websocketEvents.push(event);
  }
}

class ThrowingGameMetrics extends FakeGameMetrics {
  recordWebSocketEvent(event: string): void {
    super.recordWebSocketEvent(event);
    throw new Error("websocket metrics unavailable");
  }
}

function openRound(): Round {
  const round = Round.openBetting({
    id: "round-1",
    bettingStartsAt: new Date("2026-05-31T10:00:00.000Z"),
    bettingEndsAt: new Date("2026-05-31T10:00:10.000Z"),
    crashPointBp: 25000,
    serverSeedHash: "server-seed-hash",
    clientSeed: "client-seed",
    nonce: 1,
    chainIndex: 7,
    nextServerSeedHash: "next-server-seed-hash",
  });

  round.placeBet({
    id: "bet-1",
    playerId: "player-1",
    username: "player",
    amountCents: 1000n,
  });

  return round;
}

describe("RoundsGateway", () => {
  test("uses the Game namespace expected by Kong-routed clients", () => {
    expect(GAME_REALTIME_NAMESPACE).toBe("/games");
  });

  test("emits the current round snapshot when a client connects", async () => {
    const socket = new FakeSocket();
    const metrics = new FakeGameMetrics();
    const gateway = new RoundsGateway(
      new FakeGetCurrentRoundUseCase(openRound()) as GetCurrentRoundUseCase,
      new RoundRealtimeSerializer(),
      metrics,
    );

    await gateway.handleConnection(socket as never);

    expect(socket.emitted).toHaveLength(1);
    expect(socket.emitted[0]?.event).toBe(ROUND_SNAPSHOT_EVENT);

    const payload = socket.emitted[0]?.payload as RoundSnapshotPayload;
    expect(payload.emittedAt).toBeString();
    expect(payload.round?.id).toBe("round-1");
    expect(payload.round?.status).toBe("BETTING");
    expect(payload.round?.crashPointBp).toBeNull();
    expect(payload.round?.serverSeedHash).toBe("server-seed-hash");
    expect(payload.round?.serverSeed).toBeNull();
    expect(payload.round?.chainIndex).toBe(7);
    expect(payload.round?.bets).toEqual([
      {
        id: "bet-1",
        betId: "bet-1",
        roundId: "round-1",
        playerId: "player-1",
        username: "player",
        amountCents: "1000",
        status: "ACCEPTED",
        autoCashoutMultiplierBp: null,
        cashoutMultiplierBp: null,
        payoutCents: null,
        rejectionReason: null,
      },
    ]);
    expect(metrics.websocketEvents).toEqual([ROUND_SNAPSHOT_EVENT]);
  });

  test("emits an empty snapshot when no round exists yet", async () => {
    const socket = new FakeSocket();
    const gateway = new RoundsGateway(
      new FakeGetCurrentRoundUseCase(null) as GetCurrentRoundUseCase,
      new RoundRealtimeSerializer(),
    );

    await gateway.handleConnection(socket as never);

    const payload = socket.emitted[0]?.payload as RoundSnapshotPayload;
    expect(payload.round).toBeNull();
  });

  test("does not emit a round error when snapshot metrics throw after emit", async () => {
    const socket = new FakeSocket();
    const metrics = new ThrowingGameMetrics();
    const gateway = new RoundsGateway(
      new FakeGetCurrentRoundUseCase(openRound()) as GetCurrentRoundUseCase,
      new RoundRealtimeSerializer(),
      metrics,
    );

    await gateway.handleConnection(socket as never);

    expect(socket.emitted.map((event) => event.event)).toEqual([
      ROUND_SNAPSHOT_EVENT,
    ]);
    expect(metrics.websocketEvents).toEqual([ROUND_SNAPSHOT_EVENT]);
  });

  test("does not record a snapshot event when snapshot loading fails", async () => {
    const socket = new FakeSocket();
    const metrics = new FakeGameMetrics();
    const gateway = new RoundsGateway(
      new FakeGetCurrentRoundUseCase(
        null,
        new Error("snapshot unavailable"),
      ) as GetCurrentRoundUseCase,
      new RoundRealtimeSerializer(),
      metrics,
    );

    await gateway.handleConnection(socket as never);

    expect(socket.emitted[0]?.event).toBe("round.error");
    expect(metrics.websocketEvents).toEqual([]);
  });

  test("emits bet placed and cashed out events with bet payloads", async () => {
    const namespace = new FakeNamespace();
    const metrics = new FakeGameMetrics();
    const gateway = new RoundsGateway(
      new FakeGetCurrentRoundUseCase(null) as GetCurrentRoundUseCase,
      new RoundRealtimeSerializer(),
      metrics,
    );
    (gateway as unknown as { namespace: FakeNamespace }).namespace = namespace;

    const round = openRound();
    const bet = round.bets[0];

    await gateway.publishBetPlaced(bet);

    round.start(new Date("2026-05-31T10:00:10.000Z"));
    bet.cashOut(15000);
    bet.completeCashOut();
    await gateway.publishBetCashedOut(bet);

    expect(namespace.emitted.map((event) => event.event)).toEqual([
      BET_PLACED_EVENT,
      BET_CASHED_OUT_EVENT,
    ]);

    const placedPayload = namespace.emitted[0]?.payload as BetRealtimePayload;
    const cashedOutPayload = namespace.emitted[1]?.payload as BetRealtimePayload;

    expect(placedPayload).toMatchObject({
      betId: "bet-1",
      roundId: "round-1",
      playerId: "player-1",
      username: "player",
      amountCents: "1000",
      status: "ACCEPTED",
      autoCashoutMultiplierBp: null,
      payoutCents: null,
    });
    expect(placedPayload.emittedAt).toBeString();
    expect(cashedOutPayload).toMatchObject({
      betId: "bet-1",
      status: "CASHED_OUT",
      cashoutMultiplierBp: 15000,
      payoutCents: "1500",
    });
    expect(cashedOutPayload.emittedAt).toBeString();
    expect(metrics.websocketEvents).toEqual([
      BET_PLACED_EVENT,
      BET_CASHED_OUT_EVENT,
    ]);
  });
});
