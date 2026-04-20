# E2E Tests (Playwright)

Phase 09 plan 09-04 — automated end-to-end coverage for the 8 critical
user flows.

## Running locally

```bash
# From repo root
pnpm --filter web test:e2e            # auto-starts dev server on :3002
pnpm --filter web test:e2e:ui         # Playwright UI runner
pnpm --filter web test:e2e:headed     # headed chromium
pnpm --filter web test:e2e:report     # open last HTML report
```

### Against an already-running server

```bash
E2E_SKIP_WEBSERVER=1 E2E_BASE_URL=http://localhost:3002 \
  pnpm --filter web test:e2e
```

### Port override

```bash
E2E_PORT=4002 pnpm --filter web test:e2e
```

## Structure

```
tests/e2e/
├── flows/                 # 8 spec files, one per flow
│   ├── 01-login.spec.ts
│   ├── 02-apply.spec.ts
│   ├── 03-pipeline.spec.ts
│   ├── 04-onboarding.spec.ts
│   ├── 05-billing.spec.ts
│   ├── 06-portal.spec.ts
│   ├── 07-ai-screening.spec.ts
│   └── 08-settings.spec.ts
├── pages/                 # page objects — one class per flow
│   └── <flow>.page.ts
├── fixtures/
│   ├── auth.fixture.ts    # storageState-based recruiter auth
│   ├── test-users.ts      # AGENCY_RECRUITER / EMPLOYER_USER / PORTAL_USER / CANDIDATE
│   └── files/
│       └── sample-cv.pdf  # placeholder CV used by apply flow
└── .auth/                 # gitignored — cached storageState JSON
```

Legacy inline-mocked specs (Phase 2 dnd-kit drag-end smoke test and early
Phase 3-7 flows) still live directly under `tests/e2e/` — they are NOT
run by the plan-09-04 config because `testDir` points at `./tests/e2e/flows`.
Run them manually with `playwright test tests/e2e/<file>.spec.ts` if
needed.

## Auth caching (storageState)

`fixtures/auth.fixture.ts` logs in once per worker as the
`AGENCY_RECRUITER` user (see `test-users.ts`) and persists the browser
storage to `.auth/recruiter.json`. Subsequent specs that request the
`authenticatedPage` fixture reuse this state — no per-test login cost.

If the login call fails (e.g. no seed data in the test DB), the fixture
writes an empty storage state and logs a warning. Tests that require
real authentication should mark themselves `test.fixme(...)` with a TODO
referencing the required seed script.

## Seeding test users

The `test-users.ts` constants assume a seed script has inserted these
users into the database. When running against a fresh DB, run:

```sql
-- Approximate seed (see apps/api/scripts/seed-e2e-users.ts when it exists)
INSERT INTO "user" (id, email, name, role, emailVerified) VALUES
  ('e2e-recruiter', 'e2e-recruiter@upply.test', 'E2E Recruiter', 'recruiter', true),
  ('e2e-employer',  'e2e-employer@upply.test',  'E2E Employer',  'admin', true),
  ('e2e-portal',    'e2e-portal@upply.test',    'E2E Portal',    'client_viewer', true);
-- Password hashes must be created via better-auth's hashPassword() helper.
```

## Known seed dependencies

The following specs are `test.fixme(...)` pending seed data and will be
promoted to green once `apps/api/scripts/seed-e2e-users.ts` lands:

| Spec | Why fixme | Needs |
| ---- | --------- | ----- |
| `03-pipeline.spec.ts` | Needs a known candidate card named "Simon Loos" in `prospect` | 09-01 fixtures in test DB |
| `04-onboarding.spec.ts` | Needs a user with `onboardingCompletedAt = NULL` | `ONBOARDING_USER` seed |
| `07-ai-screening.spec.ts` happy path | Candidate fixture ID | `E2E_CANDIDATE_ID` env or seed |

Specs that do NOT depend on seed data and should run green:
- `01-login.spec.ts` invalid-password branch (asserts error UI)
- `02-apply.spec.ts` required-field branch (HTML5 validation)
- `05-billing.spec.ts` dormant-stub branch
- `06-portal.spec.ts` magic-link-requested branch
- `07-ai-screening.spec.ts` mocked-verdict branch (uses `page.route()`)
- `08-settings.spec.ts` mocked-save branch

## Flow coverage

| # | Flow          | Route(s)                         | Requirements covered |
|---|---------------|----------------------------------|-----------------------|
| 1 | Login         | /login                           | TEST-02, AUTH-01..03  |
| 2 | Public apply  | /apply/:vacancyId                | TEST-02, 04-distribution-intake |
| 3 | Pipeline drag | /pipeline, /vacancies/:id/pipeline | TEST-02, PIPE-02      |
| 4 | Onboarding    | /onboarding                      | TEST-02, 01-foundation |
| 5 | Billing       | /billing                         | TEST-02, 05-billing    |
| 6 | Portal login  | /portal/login                    | TEST-02, 03-portals    |
| 7 | AI screening  | /candidates/:id                  | TEST-02, 07-ai-layer   |
| 8 | Settings      | /settings                        | TEST-02                |

## CI invocation (planned for 09-05)

```yaml
- run: pnpm --filter web exec playwright install --with-deps chromium
- run: pnpm --filter web test:e2e
  env:
    CI: "1"
```

HTML reports land in `apps/web/playwright-report/` (gitignored, upload as
CI artifact).
