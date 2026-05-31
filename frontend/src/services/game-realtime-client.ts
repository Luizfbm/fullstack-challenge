import { io } from "socket.io-client";
import { appConfig } from "../app/config";
import {
  gameRealtimeConfig,
  gameRealtimeEvents,
  type BetRealtimePayload,
  type RoundLifecyclePayload,
  type RoundSnapshotPayload,
} from "./realtime-events";

type SocketLike = {
  connect: () => void;
  disconnect: () => void;
  off: (event: string, listener: (...args: unknown[]) => void) => void;
  on: (event: string, listener: (...args: unknown[]) => void) => void;
};

type SocketOptions = {
  autoConnect: boolean;
  path: string;
  reconnection: boolean;
  transports: ["websocket"];
};

type SocketFactory = (url: string, options: SocketOptions) => SocketLike;

export type GameRealtimeHandlers = {
  onBetCashedOut: (payload: BetRealtimePayload) => void;
  onBetPlaced: (payload: BetRealtimePayload) => void;
  onConnected: () => void;
  onConnectionError: (message: string) => void;
  onDisconnected: () => void;
  onRoundEvent: (payload: RoundLifecyclePayload) => void;
  onSnapshot: (payload: RoundSnapshotPayload) => void;
};

type GameRealtimeClientOptions = {
  apiBaseUrl?: string;
  socketFactory?: SocketFactory;
};

export class GameRealtimeClient {
  private readonly apiBaseUrl: string;
  private readonly socketFactory: SocketFactory;
  private socket: SocketLike | null = null;

  constructor(options: GameRealtimeClientOptions = {}) {
    this.apiBaseUrl = options.apiBaseUrl ?? appConfig.apiBaseUrl;
    this.socketFactory = options.socketFactory ?? defaultSocketFactory;
  }

  connect(handlers: GameRealtimeHandlers): () => void {
    this.disconnect();

    const socket = this.socketFactory(
      `${this.apiBaseUrl}${gameRealtimeConfig.namespace}`,
      {
        autoConnect: false,
        path: gameRealtimeConfig.path,
        reconnection: true,
        transports: ["websocket"],
      },
    );
    const listeners = this.createListeners(handlers);

    for (const [event, listener] of listeners) {
      socket.on(event, listener);
    }

    socket.connect();
    this.socket = socket;

    return () => {
      for (const [event, listener] of listeners) {
        socket.off(event, listener);
      }
      socket.disconnect();

      if (this.socket === socket) {
        this.socket = null;
      }
    };
  }

  disconnect(): void {
    this.socket?.disconnect();
    this.socket = null;
  }

  private createListeners(
    handlers: GameRealtimeHandlers,
  ): Array<[string, (...args: unknown[]) => void]> {
    return [
      ["connect", handlers.onConnected as (...args: unknown[]) => void],
      ["disconnect", handlers.onDisconnected as (...args: unknown[]) => void],
      [
        "connect_error",
        ((error: Error) => handlers.onConnectionError(error.message)) as (
          ...args: unknown[]
        ) => void,
      ],
      [
        gameRealtimeEvents.roundSnapshot,
        handlers.onSnapshot as (...args: unknown[]) => void,
      ],
      [
        gameRealtimeEvents.roundBettingStarted,
        handlers.onRoundEvent as (...args: unknown[]) => void,
      ],
      [
        gameRealtimeEvents.roundStarted,
        handlers.onRoundEvent as (...args: unknown[]) => void,
      ],
      [
        gameRealtimeEvents.roundTick,
        handlers.onRoundEvent as (...args: unknown[]) => void,
      ],
      [
        gameRealtimeEvents.roundCrashed,
        handlers.onRoundEvent as (...args: unknown[]) => void,
      ],
      [
        gameRealtimeEvents.roundSettled,
        handlers.onRoundEvent as (...args: unknown[]) => void,
      ],
      [
        gameRealtimeEvents.betPlaced,
        handlers.onBetPlaced as (...args: unknown[]) => void,
      ],
      [
        gameRealtimeEvents.betCashedOut,
        handlers.onBetCashedOut as (...args: unknown[]) => void,
      ],
    ];
  }
}

export const gameRealtimeClient = new GameRealtimeClient();

function defaultSocketFactory(url: string, options: SocketOptions): SocketLike {
  return io(url, options);
}
