// Covers TEST-02 — settings display-name persistence
import { test, expect } from "../fixtures/auth.fixture";
import { SettingsPage } from "../pages/settings.page";

test.describe.configure({ mode: "parallel" });

test.describe("Settings", () => {
  let previousName = "";

  test("recruiter updates display name and sees persisted value after reload", async ({ authenticatedPage: page }) => {
    test.fixme(
      !process.env.E2E_HAS_SEED,
      "Requires logged-in recruiter — seed AGENCY_RECRUITER"
    );
    const settings = new SettingsPage(page);
    await settings.goto();
    previousName = await settings.readDisplayName();

    await settings.updateDisplayName("E2E Updated Name");
    await settings.save();
    await settings.expectSavedToast();

    // Reload the page and verify the name persisted.
    await page.reload();
    const persisted = await settings.readDisplayName();
    expect(persisted).toBe("E2E Updated Name");
  });

  test.afterEach(async ({ authenticatedPage: page }) => {
    // Best-effort restore of the previous display name so subsequent runs are idempotent.
    if (!previousName) return;
    try {
      const settings = new SettingsPage(page);
      await settings.goto();
      await settings.updateDisplayName(previousName);
      await settings.save();
    } catch {
      // If cleanup fails (e.g. fixme test did not run), ignore.
    }
  });
});
