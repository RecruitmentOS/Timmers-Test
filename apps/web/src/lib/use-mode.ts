"use client";

/**
 * Mode hook placeholder.
 *
 * Plan 01-04 (mode flag + subdomains) has not yet shipped. Once it does,
 * this file should read `organization.mode` from the session / organization
 * context and return "agency" | "employer".
 *
 * Until then, both hooks return safe defaults: `null` mode, `false` for
 * `useIsEmployer`. Callers that use these should render correctly in
 * agency-mode tenants and simply not apply employer-specific label
 * overrides.
 *
 * TODO(01-04): wire to `useSession().data.organization.mode`.
 */

export type Mode = "agency" | "employer";

export function useMode(): Mode | null {
  return null;
}

export function useIsEmployer(): boolean {
  return false;
}
