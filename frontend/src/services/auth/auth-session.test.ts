import { describe, expect, it } from "vitest";
import {
  canRefreshSession,
  createAuthSession,
  decodeJwtPayload,
  isAccessTokenFresh,
} from "./auth-session";
import { base64UrlEncode } from "./pkce";

describe("auth session helpers", () => {
  it("extracts username and expiry metadata from a token response", () => {
    const session = createAuthSession(
      {
        access_token: createJwt({
          preferred_username: "player",
          sub: "player-id",
        }),
        expires_in: 60,
        refresh_expires_in: 120,
        refresh_token: "refresh-token",
        token_type: "Bearer",
      },
      1_000,
    );

    expect(session).toMatchObject({
      expiresAt: 61_000,
      refreshExpiresAt: 121_000,
      refreshToken: "refresh-token",
      subject: "player-id",
      tokenType: "Bearer",
      username: "player",
    });
  });

  it("checks access token and refresh token freshness with clock skew", () => {
    const session = createAuthSession(
      {
        access_token: createJwt({ preferred_username: "player" }),
        expires_in: 60,
        refresh_expires_in: 120,
        refresh_token: "refresh-token",
        token_type: "Bearer",
      },
      0,
    );

    expect(isAccessTokenFresh(session, 20_000)).toBe(true);
    expect(isAccessTokenFresh(session, 31_000)).toBe(false);
    expect(canRefreshSession(session, 80_000)).toBe(true);
    expect(canRefreshSession(session, 91_000)).toBe(false);
  });

  it("decodes base64url JWT payloads", () => {
    expect(decodeJwtPayload(createJwt({ email: "player@test.dev" }))).toEqual({
      email: "player@test.dev",
    });
  });
});

function createJwt(payload: Record<string, unknown>): string {
  return [
    base64UrlEncode(new TextEncoder().encode(JSON.stringify({ alg: "none" }))),
    base64UrlEncode(new TextEncoder().encode(JSON.stringify(payload))),
    "signature",
  ].join(".");
}
