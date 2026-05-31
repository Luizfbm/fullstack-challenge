import { walletRoutes } from "./api-routes";
import { apiClient } from "./http-client";

type RequestClient = {
  request: <T>(
    path: string,
    options?: RequestInit & { auth?: boolean },
  ) => Promise<T>;
};

export type WalletResponse = {
  playerId: string;
  balanceCents: string;
};

export class WalletApi {
  constructor(private readonly client: RequestClient = apiClient) {}

  getMe(): Promise<WalletResponse> {
    return this.client.request<WalletResponse>(walletRoutes.me, {
      auth: true,
    });
  }
}

export const walletApi = new WalletApi();
