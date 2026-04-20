# GitHub Branch Protection Setup

This file documents the manual steps required to enable PR blocking in GitHub.
These cannot be automated — they must be configured in the GitHub repository
settings after the CI workflows have run at least once so their job names
appear in the required-status-checks dropdown.

## Required Status Checks

After `.github/workflows/ci.yml` has run at least once on any branch,
configure branch protection rules for the `main` branch:

1. Go to: **GitHub repo → Settings → Branches → Add branch protection rule**

2. Branch name pattern: `main`

3. Enable: **Require a pull request before merging**

4. Enable: **Require status checks to pass before merging**

5. Enable: **Require branches to be up to date before merging**

6. Search for and add these required status checks:
   - `quality` — from `.github/workflows/ci.yml` (lint + type-check + Vitest unit tests)

7. Enable: **Do not allow bypassing the above settings**

8. Optional: **Restrict who can push to matching branches** — limit to admins only.

## Status Check Names

GitHub uses the job name (the `name:` field of the job, or the key under
`jobs:` if no `name:` is set) as the status-check identifier.

| Workflow file                     | Job key   | Display name                        | Trigger                         |
| --------------------------------- | --------- | ----------------------------------- | ------------------------------- |
| `.github/workflows/ci.yml`        | `quality` | Lint, Type Check & Unit Tests       | PR to any branch + push to main |
| `.github/workflows/e2e.yml`       | `e2e`     | Playwright E2E                      | push to main + workflow_dispatch |

For PR blocking, only the `quality` job from `ci.yml` needs to be a required
status check. The `e2e` job runs on main push **after** merge — it is a
post-merge quality signal, not a pre-merge gate, by design. This avoids
burning GitHub Actions minutes on flaky Playwright runs for every PR while
still catching regressions on main.

## Workflow Dispatch for PR E2E

To run Playwright against a PR branch before merging:

1. Push your branch to GitHub
2. Go to **Actions → E2E Tests → Run workflow**
3. Select your branch from the dropdown
4. Leave `base_url` blank (the workflow auto-starts the Next.js dev server)
5. Click **Run workflow**
6. When finished, download `playwright-report` and `playwright-traces` from
   the run's **Artifacts** section for debugging

## Environment Secrets

Configure these in **GitHub repo → Settings → Secrets and variables → Actions → Secrets**:

| Secret name         | Required | Purpose                                                                                                                                     |
| ------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `CI_DATABASE_URL`   | Optional | PostgreSQL URL for rls-audit tests in the unit-test job. If not set, `rls-audit.test.ts` is skipped; all mock-based service tests still pass. |
| `TURBO_TOKEN`       | Optional | Turbo Remote Cache token (Vercel Remote Cache). Speeds up CI by caching turbo outputs across runs.                                          |
| `SENTRY_AUTH_TOKEN` | Optional | Sentry source-map upload token. Only needed if `withSentryConfig` build step runs in CI.                                                    |

Configure these in **Settings → Secrets and variables → Actions → Variables** (non-secret):

| Variable name | Value                 | Purpose                                               |
| ------------- | --------------------- | ----------------------------------------------------- |
| `TURBO_TEAM`  | Your Vercel team slug | Required together with `TURBO_TOKEN` for remote cache |

## E2E-Specific Secrets

The `e2e.yml` workflow uses in-line environment variables for its own test
database and JWT/Better Auth secrets (`JWT_SECRET`, `BETTER_AUTH_SECRET`).
These are intentionally hardcoded strings (`ci-e2e-...-not-for-prod`) because
the workflow spins up a fresh Postgres container for every run — there is no
persistence and no real customer data. Do not reuse these values anywhere
else.

## Verifying Setup

After enabling branch protection:

1. Open a test PR against `main`
2. Observe the **Checks** section shows `quality` as required
3. If the unit tests fail, the **Merge** button is greyed out
4. Fix the tests, push, and the merge button re-enables automatically once
   the `quality` check turns green

If `quality` does not appear in the required-checks dropdown when
configuring the branch protection rule, make sure `ci.yml` has run at
least once — GitHub only surfaces checks it has seen before.
