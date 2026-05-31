import { describe, expect, it } from "vitest";
import { WalletApi } from "./wallet-api";

describe("WalletApi", () => {
  it("loads the authenticated wallet", async () => {
    const requests: Array<{
      path: string;
      options?: RequestInit & { auth?: boolean };
    }> = [];
    const api = new WalletApi({
      request: async <T>(
        path: string,
        options?: RequestInit & { auth?: boolean },
      ): Promise<T> => {
        requests.push({ path, options });

        return { balanceCents: "100000", playerId: "player-1" } as T;
      },
    });

    await expect(api.getMe()).resolves.toEqual({
      balanceCents: "100000",
      playerId: "player-1",
    });
    expect(requests).toEqual([
      {
        path: "/wallets/me",
        options: { auth: true },
      },
    ]);
  });
});
