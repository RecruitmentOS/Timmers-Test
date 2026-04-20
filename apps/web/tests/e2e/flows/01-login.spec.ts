// Covers TEST-02 + AUTH-01..03 — login flow happy path + invalid password
import { test, expect } from "@playwright/test";
import { LoginPage } from "../pages/login.page";
import { AGENCY_RECRUITER } from "../fixtures/test-users";

test.describe.configure({ mode: "parallel" });

test.describe("Login flow", () => {
  test("recruiter logs in with valid credentials and lands on /pipeline or /dashboard", async ({ page }) => {
    // TODO seed: requires AGENCY_RECRUITER to exist in test DB with correct password hash.
    test.fixme(
      !process.env.E2E_HAS_SEED,
      "Requires seeded AGENCY_RECRUITER — run apps/api/scripts/seed-e2e-users.ts"
    );
    const login = new LoginPage(page);
    await login.goto();
    await login.fillCredentials(AGENCY_RECRUITER.email, AGENCY_RECRUITER.password);
    await login.submit();
    await login.expectLoggedIn();
    await expect(page).toHaveURL(/\/(pipeline|dashboard|inbox)/);
  });

  test("invalid password shows error and stays on /login", async ({ page }) => {
    const login = new LoginPage(page);
    await login.goto();
    await login.fillCredentials(AGENCY_RECRUITER.email, "wrong-password-xyz");
    await login.submit();
    // Error text may say "Invalid credentials" / "Invalid email or password" / NL equivalent.
    await login.expectError(/invalid|onjuist|incorrect|failed/i);
    await expect(page).toHaveURL(/\/login/);
  });
});
