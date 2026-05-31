import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  expect: {
    timeout: 15000,
  },
  outputDir: "quality/reports/playwright",
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  reporter: [["list"], ["html", { open: "never", outputFolder: "quality/reports/playwright-html" }]],
  testDir: "tests/browser",
  timeout: 120000,
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:8000",
    screenshot: "only-on-failure",
    trace: "on-first-retry",
  },
});
