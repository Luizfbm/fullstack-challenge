// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
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

  it("renders the main game screen with wallet, player, history and bet controls", () => {
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

    expect(screen.getAllByText("Saldo").length).toBeGreaterThan(0);
    expect(screen.getAllByText("R$ 123,45").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Jogador").length).toBeGreaterThan(0);
    expect(screen.getAllByText("player").length).toBeGreaterThan(0);
    expect(screen.getByLabelText("Arcade arena")).toBeTruthy();
    expect(screen.getByRole("tab", { name: "Provably Fair" })).toBeTruthy();
    expect(screen.getByText("Histórico")).toBeTruthy();
    expect(screen.getByText("Mesa")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Apostar" })).toBeTruthy();
    expect(screen.getAllByText("Leaderboard").length).toBeGreaterThan(0);
    expect(screen.getAllByText("R$ 40,00").length).toBeGreaterThan(0);
  });

  it("renders the authenticated player's active auto bet session", () => {
    hookMocks.autoBetSessionQuery.data = createAutoBetSession({
      maxRounds: 3,
      roundsPlayed: 1,
    });

    render(<GameDashboardShell />);

    expect(screen.getByText("Auto Bet ativo")).toBeTruthy();
    expect(screen.getByText("1 / 3")).toBeTruthy();
  });

  it("renders martingale session progression and stop reason", () => {
    hookMocks.autoBetSessionQuery.data = createAutoBetSession({
      martingaleCurrentStep: 1,
      martingaleMaxSteps: 3,
      martingaleMultiplier: 2,
      maxRounds: 5,
      netProfitCents: "-1000",
      nextAmountCents: "2000",
      roundsPlayed: 2,
      status: "STOPPED",
      stopReason: "MARTINGALE_MAX_STEPS_REACHED",
      strategy: "MARTINGALE",
    });

    render(<GameDashboardShell />);

    expect(screen.getByText("Ultimo Auto Bet")).toBeTruthy();
    expect(screen.getByText("Martingale")).toBeTruthy();
    expect(screen.getByText("R$ 20,00")).toBeTruthy();
    expect(screen.getByText("1 / 3")).toBeTruthy();
    expect(screen.getByText("Maximo de passos Martingale")).toBeTruthy();
  });

  it("normalizes the bet amount field and disables betting for invalid value", () => {
    render(<BetControlsPanel activeBet={null} currentRound={createRound()} />);

    const amountInput = screen.getByLabelText("Valor em centavos");
    fireEvent.change(amountInput, { target: { value: "abc001250" } });

    expect(amountInput).toHaveProperty("value", "1250");
    expect(screen.getByText("R$ 12,50")).toBeTruthy();

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
    expect(screen.getByLabelText("Valor em centavos")).toHaveProperty(
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
