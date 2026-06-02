// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { RoundResponse } from "../../services/game-api";
import { RoundHistoryPanel } from "./arcade-tab-panels";

describe("RoundHistoryPanel", () => {
  afterEach(() => {
    cleanup();
  });

  it("lets players drag the history rail with the left mouse button", () => {
    render(
      <RoundHistoryPanel
        history={[
          createRound({ crashPointBp: 12000, id: "round-1" }),
          createRound({ crashPointBp: 25000, id: "round-2" }),
        ]}
        isLoading={false}
      />,
    );

    const track = screen.getByTestId("round-history-track");

    track.scrollLeft = 50;

    fireEvent.pointerDown(track, {
      button: 0,
      clientX: 100,
      pointerId: 1,
      pointerType: "mouse",
    });
    fireEvent.pointerMove(track, {
      clientX: 40,
      pointerId: 1,
      pointerType: "mouse",
    });

    expect(track.scrollLeft).toBe(110);
    expect(track.getAttribute("data-dragging")).toBe("true");

    fireEvent.pointerUp(track, {
      pointerId: 1,
      pointerType: "mouse",
    });

    expect(track.getAttribute("data-dragging")).toBe("false");
  });
});

function createRound(overrides: Partial<RoundResponse> = {}): RoundResponse {
  return {
    bets: [],
    bettingEndsAt: "2026-06-02T19:00:05.000Z",
    bettingStartsAt: "2026-06-02T19:00:00.000Z",
    chainIndex: 1,
    clientSeed: "client-seed",
    crashedAt: "2026-06-02T19:00:12.000Z",
    crashPointBp: 20000,
    id: "round",
    multiplierBaseBp: 10000,
    multiplierCurve: "EXPONENTIAL",
    multiplierGrowthRateBpPerSecond: 500,
    nextServerSeedHash: null,
    nonce: 1,
    serverSeed: "server-seed",
    serverSeedHash: "server-seed-hash",
    startedAt: "2026-06-02T19:00:05.000Z",
    status: "SETTLED",
    ...overrides,
  };
}
