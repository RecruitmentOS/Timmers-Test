# Hey Nilo — Technical Specification

**Date:** 2026-04-23  
**Status:** Draft — ready for plan authoring  
**Stack:** Hono + Drizzle ORM + PostgreSQL (RLS) + pg-boss + Better Auth + Next.js + Twilio  
**Scope:** MVP for Timmers + extraction path to standalone multi-tenant product

> **Stack correction vs. prompt assumptions:** The prompt assumed Supabase + Next.js API routes + Vercel.
> Recruitment OS uses Hono (apps/api) + Drizzle ORM + raw PostgreSQL with Drizzle RLS + pg-boss + Better Auth.
> Every section below uses the actual stack. Supabase is not used anywhere.

---

## 1. MVP TECHNICAL SCOPE

### In Scope

- **Trigger API** — `POST /api/nilo/sessions` — accept a contact event from Zapier/Meta/external system and start a Hey Nilo session
- **WhatsApp inbound handler** — extend existing `/api/whatsapp/twilio` webhook to route to nilo sessions (alongside existing intake sessions)
- **Agent engine** — Claude-powered conversation via the existing `processInbound()` function, with flow-specific criteria injected
- **Session state machine** — CREATED → INITIATED → IN_PROGRESS → [COMPLETED | AWAITING_HUMAN | ABANDONED]
- **Reminder chain** — pg-boss: reminder_24h → reminder_72h → no_response_farewell
- **Outbound webhook** — POST to configured URL when session reaches terminal state (qualified/rejected/abandoned)
- **Slack notification** — POST to Slack webhook when verdict = qualified (hardcoded for MVP)
- **Session monitor UI** — read-only table in Next.js: phone, state, disposition, answers, created_at (no auth for MVP — protected by org slug subdomain)
- **NiloPersistence interface** — clean interface separating core engine from Drizzle storage
- **Timmers flow** — hardcoded flow config (criteria + templates + webhook URL) for MVP

### Out of Scope (MVP)

- Flow builder UI (Timmers flow is hardcoded in config)
- WABA / production WhatsApp number (Twilio sandbox only — requires opt-in join keyword)
- Multi-language templates (NL only for MVP)
- Analytics dashboard / aggregated metrics
- Billing / usage metering for Hey Nilo
- Personeel.com onboarding (comes after MVP proves the architecture)
- Calendar / scheduling integration
- API key management UI
- Match scoring for standalone mode (scoring logic stays Recruitment OS-only in MVP)

### What May Be Faked or Hardcoded

| Item | MVP approach | Future |
|------|-------------|--------|
| Timmers flow config | Hardcoded TypeScript object | DB-stored per-org flow definition |
| Slack notification | Direct `fetch()` to env var SLACK_WEBHOOK_URL | Configurable outbound webhook per org |
| Twilio credentials | Single global env var | Per-org credential vault |
| Template storage | Hardcoded strings in flow config | `nilo_templates` table with variant/locale |
| WABA 24h window check | Always returns `true` (sandbox has no window) | Real window check for WABA |

### Multi-tenant from Day 1

Every `nilo_*` table must have `organization_id uuid NOT NULL` with Drizzle RLS policies (`tenantRlsPolicies()`). The trigger API must resolve `org_id` from the API key (or subdomain). No data crosses tenant boundaries. This is non-negotiable even for MVP.

---

## 2. SYSTEM ARCHITECTURE

```
External Systems (Meta Ads, Zapier, Personeel.com, future CRMs)
         │
         ▼
┌──────────────────────────────────────────────────────────────┐
│  apps/api  (Hono)                                            │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  Route Layer                                         │    │
│  │  POST /api/nilo/sessions  (trigger)                  │    │
│  │  POST /api/nilo/webhook/twilio  (inbound WhatsApp)   │    │
│  │  GET  /api/nilo/sessions  (session list, internal)   │    │
│  └──────────────────┬──────────────────────────────────┘    │
│                     │                                        │
│  ┌──────────────────▼──────────────────────────────────┐    │
│  │  modules/nilo/  (Hey Nilo orchestration layer)       │    │
│  │                                                      │    │
│  │  orchestrator.ts  — session lifecycle                │    │
│  │  agent/           — Claude conversation engine       │    │
│  │  flow-registry.ts — resolve flow config by orgId     │    │
│  │  handoff.ts       — recruiter handoff state          │    │
│  │  outbound.ts      — webhook + notification dispatch  │    │
│  └──────────────────┬──────────────────────────────────┘    │
│                     │                                        │
│  ┌──────────────────▼──────────────────────────────────┐    │
│  │  packages/nilo-core/  (provider-agnostic engine)     │    │
│  │                                                      │    │
│  │  orchestrator.ts  (startSession, sendReminder, etc.) │    │
│  │  agent/           (processInbound, tools, prompts)   │    │
│  │  templates/       (renderTemplate)                   │    │
│  │  types.ts         (NiloPersistence, NiloFlow, etc.)  │    │
│  └──────────────────┬──────────────────────────────────┘    │
│                     │                                        │
│  ┌──────────────────▼──────────────────────────────────┐    │
│  │  modules/nilo/persistence/                           │    │
│  │  drizzle-persistence.ts  — implements NiloPersistence│    │
│  │  (reads/writes nilo_sessions, nilo_messages tables)  │    │
│  └──────────────────┬──────────────────────────────────┘    │
│                     │                                        │
│  ┌──────────────────▼──────────────────────────────────┐    │
│  │  Adapters                                            │    │
│  │  whatsapp/twilio-sandbox.ts  — WhatsAppGateway impl  │    │
│  │  whatsapp/twilio-waba.ts     — (future)              │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  lib/job-queue.ts  (pg-boss)                         │    │
│  │  Jobs: nilo.start_session, nilo.send_reminder,       │    │
│  │        nilo.send_farewell, nilo.fire_webhook          │    │
│  └─────────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────────┘
         │
         ▼
    PostgreSQL (RLS on all nilo_* tables)
         │
         ▼
┌─────────────────┐   ┌──────────────────┐
│  Twilio API     │   │  Slack/Webhook   │
│  (WhatsApp out) │   │  (notifications) │
└─────────────────┘   └──────────────────┘

┌──────────────────────────────────────────┐
│  apps/web  (Next.js)                     │
│  /[slug]/nilo/sessions  — monitor table  │
└──────────────────────────────────────────┘
```

### Module Responsibilities

| Module | Responsibility |
|--------|---------------|
| `Route Layer` | HTTP in/out, request validation (Zod), auth guard, pg-boss job dispatch |
| `modules/nilo/orchestrator` | Session lifecycle coordination — calls nilo-core with injected deps |
| `modules/nilo/flow-registry` | Resolves `NiloFlow` config by orgId — hardcoded map in MVP, DB-backed later |
| `modules/nilo/persistence` | Implements `NiloPersistence` interface via Drizzle + nilo_* tables |
| `modules/nilo/handoff` | Manages AWAITING_HUMAN state, notifies recruiter, tracks ownership |
| `modules/nilo/outbound` | Fires outbound webhooks and Slack notifications on terminal state |
| `packages/nilo-core` | Pure engine: no Drizzle, no pg-boss imports. Only interfaces and logic |
| `lib/job-queue` | pg-boss singleton — existing, shared with rest of API |

### Sync vs Async

| Operation | Sync / Async |
|-----------|-------------|
| Trigger API → create session record | Sync (fast DB write) |
| First WhatsApp send (startSession) | Async via pg-boss `nilo.start_session` job |
| Inbound message → Claude agent | Async via pg-boss `nilo.process_inbound` job |
| Reminder scheduling | Async via pg-boss `nilo.send_reminder` job |
| Outbound webhook on completion | Async via pg-boss `nilo.fire_webhook` job |
| Session monitor data fetch | Sync (read query) |

All heavy work goes through pg-boss. The Twilio webhook handler must return 200 within 15 seconds — it only enqueues a job, never runs the agent inline.

---

## 3. REPOSITORY / CODEBASE STRUCTURE

```
recruitment-os/
├── apps/
│   ├── api/
│   │   └── src/
│   │       ├── db/
│   │       │   └── schema/
│   │       │       ├── nilo-sessions.ts          ← NEW
│   │       │       ├── nilo-messages.ts           ← NEW
│   │       │       ├── nilo-flow-configs.ts       ← NEW (phase 2+)
│   │       │       ├── nilo-api-keys.ts           ← NEW
│   │       │       └── nilo-webhook-logs.ts       ← NEW
│   │       ├── modules/
│   │       │   ├── intake/                        ← EXISTING (keep, refactor tool-store)
│   │       │   └── nilo/                          ← NEW
│   │       │       ├── orchestrator.ts            ← wires nilo-core + drizzle-persistence
│   │       │       ├── flow-registry.ts           ← hardcoded map in MVP
│   │       │       ├── persistence/
│   │       │       │   └── drizzle-persistence.ts ← implements NiloPersistence
│   │       │       ├── handoff.ts                 ← AWAITING_HUMAN logic
│   │       │       ├── outbound.ts                ← webhook + slack dispatch
│   │       │       └── jobs/
│   │       │           ├── start-session.job.ts
│   │       │           ├── process-inbound.job.ts
│   │       │           ├── send-reminder.job.ts
│   │       │           └── fire-webhook.job.ts
│   │       └── routes/
│   │           ├── nilo-trigger.routes.ts         ← NEW: POST /api/nilo/sessions
│   │           ├── nilo-sessions.routes.ts        ← NEW: GET /api/nilo/sessions (internal)
│   │           └── whatsapp-webhook.routes.ts     ← EXISTING: extend to handle nilo sessions
│   └── web/
│       └── src/
│           └── app/
│               └── (app)/
│                   └── nilo/
│                       └── sessions/
│                           └── page.tsx           ← NEW: session monitor UI
└── packages/
    ├── nilo-core/                                 ← NEW: extracted engine
    │   ├── package.json
    │   └── src/
    │       ├── index.ts
    │       ├── types.ts                           ← NiloPersistence, NiloFlow, NiloSession
    │       ├── orchestrator.ts                    ← startSession, sendReminder, sendFarewell
    │       ├── agent/
    │       │   ├── agent.ts                       ← processInbound (extracted from intake-agent.ts)
    │       │   ├── tools.ts                       ← INTAKE_TOOLS (same 4 tools, generalized)
    │       │   └── prompts.ts                     ← buildSystemPrompt (flow-config-driven)
    │       ├── renderer.ts                        ← renderTemplate (already portable)
    │       └── gateway.ts                         ← WhatsAppGateway interface
    ├── types/                                     ← EXISTING: @recruitment-os/types
    └── db/                                        ← EXISTING: shared schema package (if any)
```

---

## 4. DOMAIN MODEL

### Tenant (`organizations` — existing)
Already exists in Better Auth schema. Every nilo entity references `organization_id`. No new tenant table needed.

### NiloApiKey (`nilo_api_keys`) — NEW
**Purpose:** Authenticate external systems calling the trigger API (Zapier, Meta webhooks).  
**Key fields:** `id`, `organization_id`, `key_hash` (bcrypt), `label`, `created_at`, `revoked_at`  
**Relationships:** belongs to `organizations`  
**Layer:** Integration layer

### NiloFlowConfig (`nilo_flow_configs`) — NEW, Phase 2+
**Purpose:** Stores flow definitions per org (criteria, templates, webhook URL, LLM config). In MVP this is a hardcoded TypeScript object.  
**Key fields:** `id`, `organization_id`, `name`, `locale`, `criteria` (JSONB), `templates` (JSONB map of variant→body), `outbound_webhook_url`, `slack_webhook_url`, `system_prompt_extra`, `is_active`  
**Relationships:** has many `nilo_sessions`  
**Layer:** Core platform (configures the engine)

### NiloSession (`nilo_sessions`) — NEW
**Purpose:** Top-level conversation unit. One session = one contact, one flow run.  
**Key fields:** `id`, `organization_id`, `flow_id` (null in MVP), `contact_phone`, `contact_name`, `context` (JSONB — vacancy title, source, etc.), `state` (enum), `verdict`, `verdict_reason`, `answers` (JSONB), `stuck_counter` (JSONB), `reminder_count`, `match_score`, `outbound_webhook_url`, `created_at`, `initiated_at`, `completed_at`, `last_inbound_at`, `last_outbound_at`  
**Relationships:** has many `nilo_messages`; optionally references `application_id` (Recruitment OS embedded mode)  
**Layer:** Core platform

### NiloMessage (`nilo_messages`) — NEW
**Purpose:** Append-only message log. Immutable after insert.  
**Key fields:** `id`, `organization_id`, `session_id`, `direction` (inbound/outbound), `body`, `twilio_sid`, `is_from_bot`, `tool_calls` (JSONB), `sent_at`  
**Relationships:** belongs to `nilo_sessions`  
**Layer:** Core platform. Append-only — never UPDATE or DELETE.

### NiloWebhookLog (`nilo_webhook_logs`) — NEW
**Purpose:** Log every outbound webhook attempt for debugging and retry.  
**Key fields:** `id`, `organization_id`, `session_id`, `target_url`, `payload` (JSONB), `response_status`, `attempt`, `delivered_at`, `error`  
**Layer:** Integration layer. Append-only.

### NiloHandoff (`nilo_handoffs`) — NEW
**Purpose:** Track recruiter handoff state when a session enters AWAITING_HUMAN.  
**Key fields:** `id`, `organization_id`, `session_id`, `reason` (enum), `context`, `requested_at`, `assigned_to_user_id`, `accepted_at`, `resolved_at`, `resolution` (took_over / dismissed / resumed_bot)  
**Relationships:** belongs to `nilo_sessions`, optionally belongs to Better Auth `member`  
**Layer:** Core platform

### TriggerEvent (`nilo_trigger_events`) — NEW
**Purpose:** Log every inbound trigger call for idempotency and debugging.  
**Key fields:** `id`, `organization_id`, `external_ref` (caller's ID — for idempotency), `payload` (JSONB), `session_id` (set after session created), `received_at`  
**Layer:** Integration layer. Append-only.

---

## 5. DATABASE SCHEMA DRAFT

### `nilo_sessions`

```sql
CREATE TABLE nilo_sessions (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  UUID NOT NULL,                    -- RLS anchor
  flow_id          UUID,                             -- NULL in MVP (hardcoded flow)
  application_id   UUID REFERENCES candidate_applications(id) ON DELETE SET NULL,
  contact_phone    VARCHAR(30) NOT NULL,
  contact_name     TEXT,
  context          JSONB NOT NULL DEFAULT '{}',      -- vacancy_title, source, external_ref, etc.
  state            VARCHAR(30) NOT NULL DEFAULT 'created',
  verdict          VARCHAR(20),                      -- qualified | rejected | unsure | NULL
  verdict_reason   TEXT,
  answers          JSONB NOT NULL DEFAULT '{}',      -- { key: { value, confidence } }
  stuck_counter    JSONB NOT NULL DEFAULT '{}',      -- { key: count }
  reminder_count   INT NOT NULL DEFAULT 0,
  match_score      INT,                              -- 0–100, NULL until completed
  outbound_webhook_url TEXT,                         -- where to POST on terminal state
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  initiated_at     TIMESTAMPTZ,
  completed_at     TIMESTAMPTZ,
  last_inbound_at  TIMESTAMPTZ,
  last_outbound_at TIMESTAMPTZ
);

CREATE INDEX idx_nilo_sessions_org_state ON nilo_sessions(organization_id, state);
CREATE INDEX idx_nilo_sessions_phone ON nilo_sessions(contact_phone) WHERE state IN ('initiated', 'in_progress', 'awaiting_human');

ALTER TABLE nilo_sessions ENABLE ROW LEVEL SECURITY;
-- Apply tenantRlsPolicies('nilo_sessions') via Drizzle RLS helpers
```

> **JSONB vs normalized:** `context`, `answers`, `stuck_counter` are JSONB — they vary per flow and tenant. `state`, `verdict` are normalized columns — they drive state machine logic and are indexed.

### `nilo_messages`

```sql
CREATE TABLE nilo_messages (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  UUID NOT NULL,                    -- RLS anchor (denormalized for RLS)
  session_id       UUID NOT NULL REFERENCES nilo_sessions(id) ON DELETE CASCADE,
  direction        VARCHAR(10) NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  body             TEXT NOT NULL,
  twilio_sid       TEXT,
  is_from_bot      BOOLEAN NOT NULL DEFAULT TRUE,
  tool_calls       JSONB,                            -- raw Claude tool call log
  sent_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_nilo_messages_session ON nilo_messages(session_id, sent_at);

ALTER TABLE nilo_messages ENABLE ROW LEVEL SECURITY;
-- Append-only: no UPDATE/DELETE policies — INSERT + SELECT only
```

### `nilo_api_keys`

```sql
CREATE TABLE nilo_api_keys (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  UUID NOT NULL,
  key_hash         TEXT NOT NULL,                    -- bcrypt of the raw key
  label            TEXT NOT NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_at       TIMESTAMPTZ
);

ALTER TABLE nilo_api_keys ENABLE ROW LEVEL SECURITY;
```

### `nilo_webhook_logs`

```sql
CREATE TABLE nilo_webhook_logs (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  UUID NOT NULL,
  session_id       UUID NOT NULL REFERENCES nilo_sessions(id) ON DELETE CASCADE,
  target_url       TEXT NOT NULL,
  payload          JSONB NOT NULL,
  response_status  INT,
  attempt          INT NOT NULL DEFAULT 1,
  error            TEXT,
  delivered_at     TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE nilo_webhook_logs ENABLE ROW LEVEL SECURITY;
-- Append-only
```

### `nilo_trigger_events`

```sql
CREATE TABLE nilo_trigger_events (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  UUID NOT NULL,
  external_ref     TEXT,                             -- caller's dedup ID
  payload          JSONB NOT NULL,
  session_id       UUID REFERENCES nilo_sessions(id),
  received_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_nilo_trigger_events_dedup ON nilo_trigger_events(organization_id, external_ref)
  WHERE external_ref IS NOT NULL;

ALTER TABLE nilo_trigger_events ENABLE ROW LEVEL SECURITY;
```

### `nilo_handoffs`

```sql
CREATE TABLE nilo_handoffs (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  UUID NOT NULL,
  session_id       UUID NOT NULL REFERENCES nilo_sessions(id) ON DELETE CASCADE,
  reason           VARCHAR(40) NOT NULL,
  context          TEXT,
  requested_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  assigned_to      UUID,                             -- Better Auth member id
  accepted_at      TIMESTAMPTZ,
  resolved_at      TIMESTAMPTZ,
  resolution       VARCHAR(30)                       -- took_over | dismissed | resumed_bot
);

ALTER TABLE nilo_handoffs ENABLE ROW LEVEL SECURITY;
```

### Relationship to existing `intake_sessions`

The existing `intake_sessions` table stays untouched for Recruitment OS embedded mode. `nilo_sessions` is a parallel table for standalone/headless mode. When Recruitment OS creates a nilo session for an application, it sets `application_id` on `nilo_sessions` to link them. The `intake_sessions` table will eventually be deprecated in favor of `nilo_sessions`, but not in MVP.

---

## 6. EVENT MODEL

All events are implemented as pg-boss job names. Payload is passed as the job's `data` object.

### `nilo.session_triggered`
**Producer:** Trigger API route  
**Payload:** `{ orgId, sessionId, flowId?, contactPhone, contactName, context }`  
**Consumer:** `start-session.job.ts` — sends first WhatsApp message  
**Sync/Async:** Async  
**Idempotency:** `sessionId` is unique — pg-boss deduplicates by job key if configured

### `nilo.process_inbound`
**Producer:** WhatsApp webhook route (after persisting inbound message)  
**Payload:** `{ orgId, sessionId }`  
**Consumer:** `process-inbound.job.ts` — runs Claude agent  
**Sync/Async:** Async  
**Idempotency:** At-least-once. Claude API calls are not idempotent — job must check session state before processing. If `last_inbound_at` hasn't changed since job was queued, skip (stale job).

### `nilo.send_reminder`
**Producer:** Orchestrator (scheduled after startSession, sendReminder)  
**Payload:** `{ orgId, sessionId, variant: 'reminder_24h' | 'reminder_72h' | 'no_response_farewell' }`  
**Consumer:** `send-reminder.job.ts`  
**Sync/Async:** Async, scheduled with pg-boss `startAfter`  
**Idempotency:** Check session state before sending — if COMPLETED or AWAITING_HUMAN, skip silently

### `nilo.fire_webhook`
**Producer:** Orchestrator (after finalize_verdict or farewell)  
**Payload:** `{ orgId, sessionId, targetUrl, payload }`  
**Consumer:** `fire-webhook.job.ts` — POST to external webhook with retry  
**Sync/Async:** Async  
**Retry:** 3 attempts, exponential backoff. Log each attempt to `nilo_webhook_logs`.  
**Idempotency:** Caller must deduplicate by `session_id` in their system

### `nilo.handoff_requested`
**Producer:** Tool executor (when `escalate_to_human` tool is called)  
**Payload:** `{ orgId, sessionId, reason, context }`  
**Consumer:** `handoff.ts` — creates `nilo_handoffs` record, sends Slack/email to recruiter  
**Sync/Async:** Async  

### `nilo.session_completed`
**Producer:** Tool executor (after `finalize_verdict` tool is called)  
**Payload:** `{ orgId, sessionId, verdict, matchScore }`  
**Consumer:** Recruitment OS adapter (if `application_id` set, update stage + fire alert); outbound webhook dispatch  
**Sync/Async:** Async

---

## 7. FLOW ENGINE SPEC

### What a Flow Definition Looks Like

```typescript
// packages/nilo-core/src/types.ts

export interface NiloFlow {
  id: string
  orgId: string
  name: string
  locale: 'nl' | 'en'
  criteria: NiloCriteria        // must-haves + nice-to-haves
  templates: NiloTemplates      // keyed by variant name
  systemPromptExtra?: string    // appended to base system prompt
  reminderChain: ReminderStep[]
  webhookUrl?: string           // outbound callback on completion
  slackWebhookUrl?: string      // Slack notification for qualified leads
  scoreThreshold?: number       // min match_score to fire Slack alert (default 75)
}

export interface NiloCriteria {
  mustHave: {
    [key: string]: unknown      // licenses, availability, etc.
    customKeys?: Array<{ key: string; question: string; required: boolean }>
  }
  niceToHave?: {
    [key: string]: unknown
  }
}

export interface NiloTemplates {
  first_contact: string         // {{candidate.first_name}}, {{vacancy.title}}, etc.
  reminder_24h: string
  reminder_72h: string
  no_response_farewell: string
  [variant: string]: string
}

export interface ReminderStep {
  afterSeconds: number
  variant: string               // must match a key in NiloTemplates
}
```

### MVP Timmers Flow (hardcoded)

```typescript
// apps/api/src/modules/nilo/flow-registry.ts

const TIMMERS_FLOW: NiloFlow = {
  id: 'timmers-default',
  orgId: process.env.TIMMERS_ORG_ID!,
  name: 'Timmers Chauffeur Intake',
  locale: 'nl',
  criteria: {
    mustHave: {
      licenses: ['CE'],
      availability: true,
      customKeys: [
        { key: 'code95', question: 'Heb je een geldig Code 95 certificaat?', required: true },
        { key: 'regio', question: 'Woon je in de buurt van [regio]?', required: true },
      ],
    },
    niceToHave: {
      experienceYearsMin: 2,
    },
  },
  templates: {
    first_contact: 'Hoi {{candidate.first_name}}! 👋 Ik ben Nilo, de digitale assistent van {{tenant.name}}. Je hebt gesolliciteerd op {{vacancy.title}}. Ik heb een paar korte vragen zodat we kunnen kijken of er een match is. Heb je een rijbewijs CE?',
    reminder_24h: 'Hoi {{candidate.first_name}}, we wachten nog op je antwoorden voor {{vacancy.title}}. Heb je even 2 minuutjes?',
    reminder_72h: 'Laatste herinnering: reageer je nog op onze intake voor {{vacancy.title}}?',
    no_response_farewell: 'Helaas hebben we niets van je gehoord. We sluiten je sollicitatie voor {{vacancy.title}} af. Succes!',
  },
  reminderChain: [
    { afterSeconds: 86400, variant: 'reminder_24h' },
    { afterSeconds: 172800, variant: 'reminder_72h' },
    { afterSeconds: 86400, variant: 'no_response_farewell' },
  ],
  webhookUrl: process.env.TIMMERS_WEBHOOK_URL,
  slackWebhookUrl: process.env.TIMMERS_SLACK_WEBHOOK_URL,
  scoreThreshold: 75,
}

export function resolveFlow(orgId: string): NiloFlow | null {
  if (orgId === process.env.TIMMERS_ORG_ID) return TIMMERS_FLOW
  return null
}
```

### Step Types in MVP

| Step type | How it works |
|-----------|-------------|
| `send_template` | Render + send first_contact template. One-time, at session start. |
| `await_reply` | Session waits in INITIATED/IN_PROGRESS state. No active step running. |
| `agent_turn` | Claude processes inbound message. May call tools. May send response. |
| `send_reminder` | Template send with no agent involvement. Scheduled via pg-boss. |
| `close_session` | Set state to COMPLETED or ABANDONED. Fire webhook. |
| `await_human` | Session paused. Recruiter takes over. May resume later. |

There is no generic step DSL in MVP. These step types are implemented directly in the orchestrator and job handlers, not in a configurable step runner.

### State Transitions

```
CREATED
  → (job: nilo.session_triggered) → INITIATED

INITIATED
  → (inbound message received) → IN_PROGRESS
  → (reminder_24h timeout, no reply) → send reminder, stay INITIATED
  → (no_response_farewell) → ABANDONED

IN_PROGRESS
  → (agent calls finalize_verdict) → COMPLETED
  → (agent calls escalate_to_human) → AWAITING_HUMAN
  → (session re-enters) → stay IN_PROGRESS (multiple exchanges)

AWAITING_HUMAN
  → (recruiter resolves handoff as 'took_over') → stays AWAITING_HUMAN (human owns it)
  → (recruiter resolves as 'resume_bot') → IN_PROGRESS
  → (recruiter resolves as 'dismissed') → COMPLETED (manual verdict)

COMPLETED  [terminal]
ABANDONED  [terminal]
```

### Retry Logic

- Claude API failures: pg-boss `onFail` → retry up to 3 times with 30s backoff. After 3 failures, session state set to AWAITING_HUMAN with reason `agent_error`.
- Twilio send failures: same — 3 retries, then log error + set session AWAITING_HUMAN.
- Outbound webhook failures: 3 retries with exponential backoff, log each to `nilo_webhook_logs`. Don't block session completion on webhook delivery.

### What is Config-Driven vs Code-Driven in MVP

| Behavior | MVP approach |
|----------|-------------|
| Criteria / must-haves | Config (NiloFlow.criteria) |
| Templates | Config (NiloFlow.templates) |
| Reminder timing | Config (NiloFlow.reminderChain) |
| Webhook URL | Config (NiloFlow.webhookUrl) |
| Slack URL | Config (NiloFlow.slackWebhookUrl) |
| System prompt base | Code (buildSystemPrompt in nilo-core) |
| State machine transitions | Code (orchestrator.ts) |
| Tool set | Code (NILO_TOOLS in nilo-core — same 4 tools) |
| Retry counts | Code (hardcoded 3) |

---

## 8. INTEGRATION CONTRACTS

### A. Trigger API (inbound from external systems)

```
POST /api/nilo/sessions
Authorization: Bearer <nilo_api_key>
Content-Type: application/json

{
  "external_ref": "meta_lead_123",       // optional: caller's ID for idempotency
  "contact": {
    "phone": "+31612345678",              // E.164
    "name": "Jan de Vries"               // first name or full name
  },
  "context": {
    "vacancy_title": "Chauffeur CE",
    "vacancy_location": "Rotterdam",
    "source": "meta_ads",
    "start_date": "2026-05-01"           // ISO date string
  }
}

Response 201:
{
  "session_id": "uuid",
  "state": "created",
  "created_at": "ISO timestamp"
}

Response 409 (duplicate external_ref):
{
  "error": "duplicate",
  "session_id": "uuid"                   // the existing session
}
```

**Auth:** API key resolved via `nilo_api_keys` table. Hash incoming key with bcrypt, compare to stored hash. Set `orgId` from key record.  
**Validation:** Zod schema on all fields. Phone must match E.164 `/^\+[1-9]\d{7,14}$/`. `external_ref` triggers dedup check against `nilo_trigger_events`.  
**Rate limit:** 60 requests/min per API key (Hono middleware).  
**Logging:** Every call logged to `nilo_trigger_events` regardless of outcome.

### B. Twilio Inbound Webhook

```
POST /api/nilo/webhook/twilio
Content-Type: application/x-www-form-urlencoded

From=whatsapp%3A%2B31612345678&Body=Ja+dat+klopt&To=whatsapp%3A%2B14155238886&MessageSid=SM...
X-Twilio-Signature: <HMAC>
```

**Resolution:** Look up `nilo_sessions` by `contact_phone` where `state IN ('initiated', 'in_progress')`. If not found, fall through to existing `intake_sessions` lookup (backward compat).  
**Action:** Persist inbound message to `nilo_messages`. Enqueue `nilo.process_inbound` job. Return `200 OK` (empty body or TwiML `<Response/>`).  
**Signature verification:** `TWILIO_VERIFY_WEBHOOKS !== 'false'` gate (existing pattern).  
**Failure:** If session lookup fails, log warning, return `200` to Twilio (avoid Twilio retries clogging queue).

### C. Outbound Webhook (completion callback)

```
POST <flow.webhookUrl>
Content-Type: application/json
X-Nilo-Signature: <HMAC-SHA256 of body with NILO_WEBHOOK_SECRET>

{
  "event": "session.completed",
  "session_id": "uuid",
  "external_ref": "meta_lead_123",
  "verdict": "qualified",
  "verdict_reason": "CE rijbewijs aanwezig, Code 95 geldig, beschikbaar per 1 mei",
  "match_score": 88,
  "answers": {
    "licenses": { "value": ["CE"], "confidence": "high" },
    "code95": { "value": true, "confidence": "high" },
    "availability": { "value": "2026-05-01", "confidence": "medium" },
    "regio": { "value": true, "confidence": "high" }
  },
  "contact": {
    "phone": "+31612345678",
    "name": "Jan de Vries"
  },
  "context": { "vacancy_title": "Chauffeur CE", "source": "meta_ads" },
  "completed_at": "ISO timestamp"
}
```

**Retry:** Up to 3 attempts if HTTP status >= 400 or timeout. Log each attempt to `nilo_webhook_logs`.  
**Signature:** `HMAC-SHA256(body, NILO_WEBHOOK_SECRET)` in `X-Nilo-Signature` header. Recipient should verify.  
**Failure handling:** After 3 failures, log final error. Do not retry further. Session is still COMPLETED internally.

### D. Slack Notification (qualified leads)

```
POST <flow.slackWebhookUrl>
{
  "text": "✅ Sterke kandidaat: 88% match\n*Jan de Vries* (+31612345678) voor *Chauffeur CE*\nBron: meta_ads | Antwoorden: CE ✓, Code 95 ✓, beschikbaar 1 mei ✓, regio ✓"
}
```

Best-effort only. Failure is logged but does not retry.

### E. ATS / Recruitment OS Internal Sync (existing pattern)

When `nilo_sessions.application_id IS NOT NULL`, the `nilo.session_completed` job additionally:
- Updates `candidate_applications.current_stage_id` (qualified → 'qualified' stage, rejected → 'rejected_by_bot')
- Updates `candidate_applications.match_score`
- Enqueues `intake.fleks_pushback` if Fleks integration is active for the org

This keeps Recruitment OS features working while the nilo layer handles the conversation.

---

## 9. API SPEC (MVP)

All routes under `apps/api/src/routes/`. Auth via Better Auth session OR API key depending on context.

### Trigger & Session Management

| Method | Route | Auth | Purpose |
|--------|-------|------|---------|
| `POST` | `/api/nilo/sessions` | API Key | Create session from external system |
| `GET` | `/api/nilo/sessions` | Session (recruiter) | List sessions for org — session monitor |
| `GET` | `/api/nilo/sessions/:id` | Session (recruiter) | Single session detail with messages |
| `PATCH` | `/api/nilo/sessions/:id/handoff` | Session (recruiter) | Accept / resolve a handoff |

### WhatsApp Webhooks

| Method | Route | Auth | Purpose |
|--------|-------|------|---------|
| `POST` | `/api/nilo/webhook/twilio` | Twilio HMAC | Inbound WhatsApp message |

### Admin / Internal (no UI in MVP)

| Method | Route | Auth | Purpose |
|--------|-------|------|---------|
| `POST` | `/api/nilo/api-keys` | Session (admin) | Create API key for org |
| `DELETE` | `/api/nilo/api-keys/:id` | Session (admin) | Revoke API key |

### Response shapes

```typescript
// GET /api/nilo/sessions
type SessionListResponse = {
  sessions: Array<{
    id: string
    contactPhone: string
    contactName: string | null
    state: NiloSessionState
    verdict: 'qualified' | 'rejected' | 'unsure' | null
    matchScore: number | null
    answers: Record<string, { value: unknown; confidence: string }>
    context: Record<string, unknown>
    createdAt: string
    completedAt: string | null
  }>
  total: number
}

// GET /api/nilo/sessions/:id
type SessionDetailResponse = SessionListResponse['sessions'][0] & {
  messages: Array<{
    id: string
    direction: 'inbound' | 'outbound'
    body: string
    isFromBot: boolean
    sentAt: string
  }>
  handoffs: Array<{
    id: string
    reason: string
    requestedAt: string
    resolvedAt: string | null
    resolution: string | null
  }>
}
```

---

## 10. TWILIO / WHATSAPP SERVICE LAYER

### Provider Abstraction

The `WhatsAppGateway` interface in `packages/nilo-core/src/gateway.ts` is the provider boundary. Nothing above it knows about Twilio.

```typescript
export interface WhatsAppGateway {
  send(input: WhatsAppSendInput): Promise<WhatsAppSendResult>
  verifyWebhook(signature: string, url: string, params: Record<string, string>): boolean
  parseWebhook(params: Record<string, string>): WhatsAppInboundParsed
  isWithin24hWindow(phone: string, orgId: string): Promise<boolean>
}

export interface WhatsAppSendInput {
  toPhone: string           // E.164
  body: string              // free-form text (within 24h window) or template content
  templateSid?: string      // WABA only — pre-approved template SID
  templateVariables?: Record<string, string>
}
```

Two implementations:
- `apps/api/src/modules/nilo/whatsapp/twilio-sandbox.ts` — wraps existing `twilio-sandbox.ts`, thin adapter
- `apps/api/src/modules/nilo/whatsapp/twilio-waba.ts` — Phase 2, production WABA

### Inbound Webhook Parsing

The webhook route calls `gw.verifyWebhook()` first. If verification fails: `403`. Then `gw.parseWebhook()` to extract `fromPhone`, `body`, `messageSid`. Phone is normalized to E.164 by stripping the `whatsapp:` prefix.

### Message Status Updates

Twilio can POST status callbacks (`sent`, `delivered`, `failed`). In MVP: log to `nilo_messages.twilio_sid` for correlation. No status tracking table yet.

### 24-Hour Window

In sandbox mode: `isWithin24hWindow()` always returns `true` (sandbox does not enforce the window). In WABA mode: query `nilo_messages` for last inbound from that phone within 24h.

When outside the window: must use an approved template SID. The gateway's `send()` method switches to template-based sending if `templateSid` is provided. In MVP (sandbox), this path is never hit.

### Rate Limits

Twilio WhatsApp sandbox: ~1 message/second per number. pg-boss jobs for the same session will never run in parallel (single-worker pattern per session ID). At Timmers MVP volume (< 100 sessions/day), no rate limiting needed.

### Failure Handling

If `send()` throws, the job handler catches it, increments retry counter, and re-throws to pg-boss for retry. After 3 failures: set session to AWAITING_HUMAN, send Slack alert to recruiter.

---

## 11. RECRUITER HANDOFF MODEL

### How Automation Requests Handoff

When the Claude agent calls the `escalate_to_human` tool:
1. Tool executor sets `nilo_sessions.state = 'awaiting_human'`
2. Creates a `nilo_handoffs` record with `reason` and `context`
3. Enqueues `nilo.handoff_requested` job
4. Job sends Slack notification: "⚠️ Kandidaat Jan de Vries vraagt om een recruiter. Reden: explicit_request. Ga naar [link]."

### How a Recruiter Sees It

Session monitor (`/nilo/sessions`) shows sessions in AWAITING_HUMAN state with a red badge. Clicking the session shows the full conversation + handoff reason.

In MVP: recruiter responds directly via their own WhatsApp or phone. The platform doesn't proxy the recruiter's messages — it just tracks the handoff state.

### Conversation Ownership

While in AWAITING_HUMAN, no bot messages are sent. Even if the candidate sends another WhatsApp message, the inbound handler sees `state = 'awaiting_human'` and does NOT enqueue `nilo.process_inbound`. The message is logged to `nilo_messages` with `is_from_bot = false`.

### How a Recruiter Resolves

```
PATCH /api/nilo/sessions/:id/handoff
{
  "resolution": "took_over"   // | "dismissed" | "resumed_bot"
  "verdict": "qualified"      // required if resolution = "dismissed"
  "verdict_reason": "..."     // required if resolution = "dismissed"
}
```

- `took_over`: recruiter handled it. Session stays AWAITING_HUMAN. No further bot activity.
- `dismissed`: recruiter sets final verdict manually. Session moves to COMPLETED.
- `resumed_bot`: recruiter has answered the candidate's question, wants bot to continue. Session moves to IN_PROGRESS. Next inbound message will trigger agent again.

---

## 12. CONFIGURATION MODEL

### A. Platform-Level (env vars / infrastructure)

- `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_WHATSAPP_FROM`
- `TWILIO_VERIFY_WEBHOOKS`
- `NILO_WEBHOOK_SECRET` (HMAC signing of outbound webhooks)
- `ANTHROPIC_API_KEY`
- `DATABASE_URL`
- `TIMMERS_ORG_ID` (MVP hardcode)

These are set once per deployment. No UI. Never stored in DB.

### B. Tenant-Level (per org, DB-stored)

MVP: hardcoded in `flow-registry.ts`. Phase 2: stored in `nilo_flow_configs`.

- Twilio from-number (if per-org numbers — Phase 2)
- Brand name / tone instruction override for system prompt
- Slack webhook URL
- Score threshold for alerts

### C. Flow-Level (per NiloFlow)

- Qualification criteria (must-haves + nice-to-haves)
- Template bodies (per variant, per locale)
- Reminder chain timing
- Outbound webhook URL
- `systemPromptExtra` (additional LLM instructions)

### D. Integration-Level (per API key / connection)

- API key label and permissions
- Allowed source IPs (Phase 2)
- Rate limit override (Phase 2)

### Hardcoding Mistakes to Avoid

| Don't hardcode | Instead |
|----------------|---------|
| Org-specific webhook URLs in route handlers | Resolve from `NiloFlow.webhookUrl` |
| Template text in job handlers | Resolve from `NiloFlow.templates` |
| Twilio credentials in module files | Inject via gateway factory |
| Score thresholds in tool-store | Resolve from `NiloFlow.scoreThreshold` |
| Reminder timings in orchestrator | Resolve from `NiloFlow.reminderChain` |

---

## 13. SECURITY / TENANT ISOLATION

### Tenant Isolation

All `nilo_*` tables use `organization_id` + Drizzle RLS policies via the existing `tenantRlsPolicies()` helper from `apps/api/src/db/schema/rls-helpers.ts`. The Hono middleware sets `SET LOCAL app.current_organization_id = '<uuid>'` at the start of every authenticated request. RLS policies enforce this at the database level.

### Auth Roles

| Request type | Auth mechanism |
|-------------|---------------|
| Trigger API (external) | API key — hash compared against `nilo_api_keys.key_hash` |
| Session monitor UI | Better Auth session (recruiter or admin role) |
| Handoff resolution | Better Auth session (recruiter or admin role) |
| Twilio webhook | Twilio HMAC signature verification |
| Outbound webhook receiver (caller's side) | `X-Nilo-Signature` HMAC-SHA256 |

### Webhook Authentication

Twilio inbound: `X-Twilio-Signature` HMAC verification using `TWILIO_AUTH_TOKEN`. Skip only in dev (`TWILIO_VERIFY_WEBHOOKS=false`).

Outbound webhook: `X-Nilo-Signature: sha256=<hex>` where hex = `HMAC-SHA256(body, NILO_WEBHOOK_SECRET)`. Caller should verify this header. Document this in the API guide.

### Provider Secret Handling

Twilio credentials stay in environment variables, never in the DB. In Phase 2 (per-org Twilio numbers): store encrypted in a `nilo_credentials` table using `pgcrypto` or application-level AES-256. Never expose in API responses.

### PII Concerns

- `contact_phone` and `contact_name` in `nilo_sessions` are PII.
- `nilo_messages.body` contains conversation content — PII.
- All stored in EU-region PostgreSQL (existing setup).
- Retention policy: configurable per org, default 180 days. Implement via pg-boss daily job `nilo.purge_expired_sessions` (Phase 3).

### Auditability

- `nilo_messages` is append-only — no UPDATE/DELETE allowed by RLS policy.
- `nilo_trigger_events` is append-only — records every inbound trigger.
- `nilo_webhook_logs` is append-only — records every outbound webhook attempt.
- Session state changes are derivable from the message log.

---

## 14. ANALYTICS / OBSERVABILITY

### What Goes to Database (MVP)

| Data | Table | Retention |
|------|-------|-----------|
| Every inbound message | `nilo_messages` | 180d |
| Every outbound message | `nilo_messages` | 180d |
| Every tool call | `nilo_messages.tool_calls` (JSONB) | 180d |
| Every webhook attempt | `nilo_webhook_logs` | 90d |
| Every trigger event | `nilo_trigger_events` | 90d |
| Handoff records | `nilo_handoffs` | 365d |
| Session completion state | `nilo_sessions.verdict`, `match_score`, etc. | 180d |

### Derived Metrics (computed from tables, no separate analytics table in MVP)

These can be computed by the session monitor UI via SQL queries:

```sql
-- Response rate (% sessions with at least one inbound)
SELECT COUNT(*) FILTER (WHERE last_inbound_at IS NOT NULL) * 100.0 / COUNT(*)
FROM nilo_sessions WHERE organization_id = $1;

-- Qualification rate
SELECT verdict, COUNT(*) FROM nilo_sessions
WHERE organization_id = $1 AND state = 'completed'
GROUP BY verdict;

-- Avg conversation length
SELECT AVG(msg_count) FROM (
  SELECT COUNT(*) AS msg_count FROM nilo_messages
  WHERE organization_id = $1 GROUP BY session_id
) t;
```

### Error Observability

- Claude API errors: caught in job handler, logged via `console.error` with `sessionId`. Use existing Sentry integration (`globalThis.Sentry`).
- Twilio errors: caught in gateway `send()`, surfaced via job retry mechanism.
- Webhook delivery failures: fully recorded in `nilo_webhook_logs`.

### What's Essential for MVP Debugging

1. Full message log per session (already in `nilo_messages`)
2. Tool call log per message (in `nilo_messages.tool_calls`)
3. Webhook log per session (in `nilo_webhook_logs`)
4. pg-boss job history (built-in — query `pgboss.job` table)
5. Session state history (derivable from `nilo_sessions` + `nilo_handoffs`)

---

## 15. IMPLEMENTATION PHASES

### Phase 1 — Core Extraction (3-4 days)

**Objective:** Extract the provider-agnostic engine from `apps/api/src/modules/intake/` into `packages/nilo-core/`. Define `NiloPersistence` interface. Nothing changes for existing Recruitment OS features.

**Deliverables:**
- `packages/nilo-core/src/types.ts` — `NiloPersistence`, `NiloFlow`, session state types
- `packages/nilo-core/src/orchestrator.ts` — startSession, sendReminder, sendFarewell (extracted from intake/orchestrator.ts)
- `packages/nilo-core/src/agent/` — processInbound, tools, prompts (extracted from intake/agent/)
- `packages/nilo-core/src/renderer.ts` — renderTemplate (extracted from intake/templates/renderer.ts)
- `packages/nilo-core/src/gateway.ts` — WhatsAppGateway interface (extracted from intake/whatsapp/gateway.ts)
- Existing `apps/api/src/modules/intake/` refactored so `tool-store.ts` implements `NiloPersistence` interface

**Dependencies:** None. Can start immediately.  
**Stub:** Flow configuration (NiloFlow) is stubbed as a TypeScript object — no DB storage yet.

### Phase 2 — Hey Nilo Standalone Module (3-4 days)

**Objective:** Build the `apps/api/src/modules/nilo/` layer and Drizzle schema for Hey Nilo sessions. Wire nilo-core to new persistence layer.

**Deliverables:**
- Drizzle schema: `nilo_sessions`, `nilo_messages`, `nilo_api_keys`, `nilo_trigger_events`, `nilo_webhook_logs`, `nilo_handoffs`
- `apps/api/src/modules/nilo/persistence/drizzle-persistence.ts` — implements `NiloPersistence`
- `apps/api/src/modules/nilo/orchestrator.ts` — wires nilo-core + drizzle-persistence + pg-boss
- `apps/api/src/modules/nilo/flow-registry.ts` — hardcoded Timmers flow
- `apps/api/src/modules/nilo/jobs/` — all 4 job handlers
- `apps/api/src/modules/nilo/outbound.ts` — webhook + Slack dispatch

**Dependencies:** Phase 1 complete.  
**Stub:** Trigger API route is placeholder; no API key auth yet.

### Phase 3 — Trigger API + Webhook Route Extension (2 days)

**Objective:** Expose the trigger API for external systems. Extend the existing Twilio webhook route to handle nilo sessions alongside intake sessions.

**Deliverables:**
- `apps/api/src/routes/nilo-trigger.routes.ts` — `POST /api/nilo/sessions` with API key auth
- `apps/api/src/routes/nilo-sessions.routes.ts` — `GET /api/nilo/sessions`, `GET /api/nilo/sessions/:id`, `PATCH /api/nilo/sessions/:id/handoff`
- `apps/api/src/routes/whatsapp-webhook.routes.ts` — extend to resolve nilo sessions first, fall through to intake sessions if not found
- API key creation route (`POST /api/nilo/api-keys`)

**Dependencies:** Phase 2 complete.

### Phase 4 — Session Monitor UI (2-3 days)

**Objective:** Read-only Next.js page showing all nilo sessions for an org, with conversation detail.

**Deliverables:**
- `apps/web/src/app/(app)/nilo/sessions/page.tsx` — session list with filters (state, verdict)
- `apps/web/src/app/(app)/nilo/sessions/[id]/page.tsx` — session detail with message thread + handoff controls
- TanStack Query hooks for session data
- Add "Nilo" entry to sidebar nav (agency + employer mode)

**Dependencies:** Phase 3 complete.

### Phase 5 — Timmers Integration & Go-Live (1-2 days)

**Objective:** Deploy with Timmers config. Run end-to-end with real phone numbers.

**Deliverables:**
- `TIMMERS_ORG_ID`, `TIMMERS_WEBHOOK_URL`, `TIMMERS_SLACK_WEBHOOK_URL` set in env
- Timmers API key generated and handed to Timmers/Zapier team
- Zapier: Meta Ads form → `POST /api/nilo/sessions`
- Smoke test with 5 real phone numbers
- Runbook for recruiter: how to handle AWAITING_HUMAN sessions

**Dependencies:** Phase 4 complete + WABA application in progress (for future).

---

## 16. CLAUDE CODE TASK BREAKDOWN

### Task 1: Define NiloPersistence interface and NiloFlow types

**Goal:** Create `packages/nilo-core/src/types.ts` with all shared interfaces  
**Files:** `packages/nilo-core/src/types.ts`, `packages/nilo-core/package.json`, `turbo.json` (add workspace)  
**Inputs:** This spec (section 7, domain model)  
**Output:** Exportable TypeScript interfaces — `NiloPersistence`, `NiloFlow`, `NiloCriteria`, `NiloTemplates`, `ReminderStep`, `NiloSession`, `NiloSessionState`  
**Dependencies:** None  
**Done:** `pnpm tsc --noEmit` passes in nilo-core package

### Task 2: Extract orchestrator into nilo-core

**Goal:** Move `startSession`, `sendReminder`, `sendFarewellAndClose` from `apps/api/src/modules/intake/orchestrator.ts` into `packages/nilo-core/src/orchestrator.ts`, making them use `NiloPersistence` instead of the current `StartSessionDeps` / `ReminderDeps` interfaces  
**Files:** `packages/nilo-core/src/orchestrator.ts` (create), `apps/api/src/modules/intake/orchestrator.ts` (refactor to re-export from nilo-core)  
**Inputs:** Existing orchestrator.ts, types.ts from Task 1  
**Output:** nilo-core orchestrator with identical behavior, intake orchestrator becomes a thin re-export wrapper  
**Done:** Existing unit tests for orchestrator still pass

### Task 3: Extract agent into nilo-core

**Goal:** Move `processInbound`, `buildSystemPrompt`, `buildMessages`, `INTAKE_TOOLS`, `renderTemplate`, `WhatsAppGateway` into nilo-core. Parameterize system prompt to accept `NiloFlow.criteria` and `NiloFlow.systemPromptExtra` instead of vacancy-specific fields.  
**Files:** `packages/nilo-core/src/agent/agent.ts`, `tools.ts`, `prompts.ts`, `packages/nilo-core/src/renderer.ts`, `packages/nilo-core/src/gateway.ts`  
**Inputs:** Existing intake agent files  
**Output:** nilo-core agent — same logic, `QualificationCriteria` replaced by `NiloCriteria`  
**Done:** Types check, agent function signatures match `NiloPersistence` expected by orchestrator

### Task 4: Refactor tool-store.ts to implement NiloPersistence

**Goal:** Make `apps/api/src/modules/intake/agent/tool-store.ts` implement `NiloPersistence` from nilo-core, removing any direct dependency on nilo-core-internal types  
**Files:** `apps/api/src/modules/intake/agent/tool-store.ts`  
**Inputs:** `NiloPersistence` interface, existing tool-store.ts  
**Output:** tool-store.ts where every method signature matches the interface. No behavioral change.  
**Done:** Existing intake tests pass, TypeScript reports no errors

### Task 5: Create nilo_* Drizzle schema

**Goal:** Add 6 new tables: `nilo_sessions`, `nilo_messages`, `nilo_api_keys`, `nilo_trigger_events`, `nilo_webhook_logs`, `nilo_handoffs`  
**Files:** `apps/api/src/db/schema/nilo-sessions.ts`, `nilo-messages.ts`, `nilo-api-keys.ts`, `nilo-trigger-events.ts`, `nilo-webhook-logs.ts`, `nilo-handoffs.ts`, `apps/api/src/db/schema/index.ts` (add exports)  
**Inputs:** Schema draft in this spec (section 5)  
**Output:** Drizzle schema with RLS policies, migration file  
**Done:** `drizzle-kit generate` produces correct SQL, `drizzle-kit push` applies without errors

### Task 6: Implement drizzle-persistence.ts

**Goal:** Create `apps/api/src/modules/nilo/persistence/drizzle-persistence.ts` that implements `NiloPersistence` using the new nilo_* tables  
**Files:** `apps/api/src/modules/nilo/persistence/drizzle-persistence.ts`  
**Inputs:** `NiloPersistence` interface, nilo_* schema  
**Output:** All interface methods implemented: recordAnswer, bumpStuck, escalate, finalize, getSessionState, persistOutbound, scheduleReminder  
**Done:** All methods handle `organizationId` scope; TypeScript clean

### Task 7: Implement flow-registry.ts (Timmers hardcoded)

**Goal:** Create `apps/api/src/modules/nilo/flow-registry.ts` with hardcoded Timmers `NiloFlow` and `resolveFlow(orgId)` function  
**Files:** `apps/api/src/modules/nilo/flow-registry.ts`  
**Inputs:** Timmers flow spec in this doc (section 7)  
**Output:** Exported `resolveFlow(orgId: string): NiloFlow | null`  
**Done:** Returns Timmers flow for `TIMMERS_ORG_ID`, null for any other org

### Task 8: Implement nilo orchestrator and job handlers

**Goal:** Create the 4 pg-boss job handlers and the nilo orchestrator that wires nilo-core + drizzle-persistence + WhatsApp gateway  
**Files:** `apps/api/src/modules/nilo/orchestrator.ts`, `jobs/start-session.job.ts`, `jobs/process-inbound.job.ts`, `jobs/send-reminder.job.ts`, `jobs/fire-webhook.job.ts`  
**Inputs:** nilo-core orchestrator/agent, drizzle-persistence, flow-registry, pg-boss lib  
**Output:** 4 job handlers registered with pg-boss on startup  
**Done:** Can trigger a test session end-to-end in dev environment (even without real Twilio)

### Task 9: Implement outbound.ts (webhook + Slack)

**Goal:** Fire HTTP POST to `NiloFlow.webhookUrl` on session terminal state, fire Slack notification for qualified sessions above threshold  
**Files:** `apps/api/src/modules/nilo/outbound.ts`  
**Inputs:** outbound webhook spec (section 8C, 8D), `nilo_webhook_logs` schema  
**Output:** `fireWebhook(session, flow, orgId)` and `fireSlackAlert(session, flow)` functions  
**Done:** Webhook logs written on success and failure, Slack fires for verdict=qualified with score >= threshold

### Task 10: Build trigger API route with API key auth

**Goal:** `POST /api/nilo/sessions` with API key auth, Zod validation, idempotency check  
**Files:** `apps/api/src/routes/nilo-trigger.routes.ts`, update `apps/api/src/index.ts` to mount route  
**Inputs:** API spec (section 9), `nilo_api_keys` schema, `nilo_trigger_events` schema  
**Output:** Route that creates `nilo_sessions` + `nilo_trigger_events`, enqueues `nilo.session_triggered`, returns 201  
**Done:** `curl -X POST` with valid API key creates session and enqueues job; duplicate `external_ref` returns 409

### Task 11: Extend Twilio webhook route for nilo sessions

**Goal:** Extend existing `whatsapp-webhook.routes.ts` to look up `nilo_sessions` first (by `contact_phone`, `state IN ('initiated', 'in_progress')`), then fall through to existing intake session lookup  
**Files:** `apps/api/src/routes/whatsapp-webhook.routes.ts`  
**Inputs:** Existing webhook route, nilo_sessions schema  
**Output:** Inbound WhatsApp from a nilo contact enqueues `nilo.process_inbound` and returns 200; existing intake flow unaffected  
**Done:** Test with a simulated Twilio POST — nilo session is updated, message logged

### Task 12: Build session monitor UI

**Goal:** Read-only Next.js pages at `/nilo/sessions` and `/nilo/sessions/[id]`  
**Files:** `apps/web/src/app/(app)/nilo/sessions/page.tsx`, `[id]/page.tsx`, TanStack Query hooks, sidebar nav update  
**Inputs:** Session list and detail API responses (section 9)  
**Output:** Table showing sessions with state/verdict badges, click-through to message thread + handoff status  
**Done:** Can view sessions in browser, conversation thread is legible, AWAITING_HUMAN sessions have a resolve CTA

---

## 17. FILE CREATION PLAN

### New files to create (in order)

```
packages/nilo-core/
  package.json
  tsconfig.json
  src/
    index.ts
    types.ts                    ← NiloPersistence, NiloFlow, NiloSession, etc.
    orchestrator.ts             ← startSession, sendReminder, sendFarewell
    renderer.ts                 ← renderTemplate (copy from intake)
    gateway.ts                  ← WhatsAppGateway interface (copy from intake)
    agent/
      agent.ts                  ← processInbound (adapted from intake-agent.ts)
      tools.ts                  ← NILO_TOOLS (same 4 tools, generalized naming)
      prompts.ts                ← buildSystemPrompt (NiloCriteria-driven)
      tool-executor.ts          ← applyToolCalls (copy from intake)

apps/api/src/db/schema/
  nilo-sessions.ts
  nilo-messages.ts
  nilo-api-keys.ts
  nilo-trigger-events.ts
  nilo-webhook-logs.ts
  nilo-handoffs.ts

apps/api/src/modules/nilo/
  orchestrator.ts
  flow-registry.ts
  handoff.ts
  outbound.ts
  persistence/
    drizzle-persistence.ts
  jobs/
    start-session.job.ts
    process-inbound.job.ts
    send-reminder.job.ts
    fire-webhook.job.ts
  whatsapp/
    twilio-sandbox.ts           ← adapter wrapping existing twilio-sandbox.ts

apps/api/src/routes/
  nilo-trigger.routes.ts
  nilo-sessions.routes.ts

apps/web/src/app/(app)/nilo/
  sessions/
    page.tsx
    [id]/
      page.tsx
```

### Files to modify

```
apps/api/src/modules/intake/orchestrator.ts         ← re-export from nilo-core
apps/api/src/modules/intake/agent/tool-store.ts     ← implement NiloPersistence
apps/api/src/routes/whatsapp-webhook.routes.ts      ← extend for nilo session lookup
apps/api/src/db/schema/index.ts                     ← export new nilo_* tables
apps/api/src/index.ts                               ← mount nilo routes, register jobs
apps/api/src/db/setup-rls.sql                       ← add RLS policies for nilo_* tables
apps/web/src/components/layout/sidebar.tsx          ← add Nilo nav entry
turbo.json                                          ← add nilo-core to workspace
packages/types/src/index.ts                         ← export NiloCriteria if shared
```

---

## 18. OPEN TECHNICAL DECISIONS

### Must decide before coding

| Decision | Options | Recommendation |
|----------|---------|---------------|
| Package naming | `@recruitment-os/nilo-core` vs `@hey-nilo/core` | Use `@hey-nilo/core` — signals product separation from day 1 |
| Trigger API auth | bcrypt compare vs constant-time comparison | Use `timingSafeEqual` from Node crypto — bcrypt is overkill for a key hash |
| `nilo_sessions` vs `intake_sessions` coexistence | Parallel tables | Keep parallel — don't merge in MVP. Link via `application_id`. |
| Timmers org provisioning | Manual DB insert vs script | Write a one-time seed script: `pnpm tsx scripts/provision-timmers-org.ts` |
| How to register pg-boss jobs | Startup hook in `index.ts` | Same pattern as existing `initJobQueue()` — extend it |

### Can be deferred

| Decision | Defer until |
|----------|------------|
| Per-org Twilio credentials | Phase 2 (Personeel.com onboarding) |
| DB-stored flow configurations | Phase 2 |
| WABA production adapter | After WABA approval — parallel with phase 4-5 |
| Retention / purge job | Phase 3 |
| Match scoring for standalone mode | Phase 3 — needs criteria framework decision |
| i18n (EN/PL/RO templates) | Post-MVP |
| Analytics aggregation table | After 1 month of data |

### Assumptions to validate early

1. **Timmers has a WhatsApp Business number** — or candidates must opt in via sandbox join keyword. Confirm before Phase 5.
2. **Meta Ads form can POST to a webhook** — or Zapier middle layer is needed. Confirm with Timmers.
3. **Timmers wants Zapier** — or they have tech resources to call the trigger API directly.
4. **`external_ref` dedup is enough** — Zapier sometimes retries. The `nilo_trigger_events` unique index on `(org_id, external_ref)` prevents duplicate sessions, but only if Zapier sends consistent IDs.
5. **pg-boss SKIP LOCKED is sufficient** — for Timmers volume (<100 sessions/day) yes. For Personeel.com (potentially thousands), validate pg-boss throughput before that onboarding.

---

## 19. FINAL ENGINEERING RECOMMENDATION

### Recommended architecture for MVP

Monorepo-native extraction. Do not create a separate repository. Add `packages/nilo-core/` as a new workspace package. The core engine lives there. Recruitment OS consumes it via the existing intake module (refactored). The new standalone Hey Nilo module (`apps/api/src/modules/nilo/`) also consumes it. One engine, two consumers.

### What to build first

**Task 1 (types) → Task 2 (orchestrator extraction) → Task 3 (agent extraction) → Task 4 (refactor tool-store).**

This is Phase 1. It takes 3-4 days and produces zero visible change to Recruitment OS users, but it proves the extraction works. If this step surfaces unexpected coupling, catch it early before building the new schema.

Only after Phase 1 is clean do you start Phase 2 (new schema + persistence layer).

### What to fake

- Timmers flow: hardcode it. Don't build a flow builder. Hardcoded flow configuration is a feature, not a hack — it's explicit and reviewable.
- Slack notification: direct `fetch()`. No abstraction layer. It's 6 lines.
- Session monitor auth: rely on Better Auth session + org slug. Don't build a separate auth flow.
- WABA window check: always return `true` in sandbox. Add a TODO comment. Ship.

### What to postpone

Everything in "Out of Scope" in section 1. Specifically: do not touch analytics tables, flow builder UI, multi-language templates, or billing hooks until Timmers is live and generating real data.

### Highest technical risk

**The 24-hour WhatsApp conversation window.** In sandbox mode it doesn't apply. But the moment Timmers moves to WABA, every outbound message sent more than 24 hours after the last inbound must use a pre-approved template. If the production WhatsApp gateway doesn't enforce this check, messages will silently fail. The `isWithin24hWindow()` method in the gateway interface exists precisely for this. The WABA adapter must implement it correctly, and the orchestrator must pass template SIDs for reminder messages outside the window.

Start the WABA template approval process in parallel with MVP development. Approval takes 2-5 business days and can be blocked by Meta's review team.

### How to keep the system modular without overengineering

Three rules for this codebase:

1. **`packages/nilo-core/` has zero Drizzle imports.** If you're tempted to import `db` from there, stop — define a method on `NiloPersistence` instead.
2. **`modules/nilo/` has zero awareness of Recruitment OS entities.** It doesn't know about `vacancies`, `candidateApplications`, or `pipelineStages`. If you need to update a stage, do it in a `nilo.session_completed` job consumer that lives in `modules/intake/`, not in the nilo module.
3. **Flow configuration resolves at the boundary.** The job handler calls `resolveFlow(orgId)` at the start. Everything downstream receives the resolved `NiloFlow` object. Nothing inside the engine reaches back to the registry.

These three rules keep the layers clean. They're also easy to verify in code review.
