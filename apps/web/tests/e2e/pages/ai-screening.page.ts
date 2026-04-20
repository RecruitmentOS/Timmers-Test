import { expect, type Page } from "@playwright/test";

/**
 * AiScreeningPage — Claude-powered candidate screening UI.
 * Route: /candidates/:id (screening section) or /ai-screening
 * TODO: add data-testid="ai-screening-run"/"ai-verdict"/"ai-reasoning".
 */
export class AiScreeningPage {
  constructor(private readonly page: Page) {}

  async gotoCandidate(candidateId: string) {
    await this.page.goto(`/candidates/${candidateId}`);
  }

  async clickRunScreening() {
    await this.page
      .getByRole("button", { name: /run screening|screen|start screening|ai screening/i })
      .first()
      .click();
  }

  async expectVerdict() {
    await expect(this.page.getByText(/\b(go|review|no-?go)\b/i).first()).toBeVisible({
      timeout: 10_000,
    });
  }

  async expectReasoningVisible() {
    // Reasoning is rendered as a list of bullets OR a paragraph.
    const list = this.page.locator("ul li, ol li");
    const anyBullet = list.first();
    await expect(anyBullet).toBeVisible({ timeout: 10_000 });
  }
}
