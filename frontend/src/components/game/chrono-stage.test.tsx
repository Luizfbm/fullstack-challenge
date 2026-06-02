// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ChronoStage } from "./chrono-stage";
import type { DashboardRound } from "./round-formatting";

vi.mock("./crash-flight-scene", () => ({
  CrashFlightScene: () => <canvas data-testid="crash-flight-canvas" />,
}));

describe("ChronoStage", () => {
  afterEach(() => {
    cleanup();
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
});
