# Fleks + WhatsApp Intake Module — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an end-to-end module that pulls new candidates from Fleks V2, runs an automated WhatsApp intake conversation via Claude, qualifies them against vacancy criteria, and pushes the verdict back to Fleks.

**Architecture:** Service-bounded module under `apps/api/src/modules/intake/`. pg-boss polling loop for Fleks ingest, Twilio sandbox gateway for WhatsApp (swap to WABA in Phase 2), Claude Sonnet 4.6 as guided-agent with constrained tool surface, Drizzle-managed schema additions wired into existing candidate/application pipeline via a new "Fleks Intake" stage.

**Tech Stack:** TypeScript, Next.js (App Router), Hono, Drizzle ORM, Postgres + RLS, pg-boss, `@anthropic-ai/sdk`, `twilio`, React Query, Zod, Vitest, Playwright.

**Spec:** [docs/superpowers/specs/2026-04-20-fleks-whatsapp-intake-design.md](../specs/2026-04-20-fleks-whatsapp-intake-design.md)

---

## File Map

### Shared types (`packages/types/src/`)
| Action | File | Responsibility |
|---|---|---|
| Create | `qualification-criteria.ts` | Zod schema for must-have / nice-to-have criteria |
| Create | `intake.ts` | `IntakeSession`, `IntakeMessage`, `IntakeVerdict` types |
| Create | `fleks.ts` | `FleksJob`, `FleksEmployee`, `FleksJobCandidate` response shapes |
| Modify | `index.ts` | Re-export new modules |

### Backend (`apps/api/src/`)
| Action | File | Responsibility |
|---|---|---|
| Create | `db/schema/external-integrations.ts` | External API creds storage |
| Create | `db/schema/intake.ts` | `intakeSessions`, `intakeMessages`, `intakeTemplates` tables |
| Create | `db/schema/fleks-sync.ts` | `fleksSyncCursors` table |
| Modify | `db/schema/vacancies.ts` | Add `intakeEnabled`, `fleksJobUuid` |
| Modify | `db/schema/candidates.ts` | Add `fleksEmployeeUuid` |
| Modify | `db/schema/index.ts` | Export new schemas |
| Modify | `db/seed/index.ts` | Seed default pipeline stages + intake templates |
| Create | `lib/crypto.ts` | Encrypt/decrypt helpers for API keys |
| Create | `modules/intake/fleks/client.ts` | Fleks V2 HTTP client |
| Create | `modules/intake/fleks/sync.service.ts` | Polling sync + dedup + upsert |
| Create | `modules/intake/whatsapp/gateway.ts` | `WhatsAppGateway` interface |
| Create | `modules/intake/whatsapp/twilio-sandbox.ts` | Sandbox implementation |
| Create | `modules/intake/templates/renderer.ts` | Merge-field substitution |
| Create | `modules/intake/orchestrator.ts` | Session state machine |
| Create | `modules/intake/agent/tools.ts` | Claude tool definitions |
| Create | `modules/intake/agent/prompts.ts` | System prompt builder |
| Create | `modules/intake/agent/intake-agent.ts` | Claude invocation + tool-call executor |
| Create | `modules/intake/criteria/suggest.service.ts` | AI-assisted criteria suggestions |
| Create | `modules/intake/pushback.service.ts` | Fleks status update on verdict |
| Create | `routes/intake.routes.ts` | `/api/intake/*` endpoints |
| Create | `routes/intake-template.routes.ts` | `/api/intake-templates/*` endpoints |
| Create | `routes/whatsapp-webhook.routes.ts` | `/api/webhooks/whatsapp/twilio` |
| Create | `jobs/fleks-sync.job.ts` | pg-boss worker `fleks.sync-tick` |
| Create | `jobs/intake.jobs.ts` | `intake.start`, `intake.process_message`, reminders |
| Modify | `index.ts` | Mount routes + register jobs |

### Frontend (`apps/web/src/`)
| Action | File | Responsibility |
|---|---|---|
| Create | `hooks/use-intake.ts` | TanStack hooks for sessions/templates/criteria |
| Create | `app/(app)/intake/page.tsx` | Intake Inbox list |
| Create | `app/(app)/intake/[id]/page.tsx` | Session detail |
| Create | `app/(app)/vacancies/[id]/intake/page.tsx` | Vacancy Intake tab |
| Create | `app/(app)/settings/intake-templates/page.tsx` | Template editor |
| Create | `components/intake/session-transcript.tsx` | WhatsApp-style chat view |
| Create | `components/intake/must-have-checklist.tsx` | Progress sidebar |
| Create | `components/intake/verdict-card.tsx` | Completed-verdict display |
| Create | `components/intake/takeover-dialog.tsx` | Recruiter takeover flow |
| Create | `components/intake/criteria-editor.tsx` | Criteria JSONB form |
| Create | `components/intake/criteria-ai-suggest.tsx` | AI-assist panel |
| Create | `components/intake/template-editor.tsx` | Per-variant template form |
| Modify | `components/layout/sidebar.tsx` | Add "Intake" nav item |

### Tests
| Path | Scope |
|---|---|
| `apps/api/tests/unit/fleks-client.test.ts` | HTTP client behavior |
| `apps/api/tests/unit/fleks-sync.test.ts` | Dedup + upsert logic |
| `apps/api/tests/unit/template-renderer.test.ts` | Merge fields |
| `apps/api/tests/unit/orchestrator.test.ts` | State transitions |
| `apps/api/tests/unit/intake-agent.test.ts` | Tool-call handling |
| `apps/api/tests/unit/pushback.test.ts` | Fleks PUT on verdict |
| `apps/web/tests/e2e/intake-flow.spec.ts` | End-to-end happy path |

---

## Task 1: Shared types & qualification-criteria schema

**Files:**
- Create: `packages/types/src/qualification-criteria.ts`
- Create: `packages/types/src/intake.ts`
- Create: `packages/types/src/fleks.ts`
- Modify: `packages/types/src/index.ts`

- [ ] **Step 1: Write qualification-criteria.ts**

```typescript
// packages/types/src/qualification-criteria.ts
import { z } from "zod";

export const verticalEnum = z.enum([
  "security", "traffic", "bouw", "zorg", "infra",
]);
export type Vertical = z.infer<typeof verticalEnum>;

export const availabilityEnum = z.enum(["fulltime", "parttime", "flexible"]);
export type Availability = z.infer<typeof availabilityEnum>;

export const customKeySchema = z.object({
  key: z.string().min(1),
  question: z.string().min(1),
  expectedFormat: z.enum(["yes_no", "text", "number", "enum"]),
  enumValues: z.array(z.string()).optional(),
  required: z.boolean().default(false),
});
export type CustomKey = z.infer<typeof customKeySchema>;

export const qualificationCriteriaSchema = z.object({
  mustHave: z.object({
    licenses: z.array(z.string()).optional(),
    vertical: verticalEnum.optional(),
    availability: availabilityEnum.optional(),
    locationRadiusKm: z.number().positive().optional(),
    rightToWork: z.boolean().optional(),
    minAge: z.number().int().positive().optional(),
    customKeys: z.array(customKeySchema).optional(),
  }).default({}),
  niceToHave: z.object({
    experienceYearsMin: z.number().int().nonnegative().optional(),
    certifications: z.array(z.string()).optional(),
    preferredLanguages: z.array(z.string()).optional(),
    freeText: z.string().optional(),
  }).default({}),
});
export type QualificationCriteria = z.infer<typeof qualificationCriteriaSchema>;
```

- [ ] **Step 2: Write intake.ts**

```typescript
// packages/types/src/intake.ts
import { z } from "zod";

export const intakeSessionStateEnum = z.enum([
  "awaiting_first_reply",
  "in_progress",
  "awaiting_human",
  "completed",
]);
export type IntakeSessionState = z.infer<typeof intakeSessionStateEnum>;

export const intakeVerdictEnum = z.enum(["qualified", "rejected", "unsure"]);
export type IntakeVerdict = z.infer<typeof intakeVerdictEnum>;

export const intakeTemplateVariantEnum = z.enum([
  "first_contact",
  "reminder_24h",
  "reminder_72h",
  "no_response_farewell",
]);
export type IntakeTemplateVariant = z.infer<typeof intakeTemplateVariantEnum>;

export interface IntakeSession {
  id: string;
  organizationId: string;
  applicationId: string;
  state: IntakeSessionState;
  verdict: IntakeVerdict | null;
  verdictReason: string | null;
  mustHaveAnswers: Record<string, unknown>;
  niceToHaveAnswers: Record<string, unknown>;
  stuckCounter: Record<string, number>;
  claudeThreadId: string | null;
  lastInboundAt: string | null;
  lastOutboundAt: string | null;
  reminderCount: number;
  createdAt: string;
  completedAt: string | null;
}

export interface IntakeMessage {
  id: string;
  sessionId: string;
  direction: "inbound" | "outbound";
  body: string;
  twilioSid: string | null;
  isFromBot: boolean;
  toolCalls: unknown[] | null;
  sentAt: string;
}

export interface IntakeTemplate {
  id: string;
  organizationId: string;
  variant: IntakeTemplateVariant;
  locale: string;
  name: string;
  body: string;
  isActive: boolean;
  wabaStatus: "sandbox" | "waba_pending" | "waba_approved" | "waba_rejected";
  wabaContentSid: string | null;
  createdAt: string;
  updatedAt: string | null;
}
```

- [ ] **Step 3: Write fleks.ts**

```typescript
// packages/types/src/fleks.ts
// Subset of Fleks V2 External API shapes we consume. Expand as needed.

export interface FleksJob {
  uuid: string;
  functionName: string;
  functionDescription: string | null;
  clientName: string | null;
  clientId: string | null;
  city: string | null;
  startDate: string | null;
  endDate: string | null;
  categoryUUIDS: string[];
  isArchived: boolean;
  updatedAt: string;
  createdAt: string;
}

export interface FleksEmployee {
  uuid: string;
  firstName: string;
  lastName: string;
  fullName: string;
  email: string | null;
  phoneNumber: string | null;
  city: string | null;
  postCode: string | null;
  dateCreated: string;
  updatedAt: string;
  isRegistrationCompleted: boolean;
  isVerified: boolean;
  userRole: "Planner" | "Manager" | "Client" | "Worker";
}

export interface FleksJobCandidate extends FleksEmployee {
  jobUUID: string;
  isQualified: boolean;
  isInvited: boolean;
  isAlreadyScheduled: boolean;
  hasActiveContract: boolean;
}

export interface FleksPaginatedResponse<T> {
  data: T[];
  totalCount?: number;
  page: number;
  limit: number;
}
```

- [ ] **Step 4: Re-export from index.ts**

Modify `packages/types/src/index.ts` — add these lines at the end:

```typescript
export * from "./qualification-criteria.js";
export * from "./intake.js";
export * from "./fleks.js";
```

- [ ] **Step 5: Verify typecheck**

Run: `cd /Users/bartwilbrink/recruitment-os/.worktrees/fleks-intake/packages/types && npx tsc --noEmit`
Expected: exit 0, no errors.

- [ ] **Step 6: Commit**

```bash
git add packages/types/src/qualification-criteria.ts packages/types/src/intake.ts packages/types/src/fleks.ts packages/types/src/index.ts
git commit -m "feat(types): add intake + fleks + qualification-criteria types"
```

---

## Task 2: Crypto helpers for API-key storage

**Files:**
- Create: `apps/api/src/lib/crypto.ts`
- Create: `apps/api/tests/unit/crypto.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// apps/api/tests/unit/crypto.test.ts
import { describe, it, expect, beforeAll } from "vitest";
import { encryptSecret, decryptSecret } from "../../src/lib/crypto.js";

describe("crypto helpers", () => {
  beforeAll(() => {
    process.env.SECRET_ENCRYPTION_KEY = "0".repeat(64); // 32 bytes hex
  });

  it("roundtrips a secret", () => {
    const enc = encryptSecret("super-secret-api-key");
    expect(enc).not.toContain("super-secret");
    const dec = decryptSecret(enc);
    expect(dec).toBe("super-secret-api-key");
  });

  it("produces different ciphertext for same plaintext (random IV)", () => {
    const a = encryptSecret("hello");
    const b = encryptSecret("hello");
    expect(a).not.toBe(b);
    expect(decryptSecret(a)).toBe("hello");
    expect(decryptSecret(b)).toBe("hello");
  });
});
```

- [ ] **Step 2: Run and confirm failure**

Run: `pnpm --filter api test -- crypto.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement crypto.ts**

```typescript
// apps/api/src/lib/crypto.ts
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const ALGO = "aes-256-gcm";

function getKey(): Buffer {
  const hex = process.env.SECRET_ENCRYPTION_KEY;
  if (!hex || hex.length !== 64) {
    throw new Error("SECRET_ENCRYPTION_KEY must be 64 hex chars (32 bytes)");
  }
  return Buffer.from(hex, "hex");
}

export function encryptSecret(plaintext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGO, getKey(), iv);
  const ct = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv, tag, ct].map((b) => b.toString("base64")).join(".");
}

export function decryptSecret(payload: string): string {
  const [ivB64, tagB64, ctB64] = payload.split(".");
  if (!ivB64 || !tagB64 || !ctB64) throw new Error("invalid ciphertext");
  const iv = Buffer.from(ivB64, "base64");
  const tag = Buffer.from(tagB64, "base64");
  const ct = Buffer.from(ctB64, "base64");
  const decipher = createDecipheriv(ALGO, getKey(), iv);
  decipher.setAuthTag(tag);
  const pt = Buffer.concat([decipher.update(ct), decipher.final()]);
  return pt.toString("utf8");
}
```

- [ ] **Step 4: Run test to verify PASS**

Run: `pnpm --filter api test -- crypto.test.ts`
Expected: 2 passed.

- [ ] **Step 5: Add SECRET_ENCRYPTION_KEY to .env**

Append to `.env`:
```
SECRET_ENCRYPTION_KEY=<generate with: openssl rand -hex 32>
```

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/lib/crypto.ts apps/api/tests/unit/crypto.test.ts
git commit -m "feat(api): add AES-256-GCM encrypt/decrypt helpers for API-key storage"
```

---

## Task 3: Database schema — external_integrations

**Files:**
- Create: `apps/api/src/db/schema/external-integrations.ts`
- Modify: `apps/api/src/db/schema/index.ts`

- [ ] **Step 1: Write the schema**

```typescript
// apps/api/src/db/schema/external-integrations.ts
import {
  pgTable, uuid, text, boolean, timestamp, varchar, jsonb, unique,
} from "drizzle-orm/pg-core";
import { tenantRlsPolicies } from "./rls-helpers.js";

export const externalIntegrations = pgTable(
  "external_integrations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id").notNull(),
    provider: varchar("provider", { length: 40 }).notNull(),  // 'fleks_v2' | 'twilio'
    apiKeyEncrypted: text("api_key_encrypted"),
    apiBaseUrl: text("api_base_url"),
    additionalConfig: jsonb("additional_config").default({}),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at"),
  },
  (t) => ({
    uniqueProviderPerOrg: unique().on(t.organizationId, t.provider),
    ...tenantRlsPolicies("external_integrations"),
  }),
).enableRLS();
```

- [ ] **Step 2: Re-export from schema/index.ts**

Append to `apps/api/src/db/schema/index.ts`:
```typescript
export * from "./external-integrations.js";
```

- [ ] **Step 3: Push to dev DB**

Run: `cd /Users/bartwilbrink/recruitment-os/.worktrees/fleks-intake && DATABASE_URL="postgresql://postgres:dev_password@localhost:5433/recruitment_os_dev" pnpm --filter api exec drizzle-kit push`
Expected: applied successfully.

- [ ] **Step 4: Verify table + RLS**

Run: `PGPASSWORD=dev_password psql -h localhost -p 5433 -U postgres -d recruitment_os_dev -c "\d external_integrations"`
Expected: table listed with 8 columns + RLS enabled row at bottom.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/db/schema/external-integrations.ts apps/api/src/db/schema/index.ts
git commit -m "feat(db): add external_integrations table"
```

---

## Task 4: Database schema — intake + fleks-sync tables + vacancies/candidates alters

**Files:**
- Create: `apps/api/src/db/schema/intake.ts`
- Create: `apps/api/src/db/schema/fleks-sync.ts`
- Modify: `apps/api/src/db/schema/vacancies.ts`
- Modify: `apps/api/src/db/schema/candidates.ts`
- Modify: `apps/api/src/db/schema/index.ts`

- [ ] **Step 1: Write intake.ts**

```typescript
// apps/api/src/db/schema/intake.ts
import {
  pgTable, uuid, text, boolean, timestamp, varchar, jsonb, integer, unique,
} from "drizzle-orm/pg-core";
import { tenantRlsPolicies } from "./rls-helpers.js";
import { candidateApplications } from "./applications.js";

export const intakeSessions = pgTable(
  "intake_sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id").notNull(),
    applicationId: uuid("application_id").notNull().unique()
      .references(() => candidateApplications.id, { onDelete: "cascade" }),
    state: varchar("state", { length: 30 }).notNull(),
    verdict: varchar("verdict", { length: 20 }),
    verdictReason: text("verdict_reason"),
    mustHaveAnswers: jsonb("must_have_answers").default({}).notNull(),
    niceToHaveAnswers: jsonb("nice_to_have_answers").default({}).notNull(),
    stuckCounter: jsonb("stuck_counter").default({}).notNull(),
    claudeThreadId: text("claude_thread_id"),
    lastInboundAt: timestamp("last_inbound_at"),
    lastOutboundAt: timestamp("last_outbound_at"),
    reminderCount: integer("reminder_count").default(0).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    completedAt: timestamp("completed_at"),
  },
  () => tenantRlsPolicies("intake_sessions"),
).enableRLS();

export const intakeMessages = pgTable(
  "intake_messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id").notNull(),
    sessionId: uuid("session_id").notNull()
      .references(() => intakeSessions.id, { onDelete: "cascade" }),
    direction: varchar("direction", { length: 10 }).notNull(),
    body: text("body").notNull(),
    twilioSid: text("twilio_sid"),
    isFromBot: boolean("is_from_bot").notNull().default(true),
    toolCalls: jsonb("tool_calls"),
    sentAt: timestamp("sent_at").defaultNow().notNull(),
  },
  () => tenantRlsPolicies("intake_messages"),
).enableRLS();

export const intakeTemplates = pgTable(
  "intake_templates",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id").notNull(),
    variant: varchar("variant", { length: 30 }).notNull(),
    locale: varchar("locale", { length: 5 }).notNull().default("nl"),
    name: text("name").notNull(),
    body: text("body").notNull(),
    isActive: boolean("is_active").notNull().default(true),
    wabaStatus: varchar("waba_status", { length: 20 }).default("sandbox").notNull(),
    wabaContentSid: text("waba_content_sid"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at"),
  },
  (t) => ({
    uniqueVariantLocale: unique().on(t.organizationId, t.variant, t.locale),
    ...tenantRlsPolicies("intake_templates"),
  }),
).enableRLS();
```

- [ ] **Step 2: Write fleks-sync.ts**

```typescript
// apps/api/src/db/schema/fleks-sync.ts
import {
  pgTable, uuid, text, timestamp, varchar, jsonb, primaryKey,
} from "drizzle-orm/pg-core";
import { tenantRlsPolicies } from "./rls-helpers.js";

export const fleksSyncCursors = pgTable(
  "fleks_sync_cursors",
  {
    organizationId: uuid("organization_id").notNull(),
    entityType: varchar("entity_type", { length: 30 }).notNull(),
    lastUpdatedAt: timestamp("last_updated_at"),
    lastSeenIds: jsonb("last_seen_ids").default([]).notNull(),
    lastSyncAt: timestamp("last_sync_at"),
    lastErrorAt: timestamp("last_error_at"),
    lastError: text("last_error"),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.organizationId, t.entityType] }),
    ...tenantRlsPolicies("fleks_sync_cursors"),
  }),
).enableRLS();
```

- [ ] **Step 3: Alter vacancies schema**

Read `apps/api/src/db/schema/vacancies.ts` first to find the correct insertion point. In the column list, add these columns after existing ones (before the closing `}`):

```typescript
    intakeEnabled: boolean("intake_enabled").notNull().default(false),
    fleksJobUuid: text("fleks_job_uuid"),
```

And add import for `boolean` if not already present.

- [ ] **Step 4: Alter candidates schema**

Read `apps/api/src/db/schema/candidates.ts`. Add this column before the closing `}`:

```typescript
    fleksEmployeeUuid: text("fleks_employee_uuid"),
```

- [ ] **Step 5: Re-export from schema/index.ts**

Append to `apps/api/src/db/schema/index.ts`:
```typescript
export * from "./intake.js";
export * from "./fleks-sync.js";
```

- [ ] **Step 6: Push + verify**

Run: `DATABASE_URL="postgresql://postgres:dev_password@localhost:5433/recruitment_os_dev" pnpm --filter api exec drizzle-kit push`
Expected: applied successfully.

Run: `PGPASSWORD=dev_password psql -h localhost -p 5433 -U postgres -d recruitment_os_dev -c "\dt" | grep -E "intake_|fleks_sync"`
Expected: 4 new tables visible.

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/db/schema/intake.ts apps/api/src/db/schema/fleks-sync.ts apps/api/src/db/schema/vacancies.ts apps/api/src/db/schema/candidates.ts apps/api/src/db/schema/index.ts
git commit -m "feat(db): add intake_sessions, intake_messages, intake_templates, fleks_sync_cursors + vacancy/candidate columns"
```

---

## Task 5: Seed default pipeline stages + intake templates

**Files:**
- Modify: `apps/api/src/db/seed/index.ts`
- Create: `apps/api/src/db/seed/intake-templates.ts`

- [ ] **Step 1: Write intake-templates.ts with default bodies**

```typescript
// apps/api/src/db/seed/intake-templates.ts
export const DEFAULT_INTAKE_TEMPLATES = [
  {
    variant: "first_contact",
    locale: "nl",
    name: "Eerste bericht",
    body: "Hoi {{candidate.first_name}}! Je hebt gesolliciteerd bij {{client.name}} voor de functie {{vacancy.title}}. Ik ben de intake-assistent van {{tenant.name}}. Mag ik je een paar vragen stellen zodat we kunnen kijken of er een match is?",
  },
  {
    variant: "reminder_24h",
    locale: "nl",
    name: "Herinnering 24u",
    body: "Hoi {{candidate.first_name}}, ik zag dat je nog niet gereageerd hebt. Wil je nog antwoorden op de vacature {{vacancy.title}}?",
  },
  {
    variant: "reminder_72h",
    locale: "nl",
    name: "Herinnering 72u",
    body: "{{candidate.first_name}}, laatste kans om te reageren op de vacature {{vacancy.title}}. Reageer je niet, dan sluiten we het sollicitatie-dossier.",
  },
  {
    variant: "no_response_farewell",
    locale: "nl",
    name: "Afscheidsbericht",
    body: "Jammer dat we niks meer van je horen. De sollicitatie is gesloten. Je kunt altijd later opnieuw reageren via {{client.name}}.",
  },
] as const;
```

- [ ] **Step 2: Extend db/seed/index.ts**

Read `apps/api/src/db/seed/index.ts` to find where organizations + pipeline_stages are seeded. After the organization is created, add:

```typescript
import { DEFAULT_INTAKE_TEMPLATES } from "./intake-templates.js";
import { intakeTemplates, pipelineStages } from "../schema/index.js";

// ... within the seeding function, after `Created organization` block:

// Seed default intake templates
for (const tmpl of DEFAULT_INTAKE_TEMPLATES) {
  await db.insert(intakeTemplates).values({
    organizationId: orgId,
    variant: tmpl.variant,
    locale: tmpl.locale,
    name: tmpl.name,
    body: tmpl.body,
  }).onConflictDoNothing();
}
console.log("  Seeded 4 default intake templates");

// Add 3 new pipeline stages: fleks_intake (sortOrder -1), qualified, rejected_by_bot
const NEW_STAGES = [
  { slug: "fleks_intake", name: "Fleks Intake", sortOrder: -1, isDefault: false },
  { slug: "qualified", name: "Qualified", sortOrder: 15, isDefault: false },
  { slug: "rejected_by_bot", name: "Rejected by Bot", sortOrder: 99, isDefault: false },
];
for (const s of NEW_STAGES) {
  await db.insert(pipelineStages).values({
    organizationId: orgId,
    slug: s.slug,
    name: s.name,
    sortOrder: s.sortOrder,
    isDefault: s.isDefault,
  }).onConflictDoNothing();
}
console.log("  Seeded 3 new pipeline stages for intake flow");
```

NOTE: adjust `sortOrder` values to fit existing numbering in the current seed file — read the file to see where "New"/"Qualification" etc. are, and place `fleks_intake` before "New", `qualified` after "Screening" or similar.

- [ ] **Step 3: Re-seed**

Run: `pnpm --filter api db:seed`
Expected: new log lines "Seeded 4 default intake templates" + "Seeded 3 new pipeline stages".

- [ ] **Step 4: Verify**

```bash
PGPASSWORD=dev_password psql -h localhost -p 5433 -U postgres -d recruitment_os_dev -c "SELECT variant, name FROM intake_templates ORDER BY variant;"
PGPASSWORD=dev_password psql -h localhost -p 5433 -U postgres -d recruitment_os_dev -c "SELECT slug, name, sort_order FROM pipeline_stages ORDER BY sort_order;"
```
Expected: 4 templates + new stages present.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/db/seed/intake-templates.ts apps/api/src/db/seed/index.ts
git commit -m "feat(db): seed default intake templates + fleks_intake/qualified/rejected_by_bot stages"
```

---

## Task 6: Fleks V2 HTTP client

**Files:**
- Create: `apps/api/src/modules/intake/fleks/client.ts`
- Create: `apps/api/tests/unit/fleks-client.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// apps/api/tests/unit/fleks-client.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createFleksClient } from "../../src/modules/intake/fleks/client.js";

describe("FleksClient", () => {
  const fetchSpy = vi.spyOn(globalThis, "fetch");

  beforeEach(() => fetchSpy.mockReset());
  afterEach(() => vi.clearAllMocks());

  it("sends X-API-Key header and returns parsed data", async () => {
    fetchSpy.mockResolvedValue(new Response(
      JSON.stringify({ data: [{ uuid: "j1", functionName: "Test" }], page: 1, limit: 10 }),
      { status: 200, headers: { "content-type": "application/json" } },
    ));
    const client = createFleksClient({ apiKey: "test-key", baseUrl: "https://fleks.test" });
    const res = await client.listJobs({ updatedAtMin: "2026-01-01T00:00:00Z" });
    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringContaining("https://fleks.test/api/v2/jobs/"),
      expect.objectContaining({
        headers: expect.objectContaining({ "X-API-Key": "test-key" }),
      }),
    );
    expect(res.data).toHaveLength(1);
    expect(res.data[0].uuid).toBe("j1");
  });

  it("retries on 429 with backoff then succeeds", async () => {
    fetchSpy
      .mockResolvedValueOnce(new Response("", { status: 429 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: [], page: 1, limit: 10 })));
    const client = createFleksClient({ apiKey: "k", baseUrl: "https://fleks.test", retryDelayMs: 10 });
    const res = await client.listJobs({});
    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(res.data).toEqual([]);
  });

  it("throws after 3 consecutive 5xx", async () => {
    fetchSpy.mockResolvedValue(new Response("", { status: 503 }));
    const client = createFleksClient({ apiKey: "k", baseUrl: "https://fleks.test", retryDelayMs: 1 });
    await expect(client.listJobs({})).rejects.toThrow(/Fleks API error/i);
    expect(fetchSpy).toHaveBeenCalledTimes(3);
  });
});
```

- [ ] **Step 2: Run, confirm fail**

Run: `pnpm --filter api test -- fleks-client.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement client.ts**

```typescript
// apps/api/src/modules/intake/fleks/client.ts
import type {
  FleksJob, FleksJobCandidate, FleksEmployee, FleksPaginatedResponse,
} from "@recruitment-os/types";

export interface FleksClientConfig {
  apiKey: string;
  baseUrl: string;       // e.g. "https://api.external.fleks.works"
  retryDelayMs?: number; // default 2000
  maxRetries?: number;   // default 3
}

export interface ListJobsParams {
  updatedAtMin?: string;
  isArchived?: boolean;
  page?: number;
  limit?: number;
}

export interface ListJobCandidatesParams {
  jobUUID: string;
  isQualified?: boolean;
  isInvited?: boolean;
  hasActiveContract?: boolean;
  updatedAtMin?: string;
  page?: number;
  limit?: number;
}

export interface FleksClient {
  listJobs(p: ListJobsParams): Promise<FleksPaginatedResponse<FleksJob>>;
  listJobCandidates(p: ListJobCandidatesParams): Promise<FleksPaginatedResponse<FleksJobCandidate>>;
  getEmployee(uuid: string): Promise<FleksEmployee | null>;
  updateEmployee(uuid: string, patch: Record<string, unknown>): Promise<void>;
}

export function createFleksClient(cfg: FleksClientConfig): FleksClient {
  const retryDelayMs = cfg.retryDelayMs ?? 2000;
  const maxRetries = cfg.maxRetries ?? 3;

  async function request<T>(path: string, init?: RequestInit): Promise<T> {
    const url = `${cfg.baseUrl}${path}`;
    let lastErr: unknown;
    for (let i = 0; i < maxRetries; i++) {
      const res = await fetch(url, {
        ...init,
        headers: {
          "X-API-Key": cfg.apiKey,
          "Content-Type": "application/json",
          ...(init?.headers ?? {}),
        },
      });
      if (res.ok) {
        if (res.status === 204) return null as T;
        return (await res.json()) as T;
      }
      if (res.status === 429 || res.status >= 500) {
        lastErr = new Error(`Fleks API error ${res.status}`);
        await new Promise((r) => setTimeout(r, retryDelayMs * (i + 1)));
        continue;
      }
      throw new Error(`Fleks API error ${res.status}: ${await res.text()}`);
    }
    throw lastErr ?? new Error("Fleks API error: retries exhausted");
  }

  function qs(params: Record<string, unknown>): string {
    const parts: string[] = [];
    for (const [k, v] of Object.entries(params)) {
      if (v === undefined || v === null) continue;
      if (Array.isArray(v)) v.forEach((x) => parts.push(`${encodeURIComponent(k)}=${encodeURIComponent(String(x))}`));
      else parts.push(`${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`);
    }
    return parts.length ? "?" + parts.join("&") : "";
  }

  return {
    listJobs: (p) =>
      request<FleksPaginatedResponse<FleksJob>>(`/api/v2/jobs/${qs(p)}`),
    listJobCandidates: (p) =>
      request<FleksPaginatedResponse<FleksJobCandidate>>(`/api/v2/employees/job-candidates${qs(p)}`),
    getEmployee: async (uuid) => {
      const res = await request<FleksPaginatedResponse<FleksEmployee>>(
        `/api/v2/employees/${qs({ UUIDs: [uuid], limit: 1 })}`,
      );
      return res.data[0] ?? null;
    },
    updateEmployee: async (uuid, patch) => {
      await request<void>(`/api/v2/employees/`, {
        method: "PUT",
        body: JSON.stringify([{ uuid, ...patch }]),
      });
    },
  };
}
```

- [ ] **Step 4: Run test — PASS**

Run: `pnpm --filter api test -- fleks-client.test.ts`
Expected: 3 passed.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/intake/fleks/client.ts apps/api/tests/unit/fleks-client.test.ts
git commit -m "feat(api): add Fleks V2 HTTP client with retry + pagination helpers"
```

---

## Task 7: FleksSyncService — dedup + upsert

**Files:**
- Create: `apps/api/src/modules/intake/fleks/sync.service.ts`
- Create: `apps/api/tests/unit/fleks-sync.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// apps/api/tests/unit/fleks-sync.test.ts
import { describe, it, expect, vi } from "vitest";
import { syncTick } from "../../src/modules/intake/fleks/sync.service.js";
import type { FleksClient } from "../../src/modules/intake/fleks/client.js";

describe("FleksSyncService.syncTick", () => {
  const makeDeps = () => {
    const client: Partial<FleksClient> = {
      listJobs: vi.fn().mockResolvedValue({ data: [], page: 1, limit: 100 }),
      listJobCandidates: vi.fn().mockResolvedValue({ data: [], page: 1, limit: 100 }),
      getEmployee: vi.fn(),
    };
    const storage = {
      loadCursor: vi.fn().mockResolvedValue(null),
      saveCursor: vi.fn().mockResolvedValue(undefined),
      upsertVacancyFromFleks: vi.fn().mockResolvedValue({ id: "v1", intakeEnabled: true }),
      findActiveIntakeVacancies: vi.fn().mockResolvedValue([
        { id: "v1", fleksJobUuid: "job1" },
      ]),
      isCandidateKnown: vi.fn().mockResolvedValue(false),
      createCandidateAndSession: vi.fn().mockResolvedValue({ sessionId: "s1" }),
    };
    const enqueue = vi.fn().mockResolvedValue(undefined);
    return { client: client as FleksClient, storage, enqueue };
  };

  it("creates candidate + session for new Fleks job-candidate", async () => {
    const { client, storage, enqueue } = makeDeps();
    (client.listJobCandidates as any).mockResolvedValue({
      data: [{ uuid: "emp1", jobUUID: "job1", firstName: "A", lastName: "B", phoneNumber: "+31600000001" }],
      page: 1, limit: 100,
    });
    await syncTick({ orgId: "org1", client, storage, enqueue });
    expect(storage.createCandidateAndSession).toHaveBeenCalledOnce();
    expect(enqueue).toHaveBeenCalledWith("intake.start", { sessionId: "s1" });
  });

  it("skips known candidates (idempotent)", async () => {
    const { client, storage, enqueue } = makeDeps();
    (client.listJobCandidates as any).mockResolvedValue({
      data: [{ uuid: "emp1", jobUUID: "job1", firstName: "A", lastName: "B" }],
      page: 1, limit: 100,
    });
    (storage.isCandidateKnown as any).mockResolvedValue(true);
    await syncTick({ orgId: "org1", client, storage, enqueue });
    expect(storage.createCandidateAndSession).not.toHaveBeenCalled();
    expect(enqueue).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run, confirm fail**

Run: `pnpm --filter api test -- fleks-sync.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement sync.service.ts**

```typescript
// apps/api/src/modules/intake/fleks/sync.service.ts
import type { FleksClient } from "./client.js";
import type { FleksJobCandidate } from "@recruitment-os/types";

export interface SyncStorage {
  loadCursor(orgId: string, entity: string): Promise<string | null>;
  saveCursor(orgId: string, entity: string, cursor: string, seenIds?: string[]): Promise<void>;
  upsertVacancyFromFleks(orgId: string, job: { uuid: string; functionName: string; functionDescription: string | null }): Promise<{ id: string; intakeEnabled: boolean }>;
  findActiveIntakeVacancies(orgId: string): Promise<Array<{ id: string; fleksJobUuid: string }>>;
  isCandidateKnown(orgId: string, fleksEmployeeUuid: string): Promise<boolean>;
  createCandidateAndSession(orgId: string, input: {
    vacancyId: string;
    fleksEmployee: FleksJobCandidate;
  }): Promise<{ sessionId: string }>;
}

export type EnqueueFn = (jobName: string, payload: Record<string, unknown>) => Promise<void>;

export interface SyncTickDeps {
  orgId: string;
  client: FleksClient;
  storage: SyncStorage;
  enqueue: EnqueueFn;
}

export async function syncTick(deps: SyncTickDeps): Promise<{
  vacanciesProcessed: number;
  newCandidates: number;
}> {
  const { orgId, client, storage, enqueue } = deps;

  // 1. Sync jobs (update vacancies that have fleksJobUuid)
  const jobsCursor = await storage.loadCursor(orgId, "jobs");
  const jobsResp = await client.listJobs({
    isArchived: false,
    updatedAtMin: jobsCursor ?? undefined,
    limit: 100,
  });
  for (const job of jobsResp.data) {
    await storage.upsertVacancyFromFleks(orgId, {
      uuid: job.uuid,
      functionName: job.functionName,
      functionDescription: job.functionDescription,
    });
  }
  await storage.saveCursor(orgId, "jobs", new Date().toISOString());

  // 2. Per active-intake vacancy, fetch job-candidates
  const activeVacs = await storage.findActiveIntakeVacancies(orgId);
  let newCandidates = 0;
  for (const vac of activeVacs) {
    const resp = await client.listJobCandidates({
      jobUUID: vac.fleksJobUuid,
      isQualified: true,
      isInvited: false,
      hasActiveContract: false,
      limit: 100,
    });
    for (const cand of resp.data) {
      const known = await storage.isCandidateKnown(orgId, cand.uuid);
      if (known) continue;
      const { sessionId } = await storage.createCandidateAndSession(orgId, {
        vacancyId: vac.id,
        fleksEmployee: cand,
      });
      await enqueue("intake.start", { sessionId });
      newCandidates += 1;
    }
  }
  await storage.saveCursor(orgId, "job_candidates", new Date().toISOString());

  return { vacanciesProcessed: activeVacs.length, newCandidates };
}
```

- [ ] **Step 4: Run test — PASS**

Run: `pnpm --filter api test -- fleks-sync.test.ts`
Expected: 2 passed.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/intake/fleks/sync.service.ts apps/api/tests/unit/fleks-sync.test.ts
git commit -m "feat(api): add FleksSyncService with dedup + upsert logic"
```

---

## Task 8: FleksSyncStorage (Drizzle-backed implementation)

**Files:**
- Create: `apps/api/src/modules/intake/fleks/sync-storage.ts`

- [ ] **Step 1: Implement storage**

```typescript
// apps/api/src/modules/intake/fleks/sync-storage.ts
import { eq, and } from "drizzle-orm";
import { withTenantContext } from "../../../lib/with-tenant-context.js";
import {
  vacancies, candidates, candidateApplications, pipelineStages,
  fleksSyncCursors, intakeSessions,
} from "../../../db/schema/index.js";
import type { SyncStorage } from "./sync.service.js";
import type { FleksJobCandidate } from "@recruitment-os/types";

export function createSyncStorage(): SyncStorage {
  return {
    async loadCursor(orgId, entity) {
      return withTenantContext(orgId, async (tx) => {
        const [row] = await tx
          .select()
          .from(fleksSyncCursors)
          .where(
            and(
              eq(fleksSyncCursors.organizationId, orgId),
              eq(fleksSyncCursors.entityType, entity),
            ),
          )
          .limit(1);
        return row?.lastUpdatedAt ? row.lastUpdatedAt.toISOString() : null;
      });
    },

    async saveCursor(orgId, entity, cursor, seenIds) {
      await withTenantContext(orgId, async (tx) => {
        await tx
          .insert(fleksSyncCursors)
          .values({
            organizationId: orgId,
            entityType: entity,
            lastUpdatedAt: new Date(cursor),
            lastSyncAt: new Date(),
            lastSeenIds: seenIds ?? [],
          })
          .onConflictDoUpdate({
            target: [fleksSyncCursors.organizationId, fleksSyncCursors.entityType],
            set: {
              lastUpdatedAt: new Date(cursor),
              lastSyncAt: new Date(),
              lastSeenIds: seenIds ?? [],
            },
          });
      });
    },

    async upsertVacancyFromFleks(orgId, job) {
      return withTenantContext(orgId, async (tx) => {
        const [existing] = await tx
          .select({ id: vacancies.id, intakeEnabled: vacancies.intakeEnabled })
          .from(vacancies)
          .where(
            and(
              eq(vacancies.organizationId, orgId),
              eq(vacancies.fleksJobUuid, job.uuid),
            ),
          )
          .limit(1);
        if (existing) return { id: existing.id, intakeEnabled: existing.intakeEnabled ?? false };
        const [created] = await tx
          .insert(vacancies)
          .values({
            organizationId: orgId,
            title: job.functionName,
            description: job.functionDescription ?? "",
            fleksJobUuid: job.uuid,
            status: "active",
            intakeEnabled: false,
            ownerId: "00000000-0000-0000-0000-000000000000",
          } as never)
          .returning({ id: vacancies.id, intakeEnabled: vacancies.intakeEnabled });
        return { id: created.id, intakeEnabled: created.intakeEnabled ?? false };
      });
    },

    async findActiveIntakeVacancies(orgId) {
      return withTenantContext(orgId, async (tx) => {
        const rows = await tx
          .select({ id: vacancies.id, fleksJobUuid: vacancies.fleksJobUuid })
          .from(vacancies)
          .where(
            and(
              eq(vacancies.organizationId, orgId),
              eq(vacancies.intakeEnabled, true),
              eq(vacancies.status, "active"),
            ),
          );
        return rows
          .filter((r): r is { id: string; fleksJobUuid: string } => r.fleksJobUuid !== null);
      });
    },

    async isCandidateKnown(orgId, fleksEmployeeUuid) {
      return withTenantContext(orgId, async (tx) => {
        const [row] = await tx
          .select({ id: candidates.id })
          .from(candidates)
          .where(
            and(
              eq(candidates.organizationId, orgId),
              eq(candidates.fleksEmployeeUuid, fleksEmployeeUuid),
            ),
          )
          .limit(1);
        return !!row;
      });
    },

    async createCandidateAndSession(orgId, { vacancyId, fleksEmployee }) {
      return withTenantContext(orgId, async (tx) => {
        // Insert candidate
        const [cand] = await tx
          .insert(candidates)
          .values({
            organizationId: orgId,
            firstName: fleksEmployee.firstName,
            lastName: fleksEmployee.lastName,
            email: fleksEmployee.email ?? null,
            phone: fleksEmployee.phoneNumber ?? null,
            fleksEmployeeUuid: fleksEmployee.uuid,
          } as never)
          .returning({ id: candidates.id });

        // Find fleks_intake stage
        const [stage] = await tx
          .select({ id: pipelineStages.id })
          .from(pipelineStages)
          .where(
            and(
              eq(pipelineStages.organizationId, orgId),
              eq(pipelineStages.slug, "fleks_intake"),
            ),
          )
          .limit(1);
        if (!stage) throw new Error("fleks_intake stage missing — run seed");

        // Insert application in fleks_intake stage
        const [app] = await tx
          .insert(candidateApplications)
          .values({
            organizationId: orgId,
            candidateId: cand.id,
            vacancyId,
            currentStageId: stage.id,
            qualificationStatus: "pending",
            sourceDetail: "fleks_v2",
          } as never)
          .returning({ id: candidateApplications.id });

        // Insert intake session
        const [session] = await tx
          .insert(intakeSessions)
          .values({
            organizationId: orgId,
            applicationId: app.id,
            state: "awaiting_first_reply",
          })
          .returning({ id: intakeSessions.id });

        return { sessionId: session.id };
      });
    },
  };
}
```

- [ ] **Step 2: Typecheck**

Run: `cd apps/api && npx tsc --noEmit 2>&1 | grep -E "sync-storage|intake/" | head -20`
Expected: no errors specific to these files.

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/modules/intake/fleks/sync-storage.ts
git commit -m "feat(api): add Drizzle-backed FleksSyncStorage implementation"
```

---

## Task 9: pg-boss job — fleks.sync-tick

**Files:**
- Create: `apps/api/src/jobs/fleks-sync.job.ts`
- Modify: `apps/api/src/jobs/index.ts` (or equivalent bootstrap — find the current pg-boss registration location)

- [ ] **Step 1: Find the existing pg-boss bootstrap**

Run: `grep -rn "boss.schedule\|boss.send\|pg-boss\|getJobQueue" apps/api/src/ | grep -v test | head -20`
Expected: existing pattern for job registration.

- [ ] **Step 2: Implement fleks-sync.job.ts**

```typescript
// apps/api/src/jobs/fleks-sync.job.ts
import { getJobQueue } from "../lib/job-queue.js";
import { createFleksClient } from "../modules/intake/fleks/client.js";
import { createSyncStorage } from "../modules/intake/fleks/sync-storage.js";
import { syncTick } from "../modules/intake/fleks/sync.service.js";
import { eq } from "drizzle-orm";
import { db } from "../db/index.js";
import { externalIntegrations } from "../db/schema/index.js";
import { decryptSecret } from "../lib/crypto.js";

const JOB_NAME = "fleks.sync-tick";

export async function registerFleksSyncJob() {
  const boss = getJobQueue();

  await boss.work(JOB_NAME, async (jobs) => {
    for (const job of jobs) {
      const { orgId } = job.data as { orgId: string };
      try {
        // Load integration config for this org
        const [integ] = await db
          .select()
          .from(externalIntegrations)
          .where(eq(externalIntegrations.organizationId, orgId))
          .limit(1);
        if (!integ || !integ.apiKeyEncrypted || !integ.isActive) {
          console.log(`[fleks-sync] skip org ${orgId} — no active integration`);
          continue;
        }
        const apiKey = process.env.FLEKS_API_KEY ?? decryptSecret(integ.apiKeyEncrypted);
        const baseUrl = integ.apiBaseUrl ?? "https://api.external.fleks.works";
        const client = createFleksClient({ apiKey, baseUrl });
        const storage = createSyncStorage();
        const result = await syncTick({
          orgId,
          client,
          storage,
          enqueue: async (name, payload) => {
            await getJobQueue().send(name, payload);
          },
        });
        console.log(`[fleks-sync] org ${orgId}:`, result);
      } catch (err) {
        console.error(`[fleks-sync] org ${orgId} failed:`, err);
        throw err;
      }
    }
  });

  // Schedule: every 5 minutes, one job per org with an active integration
  await boss.schedule("fleks.sync-scheduler", "*/5 * * * *", {});
  await boss.work("fleks.sync-scheduler", async () => {
    const rows = await db
      .select({ organizationId: externalIntegrations.organizationId })
      .from(externalIntegrations)
      .where(eq(externalIntegrations.isActive, true));
    const orgIds = [...new Set(rows.map((r) => r.organizationId))];
    for (const orgId of orgIds) {
      await boss.send(JOB_NAME, { orgId });
    }
  });

  console.log("[jobs] registered fleks.sync-tick + fleks.sync-scheduler");
}
```

- [ ] **Step 3: Wire into bootstrap**

In the file you found in Step 1 (e.g. `apps/api/src/index.ts` or `apps/api/src/jobs/index.ts`), add:

```typescript
import { registerFleksSyncJob } from "./jobs/fleks-sync.job.js";

// ... where other jobs are registered:
if (process.env.JOBS_ENABLED === "true") {
  await registerFleksSyncJob();
}
```

- [ ] **Step 4: Manual smoke test**

Start API: `JOBS_ENABLED=true pnpm --filter api dev`
Expected log: `[jobs] registered fleks.sync-tick + fleks.sync-scheduler`.

Trigger a sync manually via sql:
```sql
INSERT INTO pgboss.job (name, data) VALUES ('fleks.sync-tick', '{"orgId":"10000000-0000-0000-0000-000000000001"}');
```
Watch server logs for `[fleks-sync] org ... : { vacanciesProcessed: N, newCandidates: N }`.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/jobs/fleks-sync.job.ts
# also any bootstrap file you modified
git commit -m "feat(api): register fleks.sync-tick + fleks.sync-scheduler pg-boss jobs"
```

---

## Task 10: WhatsApp gateway interface + Twilio sandbox impl

**Files:**
- Create: `apps/api/src/modules/intake/whatsapp/gateway.ts`
- Create: `apps/api/src/modules/intake/whatsapp/twilio-sandbox.ts`
- Create: `apps/api/tests/unit/twilio-sandbox.test.ts`

- [ ] **Step 1: Write the interface**

```typescript
// apps/api/src/modules/intake/whatsapp/gateway.ts
export interface WhatsAppSendInput {
  toPhone: string;            // E.164, e.g. "+31600000001"
  body: string;
  templateSid?: string;       // WABA-mode only
  templateVariables?: Record<string, string>;
}

export interface WhatsAppSendResult {
  messageSid: string;
  status: "queued" | "sent";
}

export interface WhatsAppInboundParsed {
  fromPhone: string;
  messageSid: string;
  body: string;
  mediaUrls: string[];
}

export interface WhatsAppGateway {
  send(input: WhatsAppSendInput): Promise<WhatsAppSendResult>;
  verifyWebhook(signature: string, url: string, params: Record<string, string>): boolean;
  parseWebhook(params: Record<string, string>): WhatsAppInboundParsed;
  isWithin24hWindow(phone: string, orgId: string): Promise<boolean>;
}
```

- [ ] **Step 2: Write the failing test**

```typescript
// apps/api/tests/unit/twilio-sandbox.test.ts
import { describe, it, expect, vi } from "vitest";
import { createTwilioSandboxGateway } from "../../src/modules/intake/whatsapp/twilio-sandbox.js";

describe("TwilioSandboxGateway", () => {
  it("parses inbound webhook params", () => {
    const gw = createTwilioSandboxGateway({
      accountSid: "AC...", authToken: "tok", fromNumber: "whatsapp:+14155238886",
    });
    const parsed = gw.parseWebhook({
      From: "whatsapp:+31600000001",
      MessageSid: "SM123",
      Body: "hoi",
      NumMedia: "0",
    });
    expect(parsed).toEqual({
      fromPhone: "+31600000001",
      messageSid: "SM123",
      body: "hoi",
      mediaUrls: [],
    });
  });

  it("sends outbound via Twilio API", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ sid: "SM999", status: "queued" }), { status: 201 })
    );
    const gw = createTwilioSandboxGateway({
      accountSid: "AC123", authToken: "tok", fromNumber: "whatsapp:+14155238886",
    });
    const res = await gw.send({ toPhone: "+31600000001", body: "hello" });
    expect(res.messageSid).toBe("SM999");
    expect(fetchSpy).toHaveBeenCalledWith(
      "https://api.twilio.com/2010-04-01/Accounts/AC123/Messages.json",
      expect.objectContaining({ method: "POST" }),
    );
    fetchSpy.mockRestore();
  });
});
```

- [ ] **Step 3: Run, confirm fail**

Run: `pnpm --filter api test -- twilio-sandbox.test.ts`
Expected: FAIL.

- [ ] **Step 4: Implement twilio-sandbox.ts**

```typescript
// apps/api/src/modules/intake/whatsapp/twilio-sandbox.ts
import { createHmac } from "node:crypto";
import type { WhatsAppGateway } from "./gateway.js";

export interface TwilioSandboxConfig {
  accountSid: string;
  authToken: string;
  fromNumber: string;   // e.g. "whatsapp:+14155238886"
}

export function createTwilioSandboxGateway(cfg: TwilioSandboxConfig): WhatsAppGateway {
  function stripWhatsAppPrefix(s: string): string {
    return s.startsWith("whatsapp:") ? s.slice("whatsapp:".length) : s;
  }

  return {
    async send({ toPhone, body }) {
      const url = `https://api.twilio.com/2010-04-01/Accounts/${cfg.accountSid}/Messages.json`;
      const auth = Buffer.from(`${cfg.accountSid}:${cfg.authToken}`).toString("base64");
      const form = new URLSearchParams({
        From: cfg.fromNumber,
        To: `whatsapp:${toPhone}`,
        Body: body,
      });
      const res = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Basic ${auth}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: form.toString(),
      });
      if (!res.ok) throw new Error(`Twilio send failed: ${res.status} ${await res.text()}`);
      const json = (await res.json()) as { sid: string; status: string };
      return { messageSid: json.sid, status: (json.status === "queued" ? "queued" : "sent") };
    },

    verifyWebhook(signature, url, params) {
      // Twilio HMAC-SHA1 validation per https://www.twilio.com/docs/usage/webhooks/webhooks-security
      const sortedKeys = Object.keys(params).sort();
      const data = sortedKeys.reduce((acc, k) => acc + k + params[k], url);
      const expected = createHmac("sha1", cfg.authToken).update(data).digest("base64");
      return signature === expected;
    },

    parseWebhook(params) {
      const mediaCount = parseInt(params.NumMedia ?? "0", 10);
      const mediaUrls: string[] = [];
      for (let i = 0; i < mediaCount; i++) {
        const url = params[`MediaUrl${i}`];
        if (url) mediaUrls.push(url);
      }
      return {
        fromPhone: stripWhatsAppPrefix(params.From ?? ""),
        messageSid: params.MessageSid ?? "",
        body: params.Body ?? "",
        mediaUrls,
      };
    },

    async isWithin24hWindow(_phone, _orgId) {
      // Sandbox has no template restriction — always true.
      return true;
    },
  };
}
```

- [ ] **Step 5: Run test — PASS**

Run: `pnpm --filter api test -- twilio-sandbox.test.ts`
Expected: 2 passed.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/modules/intake/whatsapp/gateway.ts apps/api/src/modules/intake/whatsapp/twilio-sandbox.ts apps/api/tests/unit/twilio-sandbox.test.ts
git commit -m "feat(api): add WhatsApp gateway interface + Twilio sandbox impl"
```

---

## Task 11: Inbound WhatsApp webhook route

**Files:**
- Create: `apps/api/src/routes/whatsapp-webhook.routes.ts`
- Modify: `apps/api/src/index.ts`

- [ ] **Step 1: Implement route**

```typescript
// apps/api/src/routes/whatsapp-webhook.routes.ts
import { Hono } from "hono";
import { eq, and } from "drizzle-orm";
import type { AppEnv } from "../lib/app-env.js";
import { db } from "../db/index.js";
import {
  intakeSessions, intakeMessages, candidateApplications, candidates,
} from "../db/schema/index.js";
import { getJobQueue } from "../lib/job-queue.js";
import { createTwilioSandboxGateway } from "../modules/intake/whatsapp/twilio-sandbox.js";

export const whatsAppWebhookRoutes = new Hono<AppEnv>().post("/twilio", async (c) => {
  // Twilio sends form-encoded
  const raw = await c.req.text();
  const params = Object.fromEntries(new URLSearchParams(raw));
  const signature = c.req.header("X-Twilio-Signature") ?? "";
  const gw = createTwilioSandboxGateway({
    accountSid: process.env.TWILIO_ACCOUNT_SID!,
    authToken: process.env.TWILIO_AUTH_TOKEN!,
    fromNumber: process.env.TWILIO_WHATSAPP_FROM ?? "whatsapp:+14155238886",
  });
  const fullUrl = `${c.req.url}`;

  if (process.env.TWILIO_VERIFY_WEBHOOKS !== "false") {
    if (!gw.verifyWebhook(signature, fullUrl, params)) {
      console.warn("[twilio-webhook] signature mismatch");
      return c.text("bad signature", 403);
    }
  }

  const parsed = gw.parseWebhook(params);

  // Resolve session by inbound phone. Naive lookup across all tenants since
  // webhooks are unauthenticated; match via candidate.phone unique pair.
  const sessionRows = await db
    .select({
      sessionId: intakeSessions.id,
      organizationId: intakeSessions.organizationId,
    })
    .from(intakeSessions)
    .innerJoin(candidateApplications, eq(intakeSessions.applicationId, candidateApplications.id))
    .innerJoin(candidates, eq(candidateApplications.candidateId, candidates.id))
    .where(
      and(
        eq(candidates.phone, parsed.fromPhone),
        eq(intakeSessions.state, "awaiting_first_reply"),
      ),
    )
    .limit(1);

  let sessionRow = sessionRows[0];
  if (!sessionRow) {
    // Try in_progress sessions if no first-reply match
    const rows2 = await db
      .select({ sessionId: intakeSessions.id, organizationId: intakeSessions.organizationId })
      .from(intakeSessions)
      .innerJoin(candidateApplications, eq(intakeSessions.applicationId, candidateApplications.id))
      .innerJoin(candidates, eq(candidateApplications.candidateId, candidates.id))
      .where(
        and(
          eq(candidates.phone, parsed.fromPhone),
          eq(intakeSessions.state, "in_progress"),
        ),
      )
      .limit(1);
    sessionRow = rows2[0];
  }

  if (!sessionRow) {
    console.warn(`[twilio-webhook] no session for ${parsed.fromPhone}`);
    return c.text("no session", 200);
  }

  await db.insert(intakeMessages).values({
    organizationId: sessionRow.organizationId,
    sessionId: sessionRow.sessionId,
    direction: "inbound",
    body: parsed.body,
    twilioSid: parsed.messageSid,
    isFromBot: false,
  });

  await db
    .update(intakeSessions)
    .set({ lastInboundAt: new Date() })
    .where(eq(intakeSessions.id, sessionRow.sessionId));

  await getJobQueue().send("intake.process_message", { sessionId: sessionRow.sessionId });

  return c.text("ok", 200);
});
```

- [ ] **Step 2: Mount in index.ts**

Read `apps/api/src/index.ts`. Add import + route mount (webhooks should NOT go through auth middleware, place BEFORE the `/api/*` middleware block):

```typescript
import { whatsAppWebhookRoutes } from "./routes/whatsapp-webhook.routes.js";

// before authMiddleware mount:
app.route("/api/webhooks/whatsapp", whatsAppWebhookRoutes);
```

Also update the middleware bypass logic (if present) to allow `/api/webhooks/*`.

- [ ] **Step 3: Smoke test via curl**

Start dev server. Then:
```bash
curl -v -X POST "http://localhost:4000/api/webhooks/whatsapp/twilio" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "From=whatsapp:+31600000001&MessageSid=SMtest&Body=hoi&NumMedia=0"
```
Expected: 200 OK with "no session" (no seeded session for that phone yet).

Set `TWILIO_VERIFY_WEBHOOKS=false` in .env for local testing.

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/routes/whatsapp-webhook.routes.ts apps/api/src/index.ts
git commit -m "feat(api): add POST /api/webhooks/whatsapp/twilio inbound handler"
```

---

## Task 12: IntakeTemplateRenderer

**Files:**
- Create: `apps/api/src/modules/intake/templates/renderer.ts`
- Create: `apps/api/tests/unit/template-renderer.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// apps/api/tests/unit/template-renderer.test.ts
import { describe, it, expect } from "vitest";
import { renderTemplate } from "../../src/modules/intake/templates/renderer.js";

describe("renderTemplate", () => {
  it("substitutes simple merge fields", () => {
    const out = renderTemplate(
      "Hoi {{candidate.first_name}}, functie: {{vacancy.title}}",
      {
        candidate: { first_name: "Jan", full_name: "Jan de Vries" },
        vacancy: { title: "CE Chauffeur", location: "Utrecht", start_date: null },
        client: { name: "Timmers" },
        tenant: { name: "Demo Agency" },
        recruiter: { name: "Anna", phone: "+31600000002" },
      },
    );
    expect(out).toBe("Hoi Jan, functie: CE Chauffeur");
  });

  it("renders missing fields as empty string", () => {
    const out = renderTemplate("Hi {{candidate.first_name}}{{unknown.field}}", {
      candidate: { first_name: "Sam", full_name: "Sam X" },
      vacancy: { title: "T", location: null, start_date: null },
      client: { name: "C" },
      tenant: { name: "N" },
      recruiter: { name: "R", phone: "R" },
    } as any);
    expect(out).toBe("Hi Sam");
  });

  it("is safe against injection (no eval)", () => {
    const out = renderTemplate("A {{candidate.first_name}} B", {
      candidate: { first_name: "{{vacancy.title}}", full_name: "x" },
      vacancy: { title: "BAD", location: null, start_date: null },
      client: { name: "c" }, tenant: { name: "t" },
      recruiter: { name: "r", phone: "r" },
    } as any);
    expect(out).toBe("A {{vacancy.title}} B"); // literal, no recursive substitution
  });
});
```

- [ ] **Step 2: Run, confirm fail**

Run: `pnpm --filter api test -- template-renderer.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement renderer.ts**

```typescript
// apps/api/src/modules/intake/templates/renderer.ts
export interface TemplateContext {
  candidate: { first_name: string; full_name: string };
  vacancy: { title: string; location: string | null; start_date: string | null };
  client: { name: string };
  tenant: { name: string };
  recruiter: { name: string; phone: string };
}

const MERGE_RE = /\{\{\s*([a-z_]+)\.([a-z_]+)\s*\}\}/g;

export function renderTemplate(body: string, ctx: TemplateContext): string {
  return body.replace(MERGE_RE, (_, scope: string, key: string) => {
    const obj = (ctx as Record<string, Record<string, unknown>>)[scope];
    if (!obj) return "";
    const val = obj[key];
    if (val === null || val === undefined) return "";
    return String(val);
  });
}
```

- [ ] **Step 4: Run test — PASS**

Run: `pnpm --filter api test -- template-renderer.test.ts`
Expected: 3 passed.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/intake/templates/renderer.ts apps/api/tests/unit/template-renderer.test.ts
git commit -m "feat(api): add IntakeTemplateRenderer with safe merge-field substitution"
```

---

## Task 13: IntakeOrchestrator skeleton + intake.start job

**Files:**
- Create: `apps/api/src/modules/intake/orchestrator.ts`
- Create: `apps/api/src/jobs/intake.jobs.ts`
- Create: `apps/api/tests/unit/orchestrator.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// apps/api/tests/unit/orchestrator.test.ts
import { describe, it, expect, vi } from "vitest";
import { startSession } from "../../src/modules/intake/orchestrator.js";

describe("IntakeOrchestrator.startSession", () => {
  const makeDeps = () => ({
    loadSessionContext: vi.fn().mockResolvedValue({
      sessionId: "s1", orgId: "o1",
      candidate: { first_name: "Jan", full_name: "Jan de Vries", phone: "+31600000001" },
      vacancy: { title: "T", location: "U", start_date: null },
      client: { name: "C" },
      tenant: { name: "N" },
      recruiter: { name: "R", phone: "+31600000002" },
    }),
    loadTemplate: vi.fn().mockResolvedValue({ body: "Hoi {{candidate.first_name}}" }),
    sendWhatsApp: vi.fn().mockResolvedValue({ messageSid: "SM1", status: "sent" }),
    persistOutbound: vi.fn().mockResolvedValue(undefined),
    scheduleReminder: vi.fn().mockResolvedValue(undefined),
  });

  it("sends first-contact template and schedules 24h reminder", async () => {
    const deps = makeDeps();
    await startSession("s1", deps);
    expect(deps.sendWhatsApp).toHaveBeenCalledWith(expect.objectContaining({
      toPhone: "+31600000001",
      body: "Hoi Jan",
    }));
    expect(deps.persistOutbound).toHaveBeenCalledWith({
      sessionId: "s1", body: "Hoi Jan", twilioSid: "SM1",
    });
    expect(deps.scheduleReminder).toHaveBeenCalledWith({
      sessionId: "s1", afterSeconds: 86400, variant: "reminder_24h",
    });
  });
});
```

- [ ] **Step 2: Run, confirm fail**

Run: `pnpm --filter api test -- orchestrator.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement orchestrator.ts**

```typescript
// apps/api/src/modules/intake/orchestrator.ts
import { renderTemplate, type TemplateContext } from "./templates/renderer.js";

export interface SessionContext extends TemplateContext {
  sessionId: string;
  orgId: string;
  candidate: TemplateContext["candidate"] & { phone: string };
}

export interface StartSessionDeps {
  loadSessionContext(sessionId: string): Promise<SessionContext>;
  loadTemplate(orgId: string, variant: string, locale?: string): Promise<{ body: string }>;
  sendWhatsApp(input: { toPhone: string; body: string }): Promise<{ messageSid: string; status: string }>;
  persistOutbound(input: { sessionId: string; body: string; twilioSid: string }): Promise<void>;
  scheduleReminder(input: { sessionId: string; afterSeconds: number; variant: string }): Promise<void>;
}

export async function startSession(
  sessionId: string,
  deps: StartSessionDeps,
): Promise<void> {
  const ctx = await deps.loadSessionContext(sessionId);
  const tmpl = await deps.loadTemplate(ctx.orgId, "first_contact", "nl");
  const body = renderTemplate(tmpl.body, ctx);
  const send = await deps.sendWhatsApp({ toPhone: ctx.candidate.phone, body });
  await deps.persistOutbound({ sessionId, body, twilioSid: send.messageSid });
  await deps.scheduleReminder({ sessionId, afterSeconds: 86400, variant: "reminder_24h" });
}
```

- [ ] **Step 4: Run test — PASS**

Run: `pnpm --filter api test -- orchestrator.test.ts`
Expected: 1 passed.

- [ ] **Step 5: Implement intake.jobs.ts wiring to concrete deps**

```typescript
// apps/api/src/jobs/intake.jobs.ts
import { eq, and } from "drizzle-orm";
import { getJobQueue } from "../lib/job-queue.js";
import { db } from "../db/index.js";
import {
  intakeSessions, intakeMessages, intakeTemplates,
  candidateApplications, candidates, vacancies, clients, user, organization,
} from "../db/schema/index.js";
import { createTwilioSandboxGateway } from "../modules/intake/whatsapp/twilio-sandbox.js";
import { startSession, type StartSessionDeps } from "../modules/intake/orchestrator.js";

function gw() {
  return createTwilioSandboxGateway({
    accountSid: process.env.TWILIO_ACCOUNT_SID!,
    authToken: process.env.TWILIO_AUTH_TOKEN!,
    fromNumber: process.env.TWILIO_WHATSAPP_FROM ?? "whatsapp:+14155238886",
  });
}

const concreteStartDeps: StartSessionDeps = {
  async loadSessionContext(sessionId) {
    const [row] = await db
      .select({
        sessionId: intakeSessions.id,
        orgId: intakeSessions.organizationId,
        candFirst: candidates.firstName,
        candLast: candidates.lastName,
        candPhone: candidates.phone,
        vacTitle: vacancies.title,
        vacLoc: vacancies.location,
        clientName: clients.name,
        tenantName: organization.name,
      })
      .from(intakeSessions)
      .innerJoin(candidateApplications, eq(intakeSessions.applicationId, candidateApplications.id))
      .innerJoin(candidates, eq(candidateApplications.candidateId, candidates.id))
      .innerJoin(vacancies, eq(candidateApplications.vacancyId, vacancies.id))
      .leftJoin(clients, eq(vacancies.clientId, clients.id))
      .innerJoin(organization, eq(intakeSessions.organizationId, organization.id))
      .where(eq(intakeSessions.id, sessionId))
      .limit(1);
    if (!row) throw new Error(`session not found: ${sessionId}`);
    return {
      sessionId: row.sessionId,
      orgId: row.orgId,
      candidate: {
        first_name: row.candFirst,
        full_name: `${row.candFirst} ${row.candLast}`,
        phone: row.candPhone ?? "",
      },
      vacancy: { title: row.vacTitle, location: row.vacLoc, start_date: null },
      client: { name: row.clientName ?? "" },
      tenant: { name: row.tenantName },
      recruiter: { name: "Team", phone: "" },
    };
  },

  async loadTemplate(orgId, variant, locale = "nl") {
    const [tmpl] = await db
      .select({ body: intakeTemplates.body })
      .from(intakeTemplates)
      .where(
        and(
          eq(intakeTemplates.organizationId, orgId),
          eq(intakeTemplates.variant, variant),
          eq(intakeTemplates.locale, locale),
          eq(intakeTemplates.isActive, true),
        ),
      )
      .limit(1);
    if (!tmpl) throw new Error(`template not found: ${variant}/${locale}`);
    return tmpl;
  },

  async sendWhatsApp(input) {
    return gw().send(input);
  },

  async persistOutbound({ sessionId, body, twilioSid }) {
    const [sess] = await db
      .select({ organizationId: intakeSessions.organizationId })
      .from(intakeSessions)
      .where(eq(intakeSessions.id, sessionId))
      .limit(1);
    if (!sess) return;
    await db.insert(intakeMessages).values({
      organizationId: sess.organizationId,
      sessionId,
      direction: "outbound",
      body,
      twilioSid,
      isFromBot: true,
    });
    await db
      .update(intakeSessions)
      .set({ lastOutboundAt: new Date() })
      .where(eq(intakeSessions.id, sessionId));
  },

  async scheduleReminder({ sessionId, afterSeconds, variant }) {
    await getJobQueue().send(
      `intake.reminder_${variant}`,
      { sessionId },
      { startAfter: afterSeconds },
    );
  },
};

export async function registerIntakeJobs() {
  const boss = getJobQueue();

  await boss.work("intake.start", async (jobs) => {
    for (const job of jobs) {
      const { sessionId } = job.data as { sessionId: string };
      await startSession(sessionId, concreteStartDeps);
    }
  });

  console.log("[jobs] registered intake.start");
}
```

- [ ] **Step 6: Wire into bootstrap**

Add to same bootstrap file as Task 9:
```typescript
import { registerIntakeJobs } from "./jobs/intake.jobs.js";
// ...
if (process.env.JOBS_ENABLED === "true") {
  await registerIntakeJobs();
}
```

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/modules/intake/orchestrator.ts apps/api/src/jobs/intake.jobs.ts apps/api/tests/unit/orchestrator.test.ts
git commit -m "feat(api): intake orchestrator startSession + intake.start job"
```

---

## Task 14: Reminder + process-message job handlers

**Files:**
- Modify: `apps/api/src/jobs/intake.jobs.ts`
- Modify: `apps/api/src/modules/intake/orchestrator.ts`

- [ ] **Step 1: Add reminder + finalize-on-no-response to orchestrator.ts**

Append to orchestrator.ts:

```typescript
export interface ReminderDeps {
  loadSessionContext(sessionId: string): Promise<SessionContext>;
  loadTemplate(orgId: string, variant: string, locale?: string): Promise<{ body: string }>;
  sendWhatsApp(input: { toPhone: string; body: string }): Promise<{ messageSid: string; status: string }>;
  persistOutbound(input: { sessionId: string; body: string; twilioSid: string }): Promise<void>;
  scheduleReminder(input: { sessionId: string; afterSeconds: number; variant: string }): Promise<void>;
  getSessionState(sessionId: string): Promise<{ state: string; lastInboundAt: Date | null; createdAt: Date } | null>;
  finalizeVerdict(sessionId: string, status: "qualified" | "rejected" | "unsure", reason: string): Promise<void>;
  incrementReminderCount(sessionId: string): Promise<void>;
}

export async function sendReminder(
  sessionId: string,
  variant: "reminder_24h" | "reminder_72h",
  deps: ReminderDeps,
): Promise<void> {
  const state = await deps.getSessionState(sessionId);
  if (!state) return;
  // Cancel if candidate replied since session start
  if (state.lastInboundAt && state.lastInboundAt > state.createdAt) return;
  if (state.state === "completed" || state.state === "awaiting_human") return;

  const ctx = await deps.loadSessionContext(sessionId);
  const tmpl = await deps.loadTemplate(ctx.orgId, variant, "nl");
  const body = renderTemplate(tmpl.body, ctx);
  const send = await deps.sendWhatsApp({ toPhone: ctx.candidate.phone, body });
  await deps.persistOutbound({ sessionId, body, twilioSid: send.messageSid });
  await deps.incrementReminderCount(sessionId);

  if (variant === "reminder_24h") {
    await deps.scheduleReminder({
      sessionId,
      afterSeconds: 48 * 3600, // 48h later = 72h total
      variant: "reminder_72h",
    });
  } else {
    // 72h: schedule farewell + finalize
    await deps.scheduleReminder({
      sessionId,
      afterSeconds: 24 * 3600, // 24h later = check + farewell
      variant: "no_response_farewell",
    });
  }
}

export async function sendFarewellAndClose(
  sessionId: string,
  deps: ReminderDeps,
): Promise<void> {
  const state = await deps.getSessionState(sessionId);
  if (!state) return;
  if (state.lastInboundAt && state.lastInboundAt > state.createdAt) return;
  if (state.state === "completed" || state.state === "awaiting_human") return;

  const ctx = await deps.loadSessionContext(sessionId);
  const tmpl = await deps.loadTemplate(ctx.orgId, "no_response_farewell", "nl");
  const body = renderTemplate(tmpl.body, ctx);
  const send = await deps.sendWhatsApp({ toPhone: ctx.candidate.phone, body });
  await deps.persistOutbound({ sessionId, body, twilioSid: send.messageSid });
  await deps.finalizeVerdict(sessionId, "rejected", "no response");
}
```

- [ ] **Step 2: Extend intake.jobs.ts with handlers**

In `apps/api/src/jobs/intake.jobs.ts`, add to `concreteStartDeps` fulfilling `ReminderDeps`:

```typescript
// Add these helpers to the concreteStartDeps object (widen its type to StartSessionDeps & ReminderDeps)
const concreteDeps: StartSessionDeps & ReminderDeps = {
  ...concreteStartDeps,
  async getSessionState(sessionId) {
    const [row] = await db
      .select({
        state: intakeSessions.state,
        lastInboundAt: intakeSessions.lastInboundAt,
        createdAt: intakeSessions.createdAt,
      })
      .from(intakeSessions)
      .where(eq(intakeSessions.id, sessionId))
      .limit(1);
    return row ?? null;
  },
  async finalizeVerdict(sessionId, status, reason) {
    await db
      .update(intakeSessions)
      .set({ state: "completed", verdict: status, verdictReason: reason, completedAt: new Date() })
      .where(eq(intakeSessions.id, sessionId));
    // Pushback job
    await getJobQueue().send("intake.fleks_pushback", { sessionId });
  },
  async incrementReminderCount(sessionId) {
    await db.execute(
      sql`UPDATE intake_sessions SET reminder_count = reminder_count + 1 WHERE id = ${sessionId}`,
    );
  },
};
```

(Add `import { sql } from "drizzle-orm";` at top.)

Then register the new handlers:

```typescript
export async function registerIntakeJobs() {
  const boss = getJobQueue();

  await boss.work("intake.start", async (jobs) => {
    for (const job of jobs) {
      const { sessionId } = job.data as { sessionId: string };
      await startSession(sessionId, concreteDeps);
    }
  });

  await boss.work("intake.reminder_reminder_24h", async (jobs) => {
    for (const job of jobs) {
      await sendReminder((job.data as { sessionId: string }).sessionId, "reminder_24h", concreteDeps);
    }
  });

  await boss.work("intake.reminder_reminder_72h", async (jobs) => {
    for (const job of jobs) {
      await sendReminder((job.data as { sessionId: string }).sessionId, "reminder_72h", concreteDeps);
    }
  });

  await boss.work("intake.reminder_no_response_farewell", async (jobs) => {
    for (const job of jobs) {
      await sendFarewellAndClose((job.data as { sessionId: string }).sessionId, concreteDeps);
    }
  });

  await boss.work("intake.process_message", async (jobs) => {
    for (const job of jobs) {
      const { sessionId } = job.data as { sessionId: string };
      // Task 17 fills this in with IntakeAgent call.
      // For now log only so we can smoke-test before Task 17.
      console.log(`[intake.process_message] would invoke agent for session ${sessionId}`);
    }
  });

  console.log("[jobs] registered intake.start, reminder_24h, reminder_72h, farewell, process_message");
}
```

Also add import for `sendReminder, sendFarewellAndClose` from orchestrator.js.

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/modules/intake/orchestrator.ts apps/api/src/jobs/intake.jobs.ts
git commit -m "feat(api): add reminder + farewell handlers, stub intake.process_message"
```

---

## Task 15: Claude tool definitions + system prompt builder

**Files:**
- Create: `apps/api/src/modules/intake/agent/tools.ts`
- Create: `apps/api/src/modules/intake/agent/prompts.ts`

- [ ] **Step 1: Write tools.ts**

```typescript
// apps/api/src/modules/intake/agent/tools.ts
import type Anthropic from "@anthropic-ai/sdk";

export const INTAKE_TOOLS: Anthropic.Tool[] = [
  {
    name: "record_answer",
    description:
      "Sla een antwoord op voor een must-have of nice-to-have key. Alleen aanroepen wanneer kandidaat een duidelijk antwoord geeft.",
    input_schema: {
      type: "object" as const,
      properties: {
        key: { type: "string", description: "Must-have of nice-to-have key (bv 'licenses', 'availability', of een customKey)" },
        value: { description: "Het antwoord. Type hangt af van key (string, number, boolean, of array)" },
        confidence: { type: "string", enum: ["high", "medium", "low"] },
        source_message_id: { type: "string", description: "ID van inbound bericht waar dit uit kwam (kan leeg zijn)" },
      },
      required: ["key", "value", "confidence"],
    },
  },
  {
    name: "request_clarification",
    description:
      "Vraag opnieuw naar een must-have als het antwoord onduidelijk of tegenstrijdig was. Verhoogt stuck-counter.",
    input_schema: {
      type: "object" as const,
      properties: {
        key: { type: "string" },
        reason: { type: "string" },
      },
      required: ["key", "reason"],
    },
  },
  {
    name: "escalate_to_human",
    description:
      "Zet sessie op hold en wacht op recruiter. Gebruik bij onduidelijke criteria, expliciet verzoek kandidaat, vastlopen op key, of off-topic.",
    input_schema: {
      type: "object" as const,
      properties: {
        reason: {
          type: "string",
          enum: ["unclear_requirements", "explicit_request", "stuck_on_key", "off_topic"],
        },
        context: { type: "string" },
      },
      required: ["reason"],
    },
  },
  {
    name: "finalize_verdict",
    description:
      "Alleen aanroepen wanneer alle must-haves zijn ingevuld EN geen vervolgvragen meer nodig. Sluit sessie.",
    input_schema: {
      type: "object" as const,
      properties: {
        status: { type: "string", enum: ["qualified", "rejected", "unsure"] },
        summary: { type: "string", description: "2-3 zin samenvatting voor recruiter" },
        rejection_reason: { type: "string", description: "Leeg laten als qualified" },
      },
      required: ["status", "summary"],
    },
  },
];

export type ToolName = "record_answer" | "request_clarification" | "escalate_to_human" | "finalize_verdict";
```

- [ ] **Step 2: Write prompts.ts**

```typescript
// apps/api/src/modules/intake/agent/prompts.ts
import type { QualificationCriteria } from "@recruitment-os/types";

export interface PromptInput {
  tenantName: string;
  clientName: string;
  vacancyTitle: string;
  vacancyDescription: string | null;
  criteria: QualificationCriteria;
  answeredMustHaves: Record<string, unknown>;
  answeredNiceToHaves: Record<string, unknown>;
  stuckCounter: Record<string, number>;
  recentMessages: Array<{ direction: "inbound" | "outbound"; body: string }>;
}

export function buildSystemPrompt(input: PromptInput): string {
  const mustHaveList = Object.entries(input.criteria.mustHave ?? {})
    .filter(([k, v]) => k !== "customKeys" && v !== undefined)
    .map(([k, v]) => `- ${k}: ${JSON.stringify(v)}`)
    .join("\n");
  const customKeys = (input.criteria.mustHave.customKeys ?? [])
    .map((k) => `- ${k.key}: ${k.question}${k.required ? " (verplicht)" : ""}`)
    .join("\n");

  return `Je bent een recruitment-assistent voor ${input.tenantName}. Je voert een intake-gesprek via WhatsApp met een kandidaat die solliciteerde op "${input.vacancyTitle}" bij "${input.clientName}". Jouw doel: alle must-have criteria invullen en kandidaat kwalificeren.

Vacature-beschrijving:
${input.vacancyDescription ?? "(geen beschrijving)"}

Must-have criteria (ALLEMAAL invullen):
${mustHaveList || "(geen)"}
${customKeys ? "\nExtra verplichte vragen:\n" + customKeys : ""}

Nice-to-have criteria (alleen vragen als relevant, niet-blokkerend):
${JSON.stringify(input.criteria.niceToHave ?? {}, null, 2)}

Al beantwoord — NIET opnieuw vragen:
${JSON.stringify(input.answeredMustHaves, null, 2)}
${JSON.stringify(input.answeredNiceToHaves, null, 2)}

Stuck counter per key (3+ = direct escaleren):
${JSON.stringify(input.stuckCounter, null, 2)}

Regels:
- Nederlands, informeel maar professioneel (je/jij, geen u).
- 1-2 zinnen per bericht. Nooit lange teksten.
- Eén vraag tegelijk, tenzij logisch samen.
- Bij onduidelijk antwoord → request_clarification (niet verzinnen).
- Bij off-topic / klacht / spam → escalate_to_human met reason "off_topic".
- Bij "ik wil iemand spreken" / "mens" / "recruiter" → direct escalate_to_human "explicit_request".
- Claude mag ZELF bepalen welke nice-to-have vragen relevant zijn op basis van eerdere antwoorden — vraag niet alles.
- Alleen finalize_verdict aanroepen als ALLE must-haves ingevuld zijn.

Tools beschikbaar: record_answer, request_clarification, escalate_to_human, finalize_verdict.`;
}

export function buildMessages(
  recent: PromptInput["recentMessages"],
): Array<{ role: "user" | "assistant"; content: string }> {
  return recent.map((m) => ({
    role: (m.direction === "inbound" ? "user" : "assistant") as "user" | "assistant",
    content: m.body,
  }));
}
```

- [ ] **Step 3: Typecheck**

Run: `cd apps/api && npx tsc --noEmit 2>&1 | grep -E "tools\.ts|prompts\.ts" | head -10`
Expected: no errors in these files.

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/modules/intake/agent/tools.ts apps/api/src/modules/intake/agent/prompts.ts
git commit -m "feat(api): add Claude intake tool definitions + system prompt builder"
```

---

## Task 16: IntakeAgent — Claude invocation + tool execution

**Files:**
- Create: `apps/api/src/modules/intake/agent/intake-agent.ts`
- Create: `apps/api/tests/unit/intake-agent.test.ts`

- [ ] **Step 1: Write the failing test (Claude mocked)**

```typescript
// apps/api/tests/unit/intake-agent.test.ts
import { describe, it, expect, vi } from "vitest";
import { processInbound } from "../../src/modules/intake/agent/intake-agent.js";

const baseCtx = {
  sessionId: "s1", orgId: "o1",
  tenantName: "N", clientName: "C",
  vacancyTitle: "T", vacancyDescription: "d",
  criteria: { mustHave: { licenses: ["CE"] }, niceToHave: {} },
  mustHaveAnswers: {},
  niceToHaveAnswers: {},
  stuckCounter: {},
  recentMessages: [{ direction: "inbound" as const, body: "hoi" }],
};

describe("IntakeAgent.processInbound", () => {
  it("executes record_answer + outbound text", async () => {
    const claude = {
      messages: {
        create: vi.fn().mockResolvedValue({
          content: [
            { type: "text", text: "Top! En heb je CE-rijbewijs?" },
            { type: "tool_use", id: "t1", name: "record_answer", input: { key: "name", value: "Jan", confidence: "high" } },
          ],
          stop_reason: "tool_use",
        }),
      },
    };
    const deps = {
      claude,
      sendWhatsApp: vi.fn().mockResolvedValue({ messageSid: "SM1", status: "sent" }),
      persistOutbound: vi.fn(),
      applyToolCalls: vi.fn().mockResolvedValue({ verdict: null, escalate: null }),
      setSessionInProgress: vi.fn(),
      candidatePhone: "+31600000001",
    };
    await processInbound(baseCtx, deps);
    expect(deps.applyToolCalls).toHaveBeenCalledWith("s1", [
      { name: "record_answer", input: { key: "name", value: "Jan", confidence: "high" } },
    ]);
    expect(deps.sendWhatsApp).toHaveBeenCalledWith({
      toPhone: "+31600000001",
      body: "Top! En heb je CE-rijbewijs?",
    });
    expect(deps.persistOutbound).toHaveBeenCalled();
    expect(deps.setSessionInProgress).toHaveBeenCalledWith("s1");
  });

  it("routes finalize_verdict via applyToolCalls (no outbound text when only verdict)", async () => {
    const claude = {
      messages: {
        create: vi.fn().mockResolvedValue({
          content: [
            { type: "tool_use", id: "t1", name: "finalize_verdict",
              input: { status: "qualified", summary: "ok" } },
          ],
          stop_reason: "tool_use",
        }),
      },
    };
    const deps = {
      claude,
      sendWhatsApp: vi.fn(),
      persistOutbound: vi.fn(),
      applyToolCalls: vi.fn().mockResolvedValue({ verdict: "qualified", escalate: null }),
      setSessionInProgress: vi.fn(),
      candidatePhone: "+31600000001",
    };
    await processInbound(baseCtx, deps);
    expect(deps.sendWhatsApp).not.toHaveBeenCalled();
    expect(deps.applyToolCalls).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run, confirm fail**

Run: `pnpm --filter api test -- intake-agent.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement intake-agent.ts**

```typescript
// apps/api/src/modules/intake/agent/intake-agent.ts
import type Anthropic from "@anthropic-ai/sdk";
import { INTAKE_TOOLS, type ToolName } from "./tools.js";
import { buildSystemPrompt, buildMessages, type PromptInput } from "./prompts.js";

export interface ProcessContext extends Omit<PromptInput, "answeredMustHaves" | "answeredNiceToHaves"> {
  sessionId: string;
  orgId: string;
  mustHaveAnswers: Record<string, unknown>;
  niceToHaveAnswers: Record<string, unknown>;
}

export interface ProcessDeps {
  claude: Pick<Anthropic, "messages">;
  sendWhatsApp(input: { toPhone: string; body: string }): Promise<{ messageSid: string; status: string }>;
  persistOutbound(input: { sessionId: string; body: string; twilioSid: string; toolCalls?: unknown[] }): Promise<void>;
  applyToolCalls(sessionId: string, calls: Array<{ name: ToolName; input: Record<string, unknown> }>): Promise<{
    verdict: "qualified" | "rejected" | "unsure" | null;
    escalate: string | null;
  }>;
  setSessionInProgress(sessionId: string): Promise<void>;
  candidatePhone: string;
}

export async function processInbound(ctx: ProcessContext, deps: ProcessDeps): Promise<void> {
  const system = buildSystemPrompt({
    ...ctx,
    answeredMustHaves: ctx.mustHaveAnswers,
    answeredNiceToHaves: ctx.niceToHaveAnswers,
  });
  const messages = buildMessages(ctx.recentMessages);

  const response = await deps.claude.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1024,
    system,
    tools: INTAKE_TOOLS,
    messages,
  });

  // Collect text + tool calls
  const texts: string[] = [];
  const toolCalls: Array<{ name: ToolName; input: Record<string, unknown> }> = [];
  for (const block of response.content) {
    if (block.type === "text") texts.push(block.text);
    if (block.type === "tool_use") {
      toolCalls.push({ name: block.name as ToolName, input: block.input as Record<string, unknown> });
    }
  }

  // Apply tool calls first (they may mutate session state)
  if (toolCalls.length > 0) {
    await deps.applyToolCalls(ctx.sessionId, toolCalls);
  }

  // Send text to kandidaat (als any)
  const text = texts.join("\n").trim();
  if (text) {
    const send = await deps.sendWhatsApp({ toPhone: deps.candidatePhone, body: text });
    await deps.persistOutbound({
      sessionId: ctx.sessionId,
      body: text,
      twilioSid: send.messageSid,
      toolCalls,
    });
  }

  // Move state to in_progress (after first exchange)
  await deps.setSessionInProgress(ctx.sessionId);
}
```

- [ ] **Step 4: Run test — PASS**

Run: `pnpm --filter api test -- intake-agent.test.ts`
Expected: 2 passed.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/intake/agent/intake-agent.ts apps/api/tests/unit/intake-agent.test.ts
git commit -m "feat(api): add IntakeAgent Claude-wrapper with tool-call execution"
```

---

## Task 17: Tool executor — applyToolCalls (persistence + state machine)

**Files:**
- Create: `apps/api/src/modules/intake/agent/tool-executor.ts`
- Create: `apps/api/tests/unit/tool-executor.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// apps/api/tests/unit/tool-executor.test.ts
import { describe, it, expect, vi } from "vitest";
import { createToolExecutor } from "../../src/modules/intake/agent/tool-executor.js";

describe("applyToolCalls", () => {
  const makeStore = () => ({
    recordAnswer: vi.fn().mockResolvedValue(undefined),
    bumpStuck: vi.fn().mockResolvedValue(0),
    escalate: vi.fn().mockResolvedValue(undefined),
    finalize: vi.fn().mockResolvedValue(undefined),
  });

  it("records answers and returns no verdict", async () => {
    const store = makeStore();
    const exec = createToolExecutor(store);
    const res = await exec("s1", [
      { name: "record_answer", input: { key: "licenses", value: ["CE"], confidence: "high" } },
    ]);
    expect(store.recordAnswer).toHaveBeenCalledWith("s1", "licenses", ["CE"], "high");
    expect(res.verdict).toBeNull();
  });

  it("escalates when stuck counter reaches 3", async () => {
    const store = makeStore();
    store.bumpStuck.mockResolvedValue(3);
    const exec = createToolExecutor(store);
    const res = await exec("s1", [
      { name: "request_clarification", input: { key: "licenses", reason: "vague" } },
    ]);
    expect(store.escalate).toHaveBeenCalledWith("s1", "stuck_on_key", expect.any(String));
    expect(res.escalate).toBe("stuck_on_key");
  });

  it("finalizes verdict", async () => {
    const store = makeStore();
    const exec = createToolExecutor(store);
    const res = await exec("s1", [
      { name: "finalize_verdict", input: { status: "qualified", summary: "ok" } },
    ]);
    expect(store.finalize).toHaveBeenCalledWith("s1", "qualified", "ok", undefined);
    expect(res.verdict).toBe("qualified");
  });
});
```

- [ ] **Step 2: Run, confirm fail**

Run: `pnpm --filter api test -- tool-executor.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement tool-executor.ts**

```typescript
// apps/api/src/modules/intake/agent/tool-executor.ts
import type { ToolName } from "./tools.js";

export interface ToolStore {
  recordAnswer(sessionId: string, key: string, value: unknown, confidence: string): Promise<void>;
  bumpStuck(sessionId: string, key: string): Promise<number>;  // returns new count
  escalate(sessionId: string, reason: string, context: string): Promise<void>;
  finalize(sessionId: string, status: "qualified" | "rejected" | "unsure", summary: string, rejectionReason?: string): Promise<void>;
}

export type ToolCall = { name: ToolName; input: Record<string, unknown> };

export function createToolExecutor(store: ToolStore) {
  return async function applyToolCalls(
    sessionId: string,
    calls: ToolCall[],
  ): Promise<{ verdict: "qualified" | "rejected" | "unsure" | null; escalate: string | null }> {
    let verdict: "qualified" | "rejected" | "unsure" | null = null;
    let escalate: string | null = null;

    for (const call of calls) {
      switch (call.name) {
        case "record_answer": {
          const key = String(call.input.key ?? "");
          const value = call.input.value;
          const confidence = String(call.input.confidence ?? "medium");
          if (key) await store.recordAnswer(sessionId, key, value, confidence);
          break;
        }
        case "request_clarification": {
          const key = String(call.input.key ?? "");
          const count = await store.bumpStuck(sessionId, key);
          if (count >= 3) {
            await store.escalate(sessionId, "stuck_on_key", `3+ clarifications on ${key}`);
            escalate = "stuck_on_key";
          }
          break;
        }
        case "escalate_to_human": {
          const reason = String(call.input.reason ?? "unclear_requirements");
          const context = String(call.input.context ?? "");
          await store.escalate(sessionId, reason, context);
          escalate = reason;
          break;
        }
        case "finalize_verdict": {
          const status = call.input.status as "qualified" | "rejected" | "unsure";
          const summary = String(call.input.summary ?? "");
          const rejectionReason = call.input.rejection_reason ? String(call.input.rejection_reason) : undefined;
          await store.finalize(sessionId, status, summary, rejectionReason);
          verdict = status;
          break;
        }
      }
    }

    return { verdict, escalate };
  };
}
```

- [ ] **Step 4: Run test — PASS**

Run: `pnpm --filter api test -- tool-executor.test.ts`
Expected: 3 passed.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/intake/agent/tool-executor.ts apps/api/tests/unit/tool-executor.test.ts
git commit -m "feat(api): add tool-executor with stuck detector + verdict/escalate handling"
```

---

## Task 18: Drizzle-backed ToolStore + wire process_message job

**Files:**
- Create: `apps/api/src/modules/intake/agent/tool-store.ts`
- Modify: `apps/api/src/jobs/intake.jobs.ts`

- [ ] **Step 1: Write tool-store.ts**

> **Note on bucket simplification:** For MVP, `recordAnswer` writes all answers to `mustHaveAnswers` regardless of whether Claude meant it as must-have or nice-to-have. The `niceToHaveAnswers` column is reserved for future use (Phase 2 will add bucket routing via criteria lookup).

```typescript
// apps/api/src/modules/intake/agent/tool-store.ts
import { eq, sql } from "drizzle-orm";
import { db } from "../../../db/index.js";
import { intakeSessions, candidateApplications, pipelineStages } from "../../../db/schema/index.js";
import { getJobQueue } from "../../../lib/job-queue.js";
import type { ToolStore } from "./tool-executor.js";

export function createToolStore(): ToolStore {
  return {
    async recordAnswer(sessionId, key, value, confidence) {
      await db
        .update(intakeSessions)
        .set({
          mustHaveAnswers: sql`must_have_answers || ${sql.raw(`'${JSON.stringify({ [key]: { value, confidence } }).replace(/'/g, "''")}'::jsonb`)}`,
        })
        .where(eq(intakeSessions.id, sessionId));
    },
    async bumpStuck(sessionId, key) {
      const [row] = await db
        .execute(sql`
          UPDATE intake_sessions
          SET stuck_counter = jsonb_set(
            stuck_counter,
            ${`{${key}}`}::text[],
            (COALESCE((stuck_counter->>${key})::int, 0) + 1)::text::jsonb
          )
          WHERE id = ${sessionId}
          RETURNING (stuck_counter->>${key})::int as count
        `);
      return (row as { count: number })?.count ?? 0;
    },
    async escalate(sessionId, reason, context) {
      await db
        .update(intakeSessions)
        .set({
          state: "awaiting_human",
          verdictReason: `${reason}: ${context}`.slice(0, 500),
        })
        .where(eq(intakeSessions.id, sessionId));
    },
    async finalize(sessionId, status, summary, rejectionReason) {
      // Update session
      await db
        .update(intakeSessions)
        .set({
          state: "completed",
          verdict: status,
          verdictReason: summary + (rejectionReason ? ` — ${rejectionReason}` : ""),
          completedAt: new Date(),
        })
        .where(eq(intakeSessions.id, sessionId));

      // Move application stage
      const targetSlug = status === "qualified" ? "qualified" : "rejected_by_bot";
      const [session] = await db
        .select({ applicationId: intakeSessions.applicationId, orgId: intakeSessions.organizationId })
        .from(intakeSessions)
        .where(eq(intakeSessions.id, sessionId))
        .limit(1);
      if (session) {
        const [stage] = await db
          .select({ id: pipelineStages.id })
          .from(pipelineStages)
          .where(
            sql`${pipelineStages.organizationId} = ${session.orgId} AND ${pipelineStages.slug} = ${targetSlug}`,
          )
          .limit(1);
        if (stage) {
          await db
            .update(candidateApplications)
            .set({ currentStageId: stage.id })
            .where(eq(candidateApplications.id, session.applicationId));
        }
      }

      // Enqueue Fleks pushback
      await getJobQueue().send("intake.fleks_pushback", { sessionId });
    },
  };
}
```

- [ ] **Step 2: Wire into intake.process_message handler**

In `apps/api/src/jobs/intake.jobs.ts`, replace the stub `intake.process_message` handler:

```typescript
import Anthropic from "@anthropic-ai/sdk";
import { processInbound } from "../modules/intake/agent/intake-agent.js";
import { createToolExecutor } from "../modules/intake/agent/tool-executor.js";
import { createToolStore } from "../modules/intake/agent/tool-store.js";

// ... in registerIntakeJobs() — replace the stub:
await boss.work("intake.process_message", async (jobs) => {
  for (const job of jobs) {
    const { sessionId } = job.data as { sessionId: string };

    // Load ctx
    const [row] = await db
      .select({
        sessionId: intakeSessions.id,
        orgId: intakeSessions.organizationId,
        mustHaveAnswers: intakeSessions.mustHaveAnswers,
        niceToHaveAnswers: intakeSessions.niceToHaveAnswers,
        stuckCounter: intakeSessions.stuckCounter,
        candPhone: candidates.phone,
        vacTitle: vacancies.title,
        vacDesc: vacancies.description,
        criteria: vacancies.qualificationCriteria,
        clientName: clients.name,
        tenantName: organization.name,
      })
      .from(intakeSessions)
      .innerJoin(candidateApplications, eq(intakeSessions.applicationId, candidateApplications.id))
      .innerJoin(candidates, eq(candidateApplications.candidateId, candidates.id))
      .innerJoin(vacancies, eq(candidateApplications.vacancyId, vacancies.id))
      .leftJoin(clients, eq(vacancies.clientId, clients.id))
      .innerJoin(organization, eq(intakeSessions.organizationId, organization.id))
      .where(eq(intakeSessions.id, sessionId))
      .limit(1);
    if (!row) continue;

    // Load last 20 messages
    const recent = await db
      .select({ direction: intakeMessages.direction, body: intakeMessages.body })
      .from(intakeMessages)
      .where(eq(intakeMessages.sessionId, sessionId))
      .orderBy(intakeMessages.sentAt)
      .limit(20);

    const claude = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
    const executor = createToolExecutor(createToolStore());

    await processInbound(
      {
        sessionId: row.sessionId,
        orgId: row.orgId,
        tenantName: row.tenantName,
        clientName: row.clientName ?? "",
        vacancyTitle: row.vacTitle,
        vacancyDescription: row.vacDesc ?? null,
        criteria: (row.criteria as unknown as { mustHave: Record<string, unknown>; niceToHave: Record<string, unknown> }) ?? { mustHave: {}, niceToHave: {} },
        mustHaveAnswers: (row.mustHaveAnswers as Record<string, unknown>) ?? {},
        niceToHaveAnswers: (row.niceToHaveAnswers as Record<string, unknown>) ?? {},
        stuckCounter: (row.stuckCounter as Record<string, number>) ?? {},
        recentMessages: recent.map((m) => ({
          direction: m.direction as "inbound" | "outbound",
          body: m.body,
        })),
      },
      {
        claude,
        sendWhatsApp: (input) => gw().send(input),
        persistOutbound: async ({ sessionId: sid, body, twilioSid, toolCalls }) => {
          await db.insert(intakeMessages).values({
            organizationId: row.orgId,
            sessionId: sid,
            direction: "outbound",
            body,
            twilioSid,
            isFromBot: true,
            toolCalls: toolCalls ?? null,
          });
        },
        applyToolCalls: executor,
        setSessionInProgress: async (sid) => {
          await db
            .update(intakeSessions)
            .set({ state: "in_progress" })
            .where(eq(intakeSessions.id, sid));
        },
        candidatePhone: row.candPhone ?? "",
      },
    );
  }
});
```

- [ ] **Step 3: Add ANTHROPIC_API_KEY to .env**

Append to `.env`: `ANTHROPIC_API_KEY=...` (user provides).

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/modules/intake/agent/tool-store.ts apps/api/src/jobs/intake.jobs.ts
git commit -m "feat(api): wire intake.process_message to Claude agent + tool-executor"
```

---

## Task 19: Fleks pushback job

**Files:**
- Create: `apps/api/src/modules/intake/pushback.service.ts`
- Modify: `apps/api/src/jobs/intake.jobs.ts`
- Create: `apps/api/tests/unit/pushback.test.ts`

- [ ] **Step 1: Write test**

```typescript
// apps/api/tests/unit/pushback.test.ts
import { describe, it, expect, vi } from "vitest";
import { pushVerdictToFleks } from "../../src/modules/intake/pushback.service.js";

describe("pushVerdictToFleks", () => {
  it("calls updateEmployee with recruitment_os_status free-field", async () => {
    const client = { updateEmployee: vi.fn().mockResolvedValue(undefined) };
    await pushVerdictToFleks(client as any, "emp-uuid", "qualified");
    expect(client.updateEmployee).toHaveBeenCalledWith("emp-uuid", {
      additionalFields: { recruitment_os_status: "qualified" },
    });
  });
});
```

- [ ] **Step 2: Implement pushback.service.ts**

```typescript
// apps/api/src/modules/intake/pushback.service.ts
import type { FleksClient } from "./fleks/client.js";

export async function pushVerdictToFleks(
  client: FleksClient,
  fleksEmployeeUuid: string,
  verdict: "qualified" | "rejected" | "unsure",
): Promise<void> {
  await client.updateEmployee(fleksEmployeeUuid, {
    additionalFields: { recruitment_os_status: verdict },
  });
}
```

- [ ] **Step 3: Wire handler into intake.jobs.ts**

In `registerIntakeJobs()`:

```typescript
await boss.work("intake.fleks_pushback", async (jobs) => {
  for (const job of jobs) {
    const { sessionId } = job.data as { sessionId: string };

    const [row] = await db
      .select({
        orgId: intakeSessions.organizationId,
        verdict: intakeSessions.verdict,
        fleksEmployeeUuid: candidates.fleksEmployeeUuid,
      })
      .from(intakeSessions)
      .innerJoin(candidateApplications, eq(intakeSessions.applicationId, candidateApplications.id))
      .innerJoin(candidates, eq(candidateApplications.candidateId, candidates.id))
      .where(eq(intakeSessions.id, sessionId))
      .limit(1);
    if (!row?.verdict || !row.fleksEmployeeUuid) continue;

    const [integ] = await db
      .select()
      .from(externalIntegrations)
      .where(eq(externalIntegrations.organizationId, row.orgId))
      .limit(1);
    if (!integ || !integ.apiKeyEncrypted) continue;

    const apiKey = process.env.FLEKS_API_KEY ?? decryptSecret(integ.apiKeyEncrypted);
    const client = createFleksClient({
      apiKey,
      baseUrl: integ.apiBaseUrl ?? "https://api.external.fleks.works",
    });
    const { pushVerdictToFleks } = await import("../modules/intake/pushback.service.js");
    await pushVerdictToFleks(client, row.fleksEmployeeUuid, row.verdict as never);
  }
});
```

Add imports at top of file if missing: `createFleksClient`, `decryptSecret`, `externalIntegrations`.

- [ ] **Step 4: Run test — PASS**

Run: `pnpm --filter api test -- pushback.test.ts`
Expected: 1 passed.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/intake/pushback.service.ts apps/api/src/jobs/intake.jobs.ts apps/api/tests/unit/pushback.test.ts
git commit -m "feat(api): add Fleks pushback on verdict + job handler"
```

---

## Task 20: Criteria AI-suggest service + endpoint

**Files:**
- Create: `apps/api/src/modules/intake/criteria/suggest.service.ts`
- Modify: `apps/api/src/routes/intake.routes.ts` (create if not yet)

- [ ] **Step 1: Implement suggest.service.ts**

```typescript
// apps/api/src/modules/intake/criteria/suggest.service.ts
import Anthropic from "@anthropic-ai/sdk";
import type { QualificationCriteria } from "@recruitment-os/types";

export interface SuggestInput {
  vacancyTitle: string;
  vacancyDescription: string | null;
  currentCriteria: QualificationCriteria;
}

export interface SuggestOutput {
  suggestedMustHaves: Array<{ key: string; question: string; expectedFormat: "yes_no" | "text" | "number" | "enum"; enumValues?: string[] }>;
  suggestedNiceToHaves: Array<{ key: string; question: string }>;
  reasoning: string;
}

export async function suggestCriteria(input: SuggestInput): Promise<SuggestOutput> {
  const claude = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
  const resp = await claude.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1024,
    system: `Je analyseert een vacature en stelt voor welke cruciale informatie bij de intake uitgevraagd moet worden. Je krijgt de vacature-beschrijving en de huidige criteria. Je geeft alleen NIEUWE suggesties die NIET al in de criteria staan. Output JSON.`,
    messages: [{
      role: "user",
      content: `Vacature: ${input.vacancyTitle}\n\nBeschrijving:\n${input.vacancyDescription ?? "(geen)"}\n\nHuidige must-haves:\n${JSON.stringify(input.currentCriteria.mustHave, null, 2)}\n\nHuidige nice-to-haves:\n${JSON.stringify(input.currentCriteria.niceToHave, null, 2)}\n\nGeef JSON met keys 'suggestedMustHaves' (list), 'suggestedNiceToHaves' (list), 'reasoning' (korte uitleg). Elke suggestie heeft 'key', 'question', en voor must-haves 'expectedFormat' ('yes_no'|'text'|'number'|'enum') + optioneel 'enumValues'.`,
    }],
  });

  const text = resp.content.filter((b) => b.type === "text").map((b) => (b as { text: string }).text).join("\n");
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("Claude returned no JSON");
  return JSON.parse(match[0]) as SuggestOutput;
}
```

- [ ] **Step 2: Create intake.routes.ts with endpoint**

```typescript
// apps/api/src/routes/intake.routes.ts
import { Hono } from "hono";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import { eq, and } from "drizzle-orm";
import type { AppEnv } from "../lib/app-env.js";
import { requirePermission } from "../middleware/rbac.middleware.js";
import { db } from "../db/index.js";
import { vacancies } from "../db/schema/index.js";
import { suggestCriteria } from "../modules/intake/criteria/suggest.service.js";
import { errorResponse } from "../lib/errors.js";
import { qualificationCriteriaSchema } from "@recruitment-os/types";

export const intakeRoutes = new Hono<AppEnv>()
  .post(
    "/criteria/suggest",
    requirePermission("vacancy", "update"),
    zValidator("json", z.object({ vacancyId: z.string().uuid() })),
    async (c) => {
      try {
        const orgId = c.get("organizationId");
        const { vacancyId } = c.req.valid("json");
        const [vac] = await db
          .select({
            title: vacancies.title,
            description: vacancies.description,
            criteria: vacancies.qualificationCriteria,
          })
          .from(vacancies)
          .where(
            and(eq(vacancies.id, vacancyId), eq(vacancies.organizationId, orgId)),
          )
          .limit(1);
        if (!vac) return c.json({ error: "vacancy not found" }, 404);
        const parsed = qualificationCriteriaSchema.parse(vac.criteria ?? { mustHave: {}, niceToHave: {} });
        const result = await suggestCriteria({
          vacancyTitle: vac.title,
          vacancyDescription: vac.description ?? null,
          currentCriteria: parsed,
        });
        return c.json(result);
      } catch (e) {
        return errorResponse(c, e as Error);
      }
    },
  );
```

- [ ] **Step 3: Mount route in index.ts**

```typescript
import { intakeRoutes } from "./routes/intake.routes.js";
// ...
app.route("/api/intake", intakeRoutes);
```

- [ ] **Step 4: Smoke test**

```bash
# Must be authenticated + active org
curl -X POST http://localhost:4000/api/intake/criteria/suggest \
  -H "Content-Type: application/json" -b cookie.txt \
  -d '{"vacancyId":"<some-vacancy-uuid>"}'
```
Expected: JSON with `suggestedMustHaves`, `suggestedNiceToHaves`, `reasoning`.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/intake/criteria/suggest.service.ts apps/api/src/routes/intake.routes.ts apps/api/src/index.ts
git commit -m "feat(api): add /api/intake/criteria/suggest Claude-assist endpoint"
```

---

## Task 21: Intake CRUD endpoints (list sessions, get detail, takeover, templates)

**Files:**
- Modify: `apps/api/src/routes/intake.routes.ts`
- Create: `apps/api/src/routes/intake-template.routes.ts`
- Modify: `apps/api/src/index.ts`

- [ ] **Step 1: Extend intake.routes.ts with session endpoints**

Append chained routes after the existing `.post("/criteria/suggest", ...)`:

```typescript
  .get(
    "/sessions",
    requirePermission("application", "read"),
    zValidator("query", z.object({
      state: z.enum(["awaiting_first_reply","in_progress","awaiting_human","completed"]).optional(),
      limit: z.coerce.number().int().min(1).max(100).default(50),
    })),
    async (c) => {
      try {
        const orgId = c.get("organizationId");
        const { state, limit } = c.req.valid("query");
        const where = state
          ? and(eq(intakeSessions.organizationId, orgId), eq(intakeSessions.state, state))
          : eq(intakeSessions.organizationId, orgId);
        const rows = await db
          .select({
            id: intakeSessions.id,
            state: intakeSessions.state,
            verdict: intakeSessions.verdict,
            createdAt: intakeSessions.createdAt,
            lastInboundAt: intakeSessions.lastInboundAt,
            lastOutboundAt: intakeSessions.lastOutboundAt,
            candidateName: sql<string>`${candidates.firstName} || ' ' || ${candidates.lastName}`,
            vacancyTitle: vacancies.title,
          })
          .from(intakeSessions)
          .innerJoin(candidateApplications, eq(intakeSessions.applicationId, candidateApplications.id))
          .innerJoin(candidates, eq(candidateApplications.candidateId, candidates.id))
          .innerJoin(vacancies, eq(candidateApplications.vacancyId, vacancies.id))
          .where(where)
          .orderBy(desc(intakeSessions.createdAt))
          .limit(limit);
        return c.json({ sessions: rows });
      } catch (e) { return errorResponse(c, e as Error); }
    },
  )
  .get(
    "/sessions/:id",
    requirePermission("application", "read"),
    async (c) => {
      try {
        const orgId = c.get("organizationId");
        const id = c.req.param("id");
        const [session] = await db
          .select()
          .from(intakeSessions)
          .where(and(eq(intakeSessions.id, id), eq(intakeSessions.organizationId, orgId)))
          .limit(1);
        if (!session) return c.json({ error: "not found" }, 404);
        const messages = await db
          .select()
          .from(intakeMessages)
          .where(eq(intakeMessages.sessionId, id))
          .orderBy(intakeMessages.sentAt);
        return c.json({ session, messages });
      } catch (e) { return errorResponse(c, e as Error); }
    },
  )
  .post(
    "/sessions/:id/takeover",
    requirePermission("application", "update"),
    async (c) => {
      try {
        const orgId = c.get("organizationId");
        const id = c.req.param("id");
        await db
          .update(intakeSessions)
          .set({ state: "awaiting_human" })
          .where(and(eq(intakeSessions.id, id), eq(intakeSessions.organizationId, orgId)));
        return c.json({ ok: true });
      } catch (e) { return errorResponse(c, e as Error); }
    },
  )
  .post(
    "/sessions/:id/reply",
    requirePermission("application", "update"),
    zValidator("json", z.object({ body: z.string().min(1).max(2000) })),
    async (c) => {
      try {
        const orgId = c.get("organizationId");
        const id = c.req.param("id");
        const { body } = c.req.valid("json");
        // Load session + phone
        const [row] = await db
          .select({ orgId: intakeSessions.organizationId, phone: candidates.phone })
          .from(intakeSessions)
          .innerJoin(candidateApplications, eq(intakeSessions.applicationId, candidateApplications.id))
          .innerJoin(candidates, eq(candidateApplications.candidateId, candidates.id))
          .where(and(eq(intakeSessions.id, id), eq(intakeSessions.organizationId, orgId)))
          .limit(1);
        if (!row) return c.json({ error: "not found" }, 404);
        const gw = createTwilioSandboxGateway({
          accountSid: process.env.TWILIO_ACCOUNT_SID!,
          authToken: process.env.TWILIO_AUTH_TOKEN!,
          fromNumber: process.env.TWILIO_WHATSAPP_FROM ?? "whatsapp:+14155238886",
        });
        const send = await gw.send({ toPhone: row.phone ?? "", body });
        await db.insert(intakeMessages).values({
          organizationId: row.orgId,
          sessionId: id,
          direction: "outbound",
          body,
          twilioSid: send.messageSid,
          isFromBot: false,
        });
        await db
          .update(intakeSessions)
          .set({ lastOutboundAt: new Date() })
          .where(eq(intakeSessions.id, id));
        return c.json({ ok: true });
      } catch (e) { return errorResponse(c, e as Error); }
    },
  )
  .post(
    "/sessions/:id/manual-verdict",
    requirePermission("application", "update"),
    zValidator("json", z.object({
      verdict: z.enum(["qualified", "rejected", "unsure"]),
      reason: z.string().min(1),
    })),
    async (c) => {
      try {
        const orgId = c.get("organizationId");
        const id = c.req.param("id");
        const { verdict, reason } = c.req.valid("json");
        await db
          .update(intakeSessions)
          .set({ state: "completed", verdict, verdictReason: reason, completedAt: new Date() })
          .where(and(eq(intakeSessions.id, id), eq(intakeSessions.organizationId, orgId)));
        await getJobQueue().send("intake.fleks_pushback", { sessionId: id });
        return c.json({ ok: true });
      } catch (e) { return errorResponse(c, e as Error); }
    },
  );
```

Add imports needed at top:
```typescript
import { desc, sql } from "drizzle-orm";
import {
  intakeSessions, intakeMessages,
  candidateApplications, candidates, vacancies,
} from "../db/schema/index.js";
import { createTwilioSandboxGateway } from "../modules/intake/whatsapp/twilio-sandbox.js";
import { getJobQueue } from "../lib/job-queue.js";
```

- [ ] **Step 2: Create intake-template.routes.ts (CRUD)**

```typescript
// apps/api/src/routes/intake-template.routes.ts
import { Hono } from "hono";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import { eq, and } from "drizzle-orm";
import type { AppEnv } from "../lib/app-env.js";
import { requirePermission } from "../middleware/rbac.middleware.js";
import { db } from "../db/index.js";
import { intakeTemplates } from "../db/schema/index.js";
import { errorResponse } from "../lib/errors.js";

const templateSchema = z.object({
  variant: z.enum(["first_contact", "reminder_24h", "reminder_72h", "no_response_farewell"]),
  locale: z.string().default("nl"),
  name: z.string().min(1),
  body: z.string().min(1),
  isActive: z.boolean().default(true),
});

export const intakeTemplateRoutes = new Hono<AppEnv>()
  .get("/", requirePermission("settings", "read"), async (c) => {
    try {
      const orgId = c.get("organizationId");
      const rows = await db
        .select()
        .from(intakeTemplates)
        .where(eq(intakeTemplates.organizationId, orgId));
      return c.json({ templates: rows });
    } catch (e) { return errorResponse(c, e as Error); }
  })
  .put("/:id", requirePermission("settings", "update"),
    zValidator("json", templateSchema.partial()),
    async (c) => {
      try {
        const orgId = c.get("organizationId");
        const id = c.req.param("id");
        const patch = c.req.valid("json");
        await db
          .update(intakeTemplates)
          .set({ ...patch, updatedAt: new Date() })
          .where(and(eq(intakeTemplates.id, id), eq(intakeTemplates.organizationId, orgId)));
        return c.json({ ok: true });
      } catch (e) { return errorResponse(c, e as Error); }
    },
  );
```

- [ ] **Step 3: Mount both in index.ts**

```typescript
import { intakeTemplateRoutes } from "./routes/intake-template.routes.js";
app.route("/api/intake-templates", intakeTemplateRoutes);
```

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/routes/intake.routes.ts apps/api/src/routes/intake-template.routes.ts apps/api/src/index.ts
git commit -m "feat(api): add intake session + template CRUD endpoints"
```

---

## Task 22: Frontend hooks + apiClient wrappers

**Files:**
- Create: `apps/web/src/hooks/use-intake.ts`

- [ ] **Step 1: Implement use-intake.ts**

```typescript
// apps/web/src/hooks/use-intake.ts
"use client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import type { IntakeSession, IntakeMessage, IntakeTemplate } from "@recruitment-os/types";

type SessionRow = Pick<IntakeSession, "id" | "state" | "verdict" | "createdAt" | "lastInboundAt" | "lastOutboundAt"> & {
  candidateName: string;
  vacancyTitle: string;
};

export function useIntakeSessions(state?: IntakeSession["state"]) {
  const qs = state ? `?state=${state}` : "";
  return useQuery<{ sessions: SessionRow[] }>({
    queryKey: ["intake-sessions", state],
    queryFn: () => apiClient(`/api/intake/sessions${qs}`),
  });
}

export function useIntakeSession(id: string) {
  return useQuery<{ session: IntakeSession; messages: IntakeMessage[] }>({
    queryKey: ["intake-session", id],
    queryFn: () => apiClient(`/api/intake/sessions/${id}`),
    enabled: !!id,
    refetchInterval: 5000,
  });
}

export function useIntakeTakeover(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => apiClient(`/api/intake/sessions/${id}/takeover`, { method: "POST" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["intake-session", id] }),
  });
}

export function useIntakeManualReply(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: string) =>
      apiClient(`/api/intake/sessions/${id}/reply`, {
        method: "POST",
        body: JSON.stringify({ body }),
        headers: { "content-type": "application/json" },
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["intake-session", id] }),
  });
}

export function useIntakeManualVerdict(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (args: { verdict: "qualified" | "rejected" | "unsure"; reason: string }) =>
      apiClient(`/api/intake/sessions/${id}/manual-verdict`, {
        method: "POST",
        body: JSON.stringify(args),
        headers: { "content-type": "application/json" },
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["intake-session", id] }),
  });
}

export function useIntakeTemplates() {
  return useQuery<{ templates: IntakeTemplate[] }>({
    queryKey: ["intake-templates"],
    queryFn: () => apiClient("/api/intake-templates/"),
  });
}

export function useUpdateIntakeTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...patch }: Partial<IntakeTemplate> & { id: string }) =>
      apiClient(`/api/intake-templates/${id}`, {
        method: "PUT",
        body: JSON.stringify(patch),
        headers: { "content-type": "application/json" },
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["intake-templates"] }),
  });
}

export function useCriteriaSuggest() {
  return useMutation({
    mutationFn: (vacancyId: string) =>
      apiClient("/api/intake/criteria/suggest", {
        method: "POST",
        body: JSON.stringify({ vacancyId }),
        headers: { "content-type": "application/json" },
      }),
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/hooks/use-intake.ts
git commit -m "feat(web): add intake TanStack Query hooks"
```

---

## Task 23: Intake Inbox page + sidebar entry

**Files:**
- Create: `apps/web/src/app/(app)/intake/page.tsx`
- Modify: `apps/web/src/components/layout/sidebar.tsx`

- [ ] **Step 1: Create Intake Inbox page**

```tsx
// apps/web/src/app/(app)/intake/page.tsx
"use client";
import { useState } from "react";
import Link from "next/link";
import { useIntakeSessions } from "@/hooks/use-intake";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { formatDistanceToNow } from "date-fns";

const TABS = [
  { key: "in_progress", label: "Actief" },
  { key: "awaiting_human", label: "Wacht op mens" },
  { key: "awaiting_first_reply", label: "Eerste bericht gestuurd" },
  { key: "completed", label: "Afgerond" },
] as const;

export default function IntakeInboxPage() {
  const [tab, setTab] = useState<typeof TABS[number]["key"]>("in_progress");
  const { data } = useIntakeSessions(tab);

  return (
    <div className="space-y-4 p-6">
      <h1 className="text-2xl font-semibold">Intake Inbox</h1>
      <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
        <TabsList>
          {TABS.map((t) => <TabsTrigger key={t.key} value={t.key}>{t.label}</TabsTrigger>)}
        </TabsList>
        {TABS.map((t) => (
          <TabsContent key={t.key} value={t.key} className="mt-4">
            {data && (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Kandidaat</TableHead>
                    <TableHead>Vacature</TableHead>
                    <TableHead>Verdict</TableHead>
                    <TableHead>Laatste activiteit</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.sessions.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell>
                        <Link href={`/intake/${s.id}`} className="hover:underline font-medium">
                          {s.candidateName}
                        </Link>
                      </TableCell>
                      <TableCell>{s.vacancyTitle}</TableCell>
                      <TableCell>{s.verdict ? <Badge>{s.verdict}</Badge> : "–"}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {s.lastInboundAt ? formatDistanceToNow(new Date(s.lastInboundAt), { addSuffix: true }) : "–"}
                      </TableCell>
                    </TableRow>
                  ))}
                  {data.sessions.length === 0 && (
                    <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">Geen sessies</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            )}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
```

- [ ] **Step 2: Add Intake link to sidebar**

Read `apps/web/src/components/layout/sidebar.tsx`. Find the `FULL_NAV` array (or similar nav-items array) and add:

```typescript
{ href: "/intake", label: "Intake", icon: MessageSquareReply },
```

Add icon import from lucide-react:
```typescript
import { MessageSquareReply } from "lucide-react";
```

Place "Intake" after "Vacatures" / "Kandidaten" depending on existing order.

- [ ] **Step 3: Smoke test**

Visit `http://localhost:3002/intake` after login. Expected: page renders with empty table (no sessions yet).

- [ ] **Step 4: Commit**

```bash
git add "apps/web/src/app/(app)/intake/page.tsx" apps/web/src/components/layout/sidebar.tsx
git commit -m "feat(web): add Intake Inbox page + sidebar nav entry"
```

---

## Task 24: Intake Session detail page (transcript + checklist + actions)

**Files:**
- Create: `apps/web/src/app/(app)/intake/[id]/page.tsx`
- Create: `apps/web/src/components/intake/session-transcript.tsx`
- Create: `apps/web/src/components/intake/must-have-checklist.tsx`
- Create: `apps/web/src/components/intake/verdict-card.tsx`
- Create: `apps/web/src/components/intake/takeover-dialog.tsx`

- [ ] **Step 1: Create session-transcript.tsx**

```tsx
// apps/web/src/components/intake/session-transcript.tsx
"use client";
import type { IntakeMessage } from "@recruitment-os/types";
import { format } from "date-fns";

export function SessionTranscript({ messages }: { messages: IntakeMessage[] }) {
  return (
    <div className="flex flex-col gap-2 p-4 bg-slate-50 overflow-y-auto">
      {messages.map((m) => {
        const isOutbound = m.direction === "outbound";
        return (
          <div key={m.id} className={`flex ${isOutbound ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-xs px-3 py-2 rounded-lg text-sm whitespace-pre-wrap ${
                isOutbound
                  ? m.isFromBot
                    ? "bg-blue-100 text-blue-900"
                    : "bg-green-100 text-green-900"
                  : "bg-white text-slate-900 border"
              }`}
            >
              <p>{m.body}</p>
              <p className="text-[10px] mt-1 opacity-60">
                {isOutbound ? (m.isFromBot ? "bot" : "recruiter") : "kandidaat"} · {format(new Date(m.sentAt), "HH:mm")}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: Create must-have-checklist.tsx**

```tsx
// apps/web/src/components/intake/must-have-checklist.tsx
"use client";
import { Check, Circle, AlertCircle } from "lucide-react";

export function MustHaveChecklist({
  criteria,
  answers,
  stuck,
}: {
  criteria: Record<string, unknown>;
  answers: Record<string, unknown>;
  stuck: Record<string, number>;
}) {
  const keys = Object.keys(criteria ?? {}).filter((k) => k !== "customKeys");
  const customKeys = (criteria?.customKeys as Array<{ key: string }> | undefined) ?? [];

  function status(k: string) {
    if (answers[k] !== undefined) return "done";
    if ((stuck[k] ?? 0) > 0) return "stuck";
    return "pending";
  }

  const all = [...keys, ...customKeys.map((c) => c.key)];

  return (
    <div className="space-y-1 text-sm">
      <h3 className="font-semibold mb-2">Must-haves</h3>
      {all.map((k) => {
        const s = status(k);
        return (
          <div key={k} className="flex items-center gap-2">
            {s === "done" && <Check className="size-4 text-green-600" />}
            {s === "stuck" && <AlertCircle className="size-4 text-amber-600" />}
            {s === "pending" && <Circle className="size-4 text-slate-400" />}
            <span className={s === "done" ? "text-slate-700" : "text-slate-500"}>{k}</span>
          </div>
        );
      })}
      {all.length === 0 && <p className="text-xs text-muted-foreground">Geen must-haves geconfigureerd.</p>}
    </div>
  );
}
```

- [ ] **Step 3: Create verdict-card.tsx**

```tsx
// apps/web/src/components/intake/verdict-card.tsx
"use client";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { IntakeSession } from "@recruitment-os/types";

export function VerdictCard({ session }: { session: IntakeSession }) {
  if (!session.verdict) return null;
  const color =
    session.verdict === "qualified" ? "bg-green-100 text-green-800" :
    session.verdict === "rejected" ? "bg-red-100 text-red-800" :
    "bg-amber-100 text-amber-800";
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          Verdict <Badge className={color}>{session.verdict}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">{session.verdictReason}</p>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 4: Create takeover-dialog.tsx**

```tsx
// apps/web/src/components/intake/takeover-dialog.tsx
"use client";
import * as React from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useIntakeTakeover, useIntakeManualReply } from "@/hooks/use-intake";

export function TakeoverDialog({ sessionId }: { sessionId: string }) {
  const takeover = useIntakeTakeover(sessionId);
  const reply = useIntakeManualReply(sessionId);
  const [text, setText] = React.useState("");
  const [open, setOpen] = React.useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline">Neem gesprek over</Button>} />
      <DialogContent>
        <DialogHeader><DialogTitle>Gesprek overnemen</DialogTitle></DialogHeader>
        <p className="text-sm text-muted-foreground">Bot pauzeert. Typ je antwoord, het wordt als WhatsApp-bericht verstuurd.</p>
        <Textarea value={text} onChange={(e) => setText(e.target.value)} rows={3} />
        <div className="flex gap-2 justify-end">
          <Button variant="secondary" onClick={() => setOpen(false)}>Annuleren</Button>
          <Button
            disabled={!text.trim() || reply.isPending}
            onClick={async () => {
              await takeover.mutateAsync();
              await reply.mutateAsync(text);
              setText("");
              setOpen(false);
            }}
          >Versturen</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 5: Create the detail page**

```tsx
// apps/web/src/app/(app)/intake/[id]/page.tsx
"use client";
import { useParams } from "next/navigation";
import { useIntakeSession } from "@/hooks/use-intake";
import { SessionTranscript } from "@/components/intake/session-transcript";
import { MustHaveChecklist } from "@/components/intake/must-have-checklist";
import { VerdictCard } from "@/components/intake/verdict-card";
import { TakeoverDialog } from "@/components/intake/takeover-dialog";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

export default function IntakeSessionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data, isLoading } = useIntakeSession(id);

  if (isLoading || !data) {
    return <div className="p-6"><Skeleton className="h-96 w-full" /></div>;
  }

  const { session, messages } = data;

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col">
      <div className="border-b p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-semibold">Intake sessie</h1>
          <Badge>{session.state}</Badge>
        </div>
        {session.state !== "completed" && <TakeoverDialog sessionId={session.id} />}
      </div>
      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 overflow-y-auto">
          <SessionTranscript messages={messages} />
        </div>
        <div className="w-72 border-l p-4 space-y-4 bg-white">
          <MustHaveChecklist
            criteria={{}}
            answers={session.mustHaveAnswers as Record<string, unknown>}
            stuck={session.stuckCounter as Record<string, number>}
          />
          {session.verdict && <VerdictCard session={session} />}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 6: Commit**

```bash
git add "apps/web/src/app/(app)/intake/[id]/page.tsx" apps/web/src/components/intake/
git commit -m "feat(web): add intake session detail page with transcript + checklist + takeover"
```

---

## Task 25: Vacancy Intake tab (criteria editor + AI-assist)

**Files:**
- Create: `apps/web/src/app/(app)/vacancies/[id]/intake/page.tsx`
- Create: `apps/web/src/components/intake/criteria-editor.tsx`
- Create: `apps/web/src/components/intake/criteria-ai-suggest.tsx`

- [ ] **Step 1: Create criteria-editor.tsx**

```tsx
// apps/web/src/components/intake/criteria-editor.tsx
"use client";
import * as React from "react";
import type { QualificationCriteria } from "@recruitment-os/types";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export function CriteriaEditor({
  value,
  onChange,
}: {
  value: QualificationCriteria;
  onChange: (v: QualificationCriteria) => void;
}) {
  const mh = value.mustHave ?? {};
  const nth = value.niceToHave ?? {};

  function updateMust(patch: Partial<typeof mh>) {
    onChange({ ...value, mustHave: { ...mh, ...patch } });
  }
  function updateNice(patch: Partial<typeof nth>) {
    onChange({ ...value, niceToHave: { ...nth, ...patch } });
  }

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <h3 className="text-sm font-semibold">Must-haves</h3>

        <div className="space-y-2">
          <Label>Licenties (komma-gescheiden)</Label>
          <Input
            value={(mh.licenses ?? []).join(", ")}
            onChange={(e) => updateMust({ licenses: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })}
            placeholder="CE, code95, ADR"
          />
        </div>

        <div className="space-y-2">
          <Label>Vertical</Label>
          <Select value={mh.vertical ?? ""} onValueChange={(v) => updateMust({ vertical: (v || undefined) as any })}>
            <SelectTrigger><SelectValue placeholder="Kies vertical" /></SelectTrigger>
            <SelectContent>
              {["security", "traffic", "bouw", "zorg", "infra"].map((v) => (
                <SelectItem key={v} value={v}>{v}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Beschikbaarheid</Label>
          <Select value={mh.availability ?? ""} onValueChange={(v) => updateMust({ availability: (v || undefined) as any })}>
            <SelectTrigger><SelectValue placeholder="Kies" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="fulltime">Fulltime</SelectItem>
              <SelectItem value="parttime">Parttime</SelectItem>
              <SelectItem value="flexible">Flexibel</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-3">
        <h3 className="text-sm font-semibold">Nice-to-haves</h3>
        <div className="space-y-2">
          <Label>Min. ervaring (jaren)</Label>
          <Input
            type="number" min={0}
            value={nth.experienceYearsMin ?? ""}
            onChange={(e) => updateNice({ experienceYearsMin: e.target.value ? Number(e.target.value) : undefined })}
          />
        </div>
        <div className="space-y-2">
          <Label>Vrije tekst (context voor Claude)</Label>
          <Textarea
            rows={3}
            value={nth.freeText ?? ""}
            onChange={(e) => updateNice({ freeText: e.target.value })}
            placeholder="Bv. 'Bij voorkeur ervaring met internationale ritten'"
          />
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create criteria-ai-suggest.tsx**

```tsx
// apps/web/src/components/intake/criteria-ai-suggest.tsx
"use client";
import { Button } from "@/components/ui/button";
import { useCriteriaSuggest } from "@/hooks/use-intake";
import { Card, CardContent } from "@/components/ui/card";
import { Sparkles } from "lucide-react";

export function CriteriaAiSuggest({ vacancyId, onAccept }: {
  vacancyId: string;
  onAccept: (suggestions: any) => void;
}) {
  const suggest = useCriteriaSuggest();
  return (
    <div className="space-y-3">
      <Button
        variant="outline"
        onClick={() => suggest.mutate(vacancyId)}
        disabled={suggest.isPending}
      >
        <Sparkles className="size-4 mr-1" />
        {suggest.isPending ? "Aan het analyseren..." : "AI-check ontbrekende critical info"}
      </Button>
      {suggest.data && (
        <Card>
          <CardContent className="pt-4 space-y-2 text-sm">
            <p className="italic text-muted-foreground">{(suggest.data as any).reasoning}</p>
            {((suggest.data as any).suggestedMustHaves ?? []).map((s: any) => (
              <div key={s.key} className="border rounded p-2">
                <p className="font-medium">Must-have: {s.key}</p>
                <p className="text-xs text-muted-foreground">{s.question}</p>
                <Button size="sm" variant="outline" onClick={() => onAccept({ type: "must", ...s })}>
                  Toevoegen
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Create vacancy intake page**

```tsx
// apps/web/src/app/(app)/vacancies/[id]/intake/page.tsx
"use client";
import { useParams } from "next/navigation";
import { useState, useEffect } from "react";
import { useVacancy } from "@/hooks/use-vacancies";
import { CriteriaEditor } from "@/components/intake/criteria-editor";
import { CriteriaAiSuggest } from "@/components/intake/criteria-ai-suggest";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { apiClient } from "@/lib/api-client";
import type { QualificationCriteria } from "@recruitment-os/types";

export default function VacancyIntakePage() {
  const { id } = useParams<{ id: string }>();
  const { data: vacancy } = useVacancy(id);
  const [criteria, setCriteria] = useState<QualificationCriteria>({ mustHave: {}, niceToHave: {} });
  const [intakeEnabled, setIntakeEnabled] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!vacancy) return;
    setCriteria((vacancy as any).qualificationCriteria ?? { mustHave: {}, niceToHave: {} });
    setIntakeEnabled(!!(vacancy as any).intakeEnabled);
  }, [vacancy]);

  const save = async () => {
    setSaving(true);
    try {
      await apiClient(`/api/vacancies/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ intakeEnabled, qualificationCriteria: criteria }),
        headers: { "content-type": "application/json" },
      });
    } finally { setSaving(false); }
  };

  if (!vacancy) return <div className="p-6">Loading…</div>;

  return (
    <div className="p-6 max-w-3xl space-y-6">
      <div className="flex items-center gap-3">
        <h1 className="text-xl font-semibold">Intake-instellingen: {vacancy.title}</h1>
      </div>
      <div className="flex items-center gap-3">
        <Switch checked={intakeEnabled} onCheckedChange={setIntakeEnabled} id="intake-enabled" />
        <Label htmlFor="intake-enabled">Automatische WhatsApp-intake actief</Label>
      </div>
      <CriteriaAiSuggest
        vacancyId={id}
        onAccept={(s) => {
          if (s.type === "must") {
            setCriteria((c) => ({
              ...c,
              mustHave: {
                ...c.mustHave,
                customKeys: [...(c.mustHave.customKeys ?? []), {
                  key: s.key, question: s.question,
                  expectedFormat: s.expectedFormat, enumValues: s.enumValues, required: true,
                }],
              },
            }));
          }
        }}
      />
      <CriteriaEditor value={criteria} onChange={setCriteria} />
      <Button onClick={save} disabled={saving}>{saving ? "Opslaan…" : "Opslaan"}</Button>
    </div>
  );
}
```

- [ ] **Step 4: Verify PATCH endpoint on vacancy**

Check that `PATCH /api/vacancies/:id` accepts `intakeEnabled` + `qualificationCriteria`. Read `apps/api/src/routes/vacancy.routes.ts` — if not present, extend the update-schema to include these two fields.

- [ ] **Step 5: Commit**

```bash
git add "apps/web/src/app/(app)/vacancies/[id]/intake/page.tsx" apps/web/src/components/intake/criteria-editor.tsx apps/web/src/components/intake/criteria-ai-suggest.tsx
# plus vacancy.routes.ts if modified
git commit -m "feat(web): add Vacancy Intake settings page with criteria editor + AI-suggest"
```

---

## Task 26: Settings — Intake Templates page

**Files:**
- Create: `apps/web/src/app/(app)/settings/intake-templates/page.tsx`
- Create: `apps/web/src/components/intake/template-editor.tsx`

- [ ] **Step 1: Create template-editor.tsx**

```tsx
// apps/web/src/components/intake/template-editor.tsx
"use client";
import { useState, useEffect } from "react";
import type { IntakeTemplate } from "@recruitment-os/types";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useUpdateIntakeTemplate } from "@/hooks/use-intake";

const MERGE_FIELDS = [
  "{{candidate.first_name}}", "{{candidate.full_name}}",
  "{{vacancy.title}}", "{{vacancy.location}}",
  "{{client.name}}", "{{tenant.name}}",
  "{{recruiter.name}}", "{{recruiter.phone}}",
];

export function TemplateEditor({ template }: { template: IntakeTemplate }) {
  const [body, setBody] = useState(template.body);
  const [name, setName] = useState(template.name);
  const update = useUpdateIntakeTemplate();

  useEffect(() => { setBody(template.body); setName(template.name); }, [template.id]);

  return (
    <div className="space-y-3 p-4 border rounded">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">{template.variant}</h3>
        <span className="text-xs text-muted-foreground">status: {template.wabaStatus}</span>
      </div>
      <Label>Naam</Label>
      <Input value={name} onChange={(e) => setName(e.target.value)} />
      <Label>Bericht</Label>
      <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={4} />
      <div className="flex flex-wrap gap-1">
        {MERGE_FIELDS.map((f) => (
          <button
            key={f} type="button"
            className="text-xs px-2 py-0.5 bg-slate-100 rounded hover:bg-slate-200"
            onClick={() => setBody((b) => b + " " + f)}
          >{f}</button>
        ))}
      </div>
      <Button
        onClick={() => update.mutate({ id: template.id, body, name })}
        disabled={update.isPending}
      >Opslaan</Button>
    </div>
  );
}
```

- [ ] **Step 2: Create the settings page**

```tsx
// apps/web/src/app/(app)/settings/intake-templates/page.tsx
"use client";
import { useIntakeTemplates } from "@/hooks/use-intake";
import { TemplateEditor } from "@/components/intake/template-editor";

export default function IntakeTemplatesPage() {
  const { data } = useIntakeTemplates();
  return (
    <div className="p-6 space-y-4 max-w-3xl">
      <h1 className="text-xl font-semibold">Intake-templates</h1>
      {data?.templates.map((t) => <TemplateEditor key={t.id} template={t} />)}
      {data?.templates.length === 0 && <p>Geen templates gevonden — run seed.</p>}
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add "apps/web/src/app/(app)/settings/intake-templates/page.tsx" apps/web/src/components/intake/template-editor.tsx
git commit -m "feat(web): add Settings > Intake Templates editor page"
```

---

## Task 27: Sentry + basic metrics

**Files:**
- Modify: `apps/api/src/modules/intake/agent/intake-agent.ts`
- Modify: `apps/api/src/modules/intake/fleks/sync.service.ts`
- Modify: `apps/api/src/jobs/intake.jobs.ts`
- Create: `apps/api/src/routes/intake-metrics.routes.ts`

- [ ] **Step 1: Wrap Claude + Twilio + Fleks calls in try/catch with Sentry**

In `intake-agent.ts`, wrap `deps.claude.messages.create` in:
```typescript
try {
  // existing code
} catch (err) {
  const Sentry = (globalThis as any).Sentry;
  if (Sentry?.captureException) Sentry.captureException(err, { extra: { sessionId: ctx.sessionId } });
  throw err;
}
```

Same pattern in:
- `sync.service.ts` around each `client.listJobs` / `client.listJobCandidates`
- `intake.jobs.ts` intake.process_message handler outer try/catch

- [ ] **Step 2: Create intake-metrics.routes.ts**

```typescript
// apps/api/src/routes/intake-metrics.routes.ts
import { Hono } from "hono";
import { sql } from "drizzle-orm";
import type { AppEnv } from "../lib/app-env.js";
import { requirePermission } from "../middleware/rbac.middleware.js";
import { db } from "../db/index.js";
import { intakeSessions } from "../db/schema/index.js";
import { errorResponse } from "../lib/errors.js";

export const intakeMetricsRoutes = new Hono<AppEnv>()
  .get("/summary", requirePermission("dashboard", "read"), async (c) => {
    try {
      const orgId = c.get("organizationId");
      const [row] = await db.execute(sql`
        SELECT
          COUNT(*) FILTER (WHERE state = 'in_progress') as active,
          COUNT(*) FILTER (WHERE state = 'awaiting_human') as awaiting_human,
          COUNT(*) FILTER (WHERE state = 'completed' AND verdict = 'qualified') as qualified,
          COUNT(*) FILTER (WHERE state = 'completed' AND verdict = 'rejected') as rejected,
          COUNT(*) FILTER (WHERE state = 'completed' AND verdict = 'unsure') as unsure,
          COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '24 hours') as last_24h
        FROM intake_sessions
        WHERE organization_id = ${orgId}
      `);
      return c.json(row);
    } catch (e) { return errorResponse(c, e as Error); }
  });
```

- [ ] **Step 3: Mount + add widget on admin dashboard**

In `apps/api/src/index.ts`:
```typescript
import { intakeMetricsRoutes } from "./routes/intake-metrics.routes.js";
app.route("/api/intake/metrics", intakeMetricsRoutes);
```

Optional: surface counters on the existing admin-dashboard page (small enhancement, can defer).

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/modules/intake/agent/intake-agent.ts apps/api/src/modules/intake/fleks/sync.service.ts apps/api/src/jobs/intake.jobs.ts apps/api/src/routes/intake-metrics.routes.ts apps/api/src/index.ts
git commit -m "feat(api): add Sentry capture + /api/intake/metrics/summary"
```

---

## Task 28: E2E Playwright test for happy path

**Files:**
- Create: `apps/web/tests/e2e/intake-flow.spec.ts`

- [ ] **Step 1: Create the test**

```typescript
// apps/web/tests/e2e/intake-flow.spec.ts
import { test, expect } from "@playwright/test";

test.describe("Fleks + WhatsApp intake — E2E happy path", () => {
  test("full flow: Fleks candidate -> WhatsApp -> verdict", async ({ page, request }) => {
    // 1. Login
    await page.goto("/login");
    await page.fill('input[type="email"]', "admin@test.com");
    await page.fill('input[type="password"]', "password123");
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/dashboard/);

    // 2. Setup: seed a vacancy with intake enabled + criteria
    // (Done via API; requires auth cookie shared with `request`.)

    // 3. Trigger fleks.sync-tick via admin endpoint (to be added as test-only)
    //    OR pre-seed an intake_session directly in DB via fixture.

    // 4. Simulate inbound WhatsApp webhook
    const resp = await request.post("http://localhost:4000/api/webhooks/whatsapp/twilio", {
      form: {
        From: "whatsapp:+31600000001",
        MessageSid: "SM_test_1",
        Body: "Ja ik heb CE en ben fulltime beschikbaar",
        NumMedia: "0",
      },
      headers: { "content-type": "application/x-www-form-urlencoded" },
    });
    expect(resp.status()).toBe(200);

    // 5. Poll Intake Inbox for the session
    await page.goto("/intake");
    await expect(page.locator("text=in_progress")).toBeVisible({ timeout: 15_000 });

    // 6. Open session detail — should show at least one inbound message
    await page.click("table tbody tr:first-child a");
    await expect(page.locator("text=Ja ik heb CE")).toBeVisible();
  });
});
```

NOTE: this test assumes:
- Dev server running on :3002 + :4000
- DB seeded with a candidate whose phone = `+31600000001` and an intake_session in `awaiting_first_reply`
- `TWILIO_VERIFY_WEBHOOKS=false` in test env

Steps 2-3 require a test fixture — mark with `test.fixme()` if fixture setup is deferred to a dedicated task.

- [ ] **Step 2: Run**

Run: `pnpm --filter web test:e2e -- intake-flow.spec.ts`
Expected: PASS (or `fixme` skip if fixture pending).

- [ ] **Step 3: Commit**

```bash
git add apps/web/tests/e2e/intake-flow.spec.ts
git commit -m "test(web): e2e happy-path for Fleks + WhatsApp intake flow"
```

---

## Task 29: Vacancy Room integration — Fleks Intake column + activity events

**Files:**
- Modify: `apps/api/src/services/room-timeline.service.ts` (extend activity event filter if needed)
- Modify: `apps/api/src/jobs/intake.jobs.ts` (emit activity events on state transitions)
- Modify: `apps/web/src/components/pipeline/pipeline-board.tsx` (badge on Fleks Intake column)

- [ ] **Step 1: Emit activity-log events on intake state changes**

In `apps/api/src/jobs/intake.jobs.ts`, wherever session state changes (startSession done, verdict finalized, escalate), insert an `activity_log` row:

```typescript
import { activityLog } from "../db/schema/index.js";

// After startSession completes:
await db.insert(activityLog).values({
  organizationId: row.orgId,
  entityType: "application",
  entityId: applicationIdFor(sessionId),  // look up from session
  action: "intake_started",
  actorId: "00000000-0000-0000-0000-000000000000", // system bot user
  metadata: { sessionId, vacancyId },
});

// In finalize verdict (tool-store):
// action: "intake_qualified" | "intake_rejected" | "intake_unsure"

// In escalate:
// action: "intake_escalated", metadata: { reason }
```

The Room Timeline already picks up `activity_log` events (see room-timeline.service.ts) and displays them. Since these events have `entityType: "application"` with `vacancyId` in metadata, they appear in the Vacancy Room timeline automatically.

- [ ] **Step 2: Label new event types in the Room Timeline UI**

Extend `apps/web/src/components/room/room-timeline-item.tsx` — add to `EVENT_LABELS` + `EVENT_ICONS`:

```typescript
intake_started: () => "intake gestart via WhatsApp",
intake_qualified: () => "gekwalificeerd door bot",
intake_rejected: () => "afgewezen door bot",
intake_unsure: () => "bot twijfelt — wacht op recruiter",
intake_escalated: (meta) => `bot escaleerde (${meta.reason})`,
```

And corresponding icons from lucide-react.

- [ ] **Step 3: Add badge to Fleks Intake column in pipeline board**

Read `apps/web/src/components/pipeline/pipeline-board.tsx`. Locate the stage-header render. Add — when a stage's slug is `fleks_intake` — a small badge showing number of sessions in `state=in_progress` or `awaiting_human` for that vacancy. Fetch via:

```typescript
const { data: intakeStats } = useQuery({
  queryKey: ["vacancy-intake-stats", vacancyId],
  queryFn: () => apiClient(`/api/intake/metrics/summary`),
  refetchInterval: 30_000,
});
```

Then in the stage header for slug `fleks_intake`, render:
```tsx
<Badge variant="outline">{intakeStats?.active ?? 0} lopend</Badge>
```

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/jobs/intake.jobs.ts apps/web/src/components/room/room-timeline-item.tsx apps/web/src/components/pipeline/pipeline-board.tsx
git commit -m "feat: wire intake state changes to activity log + Room timeline + pipeline badge"
```

---

## Summary

**Total: 29 tasks across 4 weeks.**

- **Week 1:** Tasks 1–9 (foundation: types, DB, Fleks client, sync worker)
- **Week 2:** Tasks 10–14 (WhatsApp gateway, orchestrator skeleton, reminders)
- **Week 3:** Tasks 15–20 (Claude agent, tool surface, pushback, criteria AI-assist)
- **Week 4:** Tasks 21–29 (REST endpoints, UI pages, metrics, Room integration, E2E)

Parallel opportunities:
- Week 3 UI work (Task 22+ hooks) can start once Task 21 API is stable.
- Week 4 E2E test (Task 28) can be drafted earlier with mocks.

**Next step:** invoke `superpowers:subagent-driven-development` to start executing this plan.
