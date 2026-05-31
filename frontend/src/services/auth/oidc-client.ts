import { appConfig, type AppConfig } from "../../app/config";
import {
  canRefreshSession,
  createAuthSession,
  isAccessTokenFresh,
  type AuthSession,
  type TokenResponse,
} from "./auth-session";
import { createCodeChallenge, createCodeVerifier } from "./pkce";
import {
  clearPendingLogin,
  clearStoredSession,
  readPendingLogin,
  readStoredSession,
  writePendingLogin,
  writeStoredSession,
  type AuthStorage,
} from "./token-storage";

type BrowserLocation = Pick<
  Location,
  "assign" | "origin" | "pathname" | "search"
>;

type BrowserHistory = Pick<History, "replaceState">;

export type OidcClientOptions = {
  config?: AppConfig;
  cryptoApi?: Crypto;
  fetcher?: typeof fetch;
  history?: BrowserHistory;
  location?: BrowserLocation;
  now?: () => number;
  storage?: AuthStorage;
};

export class OidcClient {
  private readonly config: AppConfig;
  private readonly cryptoApi: Crypto;
  private readonly fetcher: typeof fetch;
  private readonly history: BrowserHistory;
  private readonly location: BrowserLocation;
  private readonly now: () => number;
  private readonly storage: AuthStorage;

  constructor(options: OidcClientOptions = {}) {
    this.config = options.config ?? appConfig;
    this.cryptoApi = options.cryptoApi ?? window.crypto;
    this.fetcher = options.fetcher ?? globalThis.fetch.bind(globalThis);
    this.history = options.history ?? window.history;
    this.location = options.location ?? window.location;
    this.now = options.now ?? Date.now;
    this.storage = options.storage ?? window.sessionStorage;
  }

  async startLogin(): Promise<void> {
    this.location.assign(await this.createAuthorizationUrl());
  }

  async createAuthorizationUrl(): Promise<string> {
    const state = createCodeVerifier(this.cryptoApi);
    const codeVerifier = createCodeVerifier(this.cryptoApi);
    const redirectUri = this.getRedirectUri();
    const codeChallenge = await createCodeChallenge(codeVerifier, this.cryptoApi);
    const url = new URL(this.authorizationEndpoint());

    url.searchParams.set("client_id", this.config.keycloakClientId);
    url.searchParams.set("code_challenge", codeChallenge);
    url.searchParams.set("code_challenge_method", "S256");
    url.searchParams.set("redirect_uri", redirectUri);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("scope", "openid profile email");
    url.searchParams.set("state", state);

    writePendingLogin(this.storage, {
      codeVerifier,
      redirectUri,
      state,
    });

    return url.toString();
  }

  async handleCallback(): Promise<AuthSession | null> {
    const params = new URLSearchParams(this.location.search);
    const code = params.get("code");
    const state = params.get("state");
    const error = params.get("error");

    if (error) {
      clearPendingLogin(this.storage);
      this.clearCallbackParams();
      throw new Error(params.get("error_description") || error);
    }

    if (!code && !state) {
      return null;
    }

    const pendingLogin = readPendingLogin(this.storage);

    if (!code || !state || !pendingLogin || pendingLogin.state !== state) {
      clearPendingLogin(this.storage);
      this.clearCallbackParams();
      throw new Error("Invalid OIDC callback state");
    }

    try {
      const tokenResponse = await this.requestToken({
        code,
        codeVerifier: pendingLogin.codeVerifier,
        redirectUri: pendingLogin.redirectUri,
      });
      const session = createAuthSession(tokenResponse, this.now());

      clearPendingLogin(this.storage);
      writeStoredSession(this.storage, session);
      this.clearCallbackParams();

      return session;
    } catch (error) {
      clearPendingLogin(this.storage);
      this.clearCallbackParams();
      throw error;
    }
  }

  loadSession(): AuthSession | null {
    const session = readStoredSession(this.storage);

    if (!session) {
      return null;
    }

    if (
      isAccessTokenFresh(session, this.now()) ||
      canRefreshSession(session, this.now())
    ) {
      return session;
    }

    clearStoredSession(this.storage);
    return null;
  }

  async getAccessToken(): Promise<string | null> {
    const session = this.loadSession();

    if (!session) {
      return null;
    }

    if (isAccessTokenFresh(session, this.now())) {
      return session.accessToken;
    }

    if (!canRefreshSession(session, this.now())) {
      clearStoredSession(this.storage);
      return null;
    }

    const refreshedSession = createAuthSession(
      await this.refreshToken(session.refreshToken ?? ""),
      this.now(),
    );

    writeStoredSession(this.storage, refreshedSession);

    return refreshedSession.accessToken;
  }

  logout(): void {
    const session = readStoredSession(this.storage);

    clearPendingLogin(this.storage);
    clearStoredSession(this.storage);
    this.location.assign(this.createLogoutUrl(session));
  }

  private async requestToken(input: {
    code: string;
    codeVerifier: string;
    redirectUri: string;
  }): Promise<TokenResponse> {
    return this.postTokenRequest({
      client_id: this.config.keycloakClientId,
      code: input.code,
      code_verifier: input.codeVerifier,
      grant_type: "authorization_code",
      redirect_uri: input.redirectUri,
    });
  }

  private async refreshToken(refreshToken: string): Promise<TokenResponse> {
    return this.postTokenRequest({
      client_id: this.config.keycloakClientId,
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    });
  }

  private async postTokenRequest(
    body: Record<string, string>,
  ): Promise<TokenResponse> {
    const response = await this.fetcher(this.tokenEndpoint(), {
      body: new URLSearchParams(body),
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      method: "POST",
    });

    if (!response.ok) {
      throw new Error(`OIDC token request failed with ${response.status}`);
    }

    return (await response.json()) as TokenResponse;
  }

  private clearCallbackParams(): void {
    this.history.replaceState(null, "", this.location.pathname || "/");
  }

  private createLogoutUrl(session: AuthSession | null): string {
    const url = new URL(this.logoutEndpoint());

    url.searchParams.set("client_id", this.config.keycloakClientId);
    url.searchParams.set("post_logout_redirect_uri", this.getRedirectUri());

    if (session?.idToken) {
      url.searchParams.set("id_token_hint", session.idToken);
    }

    return url.toString();
  }

  private authorizationEndpoint(): string {
    return `${this.realmUrl()}/protocol/openid-connect/auth`;
  }

  private tokenEndpoint(): string {
    return `${this.realmUrl()}/protocol/openid-connect/token`;
  }

  private logoutEndpoint(): string {
    return `${this.realmUrl()}/protocol/openid-connect/logout`;
  }

  private realmUrl(): string {
    return `${this.config.keycloakUrl}/realms/${this.config.keycloakRealm}`;
  }

  private getRedirectUri(): string {
    return `${this.location.origin}/`;
  }
}
