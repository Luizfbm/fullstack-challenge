export type AppConfig = {
  apiBaseUrl: string;
  keycloakUrl: string;
  keycloakRealm: string;
  keycloakClientId: string;
};

type RuntimeEnv = {
  readonly VITE_API_BASE_URL?: string;
  readonly VITE_KEYCLOAK_URL?: string;
  readonly VITE_KEYCLOAK_REALM?: string;
  readonly VITE_KEYCLOAK_CLIENT_ID?: string;
};

export function readAppConfig(env: RuntimeEnv = import.meta.env): AppConfig {
  return {
    apiBaseUrl: normalizeBaseUrl(env.VITE_API_BASE_URL, "http://localhost:8000"),
    keycloakUrl: normalizeBaseUrl(
      env.VITE_KEYCLOAK_URL,
      "http://localhost:8080",
    ),
    keycloakRealm: env.VITE_KEYCLOAK_REALM?.trim() || "crash-game",
    keycloakClientId:
      env.VITE_KEYCLOAK_CLIENT_ID?.trim() || "crash-game-client",
  };
}

export const appConfig = readAppConfig();

function normalizeBaseUrl(value: string | undefined, fallback: string): string {
  const baseUrl = value?.trim() || fallback;

  return baseUrl.replace(/\/+$/, "");
}
