import { test, expect } from "./fixtures/auth";
import type { Route } from "@playwright/test";

/**
 * E2E: AI screening
 *
 * Tests the AI screening trigger on a candidate application detail page.
 * Verifies the screening button, verdict display, and reasoning text.
 * Uses Dutch transport context (CE chauffeur screening).
 */

const CANDIDATE_ID = "cand-screen-test-001";

const CANDIDATE_FIXTURE = {
  id: CANDIDATE_ID,
  firstName: "Marek",
  lastName: "Nowicki",
  email: "marek@test.nl",
  phone: "+31687654321",
  city: "Utrecht",
  source: "indeed",
  licenseTypes: ["CE"],
  hasCode95: true,
  createdAt: "2026-03-20T10:00:00.000Z",
};

const APPLICATIONS_FIXTURE = [
  {
    id: "app-screen-001",
    candidateId: CANDIDATE_ID,
    vacancyId: "vac-ce-001",
    vacancyTitle: "CE Chauffeur Distributie",
    vacancyStatus: "open",
    qualificationStatus: "pending",
    currentStageId: "stage-new",
    createdAt: "2026-03-20T12:00:00.000Z",
  },
];

const SCREENING_RESULT = {
  result: {
    verdict: "yes",
    confidence: 0.85,
    reasoning:
      "Heeft CE rijbewijs en code 95, 5+ jaar ervaring in distributie transport.",
    matchedCriteria: [
      "CE rijbewijs",
      "Code 95 geldig",
      "Distributie-ervaring",
    ],
    missingCriteria: ["ADR certificaat"],
  },
  cached: false,
};

test.describe("AI screening", () => {
  test.beforeEach(async ({ authenticatedPage: page }) => {
    // Mock candidate detail
    await page.route(`**/api/candidates/${CANDIDATE_ID}`, (route: Route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(CANDIDATE_FIXTURE),
      })
    );

    // Mock candidate applications
    await page.route(
      `**/api/candidates/${CANDIDATE_ID}/applications`,
      (route: Route) =>
        route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(APPLICATIONS_FIXTURE),
        })
    );

    // Mock candidate timeline
    await page.route(
      `**/api/candidates/${CANDIDATE_ID}/timeline`,
      (route: Route) =>
        route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify([]),
        })
    );

    // Mock candidate files
    await page.route(
      `**/api/candidates/${CANDIDATE_ID}/files`,
      (route: Route) =>
        route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify([]),
        })
    );

    // Mock candidate documents
    await page.route(
      `**/api/candidates/${CANDIDATE_ID}/documents`,
      (route: Route) =>
        route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify([]),
        })
    );

    // Mock vacancies (for apply dialog)
    await page.route("**/api/vacancies", (route: Route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([]),
      })
    );

    // Mock AI screening trigger
    await page.route("**/api/ai-screening/trigger", (route: Route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(SCREENING_RESULT),
      })
    );

    // Mock screening history
    await page.route("**/api/ai-screening/history/**", (route: Route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([]),
      })
    );

    // Mock AI usage
    await page.route("**/api/ai-screening/usage", (route: Route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          totalTokens: 0,
          totalCalls: 0,
          monthlyCost: 0,
          limit: 100,
        }),
      })
    );

    // Mock dashboard APIs
    await page.route("**/api/dashboard/**", (route: Route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ items: [], total: 0, count: 0, value: 0 }),
      })
    );
  });

  test("shows candidate detail with AI screening button", async ({
    authenticatedPage: page,
  }) => {
    await page.goto(`/candidates/${CANDIDATE_ID}`);

    // Candidate name should be visible (heading has full name)
    await expect(
      page.getByRole("heading", { name: "Marek Nowicki" })
    ).toBeVisible({ timeout: 10_000 });

    // Contact info
    await expect(page.getByText("+31687654321")).toBeVisible();
    await expect(page.getByText("marek@test.nl")).toBeVisible();

    // Application should be listed
    await expect(
      page.getByText("CE Chauffeur Distributie")
    ).toBeVisible();

    // AI Screening button should be present
    await expect(page.getByText("AI Screening")).toBeVisible();
  });

  test("triggers AI screening and shows verdict", async ({
    authenticatedPage: page,
  }) => {
    await page.goto(`/candidates/${CANDIDATE_ID}`);

    // Wait for page to load
    await expect(
      page.getByRole("heading", { name: "Marek Nowicki" })
    ).toBeVisible({ timeout: 10_000 });

    // Click AI Screening button
    await page.getByRole("button", { name: /AI Screening/i }).click();

    // Wait for the screening result to appear
    // The badge should show the verdict
    await expect(page.getByText("AI Beoordeling")).toBeVisible({
      timeout: 10_000,
    });

    // Click "Meer details" to expand reasoning
    await page.getByText("Meer details").click();

    // Reasoning text should be visible
    await expect(
      page.getByText(/CE rijbewijs en code 95/)
    ).toBeVisible();

    // Matched criteria
    await expect(page.getByText("Voldoet aan:")).toBeVisible();
    await expect(
      page.getByText("CE rijbewijs", { exact: true })
    ).toBeVisible();

    // Missing criteria
    await expect(page.getByText("Ontbreekt:")).toBeVisible();
    await expect(page.getByText("ADR certificaat")).toBeVisible();
  });
});
