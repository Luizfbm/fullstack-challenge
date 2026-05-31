import { describe, expect, test } from "bun:test";
import { GetCurrentRoundUseCase } from "../../../src/application/use-cases/get-current-round.use-case";
import { Round } from "../../../src/domain/round";
import {
  GAME_REALTIME_NAMESPACE,
  ROUND_SNAPSHOT_EVENT,
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

class FakeGetCurrentRoundUseCase {
  constructor(private readonly round: Round | null) {}

  async execute(): Promise<Round | null> {
    return this.round;
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
    const gateway = new RoundsGateway(
      new FakeGetCurrentRoundUseCase(openRound()) as GetCurrentRoundUseCase,
      new RoundRealtimeSerializer(),
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
        roundId: "round-1",
        playerId: "player-1",
        username: "player",
        amountCents: "1000",
        status: "ACCEPTED",
        cashoutMultiplierBp: null,
        payoutCents: null,
        rejectionReason: null,
      },
    ]);
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
});
