// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { PropsWithChildren } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  useMyAutoBetSessionQuery,
  useStartAutoBetSessionMutation,
  useStopAutoBetSessionMutation,
} from "./use-game-rest";

const apiMocks = vi.hoisted(() => ({
  getMyAutoBetSession: vi.fn(),
  startAutoBetSession: vi.fn(),
  stopAutoBetSession: vi.fn(),
}));

vi.mock("../services/game-api", () => ({
  gameApi: {
    getMyAutoBetSession: apiMocks.getMyAutoBetSession,
    startAutoBetSession: apiMocks.startAutoBetSession,
    stopAutoBetSession: apiMocks.stopAutoBetSession,
  },
}));

describe("use-game-rest auto bet hooks", () => {
  beforeEach(() => {
    apiMocks.getMyAutoBetSession.mockReset();
    apiMocks.startAutoBetSession.mockReset();
    apiMocks.stopAutoBetSession.mockReset();
  });

  it("loads the authenticated player's auto bet session", async () => {
    apiMocks.getMyAutoBetSession.mockResolvedValue({
      id: "auto-session-1",
      status: "ACTIVE",
    });

    const { result } = renderHook(() => useMyAutoBetSessionQuery(true), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.data).toMatchObject({ id: "auto-session-1" });
    });
    expect(apiMocks.getMyAutoBetSession).toHaveBeenCalledOnce();
  });

  it("starts and stops auto bet sessions through mutations", async () => {
    apiMocks.startAutoBetSession.mockResolvedValue({ id: "auto-session-1" });
    apiMocks.stopAutoBetSession.mockResolvedValue({
      id: "auto-session-1",
      status: "STOPPED",
    });

    const { result: startResult } = renderHook(
      () => useStartAutoBetSessionMutation(),
      { wrapper: createWrapper() },
    );

    startResult.current.mutate({
      amountCents: "1000",
      maxRounds: 5,
      stopLossCents: "3000",
      takeProfitCents: "5000",
    });

    await waitFor(() => {
      expect(apiMocks.startAutoBetSession).toHaveBeenCalledWith({
        amountCents: "1000",
        maxRounds: 5,
        stopLossCents: "3000",
        takeProfitCents: "5000",
      });
    });

    const { result: stopResult } = renderHook(
      () => useStopAutoBetSessionMutation(),
      { wrapper: createWrapper() },
    );

    stopResult.current.mutate();

    await waitFor(() => {
      expect(apiMocks.stopAutoBetSession).toHaveBeenCalledOnce();
    });
  });
});

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  return function Wrapper({ children }: PropsWithChildren) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  };
}
