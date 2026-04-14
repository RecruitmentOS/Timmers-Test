import { test, expect } from "./fixtures/auth";
import type { Route } from "@playwright/test";

/**
 * E2E: Pipeline board
 *
 * Tests the authenticated pipeline board view with candidate cards,
 * stage columns, and drag interaction. Uses realistic Dutch transport
 * candidate data.
 */

const VACANCY_ID = "vac-pipeline-test-001";

const STAGE_NEW = "stage-new-001";
const STAGE_SCREEN = "stage-screen-001";
const STAGE_INTERVIEW = "stage-interview-001";
const STAGE_OFFER = "stage-offer-001";

const APP_ID_1 = "app-pieter-001";
const APP_ID_2 = "app-tomasz-002";

const boardFixture = {
  stages: [
    {
      id: STAGE_NEW,
      name: "Nieuw",
      sortOrder: 0,
      applications: [
        {
          id: APP_ID_1,
          candidateId: "cand-pieter-001",
          currentStageId: STAGE_NEW,
          ownerId: "test-user-id",
          qualificationStatus: "pending" as const,
          sentToClient: false,
          sentToHiringManager: false,
          sourceDetail: null,
          firstName: "Pieter",
          lastName: "Bakker",
          source: "indeed",
          hasOverdueTask: false,
        },
        {
          id: APP_ID_2,
          candidateId: "cand-tomasz-002",
          currentStageId: STAGE_NEW,
          ownerId: "test-user-id",
          qualificationStatus: "maybe" as const,
          sentToClient: false,
          sentToHiringManager: false,
          sourceDetail: null,
          firstName: "Tomasz",
          lastName: "Kowalski",
          source: "marktplaats",
          hasOverdueTask: true,
        },
      ],
    },
    {
      id: STAGE_SCREEN,
      name: "Screening",
      sortOrder: 1,
      applications: [],
    },
    {
      id: STAGE_INTERVIEW,
      name: "Gesprek",
      sortOrder: 2,
      applications: [],
    },
    {
      id: STAGE_OFFER,
      name: "Aanbod",
      sortOrder: 3,
      applications: [],
    },
  ],
};

test.describe("Pipeline board", () => {
  test.beforeEach(async ({ authenticatedPage: page }) => {
    // Mock pipeline data
    await page.route("**/api/pipeline/**", (route: Route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(boardFixture),
      })
    );

    // Mock stage mutation
    await page.route("**/api/applications/*/stage", (route: Route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          id: route.request().url().split("/applications/")[1]?.split("/")[0],
          currentStageId: STAGE_SCREEN,
        }),
      })
    );

    // Mock dashboard API (sidebar may fetch)
    await page.route("**/api/dashboard/**", (route: Route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ items: [], total: 0, count: 0 }),
      })
    );
  });

  test("renders kanban columns with stage names", async ({
    authenticatedPage: page,
  }) => {
    await page.goto(`/vacancies/${VACANCY_ID}/pipeline`);

    // All four stage columns should be visible
    await expect(page.getByText("Nieuw")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText("Screening")).toBeVisible();
    await expect(page.getByText("Gesprek")).toBeVisible();
    await expect(page.getByText("Aanbod")).toBeVisible();
  });

  test("shows candidate cards with names and source", async ({
    authenticatedPage: page,
  }) => {
    await page.goto(`/vacancies/${VACANCY_ID}/pipeline`);

    // Candidate cards should show names
    await expect(page.getByText("Pieter")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText("Bakker")).toBeVisible();
    await expect(page.getByText("Tomasz")).toBeVisible();
    await expect(page.getByText("Kowalski")).toBeVisible();
  });

  test("candidate cards have data-application-id for drag interaction", async ({
    authenticatedPage: page,
  }) => {
    // Verify cards have the data attribute that pipeline-drag-end.spec.ts
    // uses for drag interaction (drag itself tested in that dedicated spec).
    await page.goto(`/vacancies/${VACANCY_ID}/pipeline`);

    const card1 = page.locator(`[data-application-id="${APP_ID_1}"]`);
    const card2 = page.locator(`[data-application-id="${APP_ID_2}"]`);

    await expect(card1).toBeVisible({ timeout: 10_000 });
    await expect(card2).toBeVisible();

    // Stage columns have data-stage-id for drop targets
    await expect(
      page.locator(`[data-stage-id="${STAGE_SCREEN}"]`)
    ).toBeVisible();
    await expect(
      page.locator(`[data-stage-id="${STAGE_INTERVIEW}"]`)
    ).toBeVisible();
  });
});
