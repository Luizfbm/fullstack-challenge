type Check = {
  name: string;
  run: () => Promise<string>;
};

const keycloakBaseUrl =
  process.env.KEYCLOAK_BASE_URL ?? "http://localhost:8080";
const timeoutMs = 120_000;
const intervalMs = 2_000;
const startedAt = Date.now();

const checks: Check[] = [
  {
    name: "keycloak admin console",
    run: async () => {
      const response = await fetch(`${keycloakBaseUrl}/admin/master/console/`, {
        signal: AbortSignal.timeout(5_000),
      });
      const body = await response.text();

      if (response.ok && body.includes("Keycloak Administration Console")) {
        return `${response.status} ${response.statusText}`;
      }

      throw new Error(
        `${response.status} ${response.statusText}; expected admin console HTML; body: ${body.slice(0, 200)}`,
      );
    },
  },
  {
    name: "keycloak master admin token",
    run: async () => {
      const form = new URLSearchParams({
        client_id: "admin-cli",
        grant_type: "password",
        password: "admin",
        username: "admin",
      });

      const response = await fetch(
        `${keycloakBaseUrl}/realms/master/protocol/openid-connect/token`,
        {
          body: form,
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
          },
          method: "POST",
          signal: AbortSignal.timeout(5_000),
        },
      );
      const body = await response.text();

      if (!response.ok) {
        throw new Error(
          `${response.status} ${response.statusText}; expected admin token response; body: ${body.slice(0, 200)}`,
        );
      }

      const tokenResponse = JSON.parse(body) as { access_token?: unknown };

      if (typeof tokenResponse.access_token === "string") {
        return `${response.status} ${response.statusText}`;
      }

      throw new Error(
        `${response.status} ${response.statusText}; access_token missing; body: ${body.slice(0, 200)}`,
      );
    },
  },
];

for (const check of checks) {
  await waitForCheck(check);
}

export {};

async function waitForCheck(check: Check): Promise<void> {
  let lastFailure = "no request attempted";

  while (Date.now() - startedAt < timeoutMs) {
    try {
      const detail = await check.run();

      console.log(`${check.name} healthcheck passed: ${detail}`);
      return;
    } catch (error) {
      lastFailure = error instanceof Error ? error.message : String(error);
    }

    await Bun.sleep(intervalMs);
  }

  throw new Error(`${check.name} healthcheck failed: ${lastFailure}`);
}
