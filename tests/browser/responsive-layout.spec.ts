import { expect, test, type Page } from "@playwright/test";

const viewports = [
  { height: 844, label: "mobile", width: 390 },
  { height: 1024, label: "tablet", width: 768 },
  { height: 768, label: "laptop", width: 1024 },
  { height: 900, label: "desktop", width: 1440 },
];

for (const viewport of viewports) {
  test(`premium casino layout fits ${viewport.label} ${viewport.width}x${viewport.height}`, async ({
    page,
  }) => {
    await page.setViewportSize({
      height: viewport.height,
      width: viewport.width,
    });
    await page.goto("/");

    await expect(page.getByRole("heading", { name: "Chrono Crash" }))
      .toBeVisible();
    await expect(page.getByLabel("Arcade arena")).toBeVisible();
    await expect(page.getByTestId("bet-slip-panel")).toBeVisible();
    await expect(page.getByTestId("crash-flight-canvas")).toBeVisible();

    const layout = await readResponsiveLayout(page);

    expect(layout.overflowX).toBe(false);
    expect(layout.stageVisible).toBe(true);
    expect(layout.betSlipVisible).toBe(true);

    if (viewport.width < 1024) {
      expect(layout.betSlipAfterStage).toBe(true);
      expect(layout.technicalTabsAfterBetSlip).toBe(true);
      expect(layout.mobileDockVisible).toBe(true);
    } else {
      expect(layout.betSlipBesideStage).toBe(true);
    }
  });
}

async function readResponsiveLayout(page: Page) {
  return page.evaluate(() => {
    const stage = document.querySelector('[aria-label="Arcade arena"]');
    const betSlip = document.querySelector('[data-testid="bet-slip-panel"]');
    const mobileDock = document.querySelector('[data-testid="mobile-bet-dock"]');
    const technicalTabs = document.querySelector(
      '[data-testid="stage-technical-tabs-slot"]',
    );
    const stageRect = stage?.getBoundingClientRect();
    const betSlipRect = betSlip?.getBoundingClientRect();
    const dockRect = mobileDock?.getBoundingClientRect();
    const technicalRect = technicalTabs?.getBoundingClientRect();

    return {
      betSlipAfterStage: Boolean(
        stageRect && betSlipRect && betSlipRect.top >= stageRect.top,
      ),
      betSlipBesideStage: Boolean(
        stageRect &&
          betSlipRect &&
          betSlipRect.left > stageRect.left &&
          betSlipRect.top < stageRect.bottom,
      ),
      betSlipVisible: Boolean(
        betSlipRect && betSlipRect.width > 0 && betSlipRect.height > 0,
      ),
      mobileDockVisible: Boolean(
        dockRect && dockRect.width > 0 && dockRect.height > 0,
      ),
      overflowX:
        document.documentElement.scrollWidth > window.innerWidth ||
        document.body.scrollWidth > window.innerWidth,
      stageVisible: Boolean(
        stageRect && stageRect.width > 0 && stageRect.height > 0,
      ),
      technicalTabsAfterBetSlip: Boolean(
        betSlipRect && technicalRect && technicalRect.top >= betSlipRect.top,
      ),
    };
  });
}
