// Covers TEST-02 + PIPE-02 — pipeline drag-and-drop between stages
import { test, expect } from "../fixtures/auth.fixture";
import { PipelinePage } from "../pages/pipeline.page";

test.describe.configure({ mode: "parallel" });

test.describe("Pipeline drag-and-drop", () => {
  test("recruiter drags a company card from prospect to active", async ({ authenticatedPage: page }) => {
    // TODO seed: requires candidate card "Simon Loos" seeded in `prospect` stage (09-01 fixture).
    test.fixme(
      !process.env.E2E_HAS_SEED,
      "Requires seeded pipeline cards — run apps/api/scripts/seed-pipeline-fixtures.ts"
    );
    const pipeline = new PipelinePage(page);
    await pipeline.goto();
    // Use Playwright-native dragTo (or mouse.down/up fallback) — proves drag interaction.
    await pipeline.dragCardTo("Simon Loos", "active");
    await pipeline.expectCardInColumn("Simon Loos", "active");
    // Explicit assertion proves selector resolved
    await expect(pipeline.getColumn("active")).toContainText(/Simon Loos/i);
  });

  test.afterEach(async ({ authenticatedPage: page }) => {
    // Cleanup: drag the card back to prospect to leave state clean for re-runs.
    try {
      const pipeline = new PipelinePage(page);
      await pipeline.dragCardTo("Simon Loos", "prospect");
    } catch {
      // Best-effort cleanup; fixme tests may not have navigated.
    }
  });
});
