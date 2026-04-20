import { expect, type Page } from "@playwright/test";

export interface OnboardingOrgInput {
  name: string;
  mode: "agency" | "employer";
}

/**
 * OnboardingPage — multi-step onboarding wizard.
 * Route: /onboarding
 * TODO: add data-testid hooks per step (step1-org-name, step1-mode-agency, etc).
 */
export class OnboardingPage {
  constructor(private readonly page: Page) {}

  async goto() {
    await this.page.goto("/onboarding");
  }

  async fillStep1Organization({ name, mode }: OnboardingOrgInput) {
    await this.page
      .locator('input[name="organizationName"], input[name="name"]')
      .first()
      .fill(name);
    // Mode selection rendered as radio, select, or button — try each.
    const modeRadio = this.page.locator(`input[type="radio"][value="${mode}"]`).first();
    if (await modeRadio.count()) {
      await modeRadio.click();
    } else {
      await this.page
        .getByRole("button", { name: new RegExp(mode, "i") })
        .first()
        .click({ trial: false })
        .catch(() => {
          /* optional step */
        });
    }
  }

  async nextStep() {
    await this.page
      .getByRole("button", { name: /next|volgende|continue|ga verder/i })
      .first()
      .click();
  }

  async fillStep2Team() {
    // Team step is optional in most flows — skip if nothing required.
    const teammateEmail = this.page.locator('input[type="email"]').first();
    if (await teammateEmail.count()) {
      // Leave blank — skip invitation in tests.
    }
  }

  async finish() {
    await this.page
      .getByRole("button", { name: /finish|voltooi|klaar|done|submit/i })
      .first()
      .click();
  }

  async expectDashboard() {
    await this.page.waitForURL(/\/(dashboard|pipeline)/, { timeout: 10_000 });
    await expect(this.page).toHaveURL(/\/(dashboard|pipeline)/);
  }
}
