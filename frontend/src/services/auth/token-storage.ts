import type { AuthSession } from "./auth-session";

const SESSION_STORAGE_KEY = "crash-game.auth.session";
const PENDING_LOGIN_STORAGE_KEY = "crash-game.auth.pending";

export type PendingLogin = {
  codeVerifier: string;
  redirectUri: string;
  state: string;
};

export type AuthStorage = Pick<Storage, "getItem" | "removeItem" | "setItem">;

export function readStoredSession(storage: AuthStorage): AuthSession | null {
  const stored = storage.getItem(SESSION_STORAGE_KEY);

  if (!stored) {
    return null;
  }

  try {
    return JSON.parse(stored) as AuthSession;
  } catch {
    clearStoredSession(storage);
    return null;
  }
}

export function writeStoredSession(
  storage: AuthStorage,
  session: AuthSession,
): void {
  storage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
}

export function clearStoredSession(storage: AuthStorage): void {
  storage.removeItem(SESSION_STORAGE_KEY);
}

export function readPendingLogin(storage: AuthStorage): PendingLogin | null {
  const stored = storage.getItem(PENDING_LOGIN_STORAGE_KEY);

  if (!stored) {
    return null;
  }

  try {
    return JSON.parse(stored) as PendingLogin;
  } catch {
    clearPendingLogin(storage);
    return null;
  }
}

export function writePendingLogin(
  storage: AuthStorage,
  pendingLogin: PendingLogin,
): void {
  storage.setItem(PENDING_LOGIN_STORAGE_KEY, JSON.stringify(pendingLogin));
}

export function clearPendingLogin(storage: AuthStorage): void {
  storage.removeItem(PENDING_LOGIN_STORAGE_KEY);
}
