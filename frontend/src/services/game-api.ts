import { gameRoutes } from "./api-routes";
import { apiClient } from "./http-client";

type RequestClient = {
  request: <T>(
    path: string,
    options?: RequestInit & { auth?: boolean },
  ) => Promise<T>;
};

export type BetStatus =
  | "ACCEPTED"
  | "REJECTED"
  | "CASHOUT_PENDING_CREDIT"
  | "CASHED_OUT"
  | "LOST";

export type RoundStatus = "BETTING" | "RUNNING" | "CRASHED" | "SETTLED";

export type BetResponse = {
  id: string;
  roundId: string;
  playerId: string;
  username: string;
  amountCents: string;
  status: BetStatus;
  cashoutMultiplierBp: number | null;
  payoutCents: string | null;
  rejectionReason: string | null;
};

export type RoundResponse = {
  id: string;
  status: RoundStatus;
  bettingStartsAt: string;
  bettingEndsAt: string;
  startedAt: string | null;
  crashedAt: string | null;
  crashPointBp: number | null;
  serverSeedHash: string;
  serverSeed: string | null;
  clientSeed: string;
  nonce: number;
  chainIndex: number;
  nextServerSeedHash: string | null;
  bets: BetResponse[];
};

type RoundVerificationSeedFields = Pick<
  RoundResponse,
  | "chainIndex"
  | "clientSeed"
  | "crashPointBp"
  | "nextServerSeedHash"
  | "nonce"
  | "serverSeed"
  | "serverSeedHash"
  | "status"
>;

export type VerifyRoundResponse = RoundVerificationSeedFields & {
  roundId: string;
  revealed: boolean;
  algorithm: string;
  houseEdgeBp: number;
  recalculatedCrashPointBp: number | null;
  serverSeedMatchesCommitment: boolean | null;
  fair: boolean | null;
};

export type PlaceBetInput = {
  amountCents: string;
};

export class GameApi {
  constructor(private readonly client: RequestClient = apiClient) {}

  getCurrentRound(): Promise<RoundResponse | null> {
    return this.client.request<RoundResponse | null>(gameRoutes.currentRound);
  }

  getRoundHistory(limit = 10): Promise<RoundResponse[]> {
    return this.client.request<RoundResponse[]>(
      withLimit(gameRoutes.history, limit),
    );
  }

  verifyRound(roundId: string): Promise<VerifyRoundResponse> {
    return this.client.request<VerifyRoundResponse>(
      gameRoutes.verifyRound(roundId),
    );
  }

  getMyBets(limit = 10): Promise<BetResponse[]> {
    return this.client.request<BetResponse[]>(
      withLimit(gameRoutes.myBets, limit),
      {
        auth: true,
      },
    );
  }

  placeBet(input: PlaceBetInput): Promise<BetResponse> {
    return this.client.request<BetResponse>(gameRoutes.bet, {
      auth: true,
      body: JSON.stringify(input),
      method: "POST",
    });
  }

  cashOut(): Promise<BetResponse> {
    return this.client.request<BetResponse>(gameRoutes.cashout, {
      auth: true,
      method: "POST",
    });
  }
}

export const gameApi = new GameApi();

function withLimit(path: string, limit: number): string {
  return `${path}?${new URLSearchParams({ limit: String(limit) })}`;
}
