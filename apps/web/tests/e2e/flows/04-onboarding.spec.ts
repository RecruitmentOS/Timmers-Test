// Covers TEST-02 + 01-foundation — multi-step onboarding wizard
import { test, expect } from "@playwright/test";
import { OnboardingPage } from "../pages/onboarding.page";

test.describe.configure({ mode: "parallel" });

test.describe("Onboarding wizard", () => {
  test("new user completes multi-step onboarding and reaches dashboard", async ({ page }) => {
    // TODO seed: requires ONBOARDING_USER with onboardingCompletedAt = NULL and a live session cookie.
    test.fixme(
      !process.env.E2E_HAS_SEED,
      "Requires seeded ONBOARDING_USER + session cookie — see tests/e2e/README.md"
    );
    const onboarding = new OnboardingPage(page);
    await onboarding.goto();
    await onboarding.fillStep1Organization({ name: "E2E Test Co", mode: "agency" });
    await onboarding.nextStep();
    await onboarding.fillStep2Team();
    await onboarding.nextStep();
    await onboarding.finish();
    await onboarding.expectDashboard();
    await expect(page).toHaveURL(/\/(dashboard|pipeline)/);
  });
});
