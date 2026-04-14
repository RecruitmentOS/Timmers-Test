import { test, expect, type Route } from "@playwright/test";

/**
 * E2E: Onboarding wizard
 *
 * Tests the multi-step onboarding flow: org name -> mode selection ->
 * details -> confirmation/creation. Uses Dutch transport context.
 */

test.describe("Onboarding wizard", () => {
  test.beforeEach(async ({ page, context }) => {
    // Set session cookie so middleware allows /onboarding
    await context.addCookies([
      {
        name: "better-auth.session_token",
        value: "e2e-onboarding-test",
        domain: "localhost",
        path: "/",
        httpOnly: false,
        secure: false,
        sameSite: "Lax",
      },
    ]);

    // Mock session (user logged in but no org yet)
    const sessionPayload = {
      user: {
        id: "new-user-id",
        name: "Bart Wilbrink",
        email: "bart@transportrecruit.nl",
        role: "admin",
        image: null,
        emailVerified: true,
      },
      session: {
        id: "session-onboarding",
        userId: "new-user-id",
        expiresAt: new Date(Date.now() + 86400000).toISOString(),
        activeOrganizationId: null,
      },
      organizationId: null,
      mode: null,
    };

    await page.route("**/api/auth/get-session", (route: Route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(sessionPayload),
      })
    );
    await page.route("**/api/auth/session", (route: Route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(sessionPayload),
      })
    );

    // Mock slug availability check — match both patterns
    await page.route("**/api/onboarding/check-slug/**", (route: Route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ available: true }),
      })
    );
    await page.route("**/api/onboarding/check-slug**", (route: Route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ available: true }),
      })
    );

    // Mock organization creation
    await page.route("**/api/onboarding/create-org", (route: Route) => {
      const body = route.request().postDataJSON();
      return route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({
          id: "new-org-id",
          name: body.orgName,
          slug: body.orgName
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-+|-+$/g, ""),
          mode: body.mode,
          createdAt: new Date().toISOString(),
        }),
      });
    });

    // Mock org list (after creation)
    await page.route("**/api/auth/organization/list", (route: Route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([]),
      })
    );

    // Mock set-active org
    await page.route("**/api/auth/organization/set-active", (route: Route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ id: "new-org-id" }),
      })
    );

    // Mock dashboard APIs for redirect after creation
    await page.route("**/api/dashboard/**", (route: Route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ items: [], total: 0, count: 0, value: 0 }),
      })
    );
  });

  test("completes onboarding wizard with agency mode", async ({ page }) => {
    await page.goto("/onboarding");

    // Step 1: Organization name
    await expect(page.getByText("Organisatienaam")).toBeVisible({
      timeout: 10_000,
    });
    await page.getByPlaceholder(/Simon Loos|Upply Jobs/i).fill(
      "Transport Recruit BV"
    );

    // Subdomain preview should update — wait for it to appear
    // The slug is rendered inside a nested span: {slug}.recruitment-os.nl
    await expect(
      page.locator("text=transport-recruit-bv")
    ).toBeVisible({ timeout: 5_000 });

    // Next step
    await page.getByRole("button", { name: "Volgende" }).click();

    // Step 2: Mode selection
    await expect(page.getByText("Modus kiezen")).toBeVisible({ timeout: 5_000 });
    // Click "Uitzendbureau" (agency mode)
    await page.getByText("Uitzendbureau").click();
    await page.getByRole("button", { name: "Volgende" }).click();

    // Step 3: Details
    await expect(page.getByText("Details")).toBeVisible({ timeout: 5_000 });
    await page.getByPlaceholder(/Amsterdam|Rotterdam|Breda/i).fill("Amsterdam");

    // Select user count (1-3)
    await page.getByRole("button", { name: "1-3" }).click();
    await page.getByRole("button", { name: "Volgende" }).click();

    // Step 4: Summary / Confirmation
    await expect(page.getByText("Klaar!")).toBeVisible({ timeout: 5_000 });
    await expect(page.getByText("Transport Recruit BV")).toBeVisible();
    await expect(page.getByText("Uitzendbureau")).toBeVisible();
    await expect(page.getByText("Amsterdam")).toBeVisible();

    // Should mention agency-specific seed data (pipeline stages incl. "Sent to client")
    await expect(page.getByText(/Sent to client/i)).toBeVisible();
    await expect(page.getByText("14 dagen gratis proefperiode")).toBeVisible();
  });

  test("step 1 blocks navigation without valid org name", async ({ page }) => {
    await page.goto("/onboarding");

    await expect(page.getByText("Organisatienaam")).toBeVisible({
      timeout: 10_000,
    });

    // "Volgende" should be disabled with empty name
    const nextButton = page.getByRole("button", { name: "Volgende" });
    await expect(nextButton).toBeDisabled();

    // Type one character (too short)
    await page.getByPlaceholder(/Simon Loos|Upply Jobs/i).fill("A");
    await expect(nextButton).toBeDisabled();

    // Type two characters (minimum valid)
    await page.getByPlaceholder(/Simon Loos|Upply Jobs/i).fill("AB");
    await expect(nextButton).toBeEnabled();
  });
});
