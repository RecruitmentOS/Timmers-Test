/**
 * Realistic Dutch transport organization fixtures for testing.
 * Covers both agency and employer modes with billing fields.
 */

export interface OrganizationFixture {
  id: string;
  name: string;
  slug: string;
  mode: "agency" | "employer";
}

export interface TenantBillingFixture {
  id: string;
  organizationId: string;
  stripeCustomerId: string | null;
  subscriptionId: string | null;
  planTier: "starter" | "growth" | "enterprise";
  trialEndsAt: Date | null;
  status: string;
  currentActiveUsers: number;
  currentActiveVacancies: number;
  currentPlacements: number;
  createdAt: Date;
  updatedAt: Date;
}

export function createOrgFixture(
  overrides: Partial<OrganizationFixture> = {}
): OrganizationFixture {
  return {
    id: "a0000000-0000-0000-0000-000000000001",
    name: "Test Transport BV",
    slug: "test-transport",
    mode: "employer",
    ...overrides,
  };
}

export function createBillingFixture(
  overrides: Partial<TenantBillingFixture> = {}
): TenantBillingFixture {
  return {
    id: "b0000000-0000-0000-0000-000000000001",
    organizationId: "a0000000-0000-0000-0000-000000000001",
    stripeCustomerId: null,
    subscriptionId: null,
    planTier: "starter",
    trialEndsAt: new Date(Date.now() + 14 * 86_400_000), // 14 days from now
    status: "trialing",
    currentActiveUsers: 1,
    currentActiveVacancies: 2,
    currentPlacements: 0,
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-01"),
    ...overrides,
  };
}

/** Agency organization (like Upply Jobs) */
export const agencyOrg = createOrgFixture({
  id: "a0000000-0000-0000-0000-000000000010",
  name: "Upply Jobs BV",
  slug: "upply-jobs",
  mode: "agency",
});

export const agencyBilling = createBillingFixture({
  id: "b0000000-0000-0000-0000-000000000010",
  organizationId: agencyOrg.id,
  planTier: "growth",
  currentActiveUsers: 5,
  currentActiveVacancies: 12,
  currentPlacements: 3,
});

/** Employer organization (like Simon Loos) */
export const employerOrg = createOrgFixture({
  id: "a0000000-0000-0000-0000-000000000020",
  name: "Simon Loos Transport",
  slug: "simon-loos",
  mode: "employer",
});

export const employerBilling = createBillingFixture({
  id: "b0000000-0000-0000-0000-000000000020",
  organizationId: employerOrg.id,
  planTier: "starter",
  currentActiveUsers: 2,
  currentActiveVacancies: 3,
  currentPlacements: 0,
});
