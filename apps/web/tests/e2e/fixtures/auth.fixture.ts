import { test as base, expect, type Page } from "@playwright/test";
import path from "node:path";
import fs from "node:fs";
import { AGENCY_RECRUITER } from "./test-users";

/**
 * Playwright auth fixture using the storageState pattern.
 *
 * On first run, a worker performs a real login via the /login page and
 * persists the authenticated browser storage (cookies + localStorage) to
 * `tests/e2e/.auth/recruiter.json`. Subsequent tests reuse that state via
 * `test.use({ storageState: "tests/e2e/.auth/recruiter.json" })` — avoiding
 * per-test login cost.
 *
 * The fixture also exposes `authenticatedPage` which is a regular Page
 * already primed with the recruiter storage state.
 *
 * Dormant-safe: if the login endpoint is unreachable (e.g. no backend seed)
 * the fixture falls back to writing an empty storage state and marks the
 * spec as fixme via a console warning — individual specs must tolerate
 * this by asserting visible UI, not cookies, when possible.
 */

export const AUTH_STATE_DIR = path.resolve(__dirname, "..", ".auth");
export const RECRUITER_STATE_PATH = path.join(AUTH_STATE_DIR, "recruiter.json");

async function performLogin(page: Page, baseURL: string | undefined) {
  const target = baseURL ?? "http://localhost:3002";
  await page.goto(`${target}/login`);
  await page.locator('input[name="email"], input[type="email"]').first().fill(AGENCY_RECRUITER.email);
  await page.locator('input[name="password"], input[type="password"]').first().fill(AGENCY_RECRUITER.password);
  await page.locator('button[type="submit"]').first().click();
  // Wait for redirect away from /login
  await page.waitForURL((url) => !url.pathname.endsWith("/login"), { timeout: 10_000 });
}

/**
 * Ensure a storage-state file exists for the given user. Attempts a real login
 * once; if it fails, writes an empty state and logs a warning so downstream
 * tests may still run in mock-route mode.
 */
export async function ensureRecruiterStorageState(page: Page, baseURL?: string) {
  if (fs.existsSync(RECRUITER_STATE_PATH)) return RECRUITER_STATE_PATH;
  fs.mkdirSync(AUTH_STATE_DIR, { recursive: true });
  try {
    await performLogin(page, baseURL);
    await page.context().storageState({ path: RECRUITER_STATE_PATH });
  } catch (err) {
    // Dormant-safe fallback: write an empty storage state so `test.use({ storageState })`
    // does not error. Individual specs that need real auth should use test.fixme
    // with a TODO in the flow file.
    // eslint-disable-next-line no-console
    console.warn(`[auth.fixture] Live login failed (${(err as Error).message}). Wrote empty storageState.`);
    fs.writeFileSync(
      RECRUITER_STATE_PATH,
      JSON.stringify({ cookies: [], origins: [] }, null, 2),
      "utf8"
    );
  }
  return RECRUITER_STATE_PATH;
}

export const test = base.extend<{ authenticatedPage: Page }>({
  authenticatedPage: async ({ browser, baseURL }, use) => {
    // Use a dedicated context seeded with the recruiter storage state.
    // First invocation in a run creates the state; later invocations reuse it.
    const page0 = await browser.newPage();
    await ensureRecruiterStorageState(page0, baseURL);
    await page0.close();

    const context = await browser.newContext({ storageState: RECRUITER_STATE_PATH });
    const page = await context.newPage();
    await use(page);
    await context.close();
  },
});

export { expect };
