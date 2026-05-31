import { $ } from "bun";
import { mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";

export const KONG_BASE_URL =
  process.env.E2E_KONG_BASE_URL ?? "http://localhost:8000";
export const KEYCLOAK_BASE_URL =
  process.env.E2E_KEYCLOAK_BASE_URL ?? "http://localhost:8080";

const REPO_ROOT = resolve(import.meta.dir, "../../../..");
const COMPOSE_FILE = resolve(REPO_ROOT, "docker-compose.yml");
const LOCK_DIR = resolve(tmpdir(), "crash-game-e2e-lock");
const PLAYER_ID = "9fbd6f4e-4d5e-4e45-9ce0-91f35b72324f";

export type BetResponse = {
  id: string;
  roundId: string;
  playerId: string;
  username: string;
  amountCents: string;
  status:
    | "ACCEPTED"
    | "REJECTED"
    | "CASHOUT_PENDING_CREDIT"
    | "CASHED_OUT"
    | "LOST";
  cashoutMultiplierBp: number | null;
  payoutCents: string | null;
  rejectionReason: string | null;
};

export type RoundResponse = {
  id: string;
  status: "BETTING" | "RUNNING" | "CRASHED" | "SETTLED";
  bettingStartsAt: string;
  bettingEndsAt: string;
  startedAt: string | null;
  crashedAt: string | null;
  crashPointBp: number;
  serverSeedHash: string;
  serverSeed: string | null;
  clientSeed: string;
  nonce: number;
  chainIndex: number;
  nextServerSeedHash: string | null;
  bets: BetResponse[];
};

export type VerifyRoundResponse = {
  roundId: string;
  status: RoundResponse["status"];
  revealed: boolean;
  serverSeedHash: string;
  serverSeed: string | null;
  clientSeed: string;
  nonce: number;
  chainIndex: number;
  nextServerSeedHash: string | null;
  algorithm: string;
  houseEdgeBp: number;
  crashPointBp: number;
  recalculatedCrashPointBp: number | null;
  serverSeedMatchesCommitment: boolean | null;
  fair: boolean | null;
};

export type WalletResponse = {
  playerId: string;
  balanceCents: string;
};

type FetchOptions = RequestInit & {
  token?: string;
};

export async function withE2ELock<T>(callback: () => Promise<T>): Promise<T> {
  while (true) {
    try {
      await mkdir(LOCK_DIR);
      break;
    } catch {
      await Bun.sleep(250);
    }
  }

  try {
    return await callback();
  } finally {
    await rm(LOCK_DIR, { force: true, recursive: true });
  }
}

export async function getAccessToken(): Promise<string> {
  const response = await fetch(
    `${KEYCLOAK_BASE_URL}/realms/crash-game/protocol/openid-connect/token`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "password",
        client_id: "crash-game-client",
        username: "player",
        password: "player123",
      }),
    },
  );

  if (!response.ok) {
    throw new Error(`Keycloak token request failed with ${response.status}`);
  }

  const body = (await response.json()) as { access_token?: string };

  if (!body.access_token) {
    throw new Error("Keycloak token response did not include access_token");
  }

  return body.access_token;
}

export async function apiJson<T>(
  path: string,
  options: FetchOptions = {},
): Promise<T> {
  const response = await apiResponse(path, options);

  if (!response.ok) {
    throw new Error(
      `${options.method ?? "GET"} ${path} failed with ${response.status}: ${await response.text()}`,
    );
  }

  return (await response.json()) as T;
}

export async function apiResponse(
  path: string,
  options: FetchOptions = {},
): Promise<Response> {
  const headers = new Headers(options.headers);

  if (options.token) {
    headers.set("Authorization", `Bearer ${options.token}`);
  }

  return fetch(`${KONG_BASE_URL}${path}`, {
    ...options,
    headers,
  });
}

export async function getCurrentRound(): Promise<RoundResponse | null> {
  return apiJson<RoundResponse | null>("/games/rounds/current");
}

export async function getWallet(token: string): Promise<WalletResponse> {
  return apiJson<WalletResponse>("/wallets/me", { token });
}

export async function placeBet(
  token: string,
  amountCents: string,
): Promise<BetResponse> {
  return apiJson<BetResponse>("/games/bet", {
    method: "POST",
    token,
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ amountCents }),
  });
}

export async function cashOut(token: string): Promise<BetResponse> {
  return apiJson<BetResponse>("/games/bet/cashout", {
    method: "POST",
    token,
  });
}

export async function listMyBets(token: string, limit = 1): Promise<BetResponse[]> {
  return apiJson<BetResponse[]>(`/games/bets/me?limit=${limit}`, { token });
}

export async function verifyRound(
  roundId: string,
): Promise<VerifyRoundResponse> {
  return apiJson<VerifyRoundResponse>(`/games/rounds/${roundId}/verify`);
}

export async function ensureStackIsHealthy(): Promise<void> {
  await waitForHealthyEndpoint("/games/health");
  await waitForHealthyEndpoint("/wallets/health");
}

export async function prepareBettingRound(
  minCrashPointBp = 15000,
): Promise<RoundResponse> {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const currentRound = await waitForCurrentRound();

    if (currentRound.status === "RUNNING") {
      await forceRunningRoundToCrash(currentRound.id);
      await waitForRoundStatus(currentRound.id, "SETTLED");
      continue;
    }

    if (
      currentRound.status === "BETTING" &&
      currentRound.bets.length === 0 &&
      currentRound.crashPointBp >= minCrashPointBp
    ) {
      return currentRound;
    }

    await forceBettingRoundToStart(currentRound.id);
    const runningRound = await waitForCurrentStatus("RUNNING");
    await forceRunningRoundToCrash(runningRound.id);
    await waitForRoundStatus(runningRound.id, "SETTLED");
  }

  throw new Error("Could not prepare a suitable betting round");
}

export async function forceBettingRoundToStart(roundId: string): Promise<void> {
  await runGamesSql(
    `UPDATE rounds SET "bettingEndsAt" = NOW() WHERE id = '${roundId}' AND status = 'BETTING';`,
  );
}

export async function forceRunningRoundToCrash(roundId: string): Promise<void> {
  await runGamesSql(
    `UPDATE rounds SET "startedAt" = NOW() - INTERVAL '1000 days' WHERE id = '${roundId}' AND status = 'RUNNING';`,
  );
}

export async function waitForCurrentStatus(
  status: RoundResponse["status"],
): Promise<RoundResponse> {
  return waitFor(async () => {
    const round = await getCurrentRound();

    return round?.status === status ? round : null;
  }, `current round status ${status}`);
}

export async function waitForRoundStatus(
  roundId: string,
  status: RoundResponse["status"],
): Promise<VerifyRoundResponse> {
  return waitFor(async () => {
    const round = await verifyRound(roundId);

    return round.status === status ? round : null;
  }, `round ${roundId} status ${status}`);
}

export async function setWalletBalance(
  balanceCents: bigint,
): Promise<void> {
  await $`docker compose -f ${COMPOSE_FILE} exec -T postgres psql -U admin -d wallets -c ${`UPDATE wallets SET "balanceCents" = ${balanceCents.toString()} WHERE "playerId" = '${PLAYER_ID}';`}`.quiet();
}

async function waitForCurrentRound(): Promise<RoundResponse> {
  return waitFor(async () => await getCurrentRound(), "current round");
}

async function waitFor<T>(
  callback: () => Promise<T | null>,
  description: string,
  timeoutMs = 60000,
): Promise<T> {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    const result = await callback();

    if (result) {
      return result;
    }

    await Bun.sleep(500);
  }

  throw new Error(`Timed out waiting for ${description}`);
}

async function waitForHealthyEndpoint(path: string): Promise<void> {
  let lastFailure = "no request attempted";

  try {
    await waitFor(async () => {
      try {
        const response = await apiResponse(path);

        if (response.ok) {
          return true;
        }

        lastFailure = `${response.status}: ${await response.text()}`;
        return null;
      } catch (error) {
        lastFailure =
          error instanceof Error ? error.message : "unexpected request failure";
        return null;
      }
    }, `${path} health via Kong`, 30000);
  } catch {
    throw new Error(
      `Timed out waiting for ${path} health via Kong. Last failure: ${lastFailure}`,
    );
  }
}

async function runGamesSql(sql: string): Promise<void> {
  await $`docker compose -f ${COMPOSE_FILE} exec -T postgres psql -U admin -d games -c ${sql}`.quiet();
}
