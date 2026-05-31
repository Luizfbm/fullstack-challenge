import { describe, expect, it } from "vitest";
import { GameRealtimeClient } from "./game-realtime-client";
import { gameRealtimeConfig, gameRealtimeEvents } from "./realtime-events";

describe("GameRealtimeClient", () => {
  it("connects to the Game namespace through the Kong Socket.IO path", () => {
    const socket = new FakeSocket();
    const client = new GameRealtimeClient({
      apiBaseUrl: "http://localhost:8000",
      socketFactory: (url, options) => {
        expect(url).toBe("http://localhost:8000/games");
        expect(options).toEqual({
          autoConnect: false,
          path: gameRealtimeConfig.path,
          reconnection: true,
          transports: ["websocket"],
        });

        return socket;
      },
    });

    const disconnect = client.connect({
      onBetCashedOut: () => {},
      onBetPlaced: () => {},
      onConnected: () => {},
      onConnectionError: () => {},
      onDisconnected: () => {},
      onRoundEvent: () => {},
      onSnapshot: () => {},
    });

    expect(socket.connected).toBe(true);
    expect(socket.events).toContain(gameRealtimeEvents.roundSnapshot);
    expect(socket.events).toContain(gameRealtimeEvents.roundTick);

    disconnect();

    expect(socket.connected).toBe(false);
    expect(socket.events).toEqual([]);
  });
});

class FakeSocket {
  connected = false;
  readonly listeners = new Map<string, (...args: unknown[]) => void>();

  get events() {
    return [...this.listeners.keys()];
  }

  connect() {
    this.connected = true;
  }

  disconnect() {
    this.connected = false;
  }

  off(event: string) {
    this.listeners.delete(event);
  }

  on(event: string, listener: (...args: unknown[]) => void) {
    this.listeners.set(event, listener);
  }
}
