# Timmers Demo Core — UI Redesign

**Date:** 2026-04-23  
**Status:** Approved, awaiting implementation plan  
**Author:** Bart + Claude (brainstorming session)  
**Target:** Timmers Transport — real recruiter demo, end-to-end working

---

## Executive Summary

Recruitment OS has a solid backend but inconsistent, incomplete frontend. This spec defines the **Demo Core** — a focused sprint that brings 5 essential recruiter flows to 100% working + polished state for Timmers Transport, a flex uitzendbureau with verticals in Bouw, Security, Traffic Control, and Zorg.

The design is based on a validated B+C hybrid layout: wide labeled sidebar (B) + full-width pipeline with candidate slide-out (C) + action-oriented dashboard (A). Existing design system (HRFlow-inspired: glassmorphism cards, gradient sidebar active state, backdrop-blur header) is preserved and extended.

---

## Context: Who is Timmers?

Timmers Transport is a flex uitzendbureau (agency-mode) operating multiple verticals:
- **Bouw** (grondwerkers, stratenmakers, lassers, monteurs)
- **Traffic Control** (verkeersregelaars)
- **Security** (beveiligers)
- **Zorg** (helpenden, verzorgenden, verpleegkundigen)

**Daily recruiter workflow:**
1. Check dashboard — what needs attention today (Nilo updates, gesprekken, wachtende kandidaten)
2. Open actieve vacature → review nieuwe sollicitanten → beoordeel Nilo screenings
3. Zet kandidaten door in de pipeline of wijs af
4. Voer telefonische gesprekken, log aantekeningen
5. Stel taken in voor follow-up
6. Campagnes monitoren / bijsturen

**Hey Nilo** handles WhatsApp-based initial screening automatically — recruiter steps in when Nilo flags a completed or escalated session.

---

## Sprint 1 — Demo Core Scope

### In scope (100% working + polished)

| # | Module | Deliverable |
|---|--------|-------------|
| 1 | **App Shell** | Sidebar, header, routing consistent across all pages |
| 2 | **Dashboard** | Action-oriented command center + existing widget grid |
| 3 | **Vacatures + Pipeline** | Vacaturelijst + Vacancy Room (pipeline, tabs, slide-out) |
| 4 | **Kandidaatprofiel** | Full-page profile with tabs |
| 5 | **Intake / Hey Nilo** | Session list, session detail, handoff |
| 6 | **Taken** | Personal task list with priorities and linked entities |

### Out of scope (roadmap sprint 2+)

- Visuele workflow/automation editor (Make.com-stijl)
- Campagne-integraties (Meta API, Indeed API, TikTok) — Campagnes tab in Vacancy Room toont read-only placeholder in sprint 1
- Template manager (WhatsApp / email / SMS)
- Externe integraties (Google Calendar, Drive, Twilio configuratie UI)
- Volledig rapportage dashboard
- Inbox module (unified conversations cross-vacature) — sidebar-item bestaat maar navigeert naar "coming soon" state

---

## Design System Constraints

Existing system stays intact. No new dependencies.

| Token / Pattern | Value |
|----------------|-------|
| Primary | `#6366f1` (indigo) |
| Active state | `linear-gradient(90deg, rgba(99,102,241,0.18), rgba(99,102,241,0.08))` + `border-left: 2px solid #6366f1` |
| Cards | glassmorphism — `bg-white/5 backdrop-blur border border-white/10` (dark) |
| Header | sticky, `backdrop-blur-md`, `bg-background/80` |
| Sidebar width | 200px (always visible, no collapse in sprint 1) |
| Font | system-ui (`font-sans antialiased`) |
| Rounding | `rounded-xl` cards, `rounded-lg` smaller elements |

Transport accent: **amber** (`oklch(0.76 0.18 60)`) for driver-specific tags (CE, Code 95, ADR).

---

## 1. App Shell

### Sidebar (200px, fixed)

```
┌──────────────────┐
│ [R] Recruitment  │  ← logo mark + tenant name (Timmers Transport)
│     OS           │
├──────────────────┤
│ ⊞  Dashboard     │
│ 💼 Vacatures [14]│  ← active: gradient bg + left border
│ 👥 Kandidaten    │
│ ✉  Inbox     [7] │  ← orange badge = urgent
│ ✅ Taken      [3]│
├──────────────────┤
│ AUTOMATISERING   │  ← section label
│ 🤖 Hey Nilo      │
│ 📣 Campagnes     │
│ 🔄 Workflows     │
├──────────────────┤
│ ANALYSE          │
│ 📊 Rapporten     │
├──────────────────┤
│ ⚙  Instellingen  │
│ [JB] Jan Bakker  │  ← avatar + name + role
│      Recruiter   │
└──────────────────┘
```

**Badge logic:**
- Vacatures: count of active vacancies
- Inbox: count of unread/pending conversations
- Taken: count of overdue or due-today tasks (orange = overdue)

### Header (48px, per page)

Left: breadcrumb (`Vacatures / Chauffeur CE Rotterdam`)  
Right: search input → bell icon → `+ Kandidaat` primary button

---

## 2. Dashboard

### Layout (top → bottom)

**Welcome Banner** (gradient indigo/purple, decorative circles)
- "Goedemorgen [naam] 👋"
- Subtitle with date
- Action chips: `🤖 5 Nilo updates` · `✅ 3 taken` · `📅 1 gesprek vandaag`
- Each chip is clickable → scrolls to relevant section or navigates

**KPI Strip** (3 columns)
- Actieve kandidaten (delta: +N nieuw)
- Open vacatures (N urgent)
- Te plaatsen deze week

**Acties voor vandaag** (action list, max 5 items)
- Items generated from: completed Nilo screenings awaiting review, gesprekken gepland vandaag, kandidaten wachtend >48u in stage, overdue taken
- Each item: colored dot (green=Nilo, indigo=actie, orange=urgent) + beschrijving + gekoppelde entiteit + CTA knop
- Empty state: "Geen openstaande acties — goed bezig! 🎉"

**Widget Grid** (existing 6 widgets, 3-column)
- WidgetOpenVacancies, WidgetNewCandidates, WidgetOverdueFollowups
- WidgetQualifiedThisWeek, WidgetOpenTasks, WidgetSourceSnapshot
- Wrapped in updated glassmorphism `widget-shell.tsx` (already planned in HRFlow design system)

---

## 3. Vacatures + Pipeline (Vacancy Room)

### Vacaturelijst (`/vacancies`)

Table/card grid with per vacature:
- Titel + locatie
- Status badge (Actief / Concept / Gepauzeerd / Gesloten)
- Kandidaatcount met stage breakdown (N nieuw, N in process, N gekwalificeerd)
- Campagnes actief (count)
- Nilo status (actief / gestopt)
- Last activity timestamp
- Quick actions: open pipeline, pause, archive

### Vacancy Room (`/vacancies/[id]`)

**Vacature header strip:**
- Titel, status badge, meta (kandidaten, campagnes, Nilo, datum)
- Edit button → inline edit mode

**Tabs:**
1. **Pipeline** (default)
2. **Kandidaten** (tabel-view van alle kandidaten voor deze vacature)
3. **Campagnes** (welke campagnes zijn actief, stats per campagne)
4. **Info & Settings** (vacature details, Nilo flow config, intake form settings)

**Pipeline board (tab 1):**

Stages (Timmers default):
```
Nieuw → Nilo Screening → Telefonisch gesprek → Intake gesprek → Aanbieding → Geplaatst
```
Plus vaste kolom rechts: **Afgewezen** (collapsed by default — toont als smalle kolom met count badge, uitklapbaar via klik)

Kandidaatkaart bevat:
- Avatar (initialen) + naam
- Kwalificatie-tags: `✓ CE` `✓ Code 95` `C95 onbekend` (amber = missing info)
- Bron (Indeed / Marktplaats / Direct)
- Nilo status badge indien in Nilo Screening stage
- Timestamp last activity
- Hover: quick actions (doorsturen →, afwijzen ✕)

**Drag-and-drop** tussen stages (bestaande @dnd-kit integratie).

### Kandidaat Slide-out

Opent rechts (260px) bij klik op kandidaatkaart. Pipeline schuift niet weg.

Bevat:
1. **Header:** avatar, naam, rol/vacature, huidige stage chip, actiebar (Doorsturen → / Afwijzen / ✏ Bewerken)
2. **Kwalificaties:** tags voor CE, Code 95, ADR, etc.
3. **Nilo score:** progress bar + percentage + samenvatting in 1-2 zinnen (gegenereerd door Nilo)
4. **Nilo gesprek (samenvatting):** laatste Nilo-bericht + timestamp
5. **Tijdlijn:** stage changes, Nilo events, notities, geplande gesprekken (meest recent bovenaan)
6. **"Volledig profiel →"** link naar kandidaatprofiel pagina

Slide-out sluit via `✕` of klik buiten het panel. Klikken op een andere kandidaatkaart vervangt de slide-out content (geen sluiten/heropenen animatie).

---

## 4. Kandidaatprofiel (`/candidates/[id]`)

### Header (sticky)
Naam, locatie, huidige vacature + stage, actiebar (Doorsturen / Afwijzen / Taak toevoegen / ...)

### Tabs
1. **Overzicht** — contactinfo, kwalificaties, bron, notities
2. **Nilo gesprek** — volledig WhatsApp transcript (bestaande sessions UI uitgebreid)
3. **Tijdlijn** — alle activiteit (stage changes, notities, taken, gesprekken) chronologisch
4. **Bestanden** — CV upload, documenten
5. **Taken** — taken gekoppeld aan deze kandidaat

### Overzicht tab layout
- Links (2/3): kwalificaties grid, contactgegevens, motivatie/notes
- Rechts (1/3): status card met score, stage, snelle acties

---

## 5. Intake / Hey Nilo

### Nilo sessie-lijst (`/nilo/sessions`)

Bestaande pagina uitgebreid met:
- Filter tabs: Alle / In gesprek / Voltooid / Handoff vereist / Failed
- Per sessie: kandidaatnaam, vacature, status badge, laatste bericht preview, timestamp, score
- Row action: "Overnemen" (handoff) bij voltooide sessies

### Nilo sessie-detail (`/nilo/sessions/[id]`)

Bestaande pagina uitgebreid met:
- Volledig gesprekstranscript (WhatsApp-stijl bubbles)
- Screening resultaat card: antwoorden per vraag, score, aanbeveling
- **Handoff sectie:** "Overnemen van Nilo" → kandidaat wordt doorgestuurd naar Telefonisch gesprek stage in pipeline
- Link naar kandidaatprofiel

---

## 6. Taken (`/tasks`)

### Layout

**Mijn taken vandaag** (sectie bovenaan):
- Gefilterd op: due today + overdue
- Gesorteerd: overdue first, dan prio (urgent → hoog → medium → laag)
- Per taak: checkbox, type-icoon, omschrijving, gekoppelde kandidaat/vacature (klikbaar), deadline badge

**Alle taken** (sectie eronder):
- Filter tabs: Vandaag / Deze week / Alles
- Filter dropdown: type (gespreklog, beoordeling, contract, follow-up, overig)
- Sortering: prioriteit / deadline / aangemaakt

**Taaktypen met icoon:**
- 📞 Gespreklog invullen
- ⭐ Kandidaat beoordelen
- 📋 Contract/document
- 🔔 Follow-up
- ✉ E-mail verzenden
- 📅 Afspraak

**Quick add:** inline "+ Nieuwe taak" onderaan elke sectie.

---

## Key Interactions

| Trigger | Gedrag |
|---------|--------|
| Klik kandidaatkaart in pipeline | Slide-out opent rechts |
| "Volledig profiel →" in slide-out | Navigeer naar `/candidates/[id]` |
| "Doorsturen →" in slide-out | Stage-change modal → volgende stage selecteren → bevestig |
| "Overnemen van Nilo" | Nilo sessie → stage = Telefonisch gesprek, taak aangemaakt |
| Chip in dashboard welcome banner | Scroll naar actielijst of navigeer naar pagina |
| Drag kandidaatkaart | Stage change via @dnd-kit |
| Badge in sidebar | Telt real-time mee via TanStack Query |

---

## Page Inventory (Sprint 1)

| Route | Status nu | Sprint 1 doel |
|-------|-----------|---------------|
| `/dashboard` | Bestaat, 6 widgets | Welcome banner + KPI strip + actie-items + widgets |
| `/vacancies` | Bestaat | Verbeterde lijst + snelle acties |
| `/vacancies/[id]` | Bestaat (pipeline tab) | Vacancy Room: alle tabs werkend, slide-out |
| `/vacancies/[id]/pipeline` | Bestaat | Redirect → `/vacancies/[id]` (pipeline is default tab) |
| `/candidates` | Bestaat | Tabel met filters, consistent design |
| `/candidates/[id]` | Bestaat | Volledig profiel met alle tabs |
| `/nilo/sessions` | Bestaat | Filter tabs + handoff actie |
| `/nilo/sessions/[id]` | Bestaat | Uitgebreid met handoff + screening resultaat card |
| `/tasks` | Bestaat | Vandaag-sectie + alle taken + type filters |
| Layout (sidebar + header) | Bestaat | Consistent doorgetrokken op alle pagina's |

---

## What Does NOT Change

- Backend API routes — geen wijzigingen
- Database schema — geen wijzigingen  
- Authentication / middleware — geen wijzigingen
- Better Auth integratie — geen wijzigingen
- Bestaande hooks (`use-vacancies`, `use-candidates`, etc.) — worden hergebruikt, niet herschreven
- Hey Nilo jobs / orchestrator — geen wijzigingen
- Routing structuur — routes blijven hetzelfde
