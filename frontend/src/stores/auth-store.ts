import { create } from "zustand";
import type { AuthSession } from "../services/auth/auth-session";
import { OidcClient } from "../services/auth/oidc-client";

export type AuthStatus = "anonymous" | "authenticated" | "error" | "loading";

export type AuthState = {
  errorMessage: string | null;
  session: AuthSession | null;
  status: AuthStatus;
  getAccessToken: () => Promise<string | null>;
  initialize: () => Promise<void>;
  login: () => Promise<void>;
  logout: () => void;
};

const oidcClient = new OidcClient();
let initializationPromise: Promise<void> | null = null;

export const useAuthStore = create<AuthState>((set) => ({
  errorMessage: null,
  session: null,
  status: "loading",

  getAccessToken: async () => oidcClient.getAccessToken(),

  initialize: async () => {
    initializationPromise ??= initializeAuth(set);

    await initializationPromise;
  },

  login: async () => {
    await oidcClient.startLogin();
  },

  logout: () => {
    set({
      errorMessage: null,
      session: null,
      status: "anonymous",
    });
    oidcClient.logout();
  },
}));

async function initializeAuth(
  set: (
    state:
      | Partial<AuthState>
      | ((state: AuthState) => Partial<AuthState>),
  ) => void,
): Promise<void> {
  try {
    const callbackSession = await oidcClient.handleCallback();
    const session = callbackSession ?? oidcClient.loadSession();

    if (session) {
      set({
        errorMessage: null,
        session,
        status: "authenticated",
      });
      return;
    }

    set({
      errorMessage: null,
      session: null,
      status: "anonymous",
    });
  } catch (error) {
    initializationPromise = null;
    set({
      errorMessage:
        error instanceof Error ? error.message : "Authentication failed",
      session: null,
      status: "error",
    });
  }
}
