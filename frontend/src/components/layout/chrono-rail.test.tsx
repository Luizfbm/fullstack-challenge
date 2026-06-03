// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ChronoRail } from "./chrono-rail";

describe("ChronoRail", () => {
  afterEach(() => {
    cleanup();
  });

  it("opens evaluator access credentials for the game and dashboards", () => {
    render(<ChronoRail />);

    fireEvent.click(screen.getByRole("button", { name: "Acessos" }));

    expect(screen.getByLabelText("Acessos do avaliador")).toBeTruthy();
    expect(screen.getByText("Jogador Keycloak")).toBeTruthy();
    expect(screen.getAllByText("player / player123").length).toBeGreaterThanOrEqual(
      2,
    );
    expect(screen.getByText("Keycloak admin")).toBeTruthy();
    expect(screen.getAllByText("admin / admin").length).toBeGreaterThanOrEqual(
      3,
    );
    expect(
      screen
        .getByRole("link", { name: /RabbitMQ Management/i })
        .getAttribute("href"),
    ).toBe("http://localhost:15672");
  });

  it("opens observability links with the required local credentials", () => {
    render(<ChronoRail />);

    fireEvent.click(screen.getByRole("button", { name: "Observabilidade" }));

    expect(screen.getByLabelText("Observabilidade do avaliador")).toBeTruthy();
    expect(
      screen.getByRole("link", { name: /Grafana/i }).getAttribute("href"),
    ).toBe("http://localhost:3001");
    expect(
      screen.getByRole("link", { name: /Prometheus/i }).getAttribute("href"),
    ).toBe("http://localhost:9090");
    expect(
      screen.getByRole("link", { name: /Jaeger/i }).getAttribute("href"),
    ).toBe("http://localhost:16686");
    expect(screen.getAllByText("admin / admin").length).toBeGreaterThanOrEqual(
      2,
    );
  });

  it("closes the active evaluator panel", () => {
    render(<ChronoRail />);

    fireEvent.click(screen.getByRole("button", { name: "APIs" }));
    expect(screen.getByLabelText("APIs do avaliador")).toBeTruthy();

    fireEvent.click(
      screen.getByRole("button", { name: "Fechar painel de avaliador" }),
    );

    expect(screen.queryByLabelText("APIs do avaliador")).toBeNull();
  });
});
