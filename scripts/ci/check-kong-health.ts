const checks = [
  {
    name: "games",
    url: "http://localhost:8000/games/health",
  },
  {
    name: "wallets",
    url: "http://localhost:8000/wallets/health",
  },
];

const timeoutMs = 120_000;
const intervalMs = 2_000;
const startedAt = Date.now();

for (const check of checks) {
  await waitForHealth(check.name, check.url);
}

export {};

async function waitForHealth(name: string, url: string): Promise<void> {
  let lastError = "";

  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(url);

      if (response.ok) {
        console.log(`${name} healthcheck passed: ${url}`);
        return;
      }

      lastError = `${response.status} ${response.statusText}`;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }

    await Bun.sleep(intervalMs);
  }

  throw new Error(`${name} healthcheck failed at ${url}: ${lastError}`);
}
