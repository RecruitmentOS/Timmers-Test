import { expect, type Page } from "@playwright/test";

/**
 * SettingsPage — profile/organization settings.
 * Route: /settings
 * TODO: add data-testid="settings-display-name"/"settings-save".
 */
export class SettingsPage {
  constructor(private readonly page: Page) {}

  async goto() {
    await this.page.goto("/settings");
  }

  async updateDisplayName(name: string) {
    const input = this.page
      .locator(
        'input[name="displayName"], input[name="name"], input[aria-label*="name" i]'
      )
      .first();
    await input.fill(name);
  }

  async save() {
    await this.page
      .getByRole("button", { name: /save|opslaan|update/i })
      .first()
      .click();
  }

  async expectSavedToast() {
    await expect(
      this.page.getByText(/saved|opgeslagen|updated|bijgewerkt/i).first()
    ).toBeVisible({ timeout: 5_000 });
  }

  async readDisplayName(): Promise<string> {
    const input = this.page
      .locator('input[name="displayName"], input[name="name"]')
      .first();
    return (await input.inputValue()) ?? "";
  }
}
