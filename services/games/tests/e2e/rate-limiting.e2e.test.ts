import { describe, expect, test } from "bun:test";
import {
  apiResponse,
  ensureStackIsHealthy,
  getAccessToken,
  withE2ELock,
} from "./e2e-helpers";

describe("Kong rate limiting E2E", () => {
  test(
    "limits betting commands without limiting healthchecks or the frontend",
    async () => {
      await withE2ELock(async () => {
        await ensureStackIsHealthy();
        const token = await getAccessToken();

        for (let request = 0; request < 15; request += 1) {
          const gamesHealth = await apiResponse("/games/health");
          const walletsHealth = await apiResponse("/wallets/health");
          const frontend = await apiResponse("/");

          expect(gamesHealth.status).toBe(200);
          expect(walletsHealth.status).toBe(200);
          expect(frontend.status).toBe(200);
        }

        const responses = await Promise.all(
          Array.from({ length: 16 }, () =>
            apiResponse("/games/bet", {
              body: JSON.stringify({ amountCents: "1000" }),
              headers: {
                "Content-Type": "application/json",
              },
              method: "POST",
              token,
            }),
          ),
        );
        const statuses = responses.map((response) => response.status);

        expect(statuses).toContain(429);

        await Bun.sleep(1200);
      });
    },
    { timeout: 120000 },
  );
});
