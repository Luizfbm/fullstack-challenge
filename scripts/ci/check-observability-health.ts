type Check = {
  name: string;
  url: string;
  expect: (body: string, response: Response) => boolean;
  expectation: string;
};

const checks: Check[] = [
  {
    name: "games metrics",
    url: "http://localhost:8000/games/metrics",
    expect: (body, response) =>
      response.ok &&
      body.includes("crash_game_bets_total") &&
      body.includes("crash_game_wallet_command_duration_ms"),
    expectation:
      "HTTP OK response containing game-domain and wallet latency metrics",
  },
  {
    name: "wallets metrics",
    url: "http://localhost:8000/wallets/metrics",
    expect: (body, response) =>
      response.ok &&
      body.includes("crash_wallet_commands_total") &&
      body.includes("crash_wallet_command_duration_ms"),
    expectation:
      "HTTP OK response containing wallet command and latency metrics",
  },
  {
    name: "prometheus readiness",
    url: "http://localhost:9090/-/ready",
    expect: (_body, response) => response.ok,
    expectation: "HTTP OK readiness response",
  },
  {
    name: "grafana health",
    url: "http://localhost:3001/api/health",
    expect: (body, response) => response.ok && body.includes("database"),
    expectation: "HTTP OK health response containing database",
  },
  {
    name: "jaeger UI",
    url: "http://localhost:16686/",
    expect: (_body, response) => response.ok,
    expectation: "HTTP OK response",
  },
];

const timeoutMs = 120_000;
const intervalMs = 2_000;
const startedAt = Date.now();

for (const check of checks) {
  await waitForCheck(check);
}

export {};

async function waitForCheck(check: Check): Promise<void> {
  let lastFailure = "no request attempted";

  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(check.url, {
        signal: AbortSignal.timeout(5_000),
      });
      const body = await response.text();

      if (check.expect(body, response)) {
        console.log(`${check.name} healthcheck passed: ${check.url}`);
        return;
      }

      lastFailure = `${response.status} ${response.statusText}; expected ${check.expectation}; body: ${body.slice(0, 200)}`;
    } catch (error) {
      lastFailure = error instanceof Error ? error.message : String(error);
    }

    await Bun.sleep(intervalMs);
  }

  throw new Error(
    `${check.name} healthcheck failed at ${check.url}: ${lastFailure}`,
  );
}
