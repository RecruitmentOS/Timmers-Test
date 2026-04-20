import { defineConfig, devices } from "@playwright/test";

/**
 * Phase 09 Playwright config (plan 09-04).
 *
 * Runs the 8 critical user-flow specs under tests/e2e/flows/.
 *
 * Runtime knobs:
 *   - E2E_PORT (default 3002 to match apps/web dev script)
 *   - E2E_BASE_URL (overrides full URL)
 *   - E2E_SKIP_WEBSERVER=1 to test against already-running server
 */
const PORT = Number(process.env.E2E_PORT ?? 3002);
const BASE_URL = process.env.E2E_BASE_URL ?? `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "./tests/e2e/flows",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI
    ? [["github"], ["html", { open: "never" }]]
    : [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
  ],
  webServer: {
    command: process.env.E2E_SKIP_WEBSERVER
      ? "echo 'skipping webServer'"
      : "pnpm dev",
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    stdout: "pipe",
    stderr: "pipe",
  },
});
