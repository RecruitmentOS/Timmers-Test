// Covers TEST-02 + 03-collaboration-portals — employer/client portal magic-link login
import { test, expect } from "@playwright/test";
import { PortalPage } from "../pages/portal.page";
import { PORTAL_USER } from "../fixtures/test-users";

test.describe.configure({ mode: "parallel" });

test.describe("Portal magic-link login", () => {
  test("employer requests magic link from portal login", async ({ page }) => {
    // Portal login page should render without auth — no seed needed to render the form.
    const portal = new PortalPage(page);
    await portal.gotoLogin();
    await portal.fillEmail(PORTAL_USER.email);
    await portal.submitMagicLink();
    // Must show either a confirmation message OR navigate to a check-email route.
    try {
      await portal.expectMagicLinkSentMessage();
    } catch {
      await expect(page).toHaveURL(/check-email|magic-link|sent|verstuurd/i);
    }
  });
});
