import { expect, type Page, type Locator } from "@playwright/test";

export type PipelineStage = "prospect" | "nurture" | "active" | "klant";

/**
 * PipelinePage — kanban board with drag-and-drop.
 *
 * Route: /pipeline (agency) or /vacancies/:id/pipeline.
 * TODO: add data-testid="pipeline-column-<stage>" and
 * data-testid="pipeline-card-<id>" when landing the test.
 */
export class PipelinePage {
  constructor(private readonly page: Page) {}

  async goto() {
    await this.page.goto("/pipeline");
  }

  getColumn(stage: PipelineStage): Locator {
    return this.page.locator(
      `[data-testid="pipeline-column-${stage}"], [data-stage="${stage}"]`
    ).first();
  }

  getCard(name: string): Locator {
    return this.page.getByText(name, { exact: false }).first();
  }

  async dragCardTo(cardName: string, targetStage: PipelineStage) {
    const card = this.getCard(cardName);
    const target = this.getColumn(targetStage);
    await card.scrollIntoViewIfNeeded();
    // Prefer Playwright's built-in dragTo; fall back to low-level mouse drag
    // if dnd-kit's PointerSensor ignores the synthetic drag events.
    try {
      await card.dragTo(target, { timeout: 5_000 });
    } catch {
      const cardBox = await card.boundingBox();
      const targetBox = await target.boundingBox();
      if (!cardBox || !targetBox) throw new Error("Card or target column not found");
      await this.page.mouse.move(cardBox.x + cardBox.width / 2, cardBox.y + cardBox.height / 2);
      await this.page.mouse.down();
      await this.page.mouse.move(targetBox.x + targetBox.width / 2, targetBox.y + targetBox.height / 2, {
        steps: 10,
      });
      await this.page.mouse.up();
    }
  }

  async expectCardInColumn(cardName: string, stage: PipelineStage) {
    const column = this.getColumn(stage);
    await expect(column.getByText(cardName, { exact: false }).first()).toBeVisible({
      timeout: 5_000,
    });
  }
}
