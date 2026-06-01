import { execFileSync } from "node:child_process";
import { expect, test, type Page } from "@playwright/test";

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

  execFileSync("bun", ["run", "e2e:prepare", "cashout"], {
    stdio: "inherit",
  });

  await page.reload();

  await expect(page.getByText("LIVE").first()).toBeVisible();
  await expect(page.getByText("BETTING").first()).toBeVisible();
  await page.getByRole("tab", { name: "Round State" }).click();
  await expect(
    page.getByText(
      "multiplierBp = 10000 + floor(elapsedMs * 1000 / 1000)",
    ).first(),
  ).toBeVisible();
  await expect(
    page.getByText("1.00x + 0.10x por segundo").first(),
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

  await expect(page.getByRole("button", { name: "Cash Out" })).toBeEnabled();
  await page.getByRole("button", { name: "Cash Out" }).click();

  await page.getByRole("tab", { name: "Mesa" }).click();
  await expect(page.getByText("CASHED_OUT")).toBeVisible();
  await expectTimeCarAssetLoaded(page);
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

  execFileSync("bun", ["run", "e2e:prepare", "cashout"], {
    stdio: "inherit",
  });

  await page.reload();

  await expect(page.getByText("LIVE").first()).toBeVisible();
  await expect(page.getByText("BETTING").first()).toBeVisible();
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

  await page.getByRole("tab", { name: "Mesa" }).click();
  await expect(
    page.getByText(/CASHOUT_PENDING_CREDIT|CASHED_OUT/).first(),
  ).toBeVisible({ timeout: 20000 });
  await expectTimeCarAssetLoaded(page);
  await expectCanvasHasPixels(page);
  await expect(async () => {
    const currentBalance = await readDisplayedBalance(page);

    expect(currentBalance).not.toBe(balanceAfterBet);
  }).toPass({ timeout: 60000 });
});

async function readDisplayedBalance(page: Page): Promise<string> {
  const balance = page.getByTestId("metric-saldo").locator("p").last();

  await expect(balance).toBeVisible();

  return balance.innerText();
}

async function expectTimeCarAssetLoaded(page: Page) {
  await expect(async () => {
    const assetLoaded = await page.evaluate(() =>
      performance
        .getEntriesByType("resource")
        .some((entry) => entry.name.includes("/models/time-machine-low-poly.glb")),
    );

    expect(assetLoaded).toBe(true);
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
