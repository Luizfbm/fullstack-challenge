import { describe, expect, it, vi } from "vitest";
import { base64UrlEncode } from "./pkce";
import { OidcClient } from "./oidc-client";

describe("OidcClient", () => {
  it("builds a Keycloak authorization URL with PKCE S256", async () => {
    const storage = new MemoryStorage();
    const client = createClient({ storage });
    const url = new URL(await client.createAuthorizationUrl());

    expect(url.origin + url.pathname).toBe(
      "http://localhost:8080/realms/crash-game/protocol/openid-connect/auth",
    );
    expect(url.searchParams.get("client_id")).toBe("crash-game-client");
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
    expect(url.searchParams.get("redirect_uri")).toBe("http://localhost:8000/");
    expect(url.searchParams.get("response_type")).toBe("code");
    expect(storage.getItem("crash-game.auth.pending")).toContain(
      url.searchParams.get("state") ?? "",
    );
  });

  it("exchanges callback code for tokens and clears callback query params", async () => {
    const storage = new MemoryStorage();
    const location = createLocation();
    const history = { replaceState: vi.fn() };
    const fetcher = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      const body = init?.body as URLSearchParams;

      expect(body.get("code")).toBe("auth-code");
      expect(body.get("grant_type")).toBe("authorization_code");
      expect(body.get("redirect_uri")).toBe("http://localhost:8000/");

      return Response.json({
        access_token: createJwt({
          preferred_username: "player",
          sub: "player-id",
        }),
        expires_in: 3600,
        refresh_expires_in: 7200,
        refresh_token: "refresh-token",
        token_type: "Bearer",
      });
    }) as unknown as typeof fetch;
    const client = createClient({ fetcher, history, location, storage });
    const authorizationUrl = new URL(await client.createAuthorizationUrl());

    location.search = `?code=auth-code&state=${authorizationUrl.searchParams.get("state")}`;

    const session = await client.handleCallback();

    expect(session?.username).toBe("player");
    expect(storage.getItem("crash-game.auth.pending")).toBeNull();
    expect(storage.getItem("crash-game.auth.session")).toContain("player");
    expect(history.replaceState).toHaveBeenCalledWith(null, "", "/");
  });

  it("rejects callbacks with invalid state", async () => {
    const storage = new MemoryStorage();
    const location = createLocation("?code=auth-code&state=invalid");
    const client = createClient({ location, storage });

    await expect(client.handleCallback()).rejects.toThrow(
      "Invalid OIDC callback state",
    );
  });

  it("clears stale callback params when token exchange fails", async () => {
    const storage = new MemoryStorage();
    const location = createLocation();
    const history = { replaceState: vi.fn() };
    const client = createClient({
      fetcher: async () =>
        Response.json({ error: "invalid_grant" }, { status: 400 }),
      history,
      location,
      storage,
    });
    const authorizationUrl = new URL(await client.createAuthorizationUrl());

    location.search = `?code=stale-code&state=${authorizationUrl.searchParams.get(
      "state",
    )}`;

    await expect(client.handleCallback()).rejects.toThrow(
      "OIDC token request failed with 400",
    );
    expect(storage.getItem("crash-game.auth.pending")).toBeNull();
    expect(history.replaceState).toHaveBeenCalledWith(null, "", "/");
  });
});

function createClient(
  options: Partial<ConstructorParameters<typeof OidcClient>[0]> = {},
): OidcClient {
  return new OidcClient({
    config: {
      apiBaseUrl: "http://localhost:8000",
      keycloakClientId: "crash-game-client",
      keycloakRealm: "crash-game",
      keycloakUrl: "http://localhost:8080",
    },
    cryptoApi: deterministicCrypto(),
    fetcher: async () => Response.json({}),
    history: { replaceState: vi.fn() },
    location: createLocation(),
    now: () => 1_000,
    storage: new MemoryStorage(),
    ...options,
  });
}

function deterministicCrypto(): Crypto {
  return {
    getRandomValues: <T extends ArrayBufferView | null>(array: T): T => {
      if (array) {
        new Uint8Array(array.buffer, array.byteOffset, array.byteLength).fill(7);
      }

      return array;
    },
    subtle: crypto.subtle,
  } as Crypto;
}

function createLocation(search = "") {
  return {
    assign: vi.fn(),
    origin: "http://localhost:8000",
    pathname: "/",
    search,
  };
}

function createJwt(payload: Record<string, unknown>): string {
  return [
    base64UrlEncode(new TextEncoder().encode(JSON.stringify({ alg: "none" }))),
    base64UrlEncode(new TextEncoder().encode(JSON.stringify(payload))),
    "signature",
  ].join(".");
}

class MemoryStorage implements Storage {
  private readonly values = new Map<string, string>();

  get length(): number {
    return this.values.size;
  }

  clear(): void {
    this.values.clear();
  }

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  key(index: number): string | null {
    return Array.from(this.values.keys())[index] ?? null;
  }

  removeItem(key: string): void {
    this.values.delete(key);
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }
}
