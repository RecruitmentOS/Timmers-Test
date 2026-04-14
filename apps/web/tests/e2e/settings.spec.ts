import { test, expect } from "./fixtures/auth";
import type { Route } from "@playwright/test";

/**
 * E2E: Admin settings
 *
 * Tests the settings pages: general settings (org name), team members,
 * and pipeline stage configuration.
 */

const ORG_SETTINGS = {
  id: "test-org-id",
  name: "Transport Recruit BV",
  slug: "transport-recruit",
  mode: "agency",
  logo: null,
};

const TEAM_MEMBERS = [
  {
    id: "member-001",
    name: "Jan de Vries",
    email: "jan@test.nl",
    role: "super_admin",
    createdAt: "2026-01-15T10:00:00.000Z",
  },
  {
    id: "member-002",
    name: "Karin Jansen",
    email: "karin@test.nl",
    role: "recruiter",
    createdAt: "2026-02-01T10:00:00.000Z",
  },
  {
    id: "member-003",
    name: "Pieter Bakker",
    email: "pieter@test.nl",
    role: "agent",
    createdAt: "2026-03-01T10:00:00.000Z",
  },
];

const PIPELINE_STAGES = [
  { id: "stage-1", name: "Nieuw", sortOrder: 0, isDefault: true },
  { id: "stage-2", name: "Screening", sortOrder: 1, isDefault: false },
  { id: "stage-3", name: "Gesprek", sortOrder: 2, isDefault: false },
  { id: "stage-4", name: "Sent to client", sortOrder: 3, isDefault: false },
  { id: "stage-5", name: "Aanbod", sortOrder: 4, isDefault: false },
  { id: "stage-6", name: "Geplaatst", sortOrder: 5, isDefault: false },
];

test.describe("Admin settings", () => {
  test.beforeEach(async ({ authenticatedPage: page }) => {
    // Mock org settings (handle both GET and PATCH)
    await page.route("**/api/admin/settings", (route: Route) => {
      if (route.request().method() === "PATCH") {
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            ...ORG_SETTINGS,
            ...route.request().postDataJSON(),
          }),
        });
      }
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(ORG_SETTINGS),
      });
    });

    // Mock team members
    await page.route("**/api/admin/team**", (route: Route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(TEAM_MEMBERS),
      })
    );

    // Mock pipeline stages - all sub-routes FIRST (more specific)
    await page.route("**/api/admin/pipeline-stages/**", (route: Route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true }),
      })
    );

    // Mock pipeline stages - list endpoint (less specific, checked after)
    await page.route("**/api/admin/pipeline-stages", (route: Route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(PIPELINE_STAGES),
      })
    );

    // Mock AI usage (shown in general settings)
    await page.route("**/api/admin/ai-usage**", (route: Route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          totalTokens: 15000,
          totalCalls: 25,
          monthlyCost: 2.5,
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

  test("shows general settings with org name", async ({
    authenticatedPage: page,
  }) => {
    await page.goto("/settings");

    // Page should show settings heading
    await expect(page.getByRole("heading", { level: 2 })).toBeVisible({
      timeout: 10_000,
    });

    // Org name field should be populated
    const nameInput = page.locator("#name");
    await expect(nameInput).toHaveValue("Transport Recruit BV", {
      timeout: 10_000,
    });

    // Slug field should be disabled
    const slugInput = page.locator("#slug");
    await expect(slugInput).toBeDisabled();
    await expect(slugInput).toHaveValue("transport-recruit");
  });

  test("shows team members table", async ({ authenticatedPage: page }) => {
    await page.goto("/settings/team");

    // Team heading
    await expect(
      page.getByRole("heading", { name: "Teamleden" })
    ).toBeVisible({ timeout: 10_000 });

    // Team members should be listed
    await expect(page.getByText("Jan de Vries")).toBeVisible();
    await expect(page.getByText("Karin Jansen")).toBeVisible();
    await expect(page.getByText("Pieter Bakker")).toBeVisible();

    // Invite button
    await expect(page.getByText("Uitnodigen")).toBeVisible();
  });

  test("shows pipeline stages configuration", async ({
    authenticatedPage: page,
  }) => {
    await page.goto("/settings/pipeline");

    // Page heading
    await expect(
      page.getByRole("heading", { name: "Pipeline fases" })
    ).toBeVisible({ timeout: 10_000 });

    // Wait for the loading skeleton to disappear (signals data arrived)
    await expect(page.locator(".animate-pulse").first()).not.toBeVisible({
      timeout: 10_000,
    });

    // Pipeline stages should be listed (use exact match to avoid "Nieuwe fase" clash)
    await expect(
      page.getByText("Nieuw", { exact: true })
    ).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText("Screening", { exact: true })).toBeVisible();
    await expect(page.getByText("Gesprek", { exact: true })).toBeVisible();
    await expect(page.getByText("Sent to client")).toBeVisible();
    await expect(page.getByText("Aanbod", { exact: true })).toBeVisible();
    await expect(page.getByText("Geplaatst", { exact: true })).toBeVisible();

    // Default badge should be on "Nieuw"
    await expect(page.getByText("Standaard")).toBeVisible();

    // Add stage button
    await expect(page.getByText("Nieuwe fase")).toBeVisible();
  });
});
