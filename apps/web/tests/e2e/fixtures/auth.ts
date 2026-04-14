import { test as base, expect, type Route } from "@playwright/test";

/**
 * Auth fixture for E2E tests.
 *
 * Provides an `authenticatedPage` that:
 * 1. Injects a dummy better-auth session cookie
 * 2. Intercepts /api/auth/session to return a mock authenticated user
 *
 * Usage:
 *   import { test, expect } from './fixtures/auth';
 *   test('my test', async ({ authenticatedPage }) => { ... });
 */

export interface MockUser {
  id: string;
  name: string;
  email: string;
  role: string;
}

export interface AuthFixtureOptions {
  user?: MockUser;
  organizationId?: string;
  mode?: "agency" | "employer";
}

const DEFAULT_USER: MockUser = {
  id: "test-user-id",
  name: "Jan de Vries",
  email: "jan@test.nl",
  role: "admin",
};

const DEFAULT_ORG_ID = "test-org-id";
const DEFAULT_MODE = "agency" as const;

/**
 * Creates the session mock handler for a given user/org.
 */
function sessionHandler(
  user: MockUser,
  organizationId: string,
  mode: string
) {
  return (route: Route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          image: null,
          emailVerified: true,
        },
        session: {
          id: "test-session-id",
          userId: user.id,
          expiresAt: new Date(Date.now() + 86400000).toISOString(),
          activeOrganizationId: organizationId,
        },
        organizationId,
        mode,
      }),
    });
}

/**
 * Mock for /api/organizations/list — needed by login flow to
 * auto-set active organization.
 */
function orgListHandler(organizationId: string, mode: string) {
  return (route: Route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([
        {
          id: organizationId,
          name: "Test Transport BV",
          slug: "test-transport",
          mode,
          createdAt: "2026-01-01T00:00:00.000Z",
        },
      ]),
    });
}

export const test = base.extend<{
  authenticatedPage: Awaited<ReturnType<typeof base["page"]>>;
}>({
  authenticatedPage: async ({ page, context }, use) => {
    // 1. Set session cookie
    await context.addCookies([
      {
        name: "better-auth.session_token",
        value: "e2e-test-session-token",
        domain: "localhost",
        path: "/",
        httpOnly: false,
        secure: false,
        sameSite: "Lax",
      },
    ]);

    // 2. Intercept session endpoint
    await page.route(
      "**/api/auth/get-session",
      sessionHandler(DEFAULT_USER, DEFAULT_ORG_ID, DEFAULT_MODE)
    );
    await page.route(
      "**/api/auth/session",
      sessionHandler(DEFAULT_USER, DEFAULT_ORG_ID, DEFAULT_MODE)
    );

    // 3. Intercept org list
    await page.route(
      "**/api/auth/organization/list",
      orgListHandler(DEFAULT_ORG_ID, DEFAULT_MODE)
    );

    // 4. Intercept active org setting
    await page.route("**/api/auth/organization/set-active", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ id: DEFAULT_ORG_ID }),
      })
    );

    await use(page);
  },
});

export { expect };

/**
 * Helper to create a custom-role authenticated page (e.g. client_viewer, recruiter).
 */
export function createAuthHandler(
  user: MockUser,
  orgId = DEFAULT_ORG_ID,
  mode: "agency" | "employer" = DEFAULT_MODE
) {
  return {
    sessionHandler: sessionHandler(user, orgId, mode),
    orgListHandler: orgListHandler(orgId, mode),
  };
}
