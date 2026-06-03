import { execFileSync } from "node:child_process";
import { expect, test, type Page } from "@playwright/test";

type PreparedRound = {
  chainIndex: number;
  crashPointBp: number;
  extendedBettingWindowMs: number | null;
  multiplier: string;
  roundId: string;
  scenario: string;
  status: string;
};

test("player can login, bet, cash out, and keep the realtime table visible", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { exact: true, name: "Entrar" }).click();

  await page.locator('input[name="username"]').fill("player");
  await page.locator('input[name="password"]').fill("player123");
  await page.locator('button[type="submit"]').click();

  await expect(page).toHaveURL("http://localhost:8000/");
  await expect(page.getByRole("banner").getByText("player")).toBeVisible();

  const preparedRound = prepareBrowserCashoutRound();

  await page.reload();

  await expectPreparedBettingRound(page, preparedRound);
  await page.getByRole("tab", { name: "Round State" }).click();
  await expect(
    page.getByText(
      "multiplierBp = floor(10000 * exp(0.05 * elapsedSeconds))",
    ).first(),
  ).toBeVisible();
  await expect(
    page.getByText("curva exponencial 5.00%/s").first(),
  ).toBeVisible();

  const balanceBeforeBet = await readDisplayedBalance(page);

  await expect(page.getByRole("button", { name: "Apostar" })).toBeEnabled();
  await page.getByRole("button", { name: "Apostar" }).click();

  await expect(page.getByText("Aposta ativa: ACCEPTED")).toBeVisible();
  await expect(async () => {
    const balanceAfterBet = await readDisplayedBalance(page);

    expect(balanceAfterBet).not.toBe(balanceBeforeBet);
  }).toPass();
  const balanceAfterBet = await readDisplayedBalance(page);

  forceBettingRoundToStart(preparedRound.roundId);

  await expect(page.getByRole("button", { name: "Cash Out" })).toBeEnabled();
  await page.getByRole("button", { name: "Cash Out" }).click();

  await page.getByRole("tab", { name: "Mesa" }).click();
  await expect(page.getByText("CASHED_OUT")).toBeVisible();
  await expectStageAssetsLoaded(page);
  await expectCanvasHasPixels(page);
  await expect(page.getByRole("heading", { name: "Chrono Crash" })).toBeVisible();
  await expect(async () => {
    const currentBalance = await readDisplayedBalance(page);

    expect(currentBalance).not.toBe(balanceAfterBet);
  }).toPass();
});

test("player can use auto cashout preset without manual cashout", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { exact: true, name: "Entrar" }).click();

  await page.locator('input[name="username"]').fill("player");
  await page.locator('input[name="password"]').fill("player123");
  await page.locator('button[type="submit"]').click();

  await expect(page).toHaveURL("http://localhost:8000/");
  await expect(page.getByRole("banner").getByText("player")).toBeVisible();

  const preparedRound = prepareBrowserCashoutRound();

  await page.reload();

  await expectPreparedBettingRound(page, preparedRound);
  await expect(page.getByText("Limite: 1.01x a 1000.00x")).toBeVisible();

  const balanceBeforeBet = await readDisplayedBalance(page);

  await page.getByRole("button", { name: /Auto cashout/ }).click();
  await page.getByRole("button", { name: "1.50x" }).click();
  await page.getByRole("button", { name: "Apostar" }).click();

  await expect(page.getByText("Auto cashout em 1.50x")).toBeVisible();
  await expect(async () => {
    const balanceAfterBet = await readDisplayedBalance(page);

    expect(balanceAfterBet).not.toBe(balanceBeforeBet);
  }).toPass();
  const balanceAfterBet = await readDisplayedBalance(page);

  forceBettingRoundToStart(preparedRound.roundId);

  await page.getByRole("tab", { name: "Mesa" }).click();
  await expect(
    page.getByText(/CASHOUT_PENDING_CREDIT|CASHED_OUT/).first(),
  ).toBeVisible({ timeout: 20000 });
  await expectStageAssetsLoaded(page);
  await expectCanvasHasPixels(page);
  await expect(async () => {
    const currentBalance = await readDisplayedBalance(page);

    expect(currentBalance).not.toBe(balanceAfterBet);
  }).toPass({ timeout: 60000 });
});

test("player can configure and stop a martingale auto bet session", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { exact: true, name: "Entrar" }).click();

  await page.locator('input[name="username"]').fill("player");
  await page.locator('input[name="password"]').fill("player123");
  await page.locator('button[type="submit"]').click();

  await expect(page).toHaveURL("http://localhost:8000/");
  await expect(page.getByRole("banner").getByText("player")).toBeVisible();

  const preparedRound = prepareBrowserCashoutRound();

  await page.reload();

  await expectPreparedBettingRound(page, preparedRound);

  await page.getByRole("button", { exact: true, name: "Auto" }).click();
  await page.getByRole("button", { name: "Martingale" }).click();
  await page.getByLabel("Rodadas maximas").fill("4");
  await page.getByLabel("Multiplicador Martingale").fill("2");
  await page.getByLabel("Passos Martingale").fill("3");

  await expect(page.getByRole("button", { name: "Iniciar Auto Bet" }))
    .toBeEnabled();
  await page.getByRole("button", { name: "Iniciar Auto Bet" }).click();

  await expect(page.getByText("Auto Bet ativo")).toBeVisible();
  await expect(page.getByText("Martingale", { exact: true }).first())
    .toBeVisible();
  await expect(page.getByText("Proxima aposta")).toBeVisible();
  await expect(page.getByText("0 / 4")).toBeVisible();
  await expect(page.getByText("0 / 3")).toBeVisible();

  await page.getByRole("button", { name: "Parar Auto Bet" }).click();

  await expect(page.getByText("Ultimo Auto Bet")).toBeVisible();
  await expect(page.getByText("Parado manualmente")).toBeVisible();
});

async function readDisplayedBalance(page: Page): Promise<string> {
  const balance = page.getByLabel("Conta do jogador").locator("p").last();

  await expect(balance).toHaveText(/^R\$/);

  return balance.innerText();
}

async function expectPreparedBettingRound(
  page: Page,
  preparedRound: PreparedRound,
) {
  await expect(page.getByText("connected BETTING").first()).toBeVisible();
  await expect(page.getByText("Rodada inicia em").first()).toBeVisible();
  await expect(async () => {
    const response = await page.request.get("/games/rounds/current");

    expect(response.ok()).toBe(true);

    const currentRound = (await response.json()) as {
      chainIndex: number;
      id: string;
      status: string;
    };

    expect(currentRound).toMatchObject({
      chainIndex: preparedRound.chainIndex,
      id: preparedRound.roundId,
      status: "BETTING",
    });
  }).toPass();
}

async function expectStageAssetsLoaded(page: Page) {
  const requiredAssets = [
    "/models/time-machine-low-poly.glb",
    "/models/blackhole_pixel_pass_3.glb",
  ];

  await expect(async () => {
    const loadedAssets = await page.evaluate(() =>
      performance
        .getEntriesByType("resource")
        .map((entry) => entry.name),
    );

    for (const requiredAsset of requiredAssets) {
      expect(
        loadedAssets.some((assetName) => assetName.includes(requiredAsset)),
      ).toBe(true);
    }
  }).toPass();
}

async function expectCanvasHasPixels(page: Page) {
  await expect(page.getByTestId("crash-flight-canvas")).toBeVisible();
  await expect(async () => {
    const hasPixels = await page
      .getByTestId("crash-flight-canvas")
      .evaluate((node) => {
        const canvas = node as HTMLCanvasElement;
        const context = canvas.getContext("2d");

        if (context) {
          const pixel = context.getImageData(0, 0, 1, 1).data;

          return pixel.some((value) => value !== 0);
        }

        return canvas.toDataURL("image/png").length > 1000;
      });

    expect(hasPixels).toBe(true);
  }).toPass();
}

function prepareBrowserCashoutRound(): PreparedRound {
  const output = execFileSync("bun", ["run", "e2e:prepare", "cashout"], {
    encoding: "utf8",
    env: {
      ...process.env,
      E2E_PREPARE_BETTING_WINDOW_MS: "60000",
    },
  });

  process.stdout.write(output);

  return parsePreparedRound(output);
}

function parsePreparedRound(output: string): PreparedRound {
  const jsonStart = output.indexOf("{");

  if (jsonStart < 0) {
    throw new Error(`Could not parse deterministic round output: ${output}`);
  }

  return JSON.parse(output.slice(jsonStart)) as PreparedRound;
}

function forceBettingRoundToStart(roundId: string): void {
  execFileSync(
    "docker",
    [
      "compose",
      "exec",
      "-T",
      "postgres",
      "psql",
      "-U",
      "admin",
      "-d",
      "games",
      "-c",
      `UPDATE rounds SET "bettingEndsAt" = NOW() WHERE id = '${roundId}' AND status = 'BETTING';`,
    ],
    { stdio: "inherit" },
  );
}
