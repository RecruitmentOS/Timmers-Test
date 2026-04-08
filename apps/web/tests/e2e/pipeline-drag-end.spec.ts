import { test, expect, type Route } from "@playwright/test";

/**
 * Phase 2 mandatory smoke test (02-CONTEXT.md line 36):
 *
 * On `@dnd-kit/react@0.3.2` (pre-1.0) we must have automated coverage
 * for drag-end → PATCH /api/applications/:id/stage. If this test fails
 * we fall back to `@dnd-kit/core@^6.3` — a one-file swap inside
 * components/pipeline/ because all dnd-kit imports are isolated there.
 *
 * Strategy:
 *   1. Set a dummy better-auth session cookie so Next.js middleware
 *      lets us through to the (app) layout.
 *   2. Intercept GET /api/pipeline/* with a mocked 2-stage board
 *      containing a single card we can drag.
 *   3. Intercept PATCH /api/applications/* /stage and capture the
 *      body so we can assert the mutation shape.
 *   4. Navigate to /vacancies/:id/pipeline, locate the card and the
 *      target column by their data-attributes, and drive a pointer
 *      drag with page.mouse so dnd-kit's PointerSensor activates.
 *   5. Assert the intercepted mutation body === { stageId: <target> }.
 */

const NEW_STAGE_ID = "00000000-0000-0000-0000-000000000001";
const TARGET_STAGE_ID = "00000000-0000-0000-0000-000000000002";
const APP_ID = "00000000-0000-0000-0000-00000000aaaa";
const VACANCY_ID = "00000000-0000-0000-0000-000000000abc";

const boardFixture = {
  stages: [
    {
      id: NEW_STAGE_ID,
      name: "New",
      sortOrder: 0,
      applications: [
        {
          id: APP_ID,
          candidateId: "c1",
          currentStageId: NEW_STAGE_ID,
          ownerId: "u1",
          qualificationStatus: "pending" as const,
          sentToClient: false,
          sentToHiringManager: false,
          sourceDetail: null,
          firstName: "Test",
          lastName: "Driver",
          source: "indeed",
          hasOverdueTask: false,
        },
      ],
    },
    {
      id: TARGET_STAGE_ID,
      name: "To screen",
      sortOrder: 1,
      applications: [],
    },
  ],
};

test.describe("Pipeline drag-end smoke test", () => {
  test.beforeEach(async ({ context }) => {
    // Set a dummy better-auth session cookie so the Next.js middleware
    // lets us reach the /vacancies/:id/pipeline route.
    await context.addCookies([
      {
        name: "better-auth.session_token",
        value: "e2e-smoke-test-dummy",
        domain: "localhost",
        path: "/",
        httpOnly: false,
        secure: false,
        sameSite: "Lax",
      },
    ]);
  });

  test("dragging a card fires PATCH /api/applications/:id/stage", async ({
    page,
  }) => {
    // 1. Mock GET /api/pipeline/:vacancyId (both the relative frontend
    //    path and the absolute localhost:4000 API base).
    const pipelineHandler = (route: Route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(boardFixture),
      });
    await page.route("**/api/pipeline/**", pipelineHandler);

    // 2. Spy on the stage mutation — capture the request body.
    let mutationBody: unknown = null;
    const stageHandler = (route: Route) => {
      mutationBody = route.request().postDataJSON();
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          id: APP_ID,
          currentStageId: TARGET_STAGE_ID,
        }),
      });
    };
    await page.route("**/api/applications/*/stage", stageHandler);

    // 3. Navigate to the full-screen pipeline route.
    await page.goto(`/vacancies/${VACANCY_ID}/pipeline`);

    // 4. Wait for the board to hydrate. The card and target column
    //    render their data-attributes as soon as usePipeline's query
    //    resolves.
    const card = page.locator(`[data-application-id="${APP_ID}"]`);
    const targetColumn = page.locator(
      `[data-stage-id="${TARGET_STAGE_ID}"]`
    );

    await expect(card).toBeVisible({ timeout: 10_000 });
    await expect(targetColumn).toBeVisible();

    // 5. Drive a pointer drag with page.mouse so dnd-kit's default
    //    PointerSensor activates. Use multiple move steps so the
    //    activation constraint (distance threshold) is crossed.
    const cardBox = await card.boundingBox();
    const targetBox = await targetColumn.boundingBox();
    if (!cardBox || !targetBox) {
      throw new Error("Could not locate card or target bounding box");
    }

    const startX = cardBox.x + cardBox.width / 2;
    const startY = cardBox.y + cardBox.height / 2;
    const endX = targetBox.x + targetBox.width / 2;
    const endY = targetBox.y + targetBox.height / 2;

    await page.mouse.move(startX, startY);
    await page.mouse.down();
    // Intermediate small move to trip the activation constraint.
    await page.mouse.move(startX + 10, startY + 10, { steps: 3 });
    await page.mouse.move(endX, endY, { steps: 20 });
    await page.mouse.up();

    // 6. Wait for the mutation to flush through TanStack Query.
    await expect
      .poll(() => mutationBody, { timeout: 5_000 })
      .toEqual({ stageId: TARGET_STAGE_ID });
  });
});
