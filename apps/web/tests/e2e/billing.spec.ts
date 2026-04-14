import { test, expect } from "./fixtures/auth";
import type { Route } from "@playwright/test";

/**
 * E2E: Billing dashboard
 *
 * Tests the billing page with usage bars, plan tier, trial status,
 * and Stripe portal link. Uses authenticated admin fixture.
 */

const BILLING_DASHBOARD = {
  usage: {
    activeUsers: 3,
    activeVacancies: 8,
    placements: 2,
    limits: {
      maxUsers: 5,
      maxActiveVacancies: 10,
      maxPlacements: 50,
    },
    planTier: "growth",
  },
  trialEndsAt: null,
  status: "active",
  portalUrl: "https://billing.stripe.com/test-portal",
};

test.describe("Billing dashboard", () => {
  test.beforeEach(async ({ authenticatedPage: page }) => {
    // Mock billing dashboard endpoint
    await page.route("**/api/billing/dashboard", (route: Route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(BILLING_DASHBOARD),
      })
    );

    // Mock billing usage endpoint (fallback)
    await page.route("**/api/billing/usage", (route: Route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(BILLING_DASHBOARD.usage),
      })
    );

    // Mock portal session creation
    await page.route("**/api/billing/portal-session", (route: Route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          url: "https://billing.stripe.com/test-portal-session",
        }),
      })
    );

    // Mock dashboard APIs that sidebar may need
    await page.route("**/api/dashboard/**", (route: Route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ items: [], total: 0, count: 0, value: 0 }),
      })
    );

    // Mock admin/org settings (settings layout may fetch)
    await page.route("**/api/admin/settings", (route: Route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          name: "Transport Recruit BV",
          slug: "transport-recruit",
          mode: "agency",
        }),
      })
    );
  });

  test("displays usage bars for all billing axes", async ({
    authenticatedPage: page,
  }) => {
    await page.goto("/settings/billing");

    // Page title
    await expect(page.getByRole("heading", { name: "Facturatie" })).toBeVisible({ timeout: 10_000 });

    // Usage cards should show current / limit
    await expect(page.getByText("Actieve gebruikers")).toBeVisible();
    await expect(page.getByText("Actieve vacatures")).toBeVisible();
    // Agency mode should show placements
    await expect(page.getByText("Plaatsingen")).toBeVisible();

    // Usage numbers should be visible (in card titles showing "X / Y")
    await expect(page.getByText("3 /")).toBeVisible();
    await expect(page.getByText("8 /")).toBeVisible();
  });

  test("shows plan tier badge", async ({ authenticatedPage: page }) => {
    await page.goto("/settings/billing");

    await expect(page.getByRole("heading", { name: "Facturatie" })).toBeVisible({ timeout: 10_000 });

    // Plan tier badge should show "Growth"
    await expect(page.getByText("Growth")).toBeVisible({ timeout: 10_000 });

    // Status should show "Actief"
    await expect(page.getByText("Actief")).toBeVisible();
  });

  test("shows Stripe portal button", async ({ authenticatedPage: page }) => {
    await page.goto("/settings/billing");

    await expect(page.getByRole("heading", { name: "Facturatie" })).toBeVisible({ timeout: 10_000 });

    // Stripe portal button should be present
    await expect(page.getByText("Beheer facturatie")).toBeVisible();
  });
});
