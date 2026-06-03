// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AppShell } from "./app-shell";

const hookMocks = vi.hoisted(() => ({
  auth: {
    isAuthenticated: true,
    isLoading: false,
    login: vi.fn(),
    logout: vi.fn(),
    username: "player",
  },
  walletQuery: {
    data: { balanceCents: "100000", playerId: "player-1" },
    isLoading: false,
  },
}));

vi.mock("../../hooks/use-auth", () => ({
  useAuth: () => hookMocks.auth,
}));

vi.mock("../../hooks/use-game-rest", () => ({
  useWalletQuery: () => hookMocks.walletQuery,
}));

describe("AppShell", () => {
  beforeEach(() => {
    hookMocks.auth.isAuthenticated = true;
    hookMocks.auth.isLoading = false;
    hookMocks.auth.login.mockReset();
    hookMocks.auth.logout.mockReset();
    hookMocks.auth.username = "player";
    hookMocks.walletQuery.data = {
      balanceCents: "100000",
      playerId: "player-1",
    };
    hookMocks.walletQuery.isLoading = false;
  });

  afterEach(() => {
    cleanup();
  });

  it("shows the player and wallet balance together in the header", () => {
    render(
      <AppShell>
        <main>Game content</main>
      </AppShell>,
    );

    const playerChip = screen.getByLabelText("Conta do jogador");

    const headerAccountText = playerChip.textContent?.replace(/\u00a0/g, " ");

    expect(headerAccountText).toContain("player");
    expect(headerAccountText).toContain("R$ 1.000,00");
  });

  it("keeps the authenticated account row readable on narrow headers", () => {
    render(
      <AppShell>
        <main>Game content</main>
      </AppShell>,
    );

    const accountActions = screen.getByLabelText("Ações da conta");
    const playerChip = screen.getByLabelText("Conta do jogador");

    expect(accountActions.className).toContain("w-full");
    expect(accountActions.className).toContain("sm:w-auto");
    expect(playerChip.className).toContain("flex-1");
    expect(playerChip.className).toContain("sm:flex-none");
  });

  it("keeps the application chrome aligned with felt green and gold casino styling", () => {
    render(
      <AppShell>
        <main>Game content</main>
      </AppShell>,
    );

    const header = screen.getByRole("banner");
    const brandMark = screen.getByText("CC");
    const subtitle = screen.getByText("Arcade casino premium");

    expect(header.className).toContain("border-amber-200/25");
    expect(header.className).not.toContain("rose");
    expect(brandMark.className).toContain("border-amber-200/45");
    expect(brandMark.className).toContain("bg-emerald-950/70");
    expect(brandMark.className).not.toContain("rose");
    expect(subtitle.className).toContain("text-amber-200");
    expect(subtitle.className).not.toContain("rose");
  });
});
