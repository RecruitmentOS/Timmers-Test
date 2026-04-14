---
phase: 10-first-customer-ready
plan: 02
subsystem: api, ui, database
tags: [vacancy, archiving, onboarding, transport, seed-data, drizzle]

requires:
  - phase: 01-foundation
    provides: vacancy schema, service layer, RLS tenant context
  - phase: 02-core-operational-loop
    provides: activity log, pipeline stages
provides:
  - Vacancy archive/unarchive API endpoints (POST /:id/archive, /:id/unarchive)
  - Archived status in vacancy_status enum
  - UI toggle for showing archived vacancies
  - 4 transport qualification presets in onboarding (CE, C, Buschauffeur, Koerier)
  - Transport-realistic seed data with NL job titles and locations
affects: [vacancy-management, onboarding, demo-environment]

tech-stack:
  added: []
  patterns:
    - "Archive pattern: soft status change (not soft delete) with activity logging"
    - "Base UI render prop for DropdownMenuTrigger (no asChild)"

key-files:
  created: []
  modified:
    - apps/api/src/db/schema/vacancies.ts
    - apps/api/src/services/vacancy.service.ts
    - apps/api/src/routes/vacancy.routes.ts
    - apps/web/src/app/(app)/vacancies/page.tsx
    - apps/web/src/hooks/use-vacancies.ts
    - apps/api/src/services/onboarding.service.ts
    - apps/api/src/db/seed/index.ts
    - packages/types/src/vacancy.ts

key-decisions:
  - "Unarchive returns vacancy to 'draft' status (not previous status) so admin explicitly re-activates"
  - "Archive is a status change, not a soft delete -- distinct from deletedAt pattern"

patterns-established:
  - "Archive/unarchive as dedicated POST endpoints (not PATCH status) for clear intent"

requirements-completed: [CX-04, CX-05]

duration: 4min
completed: 2026-04-14
---

# Phase 10 Plan 02: Vacancy Archiving + Transport Seed Data Summary

**Vacancy archive/unarchive API + UI with transport-realistic onboarding presets (CE, C, Buschauffeur, Koerier) and NL seed data**

## Performance

- **Duration:** 4 min
- **Started:** 2026-04-14T12:33:27Z
- **Completed:** 2026-04-14T12:37:48Z
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments
- Added "archived" to vacancy_status enum with archive/unarchive service methods and activity logging
- Vacancy list excludes archived by default; "Show archived" toggle reveals them with dimmed styling
- Per-row dropdown menu with archive/unarchive actions and inline toast feedback
- Expanded onboarding qualification presets from 2 to 4 (added Buschauffeur D/D1 and Koerier B)
- Replaced generic seed vacancy titles with real transport jobs (CE Chauffeur Internationaal Transport, Koerier Last-mile Delivery, C Chauffeur Distributie)

## Task Commits

Each task was committed atomically:

1. **Task 1: Add archived status to vacancy schema, archive/unarchive service methods and routes** - `767759c` (feat)
2. **Task 2: Vacancy archiving UI + onboarding seed data transport realism review** - `0495bb8` (feat)

## Files Created/Modified
- `packages/types/src/vacancy.ts` - Added "archived" to VacancyStatus type
- `apps/api/src/db/schema/vacancies.ts` - Added "archived" to vacancy_status pgEnum
- `apps/api/src/services/vacancy.service.ts` - Added archive(), unarchive() methods + includeArchived filter
- `apps/api/src/routes/vacancy.routes.ts` - Added POST /:id/archive and /:id/unarchive routes
- `apps/web/src/app/(app)/vacancies/page.tsx` - Show-archived toggle, per-row archive dropdown, toast
- `apps/web/src/hooks/use-vacancies.ts` - Added useArchiveVacancy and useUnarchiveVacancy hooks
- `apps/api/src/services/onboarding.service.ts` - Added Buschauffeur D/D1 and Koerier B presets
- `apps/api/src/db/seed/index.ts` - Updated vacancy titles to real transport jobs

## Decisions Made
- Unarchive returns vacancy to "draft" (not previous status) so admin must explicitly re-activate
- Archive/unarchive use dedicated POST endpoints for clear intent rather than PATCH status update
- Used Base UI render prop pattern for DropdownMenuTrigger (project convention, not asChild)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Updated VacancyStatus type in packages/types**
- **Found during:** Task 1
- **Issue:** Plan did not mention updating the shared types package, but VacancyStatus type union would be out of sync with the DB enum
- **Fix:** Added "archived" to VacancyStatus in packages/types/src/vacancy.ts
- **Files modified:** packages/types/src/vacancy.ts
- **Committed in:** 767759c

**2. [Rule 3 - Blocking] Fixed DropdownMenuTrigger render prop pattern**
- **Found during:** Task 2
- **Issue:** Initial implementation used asChild (Radix pattern) but project uses Base UI render prop
- **Fix:** Changed to render={<Button>} pattern matching existing codebase convention
- **Files modified:** apps/web/src/app/(app)/vacancies/page.tsx
- **Committed in:** 0495bb8

---

**Total deviations:** 2 auto-fixed (1 bug, 1 blocking)
**Impact on plan:** Both fixes essential for type safety and compilation. No scope creep.

## Issues Encountered
- Note: Adding "archived" to the PostgreSQL enum requires `drizzle-kit push` or a migration to actually update the database enum type. This is a deployment step, not a code issue.

## User Setup Required
None - no external service configuration required.

## Known Stubs
None - all features are fully wired.

## Next Phase Readiness
- Vacancy archiving ready for end-to-end testing
- Database migration needed to add "archived" to vacancy_status enum in PostgreSQL

---
*Phase: 10-first-customer-ready*
*Completed: 2026-04-14*
