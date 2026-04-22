# Fleks + WhatsApp Intake Module — Design Spec

**Status:** Design approved 2026-04-20. Ready for implementation planning.
**Codename:** `fleks-intake`
**Phase:** 1 (MVP). Phase 2 roadmap at bottom.
**Target customer:** Timmers.works (1 tenant, 5 verticals: security, traffic control, bouw, zorg, infra).
**Timeline:** 4 weken tot productie.

---

## 1. Context & Goal

Timmers.works gebruikt al Fleks (planning/uitzendsoftware) en Nilo (WhatsApp assistent). Een extern platform — hun huidige acquisitie-aggregator — bundelt sollicitanten uit Meta/Indeed/etc. en schrijft ze in Fleks. Timmers wil dat platform vervangen door Recruitment OS, met als eerste feature een **volledig geautomatiseerde WhatsApp-intake** voor binnenkomende kandidaten.

**Doel v1:** zodra een kandidaat in Fleks verschijnt als job-candidate, pikt Recruitment OS die op, voert via WhatsApp een gesprek, kwalificeert obv vacature-parameters, en pusht het verdict terug naar Fleks. Geen recruiter nodig tenzij bot vastloopt of kandidaat mens vraagt.

**Business-waarde:** Timmers wordt eerste betalende Recruitment OS-klant (end-of-month go-live), module blijkt schaalbaar naar andere flex-organisaties, en dient later als basis voor Nilo-recruitment-module.

## 2. Non-Goals (out of scope Phase 1)

- Auto-scheduling van interviews (Cal.com / Google Calendar)
- CV-upload + parsing via WhatsApp media
- Multi-language (EN/PL/RO) — NL-only in MVP
- Productie-WABA-nummer met Meta-approved templates (sandbox-first)
- Team-routing per vertical (alle recruiters zien alle escalaties)
- Meer dan 2 reminders (24u + 72u enige drop-off-logica)
- Uitsplitsing naar Nilo-microservice

## 3. Architecture Overview

```
                    [Fleks V2 External API]
                         │ poll 5 min (pg-boss)
                         ▼
                 [FleksSyncWorker]
                         │ upsert candidates + applications
                         │ stage = "fleks_intake"
                         ▼
                 [IntakeOrchestrator]
                         │
            ┌────────────┼────────────┐
            ▼            ▼            ▼
        start session  reply turn  reminders
            │            │            │
            ▼            ▼            ▼
                [WhatsAppGateway (Twilio)]
                   ▲ webhook  │ outbound
                   │          ▼
              [Claude Intake Agent]
              tools: record_answer, request_clarification,
                     escalate_to_human, finalize_verdict
                         │
                         ▼
              verdict → move stage → Fleks PUT /employees/
```

**Service boundary:** `apps/api/src/modules/intake/` — alles wat specifiek is voor deze feature. Duidelijke interfaces (`FleksClient`, `WhatsAppGateway`, `IntakeAgent`) zodat module later naar Nilo-microservice geëxtraheerd kan worden.

### 3.1 Key components

| Component | Responsibility | File location |
|---|---|---|
| `FleksClient` | HTTP client voor Fleks V2, auth + pagination + retry | `modules/intake/fleks/client.ts` |
| `FleksSyncService` | polling-loop, dedup, upsert candidates/applications | `modules/intake/fleks/sync.service.ts` |
| `IntakeOrchestrator` | state machine per sessie, schedulet reminders | `modules/intake/orchestrator.ts` |
| `IntakeAgent` | Claude wrapper met tool-calling surface | `modules/intake/agent/intake-agent.ts` |
| `WhatsAppGateway` (interface) | send(), verifyWebhook(), getMedia() | `modules/intake/whatsapp/gateway.ts` |
| `TwilioSandboxGateway` | sandbox implementatie (dev/test) | `modules/intake/whatsapp/twilio-sandbox.ts` |
| `TwilioWabaGateway` | productie WABA implementatie (Phase 2) | `modules/intake/whatsapp/twilio-waba.ts` |
| `IntakeTemplateRenderer` | merge-field substitutie voor first-contact + reminders | `modules/intake/templates/renderer.ts` |

## 4. Data Model

Alle nieuwe tabellen krijgen tenant-RLS (`organization_id` + `tenantRlsPolicies`).

### 4.1 `intake_sessions`

1:1 met `candidate_applications`. Eén sessie per vacature-kandidaat-paar.

```ts
intakeSessions = pgTable("intake_sessions", {
  id: uuid().primaryKey().defaultRandom(),
  organizationId: uuid().notNull(),
  applicationId: uuid().notNull().unique().references(() => candidateApplications.id),
  state: varchar({ length: 30 }).notNull(),
    // "awaiting_first_reply" | "in_progress" | "awaiting_human" | "completed"
  verdict: varchar({ length: 20 }),
    // "qualified" | "rejected" | "unsure" | null (until completed)
  verdictReason: text(),
  mustHaveAnswers: jsonb().default({}),  // { license: "CE", vertical: "bouw", availability: "fulltime" }
  niceToHaveAnswers: jsonb().default({}),
  stuckCounter: jsonb().default({}),     // { license: 2 } — counts per-key retries
  claudeThreadId: text(),                // local identifier for grouping turn history (Anthropic SDK is stateless)
  lastInboundAt: timestamp(),
  lastOutboundAt: timestamp(),
  reminderCount: integer().default(0),
  createdAt: timestamp().defaultNow().notNull(),
  completedAt: timestamp(),
});
```

### 4.2 `intake_messages`

Alle WhatsApp-berichten in een sessie. Append-only.

```ts
intakeMessages = pgTable("intake_messages", {
  id: uuid().primaryKey().defaultRandom(),
  organizationId: uuid().notNull(),
  sessionId: uuid().notNull().references(() => intakeSessions.id, { onDelete: "cascade" }),
  direction: varchar({ length: 10 }).notNull(),  // "inbound" | "outbound"
  body: text().notNull(),
  twilioSid: text(),                     // Message SID from Twilio
  isFromBot: boolean().notNull().default(true),  // false = recruiter took over
  toolCalls: jsonb(),                    // [{ tool: "record_answer", args: {...} }] for outbound
  sentAt: timestamp().defaultNow().notNull(),
});
```

### 4.3 `fleks_sync_cursors`

Eén rij per entiteit-type per tenant. Houdt bij waar polling gebleven is.

```ts
fleksSyncCursors = pgTable("fleks_sync_cursors", {
  organizationId: uuid().notNull(),
  entityType: varchar({ length: 30 }).notNull(),  // "jobs" | "job_candidates" | "employees"
  lastUpdatedAt: timestamp(),
  lastSeenIds: jsonb().default([]),      // Ring buffer of last 500 UUIDs for dedup
  lastSyncAt: timestamp(),
  lastErrorAt: timestamp(),
  lastError: text(),
}, (t) => ({
  pk: primaryKey({ columns: [t.organizationId, t.entityType] }),
}));
```

### 4.4 `intake_templates`

Tenant-scoped message templates voor first-contact + reminders.

```ts
intakeTemplates = pgTable("intake_templates", {
  id: uuid().primaryKey().defaultRandom(),
  organizationId: uuid().notNull(),
  variant: varchar({ length: 30 }).notNull(),
    // "first_contact" | "reminder_24h" | "reminder_72h" | "no_response_farewell"
  locale: varchar({ length: 5 }).notNull().default("nl"),
  name: text().notNull(),
  body: text().notNull(),
  isActive: boolean().notNull().default(true),
  wabaStatus: varchar({ length: 20 }).default("sandbox"),
    // "sandbox" | "waba_pending" | "waba_approved" | "waba_rejected"
  wabaContentSid: text(),                // Twilio Content SID after approval
  createdAt: timestamp().defaultNow().notNull(),
  updatedAt: timestamp(),
}, (t) => ({
  uniqueVariantLocale: unique().on(t.organizationId, t.variant, t.locale),
}));
```

Default template wordt bij tenant-aanmaak geseed (migration + seed).

### 4.5 Uitbreiding bestaande tabellen

**`vacancies`:**
- `intakeEnabled` boolean default false
- `fleksJobUuid` text (external key, unique per tenant) — nullable, alleen voor vacatures die uit Fleks komen
- `qualificationCriteria` (bestaand JSONB) krijgt formele schema:

```ts
// packages/types/src/qualification-criteria.ts
export const qualificationCriteriaSchema = z.object({
  mustHave: z.object({
    licenses: z.array(z.string()).optional(),              // ["CE", "code95"]
    vertical: z.enum(["security", "traffic", "bouw", "zorg", "infra"]).optional(),
    availability: z.enum(["fulltime", "parttime", "flexible"]).optional(),
    locationRadiusKm: z.number().optional(),
    rightToWork: z.boolean().optional(),
    minAge: z.number().optional(),
    customKeys: z.array(z.object({
      key: z.string(),
      question: z.string(),
      expectedFormat: z.enum(["yes_no", "text", "number", "enum"]),
      enumValues: z.array(z.string()).optional(),
    })).optional(),
  }),
  niceToHave: z.object({
    experienceYearsMin: z.number().optional(),
    certifications: z.array(z.string()).optional(),
    preferredLanguages: z.array(z.string()).optional(),
    freeText: z.string().optional(),   // "Bij voorkeur ervaring met internationale ritten"
  }),
});
```

**`candidates`:**
- `fleksEmployeeUuid` text (unique per tenant) — nullable voor niet-Fleks kandidaten

**`pipeline_stages`:** seed 3 nieuwe default stages (per tenant bij aanmaak):
- `fleks_intake` (sortOrder 0, vóór "new")
- `qualified` (sortOrder tussen interview en offer)
- `rejected_by_bot` (terminal, sortOrder hoog)

## 5. Fleks V2 Integration

### 5.1 Auth

- Header: `X-API-Key: <key>` — geverifieerd via probing (spec heeft geen `securitySchemes` gedocumenteerd).
- Key opgeslagen in nieuwe `external_integrations` tabel (niet bestaand — creëren in Phase 1), per tenant, encrypted-at-rest via Node `crypto` + env-secret. Schema: `{ organizationId, provider: 'fleks_v2', apiKeyEncrypted, apiBaseUrl, additionalConfig: jsonb, isActive }`.
- Env-override voor dev/test: `FLEKS_API_KEY` in `.env` (reads wins over DB tijdens development).

### 5.2 Endpoints used

**Read:**
- `GET /api/v2/jobs/?isArchived=false&updatedAtMin={cursor}` — actieve vacatures + wijzigingen
- `GET /api/v2/employees/job-candidates?jobUUID={id}&isQualified=true&isInvited=false&hasActiveContract=false` — nieuwe kandidaten per job (Fleks' eigen qualified-flag = basis-check, onze intake is diepgaander)
- `GET /api/v2/job-categories/?format=ExternalJobCategoryList` — verticals-mapping
- `GET /api/v2/employees/?UUIDs=...` — employee details (naam, phone, email)

**Write:**
- `PUT /api/v2/employees/` — update `free_field_attribute` `recruitment_os_status` met `qualified|rejected|awaiting_human`
- (Phase 2) `POST /api/v2/shifts/apply` — kandidaat auto-aanmelden voor shift na qualified-verdict

### 5.3 Polling strategy

Eén pg-boss job `fleks.sync-tick`, elke 5 minuten, per tenant met `intakeEnabled` vacatures.

**Tick-logica:**
1. Haal `fleks_sync_cursors` op voor `jobs` + `job_candidates`.
2. Sync jobs: `GET /jobs/?updatedAtMin={cursor.jobs.lastUpdatedAt}` → upsert `vacancies` met `fleksJobUuid` matching. Update cursor.
3. Voor elke actieve vacature met `intakeEnabled=true`:
   - `GET /employees/job-candidates?jobUUID=...&isQualified=true` met paginatie.
   - Voor elke kandidaat: dedup via `(organizationId, fleksEmployeeUuid)`. Als nieuw: haal employee details op, create `candidate` + `application` + `intake_session`, enqueue `intake.start`.
4. Update `fleks_sync_cursors.lastUpdatedAt = now()`, append seen UUIDs naar ring-buffer.
5. Error-handling: 429 → exponential backoff (2s/5s/15s), 5xx → alert Sentry, skip tick.

### 5.4 Pushback (write)

Bij `intake_session.completed`:
- Verdict `qualified` of `rejected` → `PUT /api/v2/employees/{uuid}` met free-field `recruitment_os_status`.
- `awaiting_human` stuurt géén pushback (recruiter bepaalt).
- Failures → retry queue met 3 pogingen, dan Sentry alert + manual re-enqueue knop in UI.

## 6. Intake Conversation Engine

### 6.1 Guided agent pattern

Claude is de **conversation authority**: genereert alle outbound berichten (behalve eerste contact en reminders, die zijn templates). Must-have checklist zit in system prompt + volgorde-hint, maar Claude mag natuurlijk schakelen.

### 6.2 Tool surface (Anthropic tool-use)

```typescript
tools = [
  {
    name: "record_answer",
    description: "Sla een antwoord op voor een must-have of nice-to-have key. Alleen aanroepen wanneer kandidaat duidelijk antwoord geeft.",
    input_schema: {
      key: "string",                  // bv "license" of "availability"
      value: "string | number | boolean | array",
      confidence: "'high' | 'medium' | 'low'",
      source_message_id: "string",
    },
  },
  {
    name: "request_clarification",
    description: "Vraag opnieuw naar een must-have als antwoord onduidelijk is. Verhoogt stuck-counter.",
    input_schema: {
      key: "string",
      reason: "string",  // "antwoord was te vaag", "tegenstrijdig met eerder", etc.
    },
  },
  {
    name: "escalate_to_human",
    description: "Zet sessie op hold, wacht op recruiter.",
    input_schema: {
      reason: "'unclear_requirements' | 'explicit_request' | 'stuck_on_key' | 'off_topic'",
      context: "string",
    },
  },
  {
    name: "finalize_verdict",
    description: "Alleen aanroepen wanneer alle must-haves ingevuld zijn en Claude geen vervolgvragen meer heeft. Sluit sessie.",
    input_schema: {
      status: "'qualified' | 'rejected' | 'unsure'",
      summary: "string",  // 2-3 zin summary voor recruiter
      rejection_reason: "string | null",
    },
  },
];
```

### 6.3 Dynamic completion (no message cap)

**Verwijderd uit eerder design:** harde limiet van 10 turns.
**Vervangen door:**
- Intake is **done** wanneer `finalize_verdict` wordt aangeroepen.
- Bot checkt elke turn of alle must-haves in `mustHaveAnswers` staan EN geen flagged ambiguïteiten zijn.
- **Stuck-detector per key:** elke `request_clarification(key)` verhoogt `stuckCounter[key]`. Bij >= 3 voor dezelfde key → Claude krijgt tool-hint om `escalate_to_human("stuck_on_key")` aan te roepen.
- **Global soft-cap:** 25 turns = automatische escalatie met reden `off_topic`. Voorkomt oneindige loops bij bizarre input, maar is heel ruim.

### 6.4 Per-vacancy "critical info" AI-assist

Bij enabling van intake op een vacature:
1. Recruiter vult of laat `qualification_criteria` leeg.
2. Klikt "AI-check op ontbrekende critical info".
3. Backend roept Claude met `job.functionDescription` + `qualification_criteria` → Claude returnt gestructureerd suggestieslijst:

```json
{
  "suggested_must_haves": ["code95_valid", "adr_certificate"],
  "suggested_nice_to_haves": ["internation_experience_years"],
  "reasoning": "Functie beschrijft internationale ritten, dus code 95 en ADR zijn cruciaal."
}
```

4. Recruiter accept/reject per item → toegevoegd aan `customKeys` in criteria.

### 6.5 Model selection

- **Claude Sonnet 4.6** voor conversation (fast + goed tool-gebruik).
- **Haiku 4.5** voor first-message templating (geen conversatie, alleen merge-field polish — kostenbesparing).
- Context per turn: laatste 20 berichten (of alles als < 20), volledige vacancy + criteria, system prompt met tool instructions.

### 6.6 Prompt-structuur (schematisch)

```
[system]
Je bent een recruitment-assistent voor {tenant.name}. Je voert een intake-gesprek
via WhatsApp met een kandidaat die solliciteerde op "{vacancy.title}" bij
"{client.name}". Jouw doel: alle must-have criteria invullen en kandidaat
kwalificeren.

Criteria:
- Must-haves (ALLEMAAL invullen): {mustHave JSON}
- Nice-to-haves (alleen vragen als relevant): {niceToHave JSON}

Regels:
- Nederlands, informeel maar professioneel (tutoyeren).
- 1-2 zinnen per bericht. Nooit lange teksten.
- Eén vraag tegelijk tenzij eenvoudig gecombineerd (bv. "naam + woonplaats").
- Bij onduidelijk antwoord → request_clarification (niet verzinnen).
- Bij ongerelateerde gesprek of klacht → escalate_to_human.
- Bij "ik wil iemand spreken" / "mens" → direct escalate_to_human.

Tools: record_answer, request_clarification, escalate_to_human, finalize_verdict.

[user] Recente berichten:
{chat history}

[user] Laatste kandidaat-bericht:
{latest inbound}
```

## 7. WhatsApp Wire

### 7.1 Dev/test: Twilio Sandbox

- Sandbox nummer: `whatsapp:+14155238886` (Twilio default).
- Test-kandidaten moeten eenmalig "join {sandbox-code}" sturen vóór bot reageert — documenteren in `docs/dev/whatsapp-sandbox.md`.
- Geen template-goedkeuring nodig in sandbox. Alle templates gaan "as-is" vrije tekst.

### 7.2 Gateway interface

```typescript
interface WhatsAppGateway {
  send(input: {
    toPhone: string;            // E.164 format
    body: string;
    templateSid?: string;       // Alleen voor WABA-mode
    templateVariables?: Record<string, string>;
  }): Promise<{ messageSid: string; status: "queued" | "sent" }>;

  verifyWebhook(headers: Headers, rawBody: string): boolean;
  parseWebhook(rawBody: string): {
    fromPhone: string;
    messageSid: string;
    body: string;
    mediaUrls?: string[];
  };

  isWithin24hWindow(phone: string, orgId: string): Promise<boolean>;
}
```

Twee implementaties (`TwilioSandboxGateway`, `TwilioWabaGateway`) achter env-var `WHATSAPP_PROVIDER=sandbox|waba`.

### 7.3 Inbound flow

1. Twilio POST → `/api/webhooks/whatsapp/twilio`.
2. HMAC-SHA1 signature verify.
3. Parse → resolve `(tenantId, phone) → intake_session` via phone-number lookup.
4. Persist `intake_message` (inbound).
5. Enqueue `intake.process_message` job met `sessionId`.
6. Respond 200 OK naar Twilio binnen 15s.

### 7.4 Outbound flow (conversation)

1. Orchestrator roept `IntakeAgent.processInbound(sessionId, inboundMessage)`.
2. Agent bouwt Claude-call met context, roept Anthropic API.
3. Claude returnt text + 0+ tool-calls.
4. Tool-calls uitvoeren (record_answer → update `mustHaveAnswers`; finalize_verdict → move stage; etc.).
5. Outbound body via `WhatsAppGateway.send()`.
6. Persist `intake_message` (outbound) met `toolCalls` voor audit.

### 7.5 First-contact + reminder flow (templates, niet Claude)

1. `intake.start` job → render first-contact template via `IntakeTemplateRenderer` met merge-fields → `WhatsAppGateway.send()`.
2. Schedule 24h-reminder job.
3. Bij reminder-fire: check of lastInboundAt > creation (= kandidaat heeft al geantwoord) → cancel. Anders: verstuur 24h-template.
4. Schedule 72h-reminder idem.
5. Bij 72h zonder respons: verstuur farewell-template → finalize_verdict("rejected", "no response") → push Fleks.

### 7.6 24h-window (productie WABA, Phase 2)

- Voor sandbox: niet relevant, alles is free-form.
- Voor productie: `isWithin24hWindow(phone)` check vóór elke outbound. Binnen window → free-form ok. Buiten → moet pre-approved template zijn.
- Eerste contact valt per definitie buiten window → altijd template.

## 8. Intake Templates

### 8.1 Variants

| Variant | Trigger | Default body |
|---|---|---|
| `first_contact` | `intake.start` job | "Hoi {{candidate.first_name}}! Je hebt gesolliciteerd bij {{client.name}} voor de functie {{vacancy.title}}. Ik ben de intake-assistent van {{tenant.name}}. Mag ik je een paar vragen stellen zodat we kunnen kijken of er een match is?" |
| `reminder_24h` | 24h scheduler | "Hoi {{candidate.first_name}}, ik zag dat je nog niet gereageerd hebt. Wil je nog antwoorden op de vacature {{vacancy.title}}?" |
| `reminder_72h` | 72h scheduler | "{{candidate.first_name}}, laatste kans om te reageren op de vacature {{vacancy.title}}. Reageer je niet, dan sluiten we het sollicitatie-dossier." |
| `no_response_farewell` | 72h expired | "Jammer dat we niks meer van je horen. De sollicitatie is gesloten. Je kunt altijd later opnieuw reageren via {{client.name}}." |

### 8.2 Merge-fields

- `{{candidate.first_name}}`, `{{candidate.full_name}}`
- `{{vacancy.title}}`, `{{vacancy.location}}`, `{{vacancy.start_date}}`
- `{{client.name}}`
- `{{tenant.name}}`
- `{{recruiter.name}}`, `{{recruiter.phone}}` (primaire recruiter van vacature; voor handoff)

### 8.3 Template management UI

- **Settings → Intake Templates**: per variant tekst-editor met merge-field picker.
- Preview met voorbeeld-data.
- Status-badge: `sandbox` (alles mag) / `waba_pending` (ingediend bij Meta) / `waba_approved` / `waba_rejected`.
- Save creeërt nieuwe versie (audit-trail), rollback mogelijk.

### 8.4 WABA migration pad (Phase 2)

- Templates markeren voor WABA-submission.
- Wanneer WABA provisioned + templates approved: wabaContentSid invullen per template.
- `TwilioWabaGateway.send()` gebruikt templateSid + variable mapping (numeriek keys "1", "2", ... volgens Twilio conventie).

## 9. No-Response Handling

- Initiële reminder na 24u, tweede na 72u.
- Elke inbound bericht cancelt next reminder via pg-boss `cancel(jobId)`.
- Na 72u-reminder expireert zonder respons: orchestrator roept `finalizeVerdict("rejected", "no response")` + verstuurt farewell → pushback naar Fleks.
- Tijden zijn configurable via env-var voor testing (defaults 86400s / 259200s).

## 10. Human Escalation

- Trigger: Claude tool-call `escalate_to_human`. Redenen:
  - `unclear_requirements` — criteria kan niet bepaald worden uit conversation
  - `explicit_request` — kandidaat vraagt mens ("ik wil iemand spreken")
  - `stuck_on_key` — 3 failed clarifications op dezelfde must-have
  - `off_topic` — conversatie gaat ver buiten scope (klacht, spam, etc.)
- Sessie state → `awaiting_human`. Bot stopt auto-replies.
- Recruiter ziet in Intake Inbox rode badge. Opent detail, leest transcript + verdict-summary.
- Recruiter kan: **"Neem gesprek over"** (bot pauzeert, recruiter typt direct via Intake-UI → wordt als outbound WhatsApp verzonden met `isFromBot=false`), of **"Markeer verdict en sluit"** (handmatige verdict zonder verdere conversatie).

## 11. UI Additions (Recruitment OS frontend)

### 11.1 Intake Inbox — `/intake`

Nieuwe sidebar-item "Intake". Full-page lijst met:
- Tabs: Active / Awaiting Human (badge met count) / Completed
- Kolommen: Kandidaat | Vacature | State | Last activity | Verdict | Actions
- Filter op vacature / state / verdict.
- Klik op rij → Intake Session detail.

### 11.2 Intake Session detail — `/intake/:sessionId`

Layout:
- **Header:** kandidaat-naam + vacature + status-badge + "Neem gesprek over"-knop
- **Linker 70%:** WhatsApp-style transcript (bot left, kandidaat right, timestamps)
- **Rechter 30% sidebar:**
  - Must-have checklist (groen = ingevuld, grijs = nog open, geel = unclear/clarification pending)
  - Verdict kaart (als completed)
  - Actions: "Markeer verdict manueel", "Re-sync naar Fleks", "Archiveer"

Component-hergebruik: transcript component leunt op comment-thread pattern uit Vacancy Room.

### 11.3 Vacancy setup — new "Intake" tab

Op vacature-detail page nieuwe tab naast Candidates/Notes/Details/Pipeline:
- Toggle `intake_enabled`
- `fleksJobUuid` read-only (auto-gepopulated bij Fleks-sync)
- Qualification criteria editor:
  - Must-haves: form-builder voor licenses / vertical dropdown / availability / custom keys
  - Nice-to-haves: idem + vrije tekst veld
  - "AI-check ontbrekende critical info" knop → Claude-assist
- Preview: "Zo ziet Claude jouw criteria"

### 11.4 Vacancy Room integratie

- Pipeline in Vacancy Room toont "Fleks Intake" kolom vooraan.
- Kolom-header heeft badge "N lopend" met `awaiting_human` highlight als > 0.
- Klik op badge → deep-link naar Intake Inbox gefilterd op die vacature.
- Intake-events verschijnen in de Room timeline als activity-events: `intake_started`, `intake_qualified`, `intake_rejected`, `intake_escalated`.

## 12. Error Handling + Observability

### 12.1 Sentry-captures

- Alle Fleks 5xx responses
- Alle Claude API failures (rate-limit, content-filter, malformed tool-call)
- Twilio send-failures (invalid number, rate-limit)
- Orchestrator state-machine transitions die onmogelijk zouden moeten zijn

### 12.2 Metrics dashboard (Phase 1 = simpele counters in admin-UI)

- Kandidaten binnengekomen vandaag / week
- Time-to-first-reply p50/p95
- Verdict-distributie (qualified/rejected/unsure %)
- Escalation-ratio per reden
- No-response-ratio

### 12.3 Manual recovery

- Sessies in `error` state krijgen "Retry"-knop in Intake Inbox.
- Fleks-pushback failures idem: recruiter kan re-pushen.

## 13. Testing Strategy

### 13.1 Unit (Vitest)

- `FleksSyncService` dedup-logica met mocked Fleks API
- `IntakeAgent` tool-calling met mocked Claude SDK
- Reminder scheduling met mocked pg-boss
- Template-renderer merge-field substitutie

### 13.2 Integration

- `TwilioSandboxGateway` tegen echte Twilio sandbox (feature-flagged tests)
- Claude-agent end-to-end met 5 mocked conversation scripts (happy / stuck / explicit_handoff / no_response / off_topic)

### 13.3 E2E (Playwright)

- Seed: 1 vacature met criteria, 1 Fleks-mock dat 1 kandidaat returnt
- Trigger sync-tick manual → check application aangemaakt
- Simuleer WhatsApp inbound via webhook-POST → check Claude called + outbound persisted
- Tot verdict → check stage moved + Fleks-pushback PUT call assertion

## 14. Dependencies

- `@anthropic-ai/sdk` — Claude tool-calling
- `twilio` npm package (of direct HTTP — evalueren)
- Bestaande: `drizzle-orm`, `pg-boss`, `hono`, `zod`

## 15. Migrations Needed

1. Create `external_integrations` (generic, reuse across providers)
2. Create `intake_sessions`, `intake_messages`, `fleks_sync_cursors`, `intake_templates`
3. Alter `vacancies` add `intakeEnabled`, `fleksJobUuid`
4. Alter `candidates` add `fleksEmployeeUuid`
5. Seed 3 new default `pipeline_stages` per tenant (migration + backfill for existing tenants)
6. Seed 4 default `intake_templates` per tenant (NL locale)

## 16. Phase 2 Roadmap (na MVP go-live)

Niet in scope voor eerste versie, wel scope voor planning vanaf week 5:

- **Auto-scheduling** — bij `qualified` verdict → Claude vraagt beschikbaarheid → boekt timeslot via Cal.com/Google Calendar → bevestigt via WhatsApp.
- **Follow-up aggression** — extra reminders (24u/48u/72u/7d) met verschillende templates.
- **Multi-language** — detecteer taal kandidaat, switch prompts + templates (EN/PL/RO).
- **Team-routing per vertical** — security-escalatie naar recruiter X, zorg naar recruiter Y.
- **CV-request via WhatsApp media** — "Kun je je CV sturen?" → upload → parser extract → auto-update `niceToHaveAnswers`.
- **Productie WABA** — provision echt nummer, template approval, migration van sandbox.
- **Nilo-microservice extractie** — intake-module in apart service zodat Nilo recruitment-customers 'm kunnen consumeren.
- **Proactive engagement** — bot neemt zelf initiatief bij nieuwe vacatures die matchen met bestaande pool-kandidaten in Fleks (cross-sell tussen jobs).

## 17. Open Questions

Geen — alle design-keuzes zijn vastgelegd in eerdere brainstorm-gesprek.

## 18. Implementation Plan

Volgende stap: `superpowers:writing-plans` skill → creeërt `docs/superpowers/plans/2026-04-20-fleks-whatsapp-intake.md` met uitgewerkte taken.

Kritisch pad voor 4-week oplevering:
- **Week 1:** Data model migrations + Fleks client + sync-worker + first template seed
- **Week 2:** WhatsApp gateway (sandbox) + inbound webhook + intake orchestrator skeleton
- **Week 3:** Claude intake agent + tool-calling + state machine completion
- **Week 4:** UI (Intake Inbox + Session detail + Vacancy Intake tab) + E2E + Sentry + polish

Parallellisatie mogelijk op backend (week 2) en UI (week 3 kan eerder starten met mocks).
