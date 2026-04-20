// Covers TEST-02 + 05-billing-go-live-mvp — billing dashboard + portal link
// Billing service is dormant-safe (09-02 SUMMARY): tolerates both live Stripe
// portal redirect and unconfigured-stub message.
import { test, expect } from "../fixtures/auth.fixture";
import { BillingPage } from "../pages/billing.page";

test.describe.configure({ mode: "parallel" });

test.describe("Billing dashboard", () => {
  test("recruiter views billing dashboard", async ({ authenticatedPage: page }) => {
    test.fixme(
      !process.env.E2E_HAS_SEED,
      "Requires logged-in recruiter with an organization — seed AGENCY_RECRUITER"
    );
    const billing = new BillingPage(page);
    await billing.goto();
    await expect(page.getByRole("heading", { name: /billing|facturering/i }).first()).toBeVisible();
  });

  test("portal button behaves correctly (live redirect OR dormant-safe stub)", async ({ authenticatedPage: page }) => {
    test.fixme(
      !process.env.E2E_HAS_SEED,
      "Requires logged-in recruiter with an organization — seed AGENCY_RECRUITER"
    );
    const billing = new BillingPage(page);
    await billing.goto();
    await billing.clickPortalButton();
    await billing.expectPortalRedirectOrStubMessage();
  });
});
