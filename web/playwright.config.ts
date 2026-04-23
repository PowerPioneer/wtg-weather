import { defineConfig, devices } from "@playwright/test";

/**
 * Keep the config tight on purpose — we want the e2e suite to run in CI
 * against `next dev` (or `next start`) with zero external services. Mock
 * data is driven by `USE_MOCK_DATA=true`, and the tile fetch is intercepted
 * inside the tests themselves.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: process.env.PLAYWRIGHT_BASE_URL
    ? undefined
    : {
        command: "pnpm dev",
        url: "http://localhost:3000",
        reuseExistingServer: !process.env.CI,
        env: { USE_MOCK_DATA: "true" },
        timeout: 120_000,
      },
});
