// @vitest-environment jsdom

import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "../../services/http-client";
import type {
  AutoBetSessionResponse,
  BetResponse,
  LeaderboardEntry,
  RoundResponse,
} from "../../services/game-api";
import { useGameUiStore } from "../../stores/game-ui-store";
import { BetControlsPanel } from "./bet-controls-panel";
import { GameDashboardShell } from "./game-dashboard-shell";
import { getRoundBets } from "./game-dashboard-view-model";

const hookMocks = vi.hoisted(() => ({
  auth: {
    errorMessage: null as string | null,
    isAuthenticated: true,
    isLoading: false,
    login: vi.fn(),
    logout: vi.fn(),
    session: null,
    status: "authenticated",
    username: "player",
  },
  autoBetSessionQuery: {
    data: null as AutoBetSessionResponse | null,
    error: null as Error | null,
    isLoading: false,
  },
  cashOutMutation: {
    error: null as Error | null,
    isPending: false,
    mutate: vi.fn(),
  },
  currentRoundQuery: {
    data: null as RoundResponse | null,
    error: null as Error | null,
    isLoading: false,
  },
  historyQuery: {
    data: [] as RoundResponse[],
    error: null as Error | null,
    isLoading: false,
  },
  leaderboardQuery: {
    data: [] as LeaderboardEntry[],
    error: null as Error | null,
    isLoading: false,
  },
  myBetsQuery: {
    data: [] as BetResponse[],
    error: null as Error | null,
    isLoading: false,
  },
  placeBetMutation: {
    error: null as Error | null,
    isPending: false,
    mutate: vi.fn(),
  },
  startAutoBetSessionMutation: {
    error: null as Error | null,
    isPending: false,
    mutate: vi.fn(),
  },
  stopAutoBetSessionMutation: {
    error: null as Error | null,
    isPending: false,
    mutate: vi.fn(),
  },
  realtime: {
    connectionStatus: "LIVE",
    round: null as RoundResponse | null,
  },
  walletQuery: {
    data: { balanceCents: "12345", playerId: "player-1" },
    error: null as Error | null,
    isLoading: false,
  },
}));

vi.mock("../../hooks/use-auth", () => ({
  useAuth: () => hookMocks.auth,
}));

vi.mock("../../hooks/use-game-realtime", () => ({
  useGameRealtime: () => hookMocks.realtime,
}));

vi.mock("../../hooks/use-game-rest", () => ({
  useCashOutMutation: () => hookMocks.cashOutMutation,
  useCurrentRoundQuery: () => hookMocks.currentRoundQuery,
  useLeaderboardQuery: () => hookMocks.leaderboardQuery,
  useMyAutoBetSessionQuery: () => hookMocks.autoBetSessionQuery,
  useMyBetsQuery: () => hookMocks.myBetsQuery,
  usePlaceBetMutation: () => hookMocks.placeBetMutation,
  useRoundHistoryQuery: () => hookMocks.historyQuery,
  useStartAutoBetSessionMutation: () => hookMocks.startAutoBetSessionMutation,
  useStopAutoBetSessionMutation: () => hookMocks.stopAutoBetSessionMutation,
  useWalletQuery: () => hookMocks.walletQuery,
}));

vi.mock("./crash-round-panel", () => ({
  CrashRoundPanel: ({ round }: { round: RoundResponse | null }) => (
    <section aria-label="Arcade arena">
      <p>{round?.serverSeedHash ?? "no-round"}</p>
    </section>
  ),
}));

describe("game dashboard helpers", () => {
  beforeEach(() => {
    resetMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it("keeps the table render safe when a round payload has no bets array", () => {
    const roundWithoutBets = {
      id: "round-1",
      status: "RUNNING",
    } as unknown as RoundResponse;

    expect(getRoundBets(roundWithoutBets)).toEqual([]);
  });

  it("returns the current round bets when present", () => {
    const bet: BetResponse = {
      amountCents: "1000",
      autoCashoutMultiplierBp: null,
      cashoutMultiplierBp: null,
      id: "bet-1",
      payoutCents: null,
      playerId: "player-1",
      rejectionReason: null,
      roundId: "round-1",
      status: "ACCEPTED",
      username: "player",
    };

    expect(getRoundBets({ bets: [bet] } as RoundResponse)).toEqual([bet]);
  });

  it("renders the main game screen without the former metric card grid", () => {
    hookMocks.currentRoundQuery.data = createRound({ bets: [createBet()] });
    hookMocks.historyQuery.data = [
      createRound({ crashPointBp: 25000, id: "round-history" }),
    ];
    hookMocks.leaderboardQuery.data = [
      {
        betsCount: 3,
        payoutCents: "9000",
        playerId: "player-1",
        profitCents: "4000",
        rank: 1,
        username: "player",
        wageredCents: "5000",
      },
    ];

    render(<GameDashboardShell />);

    expect(screen.queryByTestId("metric-realtime")).toBeNull();
    expect(screen.queryByTestId("metric-saldo")).toBeNull();
    expect(screen.queryByTestId("metric-jogador")).toBeNull();
    expect(screen.queryByTestId("metric-rodada")).toBeNull();
    expect(screen.getAllByText("player").length).toBeGreaterThan(0);
    expect(screen.getByLabelText("Arcade arena")).toBeTruthy();
    expect(screen.getByRole("tab", { name: "Provably Fair" })).toBeTruthy();
    expect(screen.getByText("Histórico")).toBeTruthy();
    expect(
      screen.getByRole("region", { name: "Histórico de rodadas" }).className,
    ).toContain("casino-chip-rail");
    expect(screen.getByText("Mesa")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Apostar" })).toBeTruthy();
    expect(screen.getAllByText("Leaderboard").length).toBeGreaterThan(0);
    expect(screen.getAllByText("R$ 40,00").length).toBeGreaterThan(0);
  });

  it("places round history as a horizontal rail directly above the arcade arena", () => {
    hookMocks.currentRoundQuery.data = createRound();
    hookMocks.historyQuery.data = [
      createRound({ crashPointBp: 12000, id: "round-history-1" }),
      createRound({ crashPointBp: 25000, id: "round-history-2" }),
    ];

    render(<GameDashboardShell />);

    const historyRail = screen.getByRole("region", {
      name: "Histórico de rodadas",
    });
    const arena = screen.getByLabelText("Arcade arena");
    const track = screen.getByTestId("round-history-track");

    expect(
      historyRail.compareDocumentPosition(arena) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(track.className).toContain("overflow-x-auto");
    expect(track.className).toContain("flex-nowrap");
    expect(screen.queryByRole("tab", { name: "Histórico" })).toBeNull();
  });

  it("does not expose technical SYNC text in the round state tab while loading", () => {
    hookMocks.currentRoundQuery.data = null;
    hookMocks.currentRoundQuery.isLoading = true;
    hookMocks.realtime.round = null;

    render(<GameDashboardShell />);

    fireEvent.click(screen.getByRole("tab", { name: "Round State" }));

    expect(screen.getByText("Sincronizando")).toBeTruthy();
    expect(screen.queryByText("SYNC")).toBeNull();
  });

  it("keeps cashier and mobile leaderboard before technical tabs while reserving the desktop stage row", () => {
    hookMocks.currentRoundQuery.data = createRound();

    render(<GameDashboardShell />);

    const arena = screen.getByLabelText("Arcade arena");
    const cashier = screen.getByText("Mesa de aposta");
    const mobileLeaderboardSlot = screen.getByTestId("mobile-leaderboard-slot");
    const technicalTabs = screen.getByRole("tablist", {
      name: "Evidências técnicas",
    });
    const desktopSidebar = screen.getByRole("complementary", {
      name: "Desktop cashier and leaderboard",
    });
    const technicalSlot = screen.getByTestId("stage-technical-tabs-slot");

    expect(
      arena.compareDocumentPosition(cashier) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      cashier.compareDocumentPosition(technicalTabs) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      cashier.compareDocumentPosition(mobileLeaderboardSlot) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      mobileLeaderboardSlot.compareDocumentPosition(technicalTabs) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(desktopSidebar.className).toContain("lg:row-span-2");
    expect(technicalSlot.className).toContain("lg:col-start-1");
    expect(technicalSlot.className).toContain("lg:row-start-2");
    expect(desktopSidebar.className).not.toContain("xl:row-span-2");
  });

  it("places the desktop cashier rail above the desktop leaderboard without duplicating the form", () => {
    hookMocks.currentRoundQuery.data = createRound();
    hookMocks.leaderboardQuery.data = [
      {
        betsCount: 3,
        payoutCents: "9000",
        playerId: "player-1",
        profitCents: "4000",
        rank: 1,
        username: "player",
        wageredCents: "5000",
      },
    ];

    render(<GameDashboardShell />);

    const desktopSidebar = screen.getByRole("complementary", {
      name: "Desktop cashier and leaderboard",
    });
    const cashier = within(desktopSidebar).getByText("Mesa de aposta");
    const betPanel = screen.getByTestId("bet-slip-panel");
    const leaderboard = within(desktopSidebar).getByText("Leaderboard");

    expect(
      cashier.compareDocumentPosition(leaderboard) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(screen.getAllByText("Mesa de aposta")).toHaveLength(1);
    expect(within(betPanel).getByRole("heading", { name: "Aposta" })).toBeTruthy();
    expect(within(betPanel).queryByText("Bet slip")).toBeNull();
    expect(screen.getAllByLabelText("Valor em reais")).toHaveLength(1);
    expect(screen.getAllByRole("button", { name: "Apostar" })).toHaveLength(1);
    expect(desktopSidebar.className).toContain("lg:sticky");
  });

  it("renders a compact mobile bet dock without duplicating the bet form", () => {
    render(<BetControlsPanel activeBet={null} currentRound={createRound()} />);

    const betSlip = screen.getByTestId("bet-slip-panel");
    const dock = within(betSlip).getByTestId("mobile-bet-dock");
    const details = within(betSlip).getByTestId("bet-slip-details");
    const configureButton = within(betSlip).getByRole("button", {
      name: "Configurar aposta",
    });

    expect(within(dock).getByLabelText("Valor em reais")).toBeTruthy();
    expect(within(dock).getByRole("button", { name: "Apostar" })).toBeTruthy();
    expect(configureButton.getAttribute("aria-expanded")).toBe("false");
    expect(details.className).toContain("max-lg:hidden");
    expect(screen.getAllByLabelText("Valor em reais")).toHaveLength(1);
    expect(screen.getAllByRole("button", { name: "Apostar" })).toHaveLength(1);
  });

  it("expands compact bet details from the mobile dock toggle", () => {
    render(<BetControlsPanel activeBet={null} currentRound={createRound()} />);

    const betSlip = screen.getByTestId("bet-slip-panel");
    const toggle = within(betSlip).getByRole("button", {
      name: "Configurar aposta",
    });
    const details = within(betSlip).getByTestId("bet-slip-details");

    fireEvent.click(toggle);

    expect(toggle.getAttribute("aria-expanded")).toBe("true");
    expect(details.className).not.toContain("max-lg:hidden");
    expect(within(details).getByRole("button", { name: "Manual" })).toBeTruthy();
    expect(within(details).getByRole("button", { name: "Auto" })).toBeTruthy();
  });

  it("renders the authenticated player's active auto bet session", () => {
    hookMocks.autoBetSessionQuery.data = createAutoBetSession({
      maxRounds: 3,
      roundsPlayed: 1,
    });

    render(<GameDashboardShell />);

    expect(screen.getByText("Auto Bet ativo")).toBeTruthy();
    expect(screen.getByText("1 / 3")).toBeTruthy();

    const activeSummary = screen.getByRole("region", {
      name: "Resumo do auto bet ativo",
    });
    const detailGrid = within(activeSummary).getByTestId(
      "auto-bet-session-detail-grid",
    );
    expect(detailGrid.className).toContain("xl:grid-cols-1");
  });

  it("renders martingale session progression and stop reason", () => {
    hookMocks.autoBetSessionQuery.data = createAutoBetSession({
      autoCashoutMultiplierBp: 20000,
      martingaleCurrentStep: 1,
      martingaleMaxSteps: 3,
      martingaleMultiplier: 2,
      maxRounds: 5,
      netProfitCents: "-1000",
      nextAmountCents: "2000",
      roundsPlayed: 2,
      status: "STOPPED",
      stopLossCents: "3000",
      stopReason: "MARTINGALE_MAX_STEPS_REACHED",
      strategy: "MARTINGALE",
      takeProfitCents: "5000",
    });

    render(<GameDashboardShell />);

    const compactSummary = screen.getByRole("region", {
      name: "Resumo compacto do último auto bet",
    });
    expect(within(compactSummary).getByText("Ultimo Auto Bet")).toBeTruthy();
    const strategyBadge = within(compactSummary).getByText("Martingale");
    expect(strategyBadge.className).not.toContain("font-mono");
    expect(
      within(compactSummary).getByText("Auto cashout 2.00x"),
    ).toBeTruthy();
    const stopReasonBadge = within(compactSummary).getByText(
      "Maximo de passos Martingale",
    );
    expect(stopReasonBadge.className).not.toContain("font-mono");

    for (const label of [
      "Rodadas",
      "Proxima aposta",
      "Passo",
      "Resultado",
      "Base",
      "Stop-loss",
      "Take-profit",
    ]) {
      expect(within(compactSummary).getByText(label)).toBeTruthy();
    }

    expect(within(compactSummary).getByText("2 / 5").className).toContain(
      "font-mono",
    );
    expect(within(compactSummary).getByText("1 / 3")).toBeTruthy();
    expect(within(compactSummary).getByText("-R$ 10,00")).toBeTruthy();
    expect(within(compactSummary).getAllByText("R$ 10,00")).toHaveLength(1);
    expect(within(compactSummary).getByText("R$ 20,00")).toBeTruthy();
    expect(within(compactSummary).getByText("R$ 30,00")).toBeTruthy();
    expect(within(compactSummary).getByText("R$ 50,00")).toBeTruthy();

    const compactGrid = within(compactSummary).getByTestId(
      "compact-auto-bet-summary-grid",
    );
    expect(compactGrid.className).toContain("grid-cols-2");
    expect(compactGrid.className).not.toContain("xl:grid-cols-1");
  });

  it("keeps cashier rail controls compact when rendered in the desktop sidebar", () => {
    render(
      <BetControlsPanel
        activeBet={null}
        autoBetSession={createAutoBetSession({
          martingaleCurrentStep: 0,
          martingaleMaxSteps: 3,
          maxRounds: 4,
          nextAmountCents: "1000",
          roundsPlayed: 0,
          status: "STOPPED",
          stopReason: "MANUAL",
          strategy: "MARTINGALE",
        })}
        currentRound={createRound()}
      />,
    );

    const cashOutButton = screen.getByRole("button", { name: "Cash Out" });
    const actionGrid = cashOutButton.parentElement;
    expect(actionGrid?.className).toContain("grid-cols-1");
    expect(actionGrid?.className).toContain("gap-2");
    expect(actionGrid?.className).not.toContain("sm:grid-cols-2");
    expect(cashOutButton.className).toContain("w-full");
    expect(cashOutButton.className).toContain("whitespace-nowrap");

    const stakePreviewGrid =
      screen.getByText("Entrada").parentElement?.parentElement;
    expect(stakePreviewGrid?.className).toContain("xl:grid-cols-1");

    const compactGrid = screen.getByTestId("compact-auto-bet-summary-grid");
    expect(compactGrid.className).toContain("grid-cols-2");
    expect(compactGrid.className).not.toContain("xl:grid-cols-1");

    const compactSummary = screen.getByRole("region", {
      name: "Resumo compacto do último auto bet",
    });
    expect(
      cashOutButton.compareDocumentPosition(compactSummary) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("accepts bet amounts in reais and sends integer cents to the API", () => {
    render(<BetControlsPanel activeBet={null} currentRound={createRound()} />);

    const amountInput = screen.getByLabelText("Valor em reais");

    expect(amountInput).toHaveProperty("value", "10,00");

    fireEvent.change(amountInput, { target: { value: "12,50" } });

    expect(amountInput).toHaveProperty("value", "12,50");
    expect(screen.getByText("R$ 12,50")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Apostar" }));

    expect(hookMocks.placeBetMutation.mutate).toHaveBeenCalledWith({
      amountCents: "1250",
    });
  });

  it("disables betting when the reais amount is invalid", () => {
    render(<BetControlsPanel activeBet={null} currentRound={createRound()} />);

    const amountInput = screen.getByLabelText("Valor em reais");

    fireEvent.change(amountInput, { target: { value: "0" } });

    expect(screen.getByRole("button", { name: "Apostar" })).toHaveProperty(
      "disabled",
      true,
    );
  });

  it("only enables betting during BETTING without an active bet", () => {
    render(<BetControlsPanel activeBet={null} currentRound={createRound()} />);

    fireEvent.click(screen.getByRole("button", { name: "Apostar" }));

    expect(hookMocks.placeBetMutation.mutate).toHaveBeenCalledWith({
      amountCents: "1000",
    });
    expect(screen.getByRole("button", { name: "Cash Out" })).toHaveProperty(
      "disabled",
      true,
    );
  });

  it("configures auto cashout with visible limits and presets", () => {
    render(<BetControlsPanel activeBet={null} currentRound={createRound()} />);

    expect(screen.getByText("Limite: 1.01x a 1000.00x")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /Auto cashout/ }));
    fireEvent.click(screen.getByRole("button", { name: "2.00x" }));
    fireEvent.click(screen.getByRole("button", { name: "Apostar" }));

    expect(hookMocks.placeBetMutation.mutate).toHaveBeenCalledWith({
      amountCents: "1000",
      autoCashoutMultiplierBp: 20000,
    });
  });

  it("starts auto bet with all configured persistent fields", () => {
    render(
      <BetControlsPanel
        activeBet={null}
        autoBetSession={null}
        currentRound={createRound()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Auto" }));
    fireEvent.click(screen.getByRole("button", { name: /Auto cashout/ }));
    fireEvent.click(screen.getByRole("button", { name: "2.00x" }));
    fireEvent.change(screen.getByLabelText("Rodadas maximas"), {
      target: { value: "5" },
    });
    fireEvent.change(screen.getByLabelText("Stop-loss em centavos"), {
      target: { value: "3000" },
    });
    fireEvent.change(screen.getByLabelText("Take-profit em centavos"), {
      target: { value: "5000" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Iniciar Auto Bet" }));

    expect(hookMocks.startAutoBetSessionMutation.mutate).toHaveBeenCalledWith({
      amountCents: "1000",
      autoCashoutMultiplierBp: 20000,
      maxRounds: 5,
      stopLossCents: "3000",
      strategy: "FIXED",
      takeProfitCents: "5000",
    });
    expect(hookMocks.placeBetMutation.mutate).not.toHaveBeenCalled();
  });

  it("starts martingale auto bet with configured strategy fields", () => {
    render(
      <BetControlsPanel
        activeBet={null}
        autoBetSession={null}
        currentRound={createRound()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Auto" }));
    fireEvent.click(screen.getByRole("button", { name: "Martingale" }));
    fireEvent.change(screen.getByLabelText("Rodadas maximas"), {
      target: { value: "6" },
    });
    fireEvent.change(screen.getByLabelText("Multiplicador Martingale"), {
      target: { value: "3" },
    });
    fireEvent.change(screen.getByLabelText("Passos Martingale"), {
      target: { value: "4" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Iniciar Auto Bet" }));

    expect(hookMocks.startAutoBetSessionMutation.mutate).toHaveBeenCalledWith({
      amountCents: "1000",
      autoCashoutMultiplierBp: null,
      martingaleMaxSteps: 4,
      martingaleMultiplier: 3,
      maxRounds: 6,
      stopLossCents: null,
      strategy: "MARTINGALE",
      takeProfitCents: null,
    });
  });

  it("disables auto bet when persistent risk fields are invalid", () => {
    render(
      <BetControlsPanel
        activeBet={null}
        autoBetSession={null}
        currentRound={createRound()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Auto" }));
    fireEvent.change(screen.getByLabelText("Rodadas maximas"), {
      target: { value: "0" },
    });

    expect(
      screen.getByRole("button", { name: "Iniciar Auto Bet" }),
    ).toHaveProperty("disabled", true);

    fireEvent.change(screen.getByLabelText("Rodadas maximas"), {
      target: { value: "5" },
    });
    fireEvent.change(screen.getByLabelText("Stop-loss em centavos"), {
      target: { value: "0" },
    });

    expect(
      screen.getByRole("button", { name: "Iniciar Auto Bet" }),
    ).toHaveProperty("disabled", true);
  });

  it("disables martingale auto bet when strategy fields are invalid", () => {
    render(
      <BetControlsPanel
        activeBet={null}
        autoBetSession={null}
        currentRound={createRound()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Auto" }));
    fireEvent.click(screen.getByRole("button", { name: "Martingale" }));
    fireEvent.change(screen.getByLabelText("Multiplicador Martingale"), {
      target: { value: "1" },
    });

    expect(
      screen.getByRole("button", { name: "Iniciar Auto Bet" }),
    ).toHaveProperty("disabled", true);

    fireEvent.change(screen.getByLabelText("Multiplicador Martingale"), {
      target: { value: "2" },
    });
    fireEvent.change(screen.getByLabelText("Passos Martingale"), {
      target: { value: "11" },
    });

    expect(
      screen.getByRole("button", { name: "Iniciar Auto Bet" }),
    ).toHaveProperty("disabled", true);
  });

  it("shows active auto bet summary, stops it and keeps cashout available", () => {
    render(
      <BetControlsPanel
        activeBet={createBet()}
        autoBetSession={createAutoBetSession({
          autoCashoutMultiplierBp: 20000,
          maxRounds: 5,
          netProfitCents: "1500",
          roundsPlayed: 2,
          stopLossCents: "3000",
          takeProfitCents: "5000",
        })}
        currentRound={createRound({
          currentMultiplierBp: 25000,
          status: "RUNNING",
        })}
      />,
    );

    expect(screen.getByText("Auto Bet ativo")).toBeTruthy();
    expect(screen.getByText("2 / 5")).toBeTruthy();
    expect(screen.getByText("+R$ 15,00")).toBeTruthy();
    expect(screen.getByText("Auto cashout 2.00x")).toBeTruthy();
    expect(screen.getByLabelText("Valor em reais")).toHaveProperty(
      "disabled",
      true,
    );
    expect(screen.getByLabelText("Rodadas maximas")).toHaveProperty(
      "value",
      "5",
    );
    expect(screen.getByLabelText("Rodadas maximas")).toHaveProperty(
      "disabled",
      true,
    );

    fireEvent.click(screen.getByRole("button", { name: "Parar Auto Bet" }));

    expect(hookMocks.stopAutoBetSessionMutation.mutate).toHaveBeenCalledOnce();

    const cashOutButton = screen.getByRole("button", { name: /Cash Out/ });
    expect(cashOutButton).toHaveProperty("disabled", false);

    fireEvent.click(cashOutButton);

    expect(hookMocks.cashOutMutation.mutate).toHaveBeenCalledOnce();
  });

  it("disables betting when auto cashout target is outside limits", () => {
    render(<BetControlsPanel activeBet={null} currentRound={createRound()} />);

    fireEvent.click(screen.getByRole("button", { name: /Auto cashout/ }));
    fireEvent.change(screen.getByLabelText("Multiplicador alvo"), {
      target: { value: "1.00" },
    });

    expect(screen.getByRole("button", { name: "Apostar" })).toHaveProperty(
      "disabled",
      true,
    );
  });

  it("shows the active bet auto cashout target", () => {
    render(
      <BetControlsPanel
        activeBet={createBet({ autoCashoutMultiplierBp: 20000 })}
        currentRound={createRound({ status: "RUNNING" })}
      />,
    );

    expect(screen.getByText("Auto cashout em 2.00x")).toBeTruthy();
  });

  it("only enables cashout during RUNNING with an accepted active bet", () => {
    const activeBet = createBet({ amountCents: "1000", status: "ACCEPTED" });

    render(
      <BetControlsPanel
        activeBet={activeBet}
        currentRound={createRound({
          currentMultiplierBp: 25000,
          status: "RUNNING",
        })}
      />,
    );

    expect(screen.getByRole("button", { name: "Apostar" })).toHaveProperty(
      "disabled",
      true,
    );

    const cashOutButton = screen.getByRole("button", { name: /Cash Out/ });
    expect(cashOutButton).toHaveProperty("disabled", false);
    expect(cashOutButton.textContent).toContain("25,00");

    fireEvent.click(cashOutButton);

    expect(hookMocks.cashOutMutation.mutate).toHaveBeenCalledOnce();
  });

  it("shows API validation errors from failed bet requests", () => {
    hookMocks.placeBetMutation.error = new ApiError("Bad request", 400, {
      message: "Saldo insuficiente",
    });

    render(<BetControlsPanel activeBet={null} currentRound={createRound()} />);

    expect(screen.getByRole("alert").textContent).toBe("Saldo insuficiente");
  });
});

function resetMocks() {
  hookMocks.auth.errorMessage = null;
  hookMocks.auth.isAuthenticated = true;
  hookMocks.auth.username = "player";
  hookMocks.auth.login.mockReset();
  hookMocks.autoBetSessionQuery.data = null;
  hookMocks.autoBetSessionQuery.error = null;
  hookMocks.autoBetSessionQuery.isLoading = false;
  hookMocks.cashOutMutation.error = null;
  hookMocks.cashOutMutation.isPending = false;
  hookMocks.cashOutMutation.mutate.mockReset();
  hookMocks.currentRoundQuery.data = null;
  hookMocks.currentRoundQuery.error = null;
  hookMocks.currentRoundQuery.isLoading = false;
  hookMocks.historyQuery.data = [];
  hookMocks.historyQuery.error = null;
  hookMocks.historyQuery.isLoading = false;
  hookMocks.leaderboardQuery.data = [];
  hookMocks.leaderboardQuery.error = null;
  hookMocks.leaderboardQuery.isLoading = false;
  hookMocks.myBetsQuery.data = [];
  hookMocks.myBetsQuery.error = null;
  hookMocks.myBetsQuery.isLoading = false;
  hookMocks.placeBetMutation.error = null;
  hookMocks.placeBetMutation.isPending = false;
  hookMocks.placeBetMutation.mutate.mockReset();
  hookMocks.startAutoBetSessionMutation.error = null;
  hookMocks.startAutoBetSessionMutation.isPending = false;
  hookMocks.startAutoBetSessionMutation.mutate.mockReset();
  hookMocks.stopAutoBetSessionMutation.error = null;
  hookMocks.stopAutoBetSessionMutation.isPending = false;
  hookMocks.stopAutoBetSessionMutation.mutate.mockReset();
  hookMocks.realtime.connectionStatus = "LIVE";
  hookMocks.realtime.round = null;
  hookMocks.walletQuery.data = { balanceCents: "12345", playerId: "player-1" };
  hookMocks.walletQuery.error = null;
  hookMocks.walletQuery.isLoading = false;
  useGameUiStore.setState({
    betAmountCents: "1000",
    selectedRoundId: null,
  });
}

function createRound(
  overrides: Partial<RoundResponse> & { currentMultiplierBp?: number } = {},
): RoundResponse & { currentMultiplierBp?: number } {
  return {
    bets: [],
    bettingEndsAt: "2026-06-01T12:00:10.000Z",
    bettingStartsAt: "2026-06-01T12:00:00.000Z",
    chainIndex: 10,
    clientSeed: "client-seed",
    crashedAt: null,
    crashPointBp: null,
    id: "round-1",
    multiplierBaseBp: 10000,
    multiplierCurve: "EXPONENTIAL",
    multiplierGrowthRateBpPerSecond: 500,
    nextServerSeedHash: "next-hash",
    nonce: 1,
    serverSeed: null,
    serverSeedHash: "server-hash",
    startedAt: null,
    status: "BETTING",
    ...overrides,
  };
}

function createBet(overrides: Partial<BetResponse> = {}): BetResponse {
  return {
    amountCents: "1000",
    autoCashoutMultiplierBp: null,
    cashoutMultiplierBp: null,
    id: "bet-1",
    payoutCents: null,
    playerId: "player-1",
    rejectionReason: null,
    roundId: "round-1",
    status: "ACCEPTED",
    username: "player",
    ...overrides,
  };
}

function createAutoBetSession(
  overrides: Partial<AutoBetSessionResponse> = {},
): AutoBetSessionResponse {
  return {
    amountCents: "1000",
    autoCashoutMultiplierBp: null,
    createdAt: "2026-06-01T12:00:00.000Z",
    id: "auto-bet-1",
    martingaleCurrentStep: 0,
    martingaleMaxSteps: 0,
    martingaleMultiplier: 2,
    maxRounds: 10,
    netProfitCents: "0",
    nextAmountCents: "1000",
    playerId: "player-1",
    roundsPlayed: 0,
    startsAfterRoundId: "round-1",
    status: "ACTIVE",
    strategy: "FIXED",
    stopLossCents: null,
    stopReason: null,
    stoppedAt: null,
    takeProfitCents: null,
    updatedAt: "2026-06-01T12:00:00.000Z",
    username: "player",
    ...overrides,
  };
}
