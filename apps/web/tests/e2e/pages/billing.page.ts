import { expect, type Page } from "@playwright/test";

/**
 * BillingPage — Stripe billing dashboard wrapper.
 * Route: /billing
 *
 * The billing service is dormant-safe (05-billing + 09-02 SUMMARY): if
 * Stripe is unconfigured, the page shows a stub notice; if configured,
 * the portal button redirects to billing.stripe.com. Tests must tolerate both.
 */
export class BillingPage {
  constructor(private readonly page: Page) {}

  async goto() {
    await this.page.goto("/billing");
  }

  async expectDormantNotice() {
    await expect(
      this.page.getByText(/not configured|dormant|stripe.*disabled/i).first()
    ).toBeVisible({ timeout: 5_000 });
  }

  async clickPortalButton() {
    await this.page
      .getByRole("button", { name: /portal|beheer|manage billing|stripe/i })
      .first()
      .click();
  }

  async expectPortalRedirectOrStubMessage() {
    // Either we navigated to a Stripe billing portal URL OR we see a stub
    // message saying billing is unconfigured.
    const seenPortal = await this.page
      .waitForURL(/billing\.stripe\.com|\/billing\/portal/, { timeout: 4_000 })
      .then(() => true)
      .catch(() => false);
    if (seenPortal) return;
    await expect(
      this.page.getByText(/not configured|dormant|unavailable|configureer/i).first()
    ).toBeVisible({ timeout: 5_000 });
  }
}
