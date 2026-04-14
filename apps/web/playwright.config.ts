import { defineConfig, devices } from "@playwright/test";

/**
 * Phase 2 Playwright config.
 *
 * The only test right now is the mandatory pipeline drag-end smoke test
 * (02-CONTEXT.md line 36). It intercepts the API and verifies that a
 * pointer drag over a card triggers the stage move mutation — our
 * regression guard for adopting pre-1.0 `@dnd-kit/react@0.3.2`.
 */
export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 60_000,
  fullyParallel: false,
  retries: process.env.CI ? 2 : 1,
  reporter: "line",
  use: {
    baseURL: "http://localhost:3002",
    trace: "retain-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: "pnpm dev",
    url: "http://localhost:3002",
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    stdout: "pipe",
    stderr: "pipe",
  },
});
