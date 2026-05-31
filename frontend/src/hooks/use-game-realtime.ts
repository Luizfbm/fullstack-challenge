import { useEffect } from "react";
import type { RoundResponse } from "../services/game-api";
import { gameRealtimeClient } from "../services/game-realtime-client";
import { useGameRealtimeStore } from "../stores/game-realtime-store";

export function useGameRealtime(restRound: RoundResponse | null) {
  const realtimeState = useGameRealtimeStore();

  useEffect(() => {
    const store = useGameRealtimeStore.getState();

    store.markConnecting();

    return gameRealtimeClient.connect({
      onBetCashedOut: store.applyBetEvent,
      onBetPlaced: store.applyBetEvent,
      onConnected: store.markConnected,
      onConnectionError: store.markError,
      onDisconnected: store.markDisconnected,
      onRoundEvent: store.applyRoundEvent,
      onSnapshot: store.applySnapshot,
    });
  }, []);

  useEffect(() => {
    useGameRealtimeStore.getState().hydrateFromRest(restRound);
  }, [restRound]);

  return realtimeState;
}
