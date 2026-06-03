// @vitest-environment jsdom

import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ChronoStage } from "./chrono-stage";
import type { DashboardRound } from "./round-formatting";

const chronoStageTestState = vi.hoisted(() => ({
  scenePhases: [] as string[],
}));

vi.mock("./crash-flight-scene", () => ({
  CrashFlightScene: ({ animationPhase }: { animationPhase: string }) => {
    chronoStageTestState.scenePhases.push(animationPhase);

    return (
      <canvas
        data-animation-phase={animationPhase}
        data-testid="crash-flight-canvas"
      />
    );
  },
}));

vi.mock("@number-flow/react", () => ({
  default: ({ value }: { value: number }) => (
    <span data-testid="betting-countdown-number">{value}</span>
  ),
}));

describe("ChronoStage", () => {
  afterEach(() => {
    cleanup();
    chronoStageTestState.scenePhases.length = 0;
    vi.useRealTimers();
  });

  it("shows a central countdown while betting", () => {
    render(
      <ChronoStage
        isLoading={false}
        now={new Date("2026-06-02T12:00:04.000Z")}
        round={roundFixture({
          bettingEndsAt: "2026-06-02T12:00:10.000Z",
          bettingStartsAt: "2026-06-02T12:00:00.000Z",
          status: "BETTING",
        })}
      />,
    );

    expect(screen.getByTestId("stage-multiplier-value").textContent).toBe(
      "6",
    );
    expect(screen.getByTestId("betting-countdown-number").textContent).toBe(
      "6",
    );
    expect(screen.getByText("Rodada inicia em")).toBeTruthy();
    expect(screen.queryByText("Multiplicador atual")).toBeNull();
    expect(screen.queryByText("6s")).toBeNull();
  });

  it("keeps the betting countdown at zero after the betting window closes", () => {
    render(
      <ChronoStage
        isLoading={false}
        now={new Date("2026-06-02T12:00:12.000Z")}
        round={roundFixture({
          bettingEndsAt: "2026-06-02T12:00:10.000Z",
          bettingStartsAt: "2026-06-02T12:00:00.000Z",
          status: "BETTING",
        })}
      />,
    );

    expect(screen.getByTestId("stage-multiplier-value").textContent).toBe(
      "0",
    );
    expect(screen.queryByText("0s")).toBeNull();
  });

  it("renders the stage without the old flight-line overlay", () => {
    render(
      <ChronoStage
        isLoading={false}
        now={new Date("2026-06-02T12:00:00.000Z")}
        round={{ currentMultiplierBp: 15700, status: "RUNNING" } as DashboardRound}
      />,
    );

    expect(screen.getByTestId("chrono-stage")).toBeTruthy();
    expect(screen.queryByTestId("chrono-stage-curve")).toBeNull();
  });

  it("uses a responsive stage height instead of a desktop-only minimum", () => {
    render(
      <ChronoStage
        isLoading={false}
        now={new Date("2026-06-02T12:00:00.000Z")}
        round={{ currentMultiplierBp: 15700, status: "RUNNING" } as DashboardRound}
      />,
    );

    const stageClassName = screen.getByTestId("chrono-stage").className;

    expect(stageClassName).toContain("h-[clamp(18rem,72vw,34rem)]");
    expect(stageClassName).not.toContain("min-h-[34rem]");
  });

  it("keeps the portal entry phase short when betting turns into running", () => {
    vi.useFakeTimers();

    const { rerender } = render(
      <ChronoStage
        isLoading={false}
        now={new Date("2026-06-02T12:00:09.900Z")}
        round={roundFixture({
          status: "BETTING",
        })}
      />,
    );

    expect(
      screen
        .getByTestId("crash-flight-canvas")
        .getAttribute("data-animation-phase"),
    ).toBe("betting");

    rerender(
      <ChronoStage
        isLoading={false}
        now={new Date("2026-06-02T12:00:10.000Z")}
        round={roundFixture({
          currentMultiplierBp: 10000,
          startedAt: "2026-06-02T12:00:10.000Z",
          status: "RUNNING",
        })}
      />,
    );

    expect(
      screen
        .getByTestId("crash-flight-canvas")
        .getAttribute("data-animation-phase"),
    ).toBe("entering");

    act(() => {
      vi.advanceTimersByTime(899);
    });

    expect(
      screen
        .getByTestId("crash-flight-canvas")
        .getAttribute("data-animation-phase"),
    ).toBe("entering");

    act(() => {
      vi.advanceTimersByTime(1);
    });

    expect(
      screen
        .getByTestId("crash-flight-canvas")
        .getAttribute("data-animation-phase"),
    ).toBe("running");
    expect(chronoStageTestState.scenePhases).toEqual(
      expect.arrayContaining(["betting", "entering", "running"]),
    );
  });

  it("keeps the stage chrome clean and centers the multiplier over the scene", () => {
    render(
      <ChronoStage
        isLoading={false}
        now={new Date("2026-06-02T12:00:00.000Z")}
        round={{ currentMultiplierBp: 21400, status: "RUNNING" } as DashboardRound}
      />,
    );

    expect(screen.queryByText("LIVE")).toBeNull();
    expect(screen.queryByText("Arcade run")).toBeNull();
    expect(screen.getByTestId("stage-multiplier").className).toContain(
      "items-center",
    );
    expect(screen.getByTestId("stage-multiplier").className).toContain(
      "justify-center",
    );
    expect(screen.getByTestId("stage-multiplier-pill")).toBeTruthy();
    expect(screen.getByTestId("stage-multiplier-value").textContent).toBe(
      "2.14x",
    );
    expect(screen.getByText("Multiplicador atual")).toBeTruthy();
    expect(screen.getByText("2.14x")).toBeTruthy();
  });

  it("shows a dedicated crash message with the crash multiplier", () => {
    render(
      <ChronoStage
        isLoading={false}
        now={new Date("2026-06-02T12:00:16.000Z")}
        round={roundFixture({
          crashedAt: "2026-06-02T12:00:16.000Z",
          crashPointBp: 23600,
          startedAt: "2026-06-02T12:00:10.000Z",
          status: "CRASHED",
        })}
      />,
    );

    expect(screen.getByTestId("stage-multiplier-value").textContent).toBe(
      "CRASH!",
    );
    expect(screen.getByText("A rodada finalizou em 2.36x")).toBeTruthy();
    expect(screen.queryByText("Multiplicador atual")).toBeNull();
  });
});

function roundFixture(overrides: Partial<DashboardRound>): DashboardRound {
  return {
    bets: [],
    bettingEndsAt: "2026-06-02T12:00:10.000Z",
    bettingStartsAt: "2026-06-02T12:00:00.000Z",
    chainIndex: 1,
    clientSeed: "client-seed",
    crashedAt: null,
    crashPointBp: null,
    id: "round-1",
    multiplierBaseBp: 10000,
    multiplierCurve: "EXPONENTIAL",
    multiplierGrowthRateBpPerSecond: 500,
    nextServerSeedHash: null,
    nonce: 1,
    serverSeed: null,
    serverSeedHash: "server-seed-hash",
    startedAt: null,
    status: "BETTING",
    ...overrides,
  };
}
