import { expect, type Page } from "@playwright/test";

export interface ApplyCandidateInput {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
}

/**
 * ApplyPage — public candidate apply flow.
 *
 * Route: /apply/[vacancyId] (mounted under the public route group).
 * TODO: add data-testid="apply-firstName"/"lastName"/"email"/"phone"/"cv"/"submit"
 * to the apply form inputs when landing this test.
 */
export class ApplyPage {
  constructor(private readonly page: Page) {}

  async goto(vacancyId: string) {
    await this.page.goto(`/apply/${vacancyId}`);
  }

  async fillCandidate(input: ApplyCandidateInput) {
    await this.fillByLabelOrName(["First name", "Voornaam"], "firstName", input.firstName);
    await this.fillByLabelOrName(["Last name", "Achternaam"], "lastName", input.lastName);
    await this.fillByLabelOrName(["Email", "E-mail"], "email", input.email);
    await this.fillByLabelOrName(["Phone", "Telefoon"], "phone", input.phone);
  }

  async uploadCV(filePath: string) {
    await this.page.locator('input[type="file"]').first().setInputFiles(filePath);
  }

  async submit() {
    await this.page
      .getByRole("button", { name: /submit|verstuur|apply|solliciteer/i })
      .first()
      .click();
  }

  async expectSuccess() {
    // Either a success message text OR navigation to a thank-you page.
    const successLocator = this.page.getByText(/thank you|bedankt|received|verzonden/i);
    await Promise.race([
      successLocator.first().waitFor({ state: "visible", timeout: 10_000 }),
      this.page.waitForURL(/thank-you|bedankt/i, { timeout: 10_000 }),
    ]);
  }

  private async fillByLabelOrName(labels: string[], name: string, value: string) {
    for (const label of labels) {
      const byLabel = this.page.getByLabel(label, { exact: false });
      if (await byLabel.count()) {
        await byLabel.first().fill(value);
        return;
      }
    }
    await this.page.locator(`input[name="${name}"]`).first().fill(value);
  }

  async expectValidationError() {
    // Either native HTML5 validation or explicit error text.
    const emailInput = this.page.locator('input[name="email"], input[type="email"]').first();
    const valid = await emailInput.evaluate((el: HTMLInputElement) => el.checkValidity());
    if (valid) {
      // Fall back to checking for an error banner
      await expect(this.page.getByText(/required|verplicht|error/i).first()).toBeVisible();
    } else {
      expect(valid).toBe(false);
    }
  }
}
