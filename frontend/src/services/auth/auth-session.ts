import { base64UrlDecode } from "./pkce";

const CLOCK_SKEW_MS = 30_000;

export type TokenResponse = {
  access_token: string;
  refresh_token?: string;
  id_token?: string;
  expires_in: number;
  refresh_expires_in?: number;
  token_type: string;
};

export type JwtPayload = {
  sub?: string;
  preferred_username?: string;
  name?: string;
  email?: string;
  exp?: number;
};

export type AuthSession = {
  accessToken: string;
  refreshToken: string | null;
  idToken: string | null;
  tokenType: string;
  expiresAt: number;
  refreshExpiresAt: number | null;
  subject: string;
  username: string;
};

export function createAuthSession(
  response: TokenResponse,
  issuedAt = Date.now(),
): AuthSession {
  const payload = decodeJwtPayload(response.access_token);

  return {
    accessToken: response.access_token,
    refreshToken: response.refresh_token ?? null,
    idToken: response.id_token ?? null,
    tokenType: response.token_type,
    expiresAt: issuedAt + response.expires_in * 1000,
    refreshExpiresAt: response.refresh_expires_in
      ? issuedAt + response.refresh_expires_in * 1000
      : null,
    subject: payload.sub ?? "",
    username: getUsername(payload),
  };
}

export function decodeJwtPayload(token: string): JwtPayload {
  const [, payload] = token.split(".");

  if (!payload) {
    throw new Error("JWT does not include a payload");
  }

  return JSON.parse(base64UrlDecode(payload)) as JwtPayload;
}

export function getUsername(payload: JwtPayload): string {
  return (
    payload.preferred_username?.trim() ||
    payload.name?.trim() ||
    payload.email?.trim() ||
    payload.sub?.trim() ||
    "player"
  );
}

export function isAccessTokenFresh(
  session: AuthSession,
  now = Date.now(),
): boolean {
  return session.expiresAt - CLOCK_SKEW_MS > now;
}

export function canRefreshSession(
  session: AuthSession,
  now = Date.now(),
): boolean {
  if (!session.refreshToken) {
    return false;
  }

  if (!session.refreshExpiresAt) {
    return true;
  }

  return session.refreshExpiresAt - CLOCK_SKEW_MS > now;
}
