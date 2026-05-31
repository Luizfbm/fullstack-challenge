import { describe, expect, it } from "vitest";
import { readAppConfig } from "./config";

describe("readAppConfig", () => {
  it("uses local defaults when env values are missing", () => {
    expect(readAppConfig({})).toEqual({
      apiBaseUrl: "http://localhost:8000",
      keycloakClientId: "crash-game-client",
      keycloakRealm: "crash-game",
      keycloakUrl: "http://localhost:8080",
    });
  });

  it("normalizes configured base urls", () => {
    expect(
      readAppConfig({
        VITE_API_BASE_URL: "http://kong.local/",
        VITE_KEYCLOAK_CLIENT_ID: "client",
        VITE_KEYCLOAK_REALM: "realm",
        VITE_KEYCLOAK_URL: "http://keycloak.local//",
      }),
    ).toEqual({
      apiBaseUrl: "http://kong.local",
      keycloakClientId: "client",
      keycloakRealm: "realm",
      keycloakUrl: "http://keycloak.local",
    });
  });
});
