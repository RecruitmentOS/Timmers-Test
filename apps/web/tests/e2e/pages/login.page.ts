import { expect, type Page } from "@playwright/test";

/**
 * LoginPage — page object for /login.
 *
 * Uses resilient selectors (role/label first, fall back to name attribute).
 * TODO: add data-testid="login-email" / "login-password" / "login-submit"
 * to <LoginPage> when selectors prove brittle under i18n.
 */
export class LoginPage {
  constructor(private readonly page: Page) {}

  async goto() {
    await this.page.goto("/login");
  }

  async fillCredentials(email: string, password: string) {
    await this.page
      .locator('input[name="email"], input[type="email"]')
      .first()
      .fill(email);
    await this.page
      .locator('input[name="password"], input[type="password"]')
      .first()
      .fill(password);
  }

  async submit() {
    await this.page.locator('button[type="submit"]').first().click();
  }

  async expectLoggedIn() {
    // Wait for any URL that is no longer the login page.
    await this.page.waitForURL((url) => !url.pathname.endsWith("/login"), {
      timeout: 10_000,
    });
  }

  async expectError(msg: string | RegExp) {
    const matcher = typeof msg === "string" ? new RegExp(msg, "i") : msg;
    await expect(this.page.getByText(matcher)).toBeVisible({ timeout: 5_000 });
  }
}
