import { describe, expect, it, vi } from "vitest";
import { ApiError, HttpClient } from "./http-client";

describe("HttpClient", () => {
  it("builds Kong-routed urls and parses JSON responses", async () => {
    const fetcher = vi.fn(async () =>
      Response.json({ status: "ok" }),
    ) as unknown as typeof fetch;
    const client = new HttpClient({
      baseUrl: "http://localhost:8000/",
      fetcher,
    });

    const body = await client.request<{ status: string }>("/games/health");

    expect(body).toEqual({ status: "ok" });
    expect(fetcher).toHaveBeenCalledWith(
      "http://localhost:8000/games/health",
      expect.objectContaining({
        headers: expect.any(Headers),
      }),
    );
  });

  it("adds bearer auth only when requested", async () => {
    let requestInit: RequestInit | undefined;
    const fetcher: typeof fetch = async (_input, init) => {
      requestInit = init;

      return Response.json({ playerId: "player-1" });
    };
    const client = new HttpClient({
      baseUrl: "http://localhost:8000",
      fetcher,
      getAccessToken: () => "token-1",
    });

    await client.request("/wallets/me", { auth: true });

    const headers = requestInit?.headers;

    expect(headers).toBeInstanceOf(Headers);
    expect((headers as Headers).get("Authorization")).toBe("Bearer token-1");
  });

  it("throws ApiError with response status and body", async () => {
    const fetcher = vi.fn(async () =>
      Response.json({ message: "Unauthorized" }, { status: 401 }),
    ) as unknown as typeof fetch;
    const client = new HttpClient({
      baseUrl: "http://localhost:8000",
      fetcher,
    });

    await expect(client.request("/wallets/me")).rejects.toMatchObject({
      body: { message: "Unauthorized" },
      name: "ApiError",
      status: 401,
    } satisfies Partial<ApiError>);
  });
});
