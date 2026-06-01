import { describe, expect, it } from "vitest";
import { GameApi } from "./game-api";

describe("GameApi", () => {
  it("loads current round through the Kong-routed games API", async () => {
    const client = createClient({ id: "round-1" });
    const api = new GameApi(client);

    await expect(api.getCurrentRound()).resolves.toEqual({ id: "round-1" });
    expect(client.requests[0]).toMatchObject({
      path: "/games/rounds/current",
      options: undefined,
    });
  });

  it("loads history and player bets with pagination", async () => {
    const client = createClient([]);
    const api = new GameApi(client);

    await api.getRoundHistory(8);
    await api.getMyBets(5);

    expect(client.requests).toEqual([
      {
        path: "/games/rounds/history?limit=8",
        options: undefined,
      },
      {
        path: "/games/bets/me?limit=5",
        options: { auth: true },
      },
    ]);
  });

  it("places bets and cashes out with authenticated POST requests", async () => {
    const client = createClient({ id: "bet-1" });
    const api = new GameApi(client);

    await api.placeBet({ amountCents: "1000" });
    await api.cashOut();

    expect(client.requests).toEqual([
      {
        path: "/games/bet",
        options: {
          auth: true,
          body: JSON.stringify({ amountCents: "1000" }),
          method: "POST",
        },
      },
      {
        path: "/games/bet/cashout",
        options: {
          auth: true,
          method: "POST",
        },
      },
    ]);
  });

  it("loads provably fair verification for a selected round", async () => {
    const client = createClient({ fair: true });
    const api = new GameApi(client);

    await api.verifyRound("round/with spaces");

    expect(client.requests[0]).toMatchObject({
      path: "/games/rounds/round%2Fwith%20spaces/verify",
    });
  });

  it("loads leaderboard with period and limit", async () => {
    const client = createClient([]);
    const api = new GameApi(client);

    await api.getLeaderboard({ limit: 25, period: "7d" });

    expect(client.requests[0]).toEqual({
      path: "/games/leaderboard?period=7d&limit=25",
      options: undefined,
    });
  });
});

type RequestRecord = {
  path: string;
  options?: RequestInit & { auth?: boolean };
};

function createClient(response: unknown) {
  const requests: RequestRecord[] = [];

  return {
    requests,
    request: async <T>(
      path: string,
      options?: RequestInit & { auth?: boolean },
    ): Promise<T> => {
      requests.push({ path, options });

      return response as T;
    },
  };
}
