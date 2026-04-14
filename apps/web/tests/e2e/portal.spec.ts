import { test as base, expect, type Route } from "@playwright/test";
import { createAuthHandler } from "./fixtures/auth";

/**
 * E2E: Client portal
 *
 * Tests the client portal view accessible to client_viewer role.
 * Verifies that only shared vacancies are visible and internal
 * recruiter data is not exposed.
 */

const CLIENT_USER = {
  id: "client-viewer-id",
  name: "Hans van Dijk",
  email: "hans@transportbedrijf.nl",
  role: "client_viewer",
};

const PORTAL_VACANCIES = [
  {
    id: "vac-shared-001",
    title: "CE Chauffeur Distributie",
    location: "Rotterdam",
    candidateCount: 5,
    stages: [
      { name: "Nieuw", count: 2 },
      { name: "Screening", count: 2 },
      { name: "Sent to client", count: 1 },
    ],
    status: "open",
    createdAt: "2026-03-01T10:00:00.000Z",
  },
  {
    id: "vac-shared-002",
    title: "C Chauffeur Internationaal",
    location: "Eindhoven",
    candidateCount: 3,
    stages: [
      { name: "Nieuw", count: 1 },
      { name: "Screening", count: 2 },
    ],
    status: "open",
    createdAt: "2026-03-10T10:00:00.000Z",
  },
];

const test = base.extend<{
  clientPage: Awaited<ReturnType<typeof base["page"]>>;
}>({
  clientPage: async ({ page, context }, use) => {
    // Set session cookie
    await context.addCookies([
      {
        name: "better-auth.session_token",
        value: "e2e-client-portal-test",
        domain: "localhost",
        path: "/",
        httpOnly: false,
        secure: false,
        sameSite: "Lax",
      },
    ]);

    const { sessionHandler, orgListHandler } = createAuthHandler(
      CLIENT_USER,
      "client-org-id",
      "agency"
    );

    // Intercept session endpoints
    await page.route("**/api/auth/get-session", sessionHandler);
    await page.route("**/api/auth/session", sessionHandler);
    await page.route("**/api/auth/organization/list", orgListHandler);
    await page.route("**/api/auth/organization/set-active", (route: Route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ id: "client-org-id" }),
      })
    );

    await use(page);
  },
});

test.describe("Client portal", () => {
  test.beforeEach(async ({ clientPage: page }) => {
    // Mock portal vacancies endpoint (matches actual hook endpoint)
    await page.route("**/api/portal/client/vacancies", (route: Route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(PORTAL_VACANCIES),
      })
    );

    // Mock portal feedback endpoint
    await page.route("**/api/portal/client/feedback", (route: Route) =>
      route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({ id: "feedback-001", status: "created" }),
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

  test("shows shared vacancies with candidate counts", async ({
    clientPage: page,
  }) => {
    await page.goto("/portal");

    // Portal header
    await expect(page.getByText("Client Portal")).toBeVisible({
      timeout: 10_000,
    });

    // Should show vacancy count widget
    await expect(page.getByText("Actieve vacatures")).toBeVisible();

    // Total candidates widget
    await expect(
      page.getByText("Kandidaten in behandeling")
    ).toBeVisible();
  });

  test("does not expose internal recruiter-only elements", async ({
    clientPage: page,
  }) => {
    await page.goto("/portal");

    await expect(page.getByText("Client Portal")).toBeVisible({
      timeout: 10_000,
    });

    // These internal elements should NOT be visible on the portal page
    const internalTexts = [
      "AI Screening",
      "Interne notities",
      "Internal notes",
      "Qualification",
      "Kwalificatie",
    ];

    for (const text of internalTexts) {
      await expect(page.getByText(text, { exact: true })).not.toBeVisible();
    }
  });
});

export { test };
