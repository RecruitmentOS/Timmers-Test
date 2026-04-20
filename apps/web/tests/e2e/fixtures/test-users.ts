/**
 * E2E test user fixtures.
 *
 * These constants are the canonical credentials/identities used by all flow
 * specs. They assume a seed script has provisioned matching users in the
 * test database (see tests/e2e/README.md "Known seed dependencies").
 *
 * All emails use the `.test` TLD per RFC 2606 to guarantee no real delivery.
 */

export const AGENCY_RECRUITER = {
  email: "e2e-recruiter@upply.test",
  password: "E2ETest!Pass123",
  role: "recruiter",
} as const;

export const EMPLOYER_USER = {
  email: "e2e-employer@upply.test",
  password: "E2ETest!Pass123",
  role: "employer",
} as const;

export const PORTAL_USER = {
  email: "e2e-portal@upply.test",
  password: "E2ETest!Pass123",
  role: "portal_user",
} as const;

/**
 * Fresh (not-yet-onboarded) user for the onboarding wizard flow.
 * A `beforeEach` hook should reset `user.onboardingCompletedAt` to NULL
 * before running the onboarding spec.
 */
export const ONBOARDING_USER = {
  email: "e2e-onboarding@upply.test",
  password: "E2ETest!Pass123",
  role: "recruiter",
} as const;

/**
 * Realistic NL transport candidate fixture — matches 09-01 seed style.
 */
export const CANDIDATE = {
  firstName: "Jan",
  lastName: "de Vries",
  email: "jan.devries@example.test",
  phone: "+31612345678",
} as const;

export type TestUser = typeof AGENCY_RECRUITER;
