import { describe, expect, test } from "bun:test";
import { io, type Socket } from "socket.io-client";
import {
  BET_CASHED_OUT_EVENT,
  BET_PLACED_EVENT,
  ROUND_CRASHED_EVENT,
  ROUND_SNAPSHOT_EVENT,
  ROUND_STARTED_EVENT,
  type BetRealtimePayload,
  type RoundLifecyclePayload,
  type RoundSnapshotPayload,
} from "../../src/presentation/realtime/round-realtime.events";
import {
  cashOut,
  ensureStackIsHealthy,
  forceBettingRoundToStart,
  forceRunningRoundToCrash,
  getAccessToken,
  getCurrentRound,
  KONG_BASE_URL,
  placeBet,
  prepareBettingRound,
  waitForRoundStatus,
  withE2ELock,
} from "./e2e-helpers";

type ConnectedRealtimeSocket = {
  socket: Socket;
  snapshot: RoundSnapshotPayload;
};

describe("realtime WebSocket E2E", () => {
  test(
    "connects through Kong and receives an initial round snapshot",
    async () => {
      await withE2ELock(async () => {
        await ensureStackIsHealthy();
        await prepareBettingRound();

        const connection = await connectRealtimeSocket();

        try {
          expect(connection.socket.connected).toBe(true);
          expect(connection.snapshot.emittedAt).toBeString();
          expect(connection.snapshot.round?.roundId).toBeString();
          expect(connection.snapshot.round?.status).toBe("BETTING");
          expect(connection.snapshot.round?.serverSeedHash).toBeString();
          expect(connection.snapshot.round?.serverSeed).toBeNull();
          expect(connection.snapshot.round?.crashPointBp).toBeNull();
        } finally {
          disconnectSockets(connection.socket);
        }
      });
    },
    { timeout: 120000 },
  );

  test(
    "broadcasts lifecycle and bet events to multiple clients while player actions remain REST-only",
    async () => {
      await withE2ELock(async () => {
        await ensureStackIsHealthy();
        const token = await getAccessToken();
        const bettingRound = await prepareBettingRound(30000);
        const connections: ConnectedRealtimeSocket[] = [];

        try {
          const clientA = await connectRealtimeSocket();
          connections.push(clientA);

          const clientB = await connectRealtimeSocket();
          connections.push(clientB);

          expect(clientA.snapshot.round?.roundId).toBe(bettingRound.id);
          expect(clientB.snapshot.round?.roundId).toBe(bettingRound.id);

          clientA.socket.emit("bet", { amountCents: "1000" });
          clientA.socket.emit("bet.cashout");
          await Bun.sleep(500);

          const roundAfterSocketActions = await getCurrentRound();

          expect(roundAfterSocketActions?.id).toBe(bettingRound.id);
          expect(roundAfterSocketActions?.bets).toHaveLength(0);

          const placedOnA = waitForSocketEvent<BetRealtimePayload>(
            clientA.socket,
            BET_PLACED_EVENT,
            (payload) => payload.roundId === bettingRound.id,
          );
          const placedOnB = waitForSocketEvent<BetRealtimePayload>(
            clientB.socket,
            BET_PLACED_EVENT,
            (payload) => payload.roundId === bettingRound.id,
          );
          const bet = await placeBet(token, "1000");
          const [placedPayloadA, placedPayloadB] = await Promise.all([
            placedOnA,
            placedOnB,
          ]);

          expect(placedPayloadA).toMatchObject({
            betId: bet.id,
            roundId: bettingRound.id,
            status: "ACCEPTED",
            amountCents: "1000",
            payoutCents: null,
          });
          expect(placedPayloadB).toMatchObject({
            betId: bet.id,
            roundId: bettingRound.id,
            status: "ACCEPTED",
            amountCents: "1000",
            payoutCents: null,
          });

          const startedOnA = waitForSocketEvent<RoundLifecyclePayload>(
            clientA.socket,
            ROUND_STARTED_EVENT,
            (payload) => payload.roundId === bettingRound.id,
          );
          const startedOnB = waitForSocketEvent<RoundLifecyclePayload>(
            clientB.socket,
            ROUND_STARTED_EVENT,
            (payload) => payload.roundId === bettingRound.id,
          );

          await forceBettingRoundToStart(bettingRound.id);
          const [startedPayloadA, startedPayloadB] = await Promise.all([
            startedOnA,
            startedOnB,
          ]);

          expect(startedPayloadA.status).toBe("RUNNING");
          expect(startedPayloadA.crashPointBp).toBeNull();
          expect(startedPayloadB.status).toBe("RUNNING");
          expect(startedPayloadB.crashPointBp).toBeNull();

          const cashedOutOnA = waitForSocketEvent<BetRealtimePayload>(
            clientA.socket,
            BET_CASHED_OUT_EVENT,
            (payload) => payload.betId === bet.id,
          );
          const cashedOutOnB = waitForSocketEvent<BetRealtimePayload>(
            clientB.socket,
            BET_CASHED_OUT_EVENT,
            (payload) => payload.betId === bet.id,
          );
          const cashedOutBet = await cashOut(token);
          const [cashedOutPayloadA, cashedOutPayloadB] = await Promise.all([
            cashedOutOnA,
            cashedOutOnB,
          ]);

          expect(cashedOutPayloadA).toMatchObject({
            betId: cashedOutBet.id,
            roundId: bettingRound.id,
            status: "CASHED_OUT",
          });
          expect(cashedOutPayloadA.cashoutMultiplierBp).toBeNumber();
          expect(cashedOutPayloadA.payoutCents).not.toBeNull();
          expect(cashedOutPayloadB).toMatchObject({
            betId: cashedOutBet.id,
            roundId: bettingRound.id,
            status: "CASHED_OUT",
          });
          expect(cashedOutPayloadB.cashoutMultiplierBp).toBeNumber();
          expect(cashedOutPayloadB.payoutCents).not.toBeNull();

          const crashedOnA = waitForSocketEvent<RoundLifecyclePayload>(
            clientA.socket,
            ROUND_CRASHED_EVENT,
            (payload) => payload.roundId === bettingRound.id,
          );
          const crashedOnB = waitForSocketEvent<RoundLifecyclePayload>(
            clientB.socket,
            ROUND_CRASHED_EVENT,
            (payload) => payload.roundId === bettingRound.id,
          );

          await forceRunningRoundToCrash(bettingRound.id);
          const [crashedPayloadA, crashedPayloadB] = await Promise.all([
            crashedOnA,
            crashedOnB,
          ]);

          expect(crashedPayloadA.status).toBe("CRASHED");
          expect(crashedPayloadA.crashPointBp).toBeNumber();
          expect(crashedPayloadA.serverSeed).toBeString();
          expect(crashedPayloadB.status).toBe("CRASHED");
          expect(crashedPayloadB.crashPointBp).toBeNumber();
          expect(crashedPayloadB.serverSeed).toBeString();

          await waitForRoundStatus(bettingRound.id, "SETTLED");
        } finally {
          disconnectSockets(...connections.map((connection) => connection.socket));
        }
      });
    },
    { timeout: 120000 },
  );
});

async function connectRealtimeSocket(): Promise<ConnectedRealtimeSocket> {
  const socket = io(`${KONG_BASE_URL}/games`, {
    autoConnect: false,
    path: "/games/socket.io",
    reconnection: false,
    timeout: 5000,
    transports: ["websocket"],
  });
  const connected = waitForSocketConnect(socket);
  const snapshot = waitForSocketEvent<RoundSnapshotPayload>(
    socket,
    ROUND_SNAPSHOT_EVENT,
  );

  socket.connect();

  try {
    await connected;

    return {
      socket,
      snapshot: await snapshot,
    };
  } catch (error) {
    socket.disconnect();
    throw error;
  }
}

function waitForSocketConnect(
  socket: Socket,
  timeoutMs = 10000,
): Promise<void> {
  if (socket.connected) {
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error("Timed out waiting for realtime socket connection"));
    }, timeoutMs);
    const onConnect = (): void => {
      cleanup();
      resolve();
    };
    const onConnectError = (error: Error): void => {
      cleanup();
      reject(
        new Error(`Realtime socket connection failed: ${error.message}`),
      );
    };

    function cleanup(): void {
      clearTimeout(timeout);
      socket.off("connect", onConnect);
      socket.off("connect_error", onConnectError);
    }

    socket.on("connect", onConnect);
    socket.on("connect_error", onConnectError);
  });
}

function waitForSocketEvent<T>(
  socket: Socket,
  event: string,
  predicate: (payload: T) => boolean = () => true,
  timeoutMs = 10000,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error(`Timed out waiting for realtime event ${event}`));
    }, timeoutMs);
    const onEvent = (payload: T): void => {
      try {
        if (!predicate(payload)) {
          return;
        }

        cleanup();
        resolve(payload);
      } catch (error) {
        cleanup();
        reject(error);
      }
    };
    const onConnectError = (error: Error): void => {
      cleanup();
      reject(
        new Error(
          `Realtime socket connection failed while waiting for ${event}: ${error.message}`,
        ),
      );
    };
    const onDisconnect = (reason: string): void => {
      cleanup();
      reject(
        new Error(
          `Realtime socket disconnected while waiting for ${event}: ${reason}`,
        ),
      );
    };

    function cleanup(): void {
      clearTimeout(timeout);
      socket.off(event, onEvent);
      socket.off("connect_error", onConnectError);
      socket.off("disconnect", onDisconnect);
    }

    socket.on(event, onEvent);
    socket.on("connect_error", onConnectError);
    socket.on("disconnect", onDisconnect);
  });
}

function disconnectSockets(...sockets: Socket[]): void {
  for (const socket of sockets) {
    socket.disconnect();
  }
}
