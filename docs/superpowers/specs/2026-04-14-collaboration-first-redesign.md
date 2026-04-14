# Recruitment OS: Collaboration-First Redesign

**Date:** 2026-04-14
**Status:** Design approved, awaiting implementation approach selection
**Author:** Bart + Claude (brainstorming session)

---

## Executive Summary

Recruitment OS is a 2-mode ATS (agency + employer) for transport/chauffeurs. The current build (Phases 1-7 complete, 174 frontend files, ~100 API files, 27 schema tables) has a solid backend but a **tool-centric frontend** — users navigate between disconnected pages (vacancies, candidates, pipeline, tasks, reports) with collaboration bolted on as comments in Phase 3.

The core insight from design partner validation: **the pain is fragmented collaboration between recruiters, agencies, HR managers, and stakeholders**. There's no central place for communication, feedback, and updates. Recruitment OS should win on collaboration and data visibility — the thing nobody else does well.

This spec describes a **structural UX transformation** from "ATS with collaboration features" to "collaborative workspace where recruitment happens." The backend stays. The frontend gets restructured around 5 core concepts.

---

## Strategic Analysis

### What the Current Build Gets Right (Keep)

1. **Two-mode architecture** — `organization.mode = 'agency' | 'employer'` drives feature visibility. One codebase, two GTM motions. This is genuinely clever.
2. **Transport-specific data model** — Driver qualifications (C/CE, code 95, ADR, digitachograaf), license expiry tracking, document management. This vertical depth is the moat.
3. **Multi-tenant from day 1** — PostgreSQL RLS, tenant subdomains, per-tenant billing. No corners cut.
4. **Monorepo structure** — Shared types, permissions package, separate API/web apps. Clean separation.
5. **Backend services layer** — 27 schema tables, Hono API with organized routes/services, Socket.IO realtime, pg-boss job queue. All solid.

### What's Structurally Wrong (Fix)

1. **Collaboration is bolted on, not built in** — Comments and @mentions were added in Phase 3 of 7. But the entire UX should be designed around shared context. Every screen should answer: "who else is looking at this? what did they say? what needs my input?"

2. **Portals are separate apps instead of shared views** — 4 separate route groups: `(app)`, `(client-portal)`, `(hm-portal)`, `(agent-portal)`. This means 4x the UI to maintain, and stakeholders feel like they're on a "lesser" version. Better pattern: one app, role-based views.

3. **No unified activity/communication timeline** — The killer feature for the collaboration value prop — a shared timeline per candidate/vacancy where ALL stakeholders see updates, feedback, stage changes, notes — doesn't exist as a first-class concept. It's scattered across comments, notifications, and activity logs.

4. **Data/insights are an afterthought** — Reports are Phase 3 with 7 static widgets. But "data-driven recruitment" means: real-time funnel health, time-to-hire benchmarks, source ROI, recruiter performance, SLA tracking per client. This should inform every screen, not live on a reports page.

5. **Zero test coverage** — 174 frontend files, 1 Playwright smoke test. Fast execution got us here, but going to production with 2 paying customers and zero tests is a liability.

### Missed Opportunities (Build)

1. **Stakeholder-specific dashboards with SLA tracking** — Agency clients care about "how fast are you filling my vacancy?" Hiring managers want "how many qualified candidates and when can I interview?" This is what makes them stay.

2. **Smart notifications that replace WhatsApp** — Recruiters use WhatsApp because it's instant and personal. The notification system needs to feel like chat — push notifications, @mentions that feel like DMs, quick-reply from notification.

3. **Candidate communication hub** — No way to see "all communication with this candidate across all channels." Email threads, notes, stage changes, interviews — all separate. A unified timeline per candidate is table stakes.

4. **AI that assists collaboration, not just screening** — Current AI screening (Phase 7) is one-directional. AI could also: auto-summarize stakeholder feedback, suggest next-best-action ("3 stakeholders reviewed, 2 positive — schedule interview?"), draft client updates, flag stalled candidates.

5. **Mobile-first for on-the-go stakeholders** — Hiring managers and transport planners aren't at desks. They review candidates on phones between shifts. Portals need quick approve/reject, voice notes, swipe actions.

---

## The Fundamental UX Shift

**From:** Tool-centric (navigate between pages: Vacancies, Candidates, Pipeline, Tasks, Reports, Client Portal, HM Portal, Agent Portal)

**To:** Context-centric (5 core concepts that replace 8+ disconnected pages)

### The 5 Core Concepts

Everything maps to these. If a feature doesn't serve one of these, cut it.

| # | Concept | Purpose | Replaces |
|---|---------|---------|----------|
| 1 | **Workspace Home** | Your personalized command center — "your day, your priorities" | Dashboard (6 static widgets) |
| 2 | **Vacancy Room** | The shared space per vacancy — pipeline + timeline + team | Pipeline page + comments + portal pages |
| 3 | **Candidate Profile** | Complete picture with unified timeline across all vacancies | Candidate page + application details + comments |
| 4 | **Inbox** | Action queue — all things waiting for you, across all Rooms | Notifications + tasks page |
| 5 | **Insights** | Data that flows everywhere, not just a reports page | Reports page (7 widgets) |

**Key shift:** Instead of "go to the pipeline page, then click a candidate, then check comments" — the Vacancy Room is a single shared space where pipeline, conversation, files, feedback, and metrics live side by side. Think Slack channel meets Kanban board meets analytics dashboard. Every stakeholder sees this room — just with different permissions on what they can do.

---

## Concept 1: Vacancy Room (The Differentiator)

### What is a Vacancy Room?

Every vacancy gets a **Room** — a persistent, shared workspace where all stakeholders collaborate in real-time. It's not a page with tabs. It's a **living space** that combines pipeline, conversation, files, feedback, and metrics in a flexible layout.

### Layout: Two-Panel

- **Left panel:** Quick stats bar (totaal, geschikt, interview, overdue, avg time-to-hire, funnel rate) + pipeline board (kanban with Board/Lijst/Kalender toggle). Pipeline cards show candidate name, license badges, AI score, overdue flags, feedback-pending indicators.
- **Right panel:** Room Timeline — a single chronological stream that mixes:
  - Human messages (recruiter notes, client requests, HM feedback with thumbs up/down)
  - System events (stage changes, new applications)
  - AI summaries ("3 nieuwe kandidaten vandaag. Jan de Vries scoort 94% match. 2 kandidaten wachten >3 dagen op actie.")
  - Quick actions (@mentions, file attachments)
- **Room header:** Vacancy title, client/employer info, open duration, candidate count, presence avatars (who's online in this room)
- **Message input:** At bottom of timeline, with internal/shared toggle, @mention support, file attach

### Role-Based Permissions (Same Room, Different Views)

| Capability | Recruiter | Hiring Manager | Client (Agency) | Agent |
|-----------|-----------|---------------|-----------------|-------|
| Full pipeline | Yes | Read-only | Shared candidates only | Assigned only |
| Drag-and-drop stages | Yes | No | No | Yes (assigned) |
| All timeline messages | Yes | Shared only | Shared only | Shared only |
| Internal notes | Yes | No | No | No |
| AI screening results | Yes | No | No | No |
| Bulk actions | Yes | No | No | No |
| Feedback buttons | N/A | Yes (thumbs) | Yes (thumbs) | N/A |
| Request more candidates | N/A | Yes | Yes | N/A |
| SLA metrics | Yes | No | Yes | No |

### Why This Kills WhatsApp

**Today:** Recruiter sends WhatsApp to hiring manager: "Ik heb 3 goede kandidaten, check je mail." HM checks email, downloads CV, replies via WhatsApp, recruiter updates spreadsheet.

**With Room:** HM opens the Room, sees pipeline, gives thumbs up on a candidate, writes "plan interview in" in the timeline. Recruiter sees it instantly. Done. Zero context switching.

---

## Concept 2: Workspace Home

### What It Replaces

The current dashboard with 6 static number widgets (open vacancies, new candidates today, overdue follow-ups, qualified this week, open tasks, source snapshot).

### Layout: Priority Feed + My Rooms

- **Left panel — Priority Feed:**
  - **"Actie vereist"** section (red) — overdue candidates, expiring documents, unanswered client/HM requests
  - **"Vandaag"** section (blue) — scheduled interviews, new applications (with AI pre-screening status), received feedback
  - **AI Dagstart** (purple) — AI-generated morning summary in plain Dutch: "Je hebt 5 actieve vacatures met 47 kandidaten. 2 kandidaten wachten te lang. CE Utrecht presteert boven gemiddelde."

- **Right panel — My Rooms:**
  - List of all vacancy Rooms assigned to this user
  - Each card shows: vacancy name, presence avatars, candidate count, qualified count, overdue count, mini funnel bar (visual pipeline health)
  - Click to enter Room
  - Weekly performance snapshot at bottom: gescreend, interviews, geplaatst, gem. doorlooptijd

### Role-Specific Workspace

| Role | Workspace Shows |
|------|----------------|
| Recruiter | Priority feed across all vacancies, Room list, weekly stats |
| Hiring Manager | "3 kandidaten wachten op jouw feedback", scheduled interviews, SLA: avg feedback time |
| Client (Agency) | "5 kandidaten in de pijplijn voor jou", new candidates proposed, SLA tracking, monthly billing overview |
| Agent | Assigned vacancies only, own tasks, own performance |

---

## Concept 3: Inbox (Action Queue)

### Workspace vs. Inbox

- **Workspace Home** = your morning view, curated highlights, AI brief. Proactive.
- **Inbox** = your full action queue. Every @mention, feedback request, overdue candidate, expiring document creates an inbox item. You clear it like email. Reactive.

### Inbox Item Sources

- @mentions in any Room timeline
- Feedback requests (HM/client asked to review a candidate)
- Overdue candidates (>X days without action)
- Expiring documents (30/14/7 day warnings)
- Stage change notifications
- New applications on your vacancies
- Task due dates
- Client/HM messages requiring response

### UX

- Simple chronological list, grouped by "Today", "Yesterday", "This Week"
- Each item: icon + description + Room link + quick action button
- Mark as done / snooze / open Room
- Badge count on sidebar nav

---

## Concept 4: Candidate Profile (Unified Timeline)

### What It Replaces

Currently candidate data is split across: candidate list page, candidate detail page, application details, pipeline cards, comments, documents, qualifications. You click through 4-5 views to answer "what's the full picture on this person?"

### Layout: Two-Panel

- **Left panel — Identity & Context:**
  - Contact info (email, phone, location)
  - Rijbewijzen & Kwalificaties (license badges with expiry: CE, C, Code 95, ADR, Digitacho)
  - Documents list with validity status (geldig / verloopt / verlopen)
  - Active applications list (which vacancies, current stage per vacancy, source, days active)
  - AI Screening summary (match %, reasoning, risks)
  - Quick actions: call, WhatsApp (wa.me link), download CV

- **Right panel — Unified Timeline:**
  - All activity across ALL vacancies this candidate is in
  - Color-coded by application/vacancy (left border)
  - Includes: Room messages about this candidate, stage changes, AI screening results, CV parse events, applications, feedback received
  - Filterable: Alles / Notities / Status / Feedback
  - Add note input with "Intern" toggle (internal notes hidden from portals)

### Cross-Vacancy View

When a candidate has multiple applications (common in agency mode — same driver proposed to 3 clients), the timeline shows everything in one stream with vacancy labels. The recruiter sees the complete relationship history.

---

## Concept 5: Ambient Insights

### Philosophy

Instead of a reports page that nobody visits, data appears **contextually on every screen:**

| Location | Insight Type |
|----------|-------------|
| Vacancy Room header | Funnel rate, avg time-to-hire, overdue count, source breakdown |
| Workspace Home | Weekly stats, AI daily brief, performance trend |
| Candidate Profile | AI match score, qualification risk flags |
| Room cards (sidebar) | Mini funnel bars, candidate counts, health color coding |
| Pipeline cards | AI score badge, overdue flag, license tags |

### Deep-Dive Insights Page (Still Exists)

The reports page becomes an "Insights" deep-dive for analysis:

- **Funnel conversion** — per vacancy, per period, per source
- **Source ROI** — which channel brings the most qualified candidates?
- **Recruiter performance** — candidates screened, time-to-action, placements
- **SLA tracking** — per client (agency mode), per hiring manager (employer mode)
- **Time-to-hire trends** — week over week, by vacancy type
- **Cost per hire** — source spend vs. placements (when Meta campaigns active)

### Client SLA Dashboard (Agency Mode)

What Upply's clients see — the "shut up and take my money" screen:

- Monthly KPIs: geplaatst, voorgesteld, gem. tijd tot voorstel (vs. target), gem. doorlooptijd (vs. target)
- Active vacancy table: per vacancy → candidates, voorgesteld, geplaatst, status indicator (op schema / achter / in opstart)
- Green/yellow/red health coding based on SLA targets

---

## Implementation Approach

### Three Options Evaluated

| Approach | Description | Timeline | Risk | Demo-able |
|----------|-------------|----------|------|-----------|
| **A: Big Bang** | Rebuild entire frontend in one go | 3-4 weeks | HIGH | Only at end |
| **B: Progressive** | Build new concepts alongside old, migrate one at a time | 5-6 weeks | LOW | After each concept |
| **C: Minimal** | Inject features into existing pages | 2 weeks | LOW | After week 1 |

### Recommended: B — Progressive Transformation

**Rationale:** The Vacancy Room is the first-meeting weapon. When you show Simon Loos or Upply a Room with their vacancy data, live timeline, and role-based views — that's the "dit is wat we zoeken" moment. Progressive Transformation delivers that moment fastest without betting everything on a big-bang refactor.

### Implementation Order

| Step | Concept | What Happens | Duration |
|------|---------|-------------|----------|
| 1 | **Vacancy Room + Room Timeline** | Build as new route `/vacancies/[id]/room`. The differentiator. Demo to partners first. | ~1-2 weeks |
| 2 | **Portal Unification** | Kill 3 portal route groups `(client-portal)`, `(hm-portal)`, `(agent-portal)`. One app, permissions-driven. Role detected from session, Room shows appropriate view. | ~1 week |
| 3 | **Workspace Home + Inbox** | Replace dashboard with priority feed. Build inbox as new nav item. Wire Room timeline events to inbox items. | ~1 week |
| 4 | **Candidate Profile** | Merge scattered candidate views into two-panel layout with unified cross-vacancy timeline. | ~1 week |
| 5 | **Ambient Insights + SLA + AI** | Insight cards on Room headers, Workspace, pipeline cards. Client SLA dashboard. AI Dagstart summaries. | ~1-2 weeks |

### Parallel Tracks

Infrastructure (current Phase 8), testing (Phase 9), and GDPR (Phase 10) run in parallel with steps 2-5. The Room can demo on localhost while infra catches up.

---

## What Changes in the Backend

The backend is largely intact. New API work needed:

| Area | Change |
|------|--------|
| **Room Timeline API** | New endpoint that merges comments, stage events, system events, and AI summaries into a single chronological feed. Filterable by type, role visibility. |
| **Inbox API** | New endpoint that aggregates action items across all vacancies for a user. Mark-as-read, snooze. |
| **Workspace API** | New endpoint for priority feed (overdue candidates, expiring docs, pending feedback) + AI daily brief generation. |
| **SLA metrics** | New service calculating time-to-propose, time-to-hire, funnel rates per vacancy/client/period. |
| **Unified candidate timeline** | New endpoint merging all activity for a candidate across all their applications. |
| **Permission-based content filtering** | Extend existing RBAC to filter timeline items by role (internal notes hidden from clients/HMs). |
| **AI summaries** | pg-boss job that generates periodic Room summaries and daily briefs via Claude. |

Existing schema tables, RLS policies, auth, services, and routes remain unchanged.

---

## What Gets Deleted

After progressive migration is complete:

- `apps/web/src/app/(client-portal)/` — entire route group
- `apps/web/src/app/(hm-portal)/` — entire route group
- `apps/web/src/app/(agent-portal)/` — entire route group
- `apps/web/src/app/(app)/dashboard/` — replaced by Workspace Home
- `apps/web/src/app/(app)/reports/` — replaced by Insights page
- `apps/web/src/components/reports/` — rebuilt as ambient insight cards
- Portal-specific components in `src/components/portal-shared/` — absorbed into role-based views

---

## Success Criteria

1. **Simon Loos test:** Hiring manager opens their browser, sees their vacancies, gives thumbs up on a candidate, writes a message — recruiter sees it instantly in the same Room. No WhatsApp needed.

2. **Upply Jobs test:** Client logs in, sees SLA dashboard showing "gem. 4.2 dagen tot voorstel" with green indicator, enters a Room, sees pipeline progress and shared candidates. Feels like a partner portal, not a read-only afterthought.

3. **Recruiter test:** Opens Workspace Home at 8:30, sees AI Dagstart ("2 kandidaten wachten te lang"), clicks through to Room, drags candidate to next stage, writes note, done. No spreadsheet opened.

4. **Zero separate portal apps:** All roles use the same URL, same app. Permissions determine the view.

5. **Data everywhere:** Every screen shows relevant metrics without navigating to a reports page.

---

## Open Questions (to resolve during implementation planning)

1. **Room Timeline storage:** Extend existing comments table with a `type` discriminator, or create a new `room_events` table that unions different event types?
2. **AI Dagstart frequency and cost:** Generate per-user daily? Per-org? Cache aggressively? What's the Claude API cost per brief?
3. **Mobile responsiveness vs. native:** Is responsive web enough for HM phone usage, or do we need a PWA with push notifications?
4. **Room URL structure:** `/vacancies/[id]/room` or `/rooms/[id]` (rooms as first-class entity)?
5. **Notification delivery:** In-app only for v1, or also email digest? Push notifications via service worker?

---

## Appendix: Current Codebase Inventory

**Frontend (apps/web):** 174 source files
- Route groups: `(app)`, `(auth)`, `(client-portal)`, `(hm-portal)`, `(agent-portal)`, `(marketing)`, `(public)`
- Component dirs: agent, campaigns, candidates, collaboration, cv-parse, dashboard, documents, driver, geo, layout, pipeline, portal-shared, qualification, reports, tasks, ui
- 1 Playwright test (pipeline drag-end)

**Backend (apps/api):** ~100 source files
- 27 schema tables with RLS
- 24 route files, 28 service files
- Socket.IO, pg-boss, React Email
- Better Auth with organization RBAC

**Packages:** types (31 type files), permissions (roles, resources, matrix)

**Completed phases:** 1-7 (40/41 plans executed)
**Remaining phases:** 8 (infra), 9 (testing), 10 (GDPR), 11 (design partner fit)
