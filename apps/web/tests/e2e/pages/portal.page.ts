import { expect, type Page } from "@playwright/test";

/**
 * PortalPage — employer/client portal login (magic-link flow).
 * Route: /portal/login
 */
export class PortalPage {
  constructor(private readonly page: Page) {}

  async gotoLogin() {
    await this.page.goto("/portal/login");
  }

  async fillEmail(email: string) {
    await this.page
      .locator('input[name="email"], input[type="email"]')
      .first()
      .fill(email);
  }

  async submitMagicLink() {
    await this.page
      .getByRole("button", { name: /send link|magic link|verstuur|inloggen/i })
      .first()
      .click();
  }

  async expectMagicLinkSentMessage() {
    await expect(
      this.page.getByText(/check your (inbox|email)|magic link|e-mail verstuurd|link sent/i).first()
    ).toBeVisible({ timeout: 5_000 });
  }
}
