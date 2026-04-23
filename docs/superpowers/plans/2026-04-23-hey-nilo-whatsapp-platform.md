# Hey Nilo — WhatsApp Automation Platform: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract the WhatsApp intake engine into a reusable `@hey-nilo/core` package and build a standalone Hey Nilo module for Timmers — trigger API, Claude conversation agent, session state machine, outbound webhooks, and session monitor UI.

**Architecture:** Extract the provider-agnostic engine (orchestrator, agent, tools, renderer) from `apps/api/src/modules/intake/` into `packages/nilo-core/`. Build a standalone `apps/api/src/modules/nilo/` that wires nilo-core to new `nilo_*` Drizzle tables via a `NiloPersistence` interface. Existing intake module is refactored to implement the same interface — no behavioral changes to Recruitment OS features.

**Tech Stack:** Hono, Drizzle ORM, PostgreSQL + RLS, pg-boss, Anthropic Claude SDK, Twilio WhatsApp API, Next.js, Vitest, TanStack Query

---

## File Map

### New files (packages/nilo-core)
```
packages/nilo-core/
  package.json
  tsconfig.json
  src/
    index.ts
    types.ts                     ← NiloPersistence, NiloFlow, NiloSession interfaces
    renderer.ts                  ← renderTemplate (extracted, unchanged)
    gateway.ts                   ← WhatsAppGateway interface (extracted, unchanged)
    orchestrator.ts              ← startSession, sendReminder, sendFarewell
    agent/
      tools.ts                   ← NILO_TOOLS (4 tools, same logic)
      tool-executor.ts           ← createToolExecutor + ToolStore interface
      prompts.ts                 ← buildSystemPrompt (NiloCriteria-driven)
      agent.ts                   ← processInbound (adapted from intake-agent.ts)
```

### New files (apps/api — schema)
```
apps/api/src/db/schema/
  nilo-sessions.ts
  nilo-messages.ts
  nilo-api-keys.ts
  nilo-trigger-events.ts
  nilo-webhook-logs.ts
  nilo-handoffs.ts
```

### New files (apps/api — module)
```
apps/api/src/modules/nilo/
  orchestrator.ts                ← wires nilo-core + drizzle-persistence + gateway
  flow-registry.ts               ← resolveFlow(orgId): NiloFlow | null
  outbound.ts                    ← fireWebhook + fireSlackAlert
  persistence/
    drizzle-persistence.ts       ← implements NiloPersistence using nilo_* tables
  jobs/
    nilo.jobs.ts                 ← registerNiloJobs(boss) — all 4 job handlers
```

### New files (apps/api — routes)
```
apps/api/src/routes/
  nilo-trigger.routes.ts         ← POST /api/nilo/sessions
  nilo-sessions.routes.ts        ← GET /api/nilo/sessions, GET /:id, PATCH /:id/handoff
```

### New files (apps/web — UI)
```
apps/web/src/app/(app)/nilo/
  sessions/
    page.tsx                     ← session monitor list
    [id]/page.tsx                ← session detail + conversation thread
apps/web/src/hooks/
  use-nilo-sessions.ts
  use-nilo-session.ts
```

### Modified files
```
apps/api/src/modules/intake/agent/tool-store.ts   ← implement NiloPersistence interface
apps/api/src/db/schema/index.ts                   ← export new nilo_* tables
apps/api/src/db/setup-rls.sql                     ← RLS policies for nilo_* tables
apps/api/src/jobs/job-handlers.ts                 ← call registerNiloJobs
apps/api/src/lib/job-queue.ts                     ← add nilo.* to KNOWN_QUEUES
apps/api/src/index.ts                             ← mount nilo routes
apps/api/src/routes/whatsapp-webhook.routes.ts    ← extend to handle nilo sessions
apps/web/src/components/layout/sidebar.tsx        ← add Nilo nav entry
packages/types/src/index.ts                       ← re-export NiloCriteria if used by web
```

---

## Task 1: Create packages/nilo-core workspace

**Files:**
- Create: `packages/nilo-core/package.json`
- Create: `packages/nilo-core/tsconfig.json`
- Create: `packages/nilo-core/src/types.ts`
- Create: `packages/nilo-core/src/index.ts`
- Test: `packages/nilo-core` — TypeScript clean on `pnpm tsc --noEmit`

- [ ] **Step 1: Create package.json**

```json
// packages/nilo-core/package.json
{
  "name": "@hey-nilo/core",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "devDependencies": {
    "typescript": "^5.7"
  },
  "dependencies": {
    "@anthropic-ai/sdk": "^0.30.0"
  }
}
```

- [ ] **Step 2: Create tsconfig.json**

```json
// packages/nilo-core/tsconfig.json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "declaration": true,
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src/**/*"]
}
```

- [ ] **Step 3: Create src/types.ts with all shared interfaces**

```typescript
// packages/nilo-core/src/types.ts

export type NiloSessionState =
  | 'created'
  | 'initiated'
  | 'in_progress'
  | 'awaiting_human'
  | 'completed'
  | 'abandoned'

export interface NiloSession {
  id: string
  orgId: string
  contactPhone: string
  contactName: string | null
  context: Record<string, unknown>  // vacancy_title, vacancy_location, start_date, source, etc.
  state: NiloSessionState
  verdict: 'qualified' | 'rejected' | 'unsure' | null
  verdictReason: string | null
  answers: Record<string, { value: unknown; confidence: string }>
  stuckCounter: Record<string, number>
  reminderCount: number
  matchScore: number | null
  outboundWebhookUrl: string | null
  createdAt: Date
  initiatedAt: Date | null
  completedAt: Date | null
  lastInboundAt: Date | null
  lastOutboundAt: Date | null
}

export interface NiloCriteria {
  mustHave: {
    licenses?: string[]
    availability?: boolean
    rightToWork?: boolean
    minAge?: number
    locationRadiusKm?: number
    customKeys?: Array<{ key: string; question: string; required: boolean }>
    [key: string]: unknown
  }
  niceToHave?: {
    experienceYearsMin?: number
    certifications?: string[]
    preferredLanguages?: string[]
    freeText?: string
    [key: string]: unknown
  }
}

export interface NiloTemplates {
  first_contact: string
  reminder_24h: string
  reminder_72h: string
  no_response_farewell: string
  [variant: string]: string
}

export interface ReminderStep {
  afterSeconds: number
  variant: string
}

export interface NiloFlow {
  id: string
  orgId: string
  name: string
  locale: 'nl' | 'en'
  criteria: NiloCriteria
  templates: NiloTemplates
  reminderChain: ReminderStep[]
  systemPromptExtra?: string
  webhookUrl?: string
  slackWebhookUrl?: string
  scoreThreshold?: number
}

export interface NiloPersistence {
  // Read
  getSession(orgId: string, sessionId: string): Promise<NiloSession | null>
  getRecentMessages(
    orgId: string,
    sessionId: string,
    limit?: number,
  ): Promise<Array<{ direction: 'inbound' | 'outbound'; body: string }>>

  // Lifecycle state transitions
  setInitiated(orgId: string, sessionId: string): Promise<void>
  setInProgress(orgId: string, sessionId: string): Promise<void>
  incrementReminderCount(orgId: string, sessionId: string): Promise<void>

  // Message persistence
  persistOutbound(
    orgId: string,
    sessionId: string,
    body: string,
    twilioSid: string,
    toolCalls?: unknown,
  ): Promise<void>

  // Answer tracking
  recordAnswer(
    orgId: string,
    sessionId: string,
    key: string,
    value: unknown,
    confidence: string,
  ): Promise<void>
  bumpStuck(orgId: string, sessionId: string, key: string): Promise<number>

  // Terminal state
  escalate(orgId: string, sessionId: string, reason: string, context: string): Promise<void>
  finalize(
    orgId: string,
    sessionId: string,
    status: 'qualified' | 'rejected' | 'unsure',
    summary: string,
    rejectionReason?: string,
  ): Promise<void>

  // Scheduling
  scheduleJob(orgId: string, sessionId: string, afterSeconds: number, variant: string): Promise<void>
}

// Template context shape for renderTemplate
export interface NiloTemplateContext {
  candidate: { first_name: string; full_name: string }
  vacancy: { title: string; location: string | null; start_date: string | null }
  tenant: { name: string }
}
```

- [ ] **Step 4: Create src/index.ts (empty barrel — will fill as we add files)**

```typescript
// packages/nilo-core/src/index.ts
export * from './types.js'
export * from './renderer.js'
export * from './gateway.js'
export * from './orchestrator.js'
export * from './agent/tools.js'
export * from './agent/tool-executor.js'
export * from './agent/prompts.js'
export * from './agent/agent.js'
```

- [ ] **Step 5: Add @hey-nilo/core as a dependency in apps/api/package.json**

Open `apps/api/package.json` and add to `dependencies`:
```json
"@hey-nilo/core": "workspace:*"
```

- [ ] **Step 6: Verify TypeScript compiles clean**

```bash
cd packages/nilo-core && pnpm tsc --noEmit
```

Expected: no errors (only types.ts and index.ts exist so far).

- [ ] **Step 7: Commit**

```bash
git add packages/nilo-core/ apps/api/package.json
git commit -m "feat(nilo-core): scaffold workspace with NiloPersistence and NiloFlow types"
```

---

## Task 2: Extract renderer and gateway into nilo-core

**Files:**
- Create: `packages/nilo-core/src/renderer.ts`
- Create: `packages/nilo-core/src/gateway.ts`
- Test: write unit test for renderTemplate in nilo-core

- [ ] **Step 1: Write the failing test**

Create `packages/nilo-core/src/renderer.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { renderTemplate } from './renderer.js'

describe('renderTemplate', () => {
  it('replaces merge tags with context values', () => {
    const result = renderTemplate(
      'Hoi {{candidate.first_name}}, voor {{vacancy.title}}!',
      {
        candidate: { first_name: 'Jan', full_name: 'Jan de Vries' },
        vacancy: { title: 'Chauffeur CE', location: null, start_date: null },
        tenant: { name: 'Timmers' },
      },
    )
    expect(result).toBe('Hoi Jan, voor Chauffeur CE!')
  })

  it('replaces null/undefined with empty string', () => {
    const result = renderTemplate('Locatie: {{vacancy.location}}', {
      candidate: { first_name: 'Jan', full_name: 'Jan de Vries' },
      vacancy: { title: 'T', location: null, start_date: null },
      tenant: { name: 'T' },
    })
    expect(result).toBe('Locatie: ')
  })

  it('ignores unknown scopes', () => {
    const result = renderTemplate('{{unknown.field}} test', {
      candidate: { first_name: 'J', full_name: 'J V' },
      vacancy: { title: 'T', location: null, start_date: null },
      tenant: { name: 'T' },
    })
    expect(result).toBe(' test')
  })
})
```

- [ ] **Step 2: Run to verify it fails**

```bash
cd packages/nilo-core && pnpm vitest run src/renderer.test.ts
```

Expected: FAIL — `renderer.js` not found.

- [ ] **Step 3: Create src/renderer.ts**

```typescript
// packages/nilo-core/src/renderer.ts
import type { NiloTemplateContext } from './types.js'

const MERGE_RE = /\{\{\s*([a-z_]+)\.([a-z_]+)\s*\}\}/g

export function renderTemplate(body: string, ctx: NiloTemplateContext): string {
  return body.replace(MERGE_RE, (_, scope: string, key: string) => {
    const obj = (ctx as Record<string, Record<string, unknown>>)[scope]
    if (!obj) return ''
    const val = obj[key]
    if (val === null || val === undefined) return ''
    return String(val)
  })
}

export function buildTemplateContext(
  session: { contactName: string | null; context: Record<string, unknown> },
  flow: { name: string },
): NiloTemplateContext {
  const firstName = session.contactName?.split(' ')[0] ?? 'there'
  return {
    candidate: {
      first_name: firstName,
      full_name: session.contactName ?? '',
    },
    vacancy: {
      title: String(session.context['vacancy_title'] ?? ''),
      location: session.context['vacancy_location'] != null
        ? String(session.context['vacancy_location'])
        : null,
      start_date: session.context['start_date'] != null
        ? String(session.context['start_date'])
        : null,
    },
    tenant: { name: flow.name },
  }
}
```

- [ ] **Step 4: Create src/gateway.ts**

```typescript
// packages/nilo-core/src/gateway.ts

export interface WhatsAppSendInput {
  toPhone: string
  body: string
  templateSid?: string
  templateVariables?: Record<string, string>
}

export interface WhatsAppSendResult {
  messageSid: string
  status: 'queued' | 'sent'
}

export interface WhatsAppInboundParsed {
  fromPhone: string
  messageSid: string
  body: string
  mediaUrls: string[]
}

export interface WhatsAppGateway {
  send(input: WhatsAppSendInput): Promise<WhatsAppSendResult>
  verifyWebhook(signature: string, url: string, params: Record<string, string>): boolean
  parseWebhook(params: Record<string, string>): WhatsAppInboundParsed
  isWithin24hWindow(phone: string, orgId: string): Promise<boolean>
}
```

- [ ] **Step 5: Add vitest config to nilo-core package.json**

```json
// packages/nilo-core/package.json — add devDependencies + scripts
{
  "scripts": {
    "test": "vitest run",
    "type-check": "tsc --noEmit"
  },
  "devDependencies": {
    "typescript": "^5.7",
    "vitest": "^2.0.0"
  }
}
```

- [ ] **Step 6: Run tests to verify they pass**

```bash
cd packages/nilo-core && pnpm vitest run src/renderer.test.ts
```

Expected: PASS (3 tests).

- [ ] **Step 7: Commit**

```bash
git add packages/nilo-core/src/renderer.ts packages/nilo-core/src/gateway.ts packages/nilo-core/src/renderer.test.ts packages/nilo-core/package.json
git commit -m "feat(nilo-core): add renderer and WhatsAppGateway interface"
```

---

## Task 3: Extract agent tools and executor into nilo-core

**Files:**
- Create: `packages/nilo-core/src/agent/tools.ts`
- Create: `packages/nilo-core/src/agent/tool-executor.ts`
- Test: `packages/nilo-core/src/agent/tool-executor.test.ts`

- [ ] **Step 1: Write the failing test for tool-executor**

```typescript
// packages/nilo-core/src/agent/tool-executor.test.ts
import { describe, it, expect, vi } from 'vitest'
import { createToolExecutor } from './tool-executor.js'
import type { NiloPersistence } from '../types.js'

function makeStore(overrides: Partial<NiloPersistence> = {}): NiloPersistence {
  return {
    getSession: vi.fn(),
    getRecentMessages: vi.fn(),
    setInitiated: vi.fn(),
    setInProgress: vi.fn(),
    incrementReminderCount: vi.fn(),
    persistOutbound: vi.fn(),
    recordAnswer: vi.fn().mockResolvedValue(undefined),
    bumpStuck: vi.fn().mockResolvedValue(1),
    escalate: vi.fn().mockResolvedValue(undefined),
    finalize: vi.fn().mockResolvedValue(undefined),
    scheduleJob: vi.fn(),
    ...overrides,
  } as unknown as NiloPersistence
}

describe('createToolExecutor', () => {
  it('calls recordAnswer for record_answer tool', async () => {
    const store = makeStore()
    const exec = createToolExecutor('org1', 'sess1', store)
    await exec([{ name: 'record_answer', input: { key: 'licenses', value: ['CE'], confidence: 'high' } }])
    expect(store.recordAnswer).toHaveBeenCalledWith('org1', 'sess1', 'licenses', ['CE'], 'high')
  })

  it('escalates automatically after 3 stuck clarifications', async () => {
    const store = makeStore({ bumpStuck: vi.fn().mockResolvedValue(3) })
    const exec = createToolExecutor('org1', 'sess1', store)
    await exec([{ name: 'request_clarification', input: { key: 'licenses', reason: 'unclear' } }])
    expect(store.escalate).toHaveBeenCalledWith('org1', 'sess1', 'stuck_on_key', expect.stringContaining('licenses'))
  })

  it('returns verdict from finalize_verdict', async () => {
    const store = makeStore()
    const exec = createToolExecutor('org1', 'sess1', store)
    const result = await exec([
      { name: 'finalize_verdict', input: { status: 'qualified', summary: 'Alles ok' } },
    ])
    expect(result.verdict).toBe('qualified')
    expect(store.finalize).toHaveBeenCalledWith('org1', 'sess1', 'qualified', 'Alles ok', undefined)
  })
})
```

- [ ] **Step 2: Run to verify it fails**

```bash
cd packages/nilo-core && pnpm vitest run src/agent/tool-executor.test.ts
```

Expected: FAIL — `tool-executor.js` not found.

- [ ] **Step 3: Create src/agent/tools.ts**

```typescript
// packages/nilo-core/src/agent/tools.ts
import type Anthropic from '@anthropic-ai/sdk'

export const NILO_TOOLS: Anthropic.Tool[] = [
  {
    name: 'record_answer',
    description:
      'Sla een antwoord op voor een must-have of nice-to-have key. Alleen aanroepen wanneer de kandidaat/contact een duidelijk antwoord geeft.',
    input_schema: {
      type: 'object' as const,
      properties: {
        key: { type: 'string', description: 'Must-have of nice-to-have key' },
        value: { description: 'Het antwoord (string, number, boolean, of array)' },
        confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
      },
      required: ['key', 'value', 'confidence'],
    },
  },
  {
    name: 'request_clarification',
    description:
      'Vraag opnieuw naar een must-have als het antwoord onduidelijk of tegenstrijdig was. Verhoogt stuck-counter.',
    input_schema: {
      type: 'object' as const,
      properties: {
        key: { type: 'string' },
        reason: { type: 'string' },
      },
      required: ['key', 'reason'],
    },
  },
  {
    name: 'escalate_to_human',
    description:
      'Zet sessie op hold en wacht op een mens. Gebruik bij onduidelijke criteria, expliciet verzoek, vastlopen, of off-topic.',
    input_schema: {
      type: 'object' as const,
      properties: {
        reason: {
          type: 'string',
          enum: ['unclear_requirements', 'explicit_request', 'stuck_on_key', 'off_topic'],
        },
        context: { type: 'string' },
      },
      required: ['reason'],
    },
  },
  {
    name: 'finalize_verdict',
    description:
      'Alleen aanroepen wanneer alle must-haves zijn ingevuld EN geen vervolgvragen meer nodig. Sluit sessie.',
    input_schema: {
      type: 'object' as const,
      properties: {
        status: { type: 'string', enum: ['qualified', 'rejected', 'unsure'] },
        summary: { type: 'string', description: '2-3 zin samenvatting' },
        rejection_reason: { type: 'string' },
      },
      required: ['status', 'summary'],
    },
  },
]

export type NiloToolName =
  | 'record_answer'
  | 'request_clarification'
  | 'escalate_to_human'
  | 'finalize_verdict'

export type NiloToolCall = { name: NiloToolName; input: Record<string, unknown> }
```

- [ ] **Step 4: Create src/agent/tool-executor.ts**

```typescript
// packages/nilo-core/src/agent/tool-executor.ts
import type { NiloPersistence } from '../types.js'
import type { NiloToolCall } from './tools.js'

export function createToolExecutor(
  orgId: string,
  sessionId: string,
  persistence: NiloPersistence,
) {
  return async function applyToolCalls(
    calls: NiloToolCall[],
  ): Promise<{ verdict: 'qualified' | 'rejected' | 'unsure' | null; escalate: string | null }> {
    let verdict: 'qualified' | 'rejected' | 'unsure' | null = null
    let escalate: string | null = null

    for (const call of calls) {
      switch (call.name) {
        case 'record_answer': {
          const key = String(call.input['key'] ?? '')
          const value = call.input['value']
          const confidence = String(call.input['confidence'] ?? 'medium')
          if (key) await persistence.recordAnswer(orgId, sessionId, key, value, confidence)
          break
        }
        case 'request_clarification': {
          const key = String(call.input['key'] ?? '')
          const count = await persistence.bumpStuck(orgId, sessionId, key)
          if (count >= 3) {
            await persistence.escalate(orgId, sessionId, 'stuck_on_key', `3+ clarifications on ${key}`)
            escalate = 'stuck_on_key'
          }
          break
        }
        case 'escalate_to_human': {
          const reason = String(call.input['reason'] ?? 'unclear_requirements')
          const context = String(call.input['context'] ?? '')
          await persistence.escalate(orgId, sessionId, reason, context)
          escalate = reason
          break
        }
        case 'finalize_verdict': {
          const status = call.input['status'] as 'qualified' | 'rejected' | 'unsure'
          const summary = String(call.input['summary'] ?? '')
          const rejectionReason = call.input['rejection_reason']
            ? String(call.input['rejection_reason'])
            : undefined
          await persistence.finalize(orgId, sessionId, status, summary, rejectionReason)
          verdict = status
          break
        }
      }
    }

    return { verdict, escalate }
  }
}
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
cd packages/nilo-core && pnpm vitest run src/agent/tool-executor.test.ts
```

Expected: PASS (3 tests).

- [ ] **Step 6: Commit**

```bash
git add packages/nilo-core/src/agent/
git commit -m "feat(nilo-core): add NILO_TOOLS and createToolExecutor"
```

---

## Task 4: Extract agent prompts and processInbound into nilo-core

**Files:**
- Create: `packages/nilo-core/src/agent/prompts.ts`
- Create: `packages/nilo-core/src/agent/agent.ts`
- Test: `packages/nilo-core/src/agent/agent.test.ts`

- [ ] **Step 1: Write the failing test for processInbound**

```typescript
// packages/nilo-core/src/agent/agent.test.ts
import { describe, it, expect, vi } from 'vitest'
import { processInbound } from './agent.js'
import type { NiloPersistence, NiloCriteria } from '../types.js'

const mockClaude = {
  messages: {
    create: vi.fn().mockResolvedValue({
      content: [{ type: 'text', text: 'Heb je een rijbewijs CE?' }],
    }),
  },
}

function makeStore(): NiloPersistence {
  return {
    getSession: vi.fn(),
    getRecentMessages: vi.fn(),
    setInitiated: vi.fn(),
    setInProgress: vi.fn().mockResolvedValue(undefined),
    incrementReminderCount: vi.fn(),
    persistOutbound: vi.fn().mockResolvedValue(undefined),
    recordAnswer: vi.fn(),
    bumpStuck: vi.fn(),
    escalate: vi.fn(),
    finalize: vi.fn(),
    scheduleJob: vi.fn(),
  } as unknown as NiloPersistence
}

const baseCriteria: NiloCriteria = {
  mustHave: { customKeys: [{ key: 'license', question: 'CE rijbewijs?', required: true }] },
}

describe('processInbound', () => {
  it('sends Claude response via WhatsApp and persists outbound', async () => {
    const store = makeStore()
    const sendWhatsApp = vi.fn().mockResolvedValue({ messageSid: 'SM1', status: 'sent' })

    await processInbound(
      {
        orgId: 'org1',
        sessionId: 'sess1',
        tenantName: 'Timmers',
        vacancyTitle: 'Chauffeur CE',
        criteria: baseCriteria,
        answeredMustHaves: {},
        answeredNiceToHaves: {},
        stuckCounter: {},
        recentMessages: [{ direction: 'inbound', body: 'Ja ik heb interesse' }],
        contactPhone: '+31612345678',
      },
      { claude: mockClaude as any, sendWhatsApp, persistence: store },
    )

    expect(sendWhatsApp).toHaveBeenCalledWith({
      toPhone: '+31612345678',
      body: 'Heb je een rijbewijs CE?',
    })
    expect(store.persistOutbound).toHaveBeenCalledWith(
      'org1', 'sess1', 'Heb je een rijbewijs CE?', 'SM1', [],
    )
    expect(store.setInProgress).toHaveBeenCalledWith('org1', 'sess1')
  })
})
```

- [ ] **Step 2: Run to verify it fails**

```bash
cd packages/nilo-core && pnpm vitest run src/agent/agent.test.ts
```

Expected: FAIL — `agent.js` not found.

- [ ] **Step 3: Create src/agent/prompts.ts**

```typescript
// packages/nilo-core/src/agent/prompts.ts
import type { NiloCriteria } from '../types.js'

export interface NiloPromptInput {
  tenantName: string
  vacancyTitle: string
  vacancyDescription?: string | null
  criteria: NiloCriteria
  answeredMustHaves: Record<string, unknown>
  answeredNiceToHaves: Record<string, unknown>
  stuckCounter: Record<string, number>
  systemPromptExtra?: string
}

export function buildNiloSystemPrompt(input: NiloPromptInput): string {
  const mh = input.criteria.mustHave
  const standardKeys = Object.entries(mh)
    .filter(([k]) => k !== 'customKeys')
    .map(([k, v]) => `- ${k}: ${JSON.stringify(v)}`)
    .join('\n')
  const customKeys = (mh.customKeys ?? [])
    .map((c) => `- ${c.key}: ${c.question}${c.required ? ' (verplicht)' : ''}`)
    .join('\n')

  return `Je bent een assistent voor ${input.tenantName}. Je voert een kort screeningsgesprek via WhatsApp voor "${input.vacancyTitle}". Doel: alle must-have criteria invullen.
${input.vacancyDescription ? `\nAchtergrond: ${input.vacancyDescription}` : ''}

Must-have criteria (ALLEMAAL invullen voor je finalizeert):
${standardKeys || '(geen standaard criteria)'}
${customKeys ? '\nExtra verplichte vragen:\n' + customKeys : ''}

Nice-to-have (vraag alleen als het gesprek er ruimte voor heeft):
${JSON.stringify(input.criteria.niceToHave ?? {}, null, 2)}

Al beantwoord — NIET opnieuw vragen:
${JSON.stringify(input.answeredMustHaves, null, 2)}
${JSON.stringify(input.answeredNiceToHaves, null, 2)}

Stuck counter per key (bij 3+ direct escaleren):
${JSON.stringify(input.stuckCounter, null, 2)}
${input.systemPromptExtra ? `\n${input.systemPromptExtra}` : ''}

STIJL: Kort en informeel. Max 3 zinnen per bericht. Na record_answer: bevestig kort + stel direct de volgende openstaande must-have vraag.
Bij "ik wil een mens" → escalate_to_human (explicit_request). Bij off-topic → escalate_to_human (off_topic).
Zodra ALLE must-haves beantwoord → roep finalize_verdict aan.`
}

export function buildNiloMessages(
  recent: Array<{ direction: 'inbound' | 'outbound'; body: string }>,
): Array<{ role: 'user' | 'assistant'; content: string }> {
  return recent.map((m) => ({
    role: m.direction === 'inbound' ? 'user' : 'assistant',
    content: m.body,
  }))
}
```

- [ ] **Step 4: Create src/agent/agent.ts**

```typescript
// packages/nilo-core/src/agent/agent.ts
import type Anthropic from '@anthropic-ai/sdk'
import { NILO_TOOLS, type NiloToolCall, type NiloToolName } from './tools.js'
import { buildNiloSystemPrompt, buildNiloMessages, type NiloPromptInput } from './prompts.js'
import { createToolExecutor } from './tool-executor.js'
import type { NiloPersistence } from '../types.js'

export interface ProcessInboundContext extends NiloPromptInput {
  orgId: string
  sessionId: string
  contactPhone: string
}

export interface ProcessInboundDeps {
  claude: Pick<Anthropic, 'messages'>
  sendWhatsApp(input: { toPhone: string; body: string }): Promise<{ messageSid: string; status: string }>
  persistence: NiloPersistence
}

export async function processInbound(
  ctx: ProcessInboundContext,
  deps: ProcessInboundDeps,
): Promise<void> {
  const system = buildNiloSystemPrompt(ctx)
  const messages = buildNiloMessages(ctx.recentMessages)

  let response: Awaited<ReturnType<typeof deps.claude.messages.create>>
  try {
    response = await deps.claude.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      system,
      tools: NILO_TOOLS,
      messages,
    })
  } catch (err) {
    const Sentry = (globalThis as any).Sentry
    if (Sentry?.captureException) {
      Sentry.captureException(err, { extra: { sessionId: ctx.sessionId } })
    }
    throw err
  }

  const texts: string[] = []
  const toolCalls: NiloToolCall[] = []
  for (const block of response.content) {
    if (block.type === 'text') texts.push(block.text)
    if (block.type === 'tool_use') {
      toolCalls.push({ name: block.name as NiloToolName, input: block.input as Record<string, unknown> })
    }
  }

  const exec = createToolExecutor(ctx.orgId, ctx.sessionId, deps.persistence)
  if (toolCalls.length > 0) {
    await exec(toolCalls)
  }

  const text = texts.join('\n').trim()
  if (text) {
    const send = await deps.sendWhatsApp({ toPhone: ctx.contactPhone, body: text })
    await deps.persistence.persistOutbound(ctx.orgId, ctx.sessionId, text, send.messageSid, toolCalls)
  }

  await deps.persistence.setInProgress(ctx.orgId, ctx.sessionId)
}
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
cd packages/nilo-core && pnpm vitest run src/agent/agent.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/nilo-core/src/agent/
git commit -m "feat(nilo-core): add agent prompts and processInbound"
```

---

## Task 5: Extract orchestrator into nilo-core

**Files:**
- Create: `packages/nilo-core/src/orchestrator.ts`
- Test: `packages/nilo-core/src/orchestrator.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// packages/nilo-core/src/orchestrator.test.ts
import { describe, it, expect, vi } from 'vitest'
import { startSession, sendReminder } from './orchestrator.js'
import type { NiloPersistence, NiloFlow, NiloSession } from './types.js'

const baseFlow: NiloFlow = {
  id: 'f1', orgId: 'org1', name: 'Timmers', locale: 'nl',
  criteria: { mustHave: {} },
  templates: {
    first_contact: 'Hoi {{candidate.first_name}}! Vacature: {{vacancy.title}}',
    reminder_24h: 'Reminder {{candidate.first_name}}',
    reminder_72h: 'Laatste kans',
    no_response_farewell: 'Helaas',
  },
  reminderChain: [
    { afterSeconds: 86400, variant: 'reminder_24h' },
    { afterSeconds: 172800, variant: 'reminder_72h' },
    { afterSeconds: 86400, variant: 'no_response_farewell' },
  ],
}

const baseSession: NiloSession = {
  id: 'sess1', orgId: 'org1', contactPhone: '+31612345678', contactName: 'Jan de Vries',
  context: { vacancy_title: 'Chauffeur CE' },
  state: 'created', verdict: null, verdictReason: null, answers: {}, stuckCounter: {},
  reminderCount: 0, matchScore: null, outboundWebhookUrl: null,
  createdAt: new Date(), initiatedAt: null, completedAt: null,
  lastInboundAt: null, lastOutboundAt: null,
}

function makeStore(overrides: Partial<NiloPersistence> = {}): NiloPersistence {
  return {
    getSession: vi.fn().mockResolvedValue(baseSession),
    getRecentMessages: vi.fn().mockResolvedValue([]),
    setInitiated: vi.fn().mockResolvedValue(undefined),
    setInProgress: vi.fn(),
    incrementReminderCount: vi.fn().mockResolvedValue(undefined),
    persistOutbound: vi.fn().mockResolvedValue(undefined),
    recordAnswer: vi.fn(),
    bumpStuck: vi.fn(),
    escalate: vi.fn(),
    finalize: vi.fn(),
    scheduleJob: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  } as unknown as NiloPersistence
}

const makeGateway = () => ({
  send: vi.fn().mockResolvedValue({ messageSid: 'SM1', status: 'sent' }),
})

describe('startSession', () => {
  it('sends first_contact template and schedules first reminder', async () => {
    const store = makeStore()
    const gateway = makeGateway()
    await startSession('org1', 'sess1', baseFlow, gateway, store)
    expect(gateway.send).toHaveBeenCalledWith({
      toPhone: '+31612345678',
      body: 'Hoi Jan! Vacature: Chauffeur CE',
    })
    expect(store.persistOutbound).toHaveBeenCalledWith('org1', 'sess1', 'Hoi Jan! Vacature: Chauffeur CE', 'SM1', undefined)
    expect(store.setInitiated).toHaveBeenCalledWith('org1', 'sess1')
    expect(store.scheduleJob).toHaveBeenCalledWith('org1', 'sess1', 86400, 'reminder_24h')
  })
})

describe('sendReminder', () => {
  it('skips if session already replied', async () => {
    const store = makeStore({
      getSession: vi.fn().mockResolvedValue({
        ...baseSession,
        state: 'in_progress',
        lastInboundAt: new Date(),
      }),
    })
    const gateway = makeGateway()
    await sendReminder('org1', 'sess1', 'reminder_24h', baseFlow, gateway, store)
    expect(gateway.send).not.toHaveBeenCalled()
  })

  it('sends reminder and schedules the next one in the chain', async () => {
    const store = makeStore()
    const gateway = makeGateway()
    await sendReminder('org1', 'sess1', 'reminder_24h', baseFlow, gateway, store)
    expect(gateway.send).toHaveBeenCalledWith({
      toPhone: '+31612345678',
      body: 'Reminder Jan',
    })
    expect(store.scheduleJob).toHaveBeenCalledWith('org1', 'sess1', 172800, 'reminder_72h')
  })
})
```

- [ ] **Step 2: Run to verify it fails**

```bash
cd packages/nilo-core && pnpm vitest run src/orchestrator.test.ts
```

Expected: FAIL — `orchestrator.js` not found.

- [ ] **Step 3: Create src/orchestrator.ts**

```typescript
// packages/nilo-core/src/orchestrator.ts
import type { NiloPersistence, NiloFlow, NiloSession } from './types.js'
import { renderTemplate, buildTemplateContext } from './renderer.js'
import type { WhatsAppGateway } from './gateway.js'

type MinimalGateway = Pick<WhatsAppGateway, 'send'>

export async function startSession(
  orgId: string,
  sessionId: string,
  flow: NiloFlow,
  gateway: MinimalGateway,
  persistence: NiloPersistence,
): Promise<void> {
  const session = await persistence.getSession(orgId, sessionId)
  if (!session) throw new Error(`session not found: ${sessionId}`)

  const template = flow.templates['first_contact']
  if (!template) throw new Error(`template first_contact missing in flow ${flow.id}`)

  const ctx = buildTemplateContext(session, flow)
  const body = renderTemplate(template, ctx)
  const result = await gateway.send({ toPhone: session.contactPhone, body })

  await persistence.persistOutbound(orgId, sessionId, body, result.messageSid)
  await persistence.setInitiated(orgId, sessionId)

  const firstStep = flow.reminderChain[0]
  if (firstStep) {
    await persistence.scheduleJob(orgId, sessionId, firstStep.afterSeconds, firstStep.variant)
  }
}

export async function sendReminder(
  orgId: string,
  sessionId: string,
  variant: string,
  flow: NiloFlow,
  gateway: MinimalGateway,
  persistence: NiloPersistence,
): Promise<void> {
  const session = await persistence.getSession(orgId, sessionId)
  if (!session) return
  if (session.lastInboundAt && session.lastInboundAt > session.createdAt) return
  if (session.state === 'completed' || session.state === 'awaiting_human') return

  const template = flow.templates[variant]
  if (!template) throw new Error(`template ${variant} missing in flow ${flow.id}`)

  const ctx = buildTemplateContext(session, flow)
  const body = renderTemplate(template, ctx)
  const result = await gateway.send({ toPhone: session.contactPhone, body })

  await persistence.persistOutbound(orgId, sessionId, body, result.messageSid)
  await persistence.incrementReminderCount(orgId, sessionId)

  // Schedule the next step in the reminder chain
  const currentIndex = flow.reminderChain.findIndex((s) => s.variant === variant)
  const nextStep = flow.reminderChain[currentIndex + 1]
  if (nextStep) {
    await persistence.scheduleJob(orgId, sessionId, nextStep.afterSeconds, nextStep.variant)
  }
}

export async function sendFarewell(
  orgId: string,
  sessionId: string,
  flow: NiloFlow,
  gateway: MinimalGateway,
  persistence: NiloPersistence,
): Promise<void> {
  const session = await persistence.getSession(orgId, sessionId)
  if (!session) return
  if (session.lastInboundAt && session.lastInboundAt > session.createdAt) return
  if (session.state === 'completed' || session.state === 'awaiting_human') return

  const template = flow.templates['no_response_farewell']
  if (!template) throw new Error(`template no_response_farewell missing in flow ${flow.id}`)

  const ctx = buildTemplateContext(session, flow)
  const body = renderTemplate(template, ctx)
  const result = await gateway.send({ toPhone: session.contactPhone, body })

  await persistence.persistOutbound(orgId, sessionId, body, result.messageSid)
  await persistence.finalize(orgId, sessionId, 'rejected', 'no_response_farewell', 'no response')
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd packages/nilo-core && pnpm vitest run src/orchestrator.test.ts
```

Expected: PASS (3 tests).

- [ ] **Step 5: Verify TypeScript is clean across nilo-core**

```bash
cd packages/nilo-core && pnpm tsc --noEmit
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add packages/nilo-core/src/orchestrator.ts packages/nilo-core/src/orchestrator.test.ts
git commit -m "feat(nilo-core): add startSession, sendReminder, sendFarewell orchestrator"
```

---

## Task 6: Create nilo_* Drizzle schema

**Files:**
- Create: `apps/api/src/db/schema/nilo-sessions.ts`
- Create: `apps/api/src/db/schema/nilo-messages.ts`
- Create: `apps/api/src/db/schema/nilo-api-keys.ts`
- Create: `apps/api/src/db/schema/nilo-trigger-events.ts`
- Create: `apps/api/src/db/schema/nilo-webhook-logs.ts`
- Create: `apps/api/src/db/schema/nilo-handoffs.ts`
- Modify: `apps/api/src/db/schema/index.ts`

- [ ] **Step 1: Create nilo-sessions.ts**

```typescript
// apps/api/src/db/schema/nilo-sessions.ts
import {
  pgTable, uuid, text, varchar, timestamp, integer, jsonb, boolean,
} from 'drizzle-orm/pg-core'
import { tenantRlsPolicies } from './rls-helpers.js'
import { candidateApplications } from './applications.js'

export const niloSessions = pgTable(
  'nilo_sessions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id').notNull(),
    flowId: uuid('flow_id'),
    applicationId: uuid('application_id').references(() => candidateApplications.id, {
      onDelete: 'set null',
    }),
    contactPhone: varchar('contact_phone', { length: 30 }).notNull(),
    contactName: text('contact_name'),
    context: jsonb('context').notNull().default({}),
    state: varchar('state', { length: 30 }).notNull().default('created'),
    verdict: varchar('verdict', { length: 20 }),
    verdictReason: text('verdict_reason'),
    answers: jsonb('answers').notNull().default({}),
    stuckCounter: jsonb('stuck_counter').notNull().default({}),
    reminderCount: integer('reminder_count').notNull().default(0),
    matchScore: integer('match_score'),
    outboundWebhookUrl: text('outbound_webhook_url'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    initiatedAt: timestamp('initiated_at'),
    completedAt: timestamp('completed_at'),
    lastInboundAt: timestamp('last_inbound_at'),
    lastOutboundAt: timestamp('last_outbound_at'),
  },
  () => tenantRlsPolicies('nilo_sessions'),
).enableRLS()
```

- [ ] **Step 2: Create nilo-messages.ts**

```typescript
// apps/api/src/db/schema/nilo-messages.ts
import { pgTable, uuid, varchar, text, boolean, timestamp, jsonb } from 'drizzle-orm/pg-core'
import { tenantRlsPolicies } from './rls-helpers.js'
import { niloSessions } from './nilo-sessions.js'

export const niloMessages = pgTable(
  'nilo_messages',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id').notNull(),
    sessionId: uuid('session_id').notNull().references(() => niloSessions.id, { onDelete: 'cascade' }),
    direction: varchar('direction', { length: 10 }).notNull(),
    body: text('body').notNull(),
    twilioSid: text('twilio_sid'),
    isFromBot: boolean('is_from_bot').notNull().default(true),
    toolCalls: jsonb('tool_calls'),
    sentAt: timestamp('sent_at').notNull().defaultNow(),
  },
  () => tenantRlsPolicies('nilo_messages'),
).enableRLS()
```

- [ ] **Step 3: Create nilo-api-keys.ts**

```typescript
// apps/api/src/db/schema/nilo-api-keys.ts
import { pgTable, uuid, text, timestamp } from 'drizzle-orm/pg-core'
import { tenantRlsPolicies } from './rls-helpers.js'

export const niloApiKeys = pgTable(
  'nilo_api_keys',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id').notNull(),
    keyHash: text('key_hash').notNull(),
    label: text('label').notNull(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    revokedAt: timestamp('revoked_at'),
  },
  () => tenantRlsPolicies('nilo_api_keys'),
).enableRLS()
```

- [ ] **Step 4: Create nilo-trigger-events.ts**

```typescript
// apps/api/src/db/schema/nilo-trigger-events.ts
import { pgTable, uuid, text, timestamp, jsonb, unique } from 'drizzle-orm/pg-core'
import { tenantRlsPolicies } from './rls-helpers.js'
import { niloSessions } from './nilo-sessions.js'

export const niloTriggerEvents = pgTable(
  'nilo_trigger_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id').notNull(),
    externalRef: text('external_ref'),
    payload: jsonb('payload').notNull(),
    sessionId: uuid('session_id').references(() => niloSessions.id),
    receivedAt: timestamp('received_at').notNull().defaultNow(),
  },
  (t) => [
    unique('nilo_trigger_events_dedup').on(t.organizationId, t.externalRef),
    ...tenantRlsPolicies('nilo_trigger_events'),
  ],
).enableRLS()
```

- [ ] **Step 5: Create nilo-webhook-logs.ts**

```typescript
// apps/api/src/db/schema/nilo-webhook-logs.ts
import { pgTable, uuid, text, integer, timestamp, jsonb } from 'drizzle-orm/pg-core'
import { tenantRlsPolicies } from './rls-helpers.js'
import { niloSessions } from './nilo-sessions.js'

export const niloWebhookLogs = pgTable(
  'nilo_webhook_logs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id').notNull(),
    sessionId: uuid('session_id').notNull().references(() => niloSessions.id, { onDelete: 'cascade' }),
    targetUrl: text('target_url').notNull(),
    payload: jsonb('payload').notNull(),
    responseStatus: integer('response_status'),
    attempt: integer('attempt').notNull().default(1),
    error: text('error'),
    deliveredAt: timestamp('delivered_at'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  () => tenantRlsPolicies('nilo_webhook_logs'),
).enableRLS()
```

- [ ] **Step 6: Create nilo-handoffs.ts**

```typescript
// apps/api/src/db/schema/nilo-handoffs.ts
import { pgTable, uuid, varchar, text, timestamp } from 'drizzle-orm/pg-core'
import { tenantRlsPolicies } from './rls-helpers.js'
import { niloSessions } from './nilo-sessions.js'

export const niloHandoffs = pgTable(
  'nilo_handoffs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id').notNull(),
    sessionId: uuid('session_id').notNull().references(() => niloSessions.id, { onDelete: 'cascade' }),
    reason: varchar('reason', { length: 40 }).notNull(),
    context: text('context'),
    requestedAt: timestamp('requested_at').notNull().defaultNow(),
    assignedTo: uuid('assigned_to'),
    acceptedAt: timestamp('accepted_at'),
    resolvedAt: timestamp('resolved_at'),
    resolution: varchar('resolution', { length: 30 }),
  },
  () => tenantRlsPolicies('nilo_handoffs'),
).enableRLS()
```

- [ ] **Step 7: Export all new tables from schema/index.ts**

Open `apps/api/src/db/schema/index.ts` and add at the end:

```typescript
export * from './nilo-sessions.js'
export * from './nilo-messages.js'
export * from './nilo-api-keys.js'
export * from './nilo-trigger-events.js'
export * from './nilo-webhook-logs.js'
export * from './nilo-handoffs.js'
```

- [ ] **Step 8: Generate and apply the migration**

```bash
cd apps/api && pnpm drizzle-kit generate
```

Review the generated SQL to confirm 6 new tables with RLS. Then:

```bash
pnpm drizzle-kit push
```

Expected: migration applied, no errors.

- [ ] **Step 9: Commit**

```bash
git add apps/api/src/db/schema/nilo-*.ts apps/api/src/db/schema/index.ts apps/api/drizzle/
git commit -m "feat(nilo): add nilo_sessions, nilo_messages, nilo_api_keys, nilo_trigger_events, nilo_webhook_logs, nilo_handoffs schema"
```

---

## Task 7: Implement drizzle-persistence.ts

**Files:**
- Create: `apps/api/src/modules/nilo/persistence/drizzle-persistence.ts`

This is the `NiloPersistence` implementation using the new nilo_* tables and pg-boss.

- [ ] **Step 1: Create the file**

```typescript
// apps/api/src/modules/nilo/persistence/drizzle-persistence.ts
import { eq, desc, sql } from 'drizzle-orm'
import { db } from '../../../db/index.js'
import {
  niloSessions,
  niloMessages,
} from '../../../db/schema/index.js'
import { withTenantContext } from '../../../lib/with-tenant-context.js'
import type { NiloPersistence, NiloSession } from '@hey-nilo/core'
import type { PgBoss } from 'pg-boss'

function rowToSession(row: typeof niloSessions.$inferSelect): NiloSession {
  return {
    id: row.id,
    orgId: row.organizationId,
    contactPhone: row.contactPhone,
    contactName: row.contactName,
    context: (row.context ?? {}) as Record<string, unknown>,
    state: row.state as NiloSession['state'],
    verdict: row.verdict as NiloSession['verdict'],
    verdictReason: row.verdictReason,
    answers: (row.answers ?? {}) as Record<string, { value: unknown; confidence: string }>,
    stuckCounter: (row.stuckCounter ?? {}) as Record<string, number>,
    reminderCount: row.reminderCount,
    matchScore: row.matchScore,
    outboundWebhookUrl: row.outboundWebhookUrl,
    createdAt: row.createdAt,
    initiatedAt: row.initiatedAt,
    completedAt: row.completedAt,
    lastInboundAt: row.lastInboundAt,
    lastOutboundAt: row.lastOutboundAt,
  }
}

export function createDrizzlePersistence(boss: PgBoss): NiloPersistence {
  return {
    async getSession(orgId, sessionId) {
      return withTenantContext(orgId, async (tx) => {
        const [row] = await tx
          .select()
          .from(niloSessions)
          .where(eq(niloSessions.id, sessionId))
          .limit(1)
        return row ? rowToSession(row) : null
      })
    },

    async getRecentMessages(orgId, sessionId, limit = 20) {
      return withTenantContext(orgId, async (tx) => {
        return tx
          .select({ direction: niloMessages.direction, body: niloMessages.body })
          .from(niloMessages)
          .where(eq(niloMessages.sessionId, sessionId))
          .orderBy(niloMessages.sentAt)
          .limit(limit)
      })
    },

    async setInitiated(orgId, sessionId) {
      await withTenantContext(orgId, async (tx) => {
        await tx
          .update(niloSessions)
          .set({ state: 'initiated', initiatedAt: new Date() })
          .where(eq(niloSessions.id, sessionId))
      })
    },

    async setInProgress(orgId, sessionId) {
      await withTenantContext(orgId, async (tx) => {
        await tx
          .update(niloSessions)
          .set({ state: 'in_progress' })
          .where(eq(niloSessions.id, sessionId))
      })
    },

    async incrementReminderCount(orgId, sessionId) {
      await withTenantContext(orgId, async (tx) => {
        await tx.execute(
          sql`UPDATE nilo_sessions SET reminder_count = reminder_count + 1 WHERE id = ${sessionId}`,
        )
      })
    },

    async persistOutbound(orgId, sessionId, body, twilioSid, toolCalls) {
      await withTenantContext(orgId, async (tx) => {
        await tx.insert(niloMessages).values({
          organizationId: orgId,
          sessionId,
          direction: 'outbound',
          body,
          twilioSid,
          isFromBot: true,
          toolCalls: toolCalls ?? null,
        })
        await tx
          .update(niloSessions)
          .set({ lastOutboundAt: new Date() })
          .where(eq(niloSessions.id, sessionId))
      })
    },

    async recordAnswer(orgId, sessionId, key, value, confidence) {
      await withTenantContext(orgId, async (tx) => {
        await tx.update(niloSessions).set({
          answers: sql`answers || ${JSON.stringify({ [key]: { value, confidence } })}::jsonb`,
        }).where(eq(niloSessions.id, sessionId))
      })
    },

    async bumpStuck(orgId, sessionId, key) {
      const [row] = await db.execute<{ count: number }>(
        sql`UPDATE nilo_sessions SET stuck_counter = jsonb_set(stuck_counter, ${`{${key}}`}::text[], (COALESCE((stuck_counter->>${key})::int, 0) + 1)::text::jsonb) WHERE id = ${sessionId} RETURNING (stuck_counter->>${key})::int as count`,
      )
      return row?.count ?? 0
    },

    async escalate(orgId, sessionId, reason, context) {
      await withTenantContext(orgId, async (tx) => {
        await tx.update(niloSessions).set({
          state: 'awaiting_human',
          verdictReason: `${reason}: ${context}`.slice(0, 500),
        }).where(eq(niloSessions.id, sessionId))
      })
    },

    async finalize(orgId, sessionId, status, summary, rejectionReason) {
      await withTenantContext(orgId, async (tx) => {
        await tx.update(niloSessions).set({
          state: status === 'rejected' ? 'completed' : 'completed',
          verdict: status,
          verdictReason: summary + (rejectionReason ? ` — ${rejectionReason}` : ''),
          completedAt: new Date(),
        }).where(eq(niloSessions.id, sessionId))
      })
    },

    async scheduleJob(orgId, sessionId, afterSeconds, variant) {
      await boss.send(
        `nilo.${variant}`,
        { orgId, sessionId },
        { startAfter: afterSeconds },
      )
    },
  }
}
```

- [ ] **Step 2: Verify TypeScript is clean**

```bash
cd apps/api && pnpm tsc --noEmit 2>&1 | grep -i "nilo"
```

Expected: no errors related to nilo files.

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/modules/nilo/persistence/drizzle-persistence.ts
git commit -m "feat(nilo): implement NiloPersistence with Drizzle and nilo_* tables"
```

---

## Task 8: Implement flow-registry and nilo module orchestrator

**Files:**
- Create: `apps/api/src/modules/nilo/flow-registry.ts`
- Create: `apps/api/src/modules/nilo/orchestrator.ts`

- [ ] **Step 1: Create flow-registry.ts with hardcoded Timmers flow**

```typescript
// apps/api/src/modules/nilo/flow-registry.ts
import type { NiloFlow } from '@hey-nilo/core'

const TIMMERS_FLOW: NiloFlow = {
  id: 'timmers-default',
  orgId: process.env['TIMMERS_ORG_ID'] ?? '',
  name: 'Timmers Transport',
  locale: 'nl',
  criteria: {
    mustHave: {
      customKeys: [
        { key: 'rijbewijs_ce', question: 'Heb je een geldig rijbewijs CE?', required: true },
        { key: 'code95', question: 'Heb je een geldig Code 95 certificaat?', required: true },
        { key: 'beschikbaarheid', question: 'Wanneer ben je beschikbaar om te starten?', required: true },
        { key: 'regio', question: 'Woon je in de buurt van Rotterdam / Zuid-Holland?', required: true },
      ],
    },
    niceToHave: {
      experienceYearsMin: 2,
    },
  },
  templates: {
    first_contact:
      'Hoi {{candidate.first_name}}! 👋 Ik ben de digitale assistent van {{tenant.name}}. Je hebt interesse getoond in {{vacancy.title}}. Ik heb een paar korte vragen zodat we kunnen kijken of er een match is.\n\nHeb je een geldig rijbewijs CE?',
    reminder_24h:
      'Hoi {{candidate.first_name}}, we wachten nog op je antwoorden voor {{vacancy.title}} bij {{tenant.name}}. Heb je even 2 minuutjes?',
    reminder_72h:
      'Laatste herinnering: wil je nog reageren op onze vragen voor {{vacancy.title}}? We sluiten de aanvraag anders af.',
    no_response_farewell:
      'Helaas hebben we niets gehoord. We sluiten je aanvraag voor {{vacancy.title}} af. Succes met je zoektocht! 🍀',
  },
  reminderChain: [
    { afterSeconds: 86400, variant: 'reminder_24h' },
    { afterSeconds: 172800, variant: 'reminder_72h' },
    { afterSeconds: 86400, variant: 'no_response_farewell' },
  ],
  webhookUrl: process.env['TIMMERS_WEBHOOK_URL'],
  slackWebhookUrl: process.env['TIMMERS_SLACK_WEBHOOK_URL'],
  scoreThreshold: 75,
}

const FLOW_MAP: Record<string, NiloFlow> = {}

if (TIMMERS_FLOW.orgId) {
  FLOW_MAP[TIMMERS_FLOW.orgId] = TIMMERS_FLOW
}

export function resolveFlow(orgId: string): NiloFlow | null {
  return FLOW_MAP[orgId] ?? null
}
```

- [ ] **Step 2: Create nilo module orchestrator (wires core + deps)**

```typescript
// apps/api/src/modules/nilo/orchestrator.ts
import Anthropic from '@anthropic-ai/sdk'
import { startSession, sendReminder, sendFarewell, processInbound } from '@hey-nilo/core'
import { createTwilioSandboxGateway } from '../intake/whatsapp/twilio-sandbox.js'
import type { NiloPersistence } from '@hey-nilo/core'
import { resolveFlow } from './flow-registry.js'
import { fireWebhookAndNotify } from './outbound.js'

function getGateway() {
  return createTwilioSandboxGateway({
    accountSid: process.env['TWILIO_ACCOUNT_SID']!,
    authToken: process.env['TWILIO_AUTH_TOKEN']!,
    fromNumber: process.env['TWILIO_WHATSAPP_FROM'] ?? 'whatsapp:+14155238886',
  })
}

export async function runStartSession(
  orgId: string,
  sessionId: string,
  persistence: NiloPersistence,
): Promise<void> {
  const flow = resolveFlow(orgId)
  if (!flow) throw new Error(`no flow configured for org ${orgId}`)
  await startSession(orgId, sessionId, flow, getGateway(), persistence)
}

export async function runSendReminder(
  orgId: string,
  sessionId: string,
  variant: string,
  persistence: NiloPersistence,
): Promise<void> {
  const flow = resolveFlow(orgId)
  if (!flow) throw new Error(`no flow configured for org ${orgId}`)

  if (variant === 'no_response_farewell') {
    await sendFarewell(orgId, sessionId, flow, getGateway(), persistence)
    await fireWebhookAndNotify(orgId, sessionId, flow, persistence)
  } else {
    await sendReminder(orgId, sessionId, variant, flow, getGateway(), persistence)
  }
}

export async function runProcessInbound(
  orgId: string,
  sessionId: string,
  persistence: NiloPersistence,
): Promise<void> {
  const flow = resolveFlow(orgId)
  if (!flow) throw new Error(`no flow configured for org ${orgId}`)

  const session = await persistence.getSession(orgId, sessionId)
  if (!session) return
  if (session.state === 'completed' || session.state === 'awaiting_human') return

  const recentMessages = await persistence.getRecentMessages(orgId, sessionId)
  const claude = new Anthropic({ apiKey: process.env['ANTHROPIC_API_KEY']! })

  await processInbound(
    {
      orgId,
      sessionId,
      tenantName: flow.name,
      vacancyTitle: String(session.context['vacancy_title'] ?? ''),
      vacancyDescription: String(session.context['vacancy_description'] ?? '') || null,
      criteria: flow.criteria,
      answeredMustHaves: session.answers,
      answeredNiceToHaves: {},
      stuckCounter: session.stuckCounter,
      recentMessages,
      contactPhone: session.contactPhone,
      systemPromptExtra: flow.systemPromptExtra,
    },
    {
      claude,
      sendWhatsApp: (input) => getGateway().send(input),
      persistence,
    },
  )

  // Check if session was finalized and fire webhook
  const updated = await persistence.getSession(orgId, sessionId)
  if (updated?.state === 'completed') {
    await fireWebhookAndNotify(orgId, sessionId, flow, persistence)
  }
}
```

- [ ] **Step 3: Verify TypeScript is clean**

```bash
cd apps/api && pnpm tsc --noEmit 2>&1 | grep -E "nilo|error"
```

Expected: no errors in nilo files.

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/modules/nilo/flow-registry.ts apps/api/src/modules/nilo/orchestrator.ts
git commit -m "feat(nilo): flow-registry (Timmers hardcoded) and module orchestrator"
```

---

## Task 9: Implement outbound.ts and pg-boss job handlers

**Files:**
- Create: `apps/api/src/modules/nilo/outbound.ts`
- Create: `apps/api/src/modules/nilo/jobs/nilo.jobs.ts`

- [ ] **Step 1: Create outbound.ts**

```typescript
// apps/api/src/modules/nilo/outbound.ts
import { db } from '../../db/index.js'
import { niloWebhookLogs } from '../../db/schema/index.js'
import { createHmac } from 'node:crypto'
import type { NiloFlow, NiloPersistence } from '@hey-nilo/core'

export async function fireWebhookAndNotify(
  orgId: string,
  sessionId: string,
  flow: NiloFlow,
  persistence: NiloPersistence,
): Promise<void> {
  const session = await persistence.getSession(orgId, sessionId)
  if (!session) return

  const webhookUrl = session.outboundWebhookUrl ?? flow.webhookUrl
  if (webhookUrl) {
    await fireWebhook(orgId, sessionId, webhookUrl, session)
  }

  if (
    flow.slackWebhookUrl &&
    session.verdict === 'qualified' &&
    (session.matchScore ?? 0) >= (flow.scoreThreshold ?? 75)
  ) {
    await fireSlackAlert(flow.slackWebhookUrl, session)
  }
}

async function fireWebhook(
  orgId: string,
  sessionId: string,
  targetUrl: string,
  session: Awaited<ReturnType<NiloPersistence['getSession']>>,
): Promise<void> {
  if (!session) return

  const payload = {
    event: 'session.completed',
    session_id: session.id,
    external_ref: (session.context['external_ref'] as string) ?? null,
    verdict: session.verdict,
    verdict_reason: session.verdictReason,
    match_score: session.matchScore,
    answers: session.answers,
    contact: { phone: session.contactPhone, name: session.contactName },
    context: session.context,
    completed_at: session.completedAt?.toISOString() ?? new Date().toISOString(),
  }

  const body = JSON.stringify(payload)
  const secret = process.env['NILO_WEBHOOK_SECRET']
  const signature = secret
    ? `sha256=${createHmac('sha256', secret).update(body).digest('hex')}`
    : undefined

  let attempt = 0
  let lastError: string | undefined
  let responseStatus: number | undefined

  for (let i = 1; i <= 3; i++) {
    attempt = i
    try {
      const res = await fetch(targetUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(signature ? { 'X-Nilo-Signature': signature } : {}),
        },
        body,
        signal: AbortSignal.timeout(10000),
      })
      responseStatus = res.status
      if (res.ok) {
        await db.insert(niloWebhookLogs).values({
          organizationId: orgId,
          sessionId,
          targetUrl,
          payload,
          responseStatus,
          attempt,
          deliveredAt: new Date(),
        })
        return
      }
      lastError = `HTTP ${res.status}`
    } catch (err) {
      lastError = String(err)
    }
    // Brief backoff before retry (not a long sleep — just exponential)
    await new Promise((r) => setTimeout(r, attempt * 1000))
  }

  await db.insert(niloWebhookLogs).values({
    organizationId: orgId,
    sessionId,
    targetUrl,
    payload,
    responseStatus,
    attempt,
    error: lastError,
  })
}

async function fireSlackAlert(
  slackWebhookUrl: string,
  session: Awaited<ReturnType<NiloPersistence['getSession']>>,
): Promise<void> {
  if (!session) return
  const score = session.matchScore ?? '?'
  const title = String(session.context['vacancy_title'] ?? 'vacature')
  const source = String(session.context['source'] ?? '')
  const answerSummary = Object.entries(session.answers)
    .map(([k, v]) => `${k}: ${JSON.stringify((v as { value: unknown }).value)}`)
    .join(', ')

  try {
    await fetch(slackWebhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: `✅ Sterke kandidaat: ${score}% match\n*${session.contactName ?? session.contactPhone}* voor *${title}*${source ? ` | Bron: ${source}` : ''}\n${answerSummary}`,
      }),
      signal: AbortSignal.timeout(5000),
    })
  } catch (err) {
    console.error('[nilo] slack alert failed:', err)
  }
}
```

- [ ] **Step 2: Create nilo.jobs.ts**

```typescript
// apps/api/src/modules/nilo/jobs/nilo.jobs.ts
import type { PgBoss, Job } from 'pg-boss'
import { createDrizzlePersistence } from '../persistence/drizzle-persistence.js'
import { runStartSession, runSendReminder, runProcessInbound } from '../orchestrator.js'
import { db } from '../../../db/index.js'
import { niloSessions, niloMessages } from '../../../db/schema/index.js'
import { eq, and } from 'drizzle-orm'

type NiloJobData = { orgId: string; sessionId: string }
type NiloInboundData = { orgId: string; sessionId: string; fromPhone: string; body: string; twilioSid?: string }

export async function registerNiloJobs(boss: PgBoss): Promise<void> {
  const persistence = createDrizzlePersistence(boss)

  await boss.work<NiloJobData>('nilo.start', async ([job]: Job<NiloJobData>[]) => {
    const { orgId, sessionId } = job.data
    await runStartSession(orgId, sessionId, persistence)
  })

  await boss.work<NiloJobData>('nilo.reminder_24h', async ([job]: Job<NiloJobData>[]) => {
    const { orgId, sessionId } = job.data
    await runSendReminder(orgId, sessionId, 'reminder_24h', persistence)
  })

  await boss.work<NiloJobData>('nilo.reminder_72h', async ([job]: Job<NiloJobData>[]) => {
    const { orgId, sessionId } = job.data
    await runSendReminder(orgId, sessionId, 'reminder_72h', persistence)
  })

  await boss.work<NiloJobData>('nilo.no_response_farewell', async ([job]: Job<NiloJobData>[]) => {
    const { orgId, sessionId } = job.data
    await runSendReminder(orgId, sessionId, 'no_response_farewell', persistence)
  })

  await boss.work<NiloInboundData>('nilo.process_inbound', async (jobs) => {
    for (const job of jobs) {
      const { orgId, sessionId, fromPhone, body, twilioSid } = job.data

      // Persist inbound message first
      await db.insert(niloMessages).values({
        organizationId: orgId,
        sessionId,
        direction: 'inbound',
        body,
        twilioSid,
        isFromBot: false,
      })
      await db.update(niloSessions)
        .set({ lastInboundAt: new Date() })
        .where(eq(niloSessions.id, sessionId))

      await runProcessInbound(orgId, sessionId, persistence)
    }
  })

  console.log('[jobs] registered nilo.start, nilo.reminder_24h/72h, nilo.farewell, nilo.process_inbound')
}
```

- [ ] **Step 3: Add nilo queues to KNOWN_QUEUES in lib/job-queue.ts**

Find the `KNOWN_QUEUES` array in `apps/api/src/lib/job-queue.ts` and add:

```typescript
// Add after the intake queue entries:
'nilo.start',
'nilo.reminder_24h',
'nilo.reminder_72h',
'nilo.no_response_farewell',
'nilo.process_inbound',
```

- [ ] **Step 4: Register nilo jobs in jobs/job-handlers.ts**

Add to top of `apps/api/src/jobs/job-handlers.ts`:

```typescript
import { registerNiloJobs } from '../modules/nilo/jobs/nilo.jobs.js'
```

Find the `registerJobHandlers` function and add inside it:

```typescript
await registerNiloJobs(boss)
```

- [ ] **Step 5: Verify TypeScript is clean**

```bash
cd apps/api && pnpm tsc --noEmit 2>&1 | head -20
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/modules/nilo/outbound.ts apps/api/src/modules/nilo/jobs/nilo.jobs.ts apps/api/src/lib/job-queue.ts apps/api/src/jobs/job-handlers.ts
git commit -m "feat(nilo): outbound webhook dispatch and pg-boss job handlers"
```

---

## Task 10: Implement trigger API route with API key auth

**Files:**
- Create: `apps/api/src/routes/nilo-trigger.routes.ts`
- Modify: `apps/api/src/index.ts`

- [ ] **Step 1: Create nilo-trigger.routes.ts**

```typescript
// apps/api/src/routes/nilo-trigger.routes.ts
import { Hono } from 'hono'
import { z } from 'zod'
import { eq, and, isNull } from 'drizzle-orm'
import { timingSafeEqual, createHash } from 'node:crypto'
import type { AppEnv } from '../lib/app-env.js'
import { db } from '../db/index.js'
import { niloApiKeys, niloSessions, niloTriggerEvents } from '../db/schema/index.js'
import { getJobQueue } from '../lib/job-queue.js'

const triggerSchema = z.object({
  external_ref: z.string().max(255).optional(),
  contact: z.object({
    phone: z.string().regex(/^\+[1-9]\d{7,14}$/, 'Phone must be E.164 format'),
    name: z.string().max(255).optional(),
  }),
  context: z.record(z.unknown()).optional(),
})

async function resolveApiKey(rawKey: string): Promise<{ orgId: string } | null> {
  // Hash the incoming key for comparison
  const incoming = createHash('sha256').update(rawKey).digest('hex')
  const rows = await db
    .select({ orgId: niloApiKeys.organizationId, storedHash: niloApiKeys.keyHash })
    .from(niloApiKeys)
    .where(isNull(niloApiKeys.revokedAt))

  for (const row of rows) {
    const stored = Buffer.from(row.storedHash, 'utf8')
    const candidate = Buffer.from(incoming, 'utf8')
    if (stored.length === candidate.length && timingSafeEqual(stored, candidate)) {
      return { orgId: row.orgId }
    }
  }
  return null
}

export const niloTriggerRoutes = new Hono<AppEnv>().post('/', async (c) => {
  // 1. Extract and validate API key
  const authHeader = c.req.header('Authorization') ?? ''
  const rawKey = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : ''
  if (!rawKey) return c.json({ error: 'missing api key' }, 401)

  const keyRecord = await resolveApiKey(rawKey)
  if (!keyRecord) return c.json({ error: 'invalid api key' }, 401)

  const { orgId } = keyRecord

  // 2. Validate body
  const body = await c.req.json().catch(() => null)
  const parsed = triggerSchema.safeParse(body)
  if (!parsed.success) {
    return c.json({ error: 'invalid request', details: parsed.error.flatten() }, 400)
  }

  const { external_ref, contact, context = {} } = parsed.data

  // 3. Idempotency check via external_ref
  if (external_ref) {
    const [existing] = await db
      .select({ sessionId: niloTriggerEvents.sessionId })
      .from(niloTriggerEvents)
      .where(
        and(
          eq(niloTriggerEvents.organizationId, orgId),
          eq(niloTriggerEvents.externalRef, external_ref),
        ),
      )
      .limit(1)

    if (existing?.sessionId) {
      return c.json({ session_id: existing.sessionId, duplicate: true }, 409)
    }
  }

  // 4. Create session
  const [session] = await db
    .insert(niloSessions)
    .values({
      organizationId: orgId,
      contactPhone: contact.phone,
      contactName: contact.name ?? null,
      context,
      state: 'created',
    })
    .returning({ id: niloSessions.id })

  if (!session) return c.json({ error: 'session creation failed' }, 500)

  // 5. Log trigger event
  await db.insert(niloTriggerEvents).values({
    organizationId: orgId,
    externalRef: external_ref ?? null,
    payload: { contact, context, external_ref },
    sessionId: session.id,
  })

  // 6. Enqueue start job
  const boss = getJobQueue()
  if (boss) {
    await boss.send('nilo.start', { orgId, sessionId: session.id })
  }

  return c.json({ session_id: session.id, state: 'created' }, 201)
})
```

- [ ] **Step 2: Mount the route in apps/api/src/index.ts**

Add import at the top of `index.ts` (near the other route imports):

```typescript
import { niloTriggerRoutes } from './routes/nilo-trigger.routes.js'
```

Find where routes are mounted (look for `app.route('/api/...', ...)`) and add:

```typescript
app.route('/api/nilo/sessions', niloTriggerRoutes)
```

Mount this WITHOUT `authMiddleware` + `tenantMiddleware` (it uses API key auth instead).

- [ ] **Step 3: Verify TypeScript is clean**

```bash
cd apps/api && pnpm tsc --noEmit 2>&1 | grep -i "nilo"
```

Expected: no errors.

- [ ] **Step 4: Smoke test with curl (requires dev server running)**

Create a test API key in the DB first:

```bash
# In psql or via drizzle studio, insert a test key
# key_hash = sha256('test-nilo-key-12345') as hex string
# Compute: node -e "console.log(require('crypto').createHash('sha256').update('test-nilo-key-12345').digest('hex'))"
```

Then test:

```bash
curl -X POST http://localhost:3001/api/nilo/sessions \
  -H "Authorization: Bearer test-nilo-key-12345" \
  -H "Content-Type: application/json" \
  -d '{"contact":{"phone":"+31612345678","name":"Jan de Vries"},"context":{"vacancy_title":"Chauffeur CE"},"external_ref":"test-001"}'
```

Expected: `{"session_id":"<uuid>","state":"created"}` with status 201.

Second call with same `external_ref`:

```bash
# Expected: 409 {"session_id":"<uuid>","duplicate":true}
```

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/routes/nilo-trigger.routes.ts apps/api/src/index.ts
git commit -m "feat(nilo): POST /api/nilo/sessions trigger route with API key auth and idempotency"
```

---

## Task 11: Extend Twilio webhook route for nilo sessions

**Files:**
- Modify: `apps/api/src/routes/whatsapp-webhook.routes.ts`

The existing webhook resolves intake sessions. Add nilo session resolution first — if a nilo session is found for the inbound phone, handle it via `nilo.process_inbound`. If not found, fall through to the existing intake session lookup.

- [ ] **Step 1: Add nilo session lookup to the webhook handler**

Open `apps/api/src/routes/whatsapp-webhook.routes.ts`.

After the Twilio signature verification block (after `const parsed = gw.parseWebhook(params)`), add before the existing intake session lookup:

```typescript
// -- NILO SESSION LOOKUP --
// Check nilo_sessions first (new standalone sessions)
const niloPhone = parsed.fromPhone
let niloSession: { sessionId: string; organizationId: string } | null = null
for (const st of ['initiated', 'in_progress'] as const) {
  const rows = await db
    .select({
      sessionId: niloSessions.id,
      organizationId: niloSessions.organizationId,
    })
    .from(niloSessions)
    .where(
      and(
        eq(niloSessions.contactPhone, niloPhone),
        eq(niloSessions.state, st),
      ),
    )
    .limit(1)
  if (rows.length > 0) {
    niloSession = rows[0] ?? null
    break
  }
}

if (niloSession) {
  const boss = getJobQueue()
  if (boss) {
    await boss.send('nilo.process_inbound', {
      orgId: niloSession.organizationId,
      sessionId: niloSession.sessionId,
      fromPhone: parsed.fromPhone,
      body: parsed.body,
      twilioSid: parsed.messageSid,
    })
  }
  return c.text('', 200)
}
// -- END NILO SESSION LOOKUP — fall through to intake session lookup --
```

Also add the import at the top of the file:

```typescript
import { niloSessions } from '../db/schema/index.js'
```

- [ ] **Step 2: Verify TypeScript is clean**

```bash
cd apps/api && pnpm tsc --noEmit 2>&1 | grep "whatsapp"
```

Expected: no errors.

- [ ] **Step 3: Run the full test suite to verify no regressions**

```bash
cd apps/api && pnpm test
```

Expected: all existing tests pass.

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/routes/whatsapp-webhook.routes.ts
git commit -m "feat(nilo): extend Twilio webhook to route nilo sessions before intake fallback"
```

---

## Task 12: Implement session list, detail, and handoff API routes

**Files:**
- Create: `apps/api/src/routes/nilo-sessions.routes.ts`
- Modify: `apps/api/src/index.ts`

- [ ] **Step 1: Create nilo-sessions.routes.ts**

```typescript
// apps/api/src/routes/nilo-sessions.routes.ts
import { Hono } from 'hono'
import { z } from 'zod'
import { eq, desc } from 'drizzle-orm'
import type { AppEnv } from '../lib/app-env.js'
import { db } from '../db/index.js'
import { niloSessions, niloMessages, niloHandoffs } from '../db/schema/index.js'
import { withTenantContext } from '../lib/with-tenant-context.js'
import { authMiddleware } from '../middleware/auth.middleware.js'
import { tenantMiddleware } from '../middleware/tenant.middleware.js'

const handoffResolveSchema = z.object({
  resolution: z.enum(['took_over', 'dismissed', 'resumed_bot']),
  verdict: z.enum(['qualified', 'rejected', 'unsure']).optional(),
  verdict_reason: z.string().max(1000).optional(),
})

export const niloSessionsRoutes = new Hono<AppEnv>()
  .use('*', authMiddleware, tenantMiddleware)

  // GET /api/nilo/sessions — list all sessions for org
  .get('/', async (c) => {
    const orgId = c.get('organizationId')
    const state = c.req.query('state')
    const sessions = await withTenantContext(orgId, async (tx) => {
      const query = tx
        .select({
          id: niloSessions.id,
          contactPhone: niloSessions.contactPhone,
          contactName: niloSessions.contactName,
          state: niloSessions.state,
          verdict: niloSessions.verdict,
          matchScore: niloSessions.matchScore,
          answers: niloSessions.answers,
          context: niloSessions.context,
          createdAt: niloSessions.createdAt,
          completedAt: niloSessions.completedAt,
        })
        .from(niloSessions)
        .orderBy(desc(niloSessions.createdAt))
        .limit(100)
      return state
        ? query.where(eq(niloSessions.state, state))
        : query
    })
    return c.json({ sessions, total: sessions.length })
  })

  // GET /api/nilo/sessions/:id — session detail with messages + handoffs
  .get('/:id', async (c) => {
    const orgId = c.get('organizationId')
    const sessionId = c.req.param('id')

    const [session, messages, handoffs] = await Promise.all([
      withTenantContext(orgId, (tx) =>
        tx.select().from(niloSessions).where(eq(niloSessions.id, sessionId)).limit(1),
      ),
      withTenantContext(orgId, (tx) =>
        tx
          .select({
            id: niloMessages.id,
            direction: niloMessages.direction,
            body: niloMessages.body,
            isFromBot: niloMessages.isFromBot,
            sentAt: niloMessages.sentAt,
          })
          .from(niloMessages)
          .where(eq(niloMessages.sessionId, sessionId))
          .orderBy(niloMessages.sentAt),
      ),
      withTenantContext(orgId, (tx) =>
        tx
          .select({
            id: niloHandoffs.id,
            reason: niloHandoffs.reason,
            requestedAt: niloHandoffs.requestedAt,
            resolvedAt: niloHandoffs.resolvedAt,
            resolution: niloHandoffs.resolution,
          })
          .from(niloHandoffs)
          .where(eq(niloHandoffs.sessionId, sessionId)),
      ),
    ])

    if (!session[0]) return c.json({ error: 'not found' }, 404)
    return c.json({ ...session[0], messages, handoffs })
  })

  // PATCH /api/nilo/sessions/:id/handoff — resolve a handoff
  .patch('/:id/handoff', async (c) => {
    const orgId = c.get('organizationId')
    const sessionId = c.req.param('id')
    const user = c.get('user')

    const body = await c.req.json().catch(() => null)
    const parsed = handoffResolveSchema.safeParse(body)
    if (!parsed.success) return c.json({ error: 'invalid request' }, 400)

    const { resolution, verdict, verdict_reason } = parsed.data

    await withTenantContext(orgId, async (tx) => {
      // Update handoff record
      const [handoff] = await tx
        .select({ id: niloHandoffs.id })
        .from(niloHandoffs)
        .where(eq(niloHandoffs.sessionId, sessionId))
        .orderBy(desc(niloHandoffs.requestedAt))
        .limit(1)

      if (handoff) {
        await tx.update(niloHandoffs).set({
          resolvedAt: new Date(),
          resolution,
          assignedTo: user?.id ? user.id as unknown as string : null,
          acceptedAt: new Date(),
        }).where(eq(niloHandoffs.id, handoff.id))
      }

      // Update session state
      if (resolution === 'resumed_bot') {
        await tx.update(niloSessions).set({ state: 'in_progress' }).where(eq(niloSessions.id, sessionId))
      } else if (resolution === 'dismissed' && verdict) {
        await tx.update(niloSessions).set({
          state: 'completed',
          verdict,
          verdictReason: verdict_reason ?? 'manual verdict by recruiter',
          completedAt: new Date(),
        }).where(eq(niloSessions.id, sessionId))
      }
    })

    return c.json({ ok: true })
  })
```

- [ ] **Step 2: Mount routes in index.ts**

Add import:

```typescript
import { niloSessionsRoutes } from './routes/nilo-sessions.routes.js'
```

Add route (this one uses authMiddleware internally, so mount without extra middleware):

```typescript
app.route('/api/nilo/sessions', niloSessionsRoutes)
```

> Note: Both `niloTriggerRoutes` and `niloSessionsRoutes` use the same `/api/nilo/sessions` prefix but are separate Hono instances. The trigger route handles `POST /` (no auth middleware), the sessions route handles `GET /`, `GET /:id`, `PATCH /:id/handoff` (with auth middleware). Mount trigger route first.

- [ ] **Step 3: Verify TypeScript is clean**

```bash
cd apps/api && pnpm tsc --noEmit 2>&1 | head -20
```

Expected: no errors.

- [ ] **Step 4: Run tests**

```bash
cd apps/api && pnpm test
```

Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/routes/nilo-sessions.routes.ts apps/api/src/index.ts
git commit -m "feat(nilo): session list, detail, and handoff resolution routes"
```

---

## Task 13: Build session monitor UI (list + detail + sidebar)

**Files:**
- Create: `apps/web/src/app/(app)/nilo/sessions/page.tsx`
- Create: `apps/web/src/app/(app)/nilo/sessions/[id]/page.tsx`
- Create: `apps/web/src/hooks/use-nilo-sessions.ts`
- Modify: `apps/web/src/components/layout/sidebar.tsx`

- [ ] **Step 1: Create TanStack Query hooks**

```typescript
// apps/web/src/hooks/use-nilo-sessions.ts
import { useQuery } from '@tanstack/react-query'

export interface NiloSessionSummary {
  id: string
  contactPhone: string
  contactName: string | null
  state: string
  verdict: string | null
  matchScore: number | null
  answers: Record<string, { value: unknown; confidence: string }>
  context: Record<string, unknown>
  createdAt: string
  completedAt: string | null
}

export interface NiloMessage {
  id: string
  direction: 'inbound' | 'outbound'
  body: string
  isFromBot: boolean
  sentAt: string
}

async function fetchSessions(state?: string): Promise<{ sessions: NiloSessionSummary[]; total: number }> {
  const url = state ? `/api/nilo/sessions?state=${state}` : '/api/nilo/sessions'
  const res = await fetch(url)
  if (!res.ok) throw new Error('Failed to fetch nilo sessions')
  return res.json()
}

async function fetchSession(id: string) {
  const res = await fetch(`/api/nilo/sessions/${id}`)
  if (!res.ok) throw new Error('Failed to fetch nilo session')
  return res.json() as Promise<NiloSessionSummary & { messages: NiloMessage[]; handoffs: unknown[] }>
}

export function useNiloSessions(state?: string) {
  return useQuery({
    queryKey: ['nilo-sessions', state],
    queryFn: () => fetchSessions(state),
    refetchInterval: 15000,
  })
}

export function useNiloSession(id: string) {
  return useQuery({
    queryKey: ['nilo-session', id],
    queryFn: () => fetchSession(id),
    refetchInterval: 5000,
  })
}
```

- [ ] **Step 2: Create session list page**

```tsx
// apps/web/src/app/(app)/nilo/sessions/page.tsx
'use client'

import { useNiloSessions } from '@/hooks/use-nilo-sessions'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import Link from 'next/link'
import { formatDistanceToNow } from 'date-fns'
import { nl } from 'date-fns/locale'

const STATE_VARIANT: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  created: 'outline',
  initiated: 'secondary',
  in_progress: 'default',
  awaiting_human: 'destructive',
  completed: 'secondary',
  abandoned: 'outline',
}

const VERDICT_VARIANT: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  qualified: 'default',
  rejected: 'destructive',
  unsure: 'secondary',
}

export default function NiloSessionsPage() {
  const { data, isLoading } = useNiloSessions()

  if (isLoading) {
    return <div className="p-6 text-muted-foreground">Sessies laden...</div>
  }

  const sessions = data?.sessions ?? []

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Hey Nilo — Sessies</h1>
          <p className="text-sm text-muted-foreground">{data?.total ?? 0} sessies</p>
        </div>
      </div>

      <div className="rounded-md border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="h-10 px-4 text-left font-medium">Contact</th>
              <th className="h-10 px-4 text-left font-medium">Status</th>
              <th className="h-10 px-4 text-left font-medium">Uitkomst</th>
              <th className="h-10 px-4 text-left font-medium">Score</th>
              <th className="h-10 px-4 text-left font-medium">Aangemaakt</th>
            </tr>
          </thead>
          <tbody>
            {sessions.map((s) => (
              <tr key={s.id} className="border-b hover:bg-muted/30 transition-colors">
                <td className="px-4 py-3">
                  <Link href={`/nilo/sessions/${s.id}`} className="hover:underline font-medium">
                    {s.contactName ?? s.contactPhone}
                  </Link>
                  {s.contactName && (
                    <p className="text-xs text-muted-foreground">{s.contactPhone}</p>
                  )}
                  {s.context['vacancy_title'] && (
                    <p className="text-xs text-muted-foreground">
                      {String(s.context['vacancy_title'])}
                    </p>
                  )}
                </td>
                <td className="px-4 py-3">
                  <Badge variant={STATE_VARIANT[s.state] ?? 'outline'}>{s.state}</Badge>
                </td>
                <td className="px-4 py-3">
                  {s.verdict ? (
                    <Badge variant={VERDICT_VARIANT[s.verdict] ?? 'outline'}>{s.verdict}</Badge>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  {s.matchScore != null ? (
                    <span className="font-mono">{s.matchScore}%</span>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </td>
                <td className="px-4 py-3 text-muted-foreground text-xs">
                  {formatDistanceToNow(new Date(s.createdAt), { addSuffix: true, locale: nl })}
                </td>
              </tr>
            ))}
            {sessions.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                  Geen sessies gevonden
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Create session detail page**

```tsx
// apps/web/src/app/(app)/nilo/sessions/[id]/page.tsx
'use client'

import { use } from 'react'
import { useNiloSession } from '@/hooks/use-nilo-sessions'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { formatDistanceToNow, format } from 'date-fns'
import { nl } from 'date-fns/locale'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'

interface Props {
  params: Promise<{ id: string }>
}

export default function NiloSessionDetailPage({ params }: Props) {
  const { id } = use(params)
  const { data: session, isLoading } = useNiloSession(id)
  const router = useRouter()

  if (isLoading) return <div className="p-6 text-muted-foreground">Laden...</div>
  if (!session) return <div className="p-6 text-muted-foreground">Sessie niet gevonden</div>

  async function resolveHandoff(resolution: string, verdict?: string) {
    await fetch(`/api/nilo/sessions/${id}/handoff`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ resolution, verdict }),
    })
    router.refresh()
  }

  return (
    <div className="p-6 space-y-6 max-w-4xl">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold">
            {session.contactName ?? session.contactPhone}
          </h1>
          <p className="text-sm text-muted-foreground">
            {session.contactPhone} · {String(session.context['vacancy_title'] ?? '')}
          </p>
          <div className="flex gap-2 mt-2">
            <Badge>{session.state}</Badge>
            {session.verdict && <Badge variant={session.verdict === 'qualified' ? 'default' : 'destructive'}>{session.verdict}</Badge>}
            {session.matchScore != null && (
              <Badge variant="outline">{session.matchScore}% match</Badge>
            )}
          </div>
        </div>

        {session.state === 'awaiting_human' && (
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => resolveHandoff('resumed_bot')}>
              Bot hervatten
            </Button>
            <Button size="sm" variant="default" onClick={() => resolveHandoff('dismissed', 'qualified')}>
              Gekwalificeerd
            </Button>
            <Button size="sm" variant="destructive" onClick={() => resolveHandoff('dismissed', 'rejected')}>
              Afgewezen
            </Button>
          </div>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Gesprek</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {session.messages.map((msg) => (
            <div
              key={msg.id}
              className={cn(
                'flex',
                msg.direction === 'outbound' ? 'justify-end' : 'justify-start',
              )}
            >
              <div
                className={cn(
                  'max-w-[75%] rounded-2xl px-4 py-2 text-sm',
                  msg.direction === 'outbound'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted',
                )}
              >
                <p className="whitespace-pre-wrap">{msg.body}</p>
                <p className="text-[10px] opacity-60 mt-1">
                  {format(new Date(msg.sentAt), 'HH:mm')}
                </p>
              </div>
            </div>
          ))}
          {session.messages.length === 0 && (
            <p className="text-muted-foreground text-sm text-center py-4">
              Geen berichten
            </p>
          )}
        </CardContent>
      </Card>

      {Object.keys(session.answers).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Antwoorden</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-2 gap-3">
              {Object.entries(session.answers).map(([key, ans]) => (
                <div key={key}>
                  <dt className="text-xs text-muted-foreground">{key}</dt>
                  <dd className="text-sm font-medium">
                    {JSON.stringify((ans as { value: unknown }).value)}
                    <span className="text-xs text-muted-foreground ml-1">
                      ({(ans as { confidence: string }).confidence})
                    </span>
                  </dd>
                </div>
              ))}
            </dl>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Add Nilo to sidebar nav**

Open `apps/web/src/components/layout/sidebar.tsx` and find the `EMPLOYER_NAV` or `AGENCY_NAV` array. Add a Nilo entry (e.g., after "Intake"):

```typescript
// Find the import block and add if not present:
import { Bot } from 'lucide-react'

// Add to EMPLOYER_NAV (and AGENCY_NAV if applicable):
{ href: '/nilo/sessions', label: 'Hey Nilo', icon: Bot },
```

- [ ] **Step 5: Verify TypeScript is clean in apps/web**

```bash
cd apps/web && pnpm tsc --noEmit 2>&1 | grep -i nilo
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/app/\(app\)/nilo/ apps/web/src/hooks/use-nilo-sessions.ts apps/web/src/components/layout/sidebar.tsx
git commit -m "feat(nilo): session monitor UI — list page, detail page with conversation thread, sidebar nav"
```

---

## Task 14: Provision Timmers org and smoke test end-to-end

**Files:**
- Create: `apps/api/scripts/provision-nilo-org.ts` (one-time script, not committed to main branch)

- [ ] **Step 1: Create provisioning script**

```typescript
// apps/api/scripts/provision-nilo-org.ts
// Run with: pnpm tsx scripts/provision-nilo-org.ts
import 'dotenv/config'
import { createHash, randomBytes } from 'node:crypto'
import { db } from '../src/db/index.js'
import { niloApiKeys } from '../src/db/schema/index.js'

const orgId = process.env['TIMMERS_ORG_ID']
if (!orgId) throw new Error('TIMMERS_ORG_ID env var required')

const rawKey = `nilo_${randomBytes(32).toString('hex')}`
const keyHash = createHash('sha256').update(rawKey).digest('hex')

await db.insert(niloApiKeys).values({
  organizationId: orgId,
  keyHash,
  label: 'Timmers default',
})

console.log('✅ API key created')
console.log('Raw key (save this — not stored):', rawKey)
console.log('Hash stored in DB:', keyHash)

process.exit(0)
```

- [ ] **Step 2: Set environment variables**

Ensure these are set in `.env`:

```
TIMMERS_ORG_ID=<uuid of the Timmers organization>
TIMMERS_WEBHOOK_URL=<optional: Timmers CRM webhook>
TIMMERS_SLACK_WEBHOOK_URL=<optional: Slack webhook for alerts>
TWILIO_ACCOUNT_SID=<your Twilio account SID>
TWILIO_AUTH_TOKEN=<your Twilio auth token>
TWILIO_WHATSAPP_FROM=whatsapp:+14155238886
ANTHROPIC_API_KEY=<your Anthropic API key>
JOBS_ENABLED=true
```

- [ ] **Step 3: Run provisioning script**

```bash
cd apps/api && pnpm tsx scripts/provision-nilo-org.ts
```

Save the printed raw key — this is what Zapier/Timmers uses for the trigger API.

- [ ] **Step 4: End-to-end smoke test**

Start the dev server:

```bash
pnpm dev
```

Trigger a test session:

```bash
curl -X POST http://localhost:3001/api/nilo/sessions \
  -H "Authorization: Bearer <raw_key_from_step_3>" \
  -H "Content-Type: application/json" \
  -d '{"contact":{"phone":"+31612345678","name":"Jan Test"},"context":{"vacancy_title":"Chauffeur CE","source":"smoke_test"},"external_ref":"smoke-001"}'
```

Expected: 201 response with `session_id`.

Verify session appears in UI at `http://localhost:3000/nilo/sessions`.

Verify pg-boss dispatched a `nilo.start` job (check logs or `pgboss.job` table).

Verify first WhatsApp message sent to Twilio sandbox (check Twilio console or mock).

- [ ] **Step 5: Commit**

```bash
git add apps/api/scripts/provision-nilo-org.ts
git commit -m "feat(nilo): provisioning script for org API key generation"
```

---

## Task 15: Final wiring — run full test suite and verify

- [ ] **Step 1: Run the complete API test suite**

```bash
cd apps/api && pnpm test
```

Expected: all tests pass. Fix any that don't before continuing.

- [ ] **Step 2: Run TypeScript check across all packages**

```bash
pnpm turbo type-check
```

Expected: no errors across `apps/api`, `apps/web`, `packages/nilo-core`.

- [ ] **Step 3: Verify nilo-core tests pass**

```bash
cd packages/nilo-core && pnpm test
```

Expected: all 7 tests pass (renderer ×3, tool-executor ×3, orchestrator ×3 via earlier tasks).

- [ ] **Step 4: Add nilo queues to endpoint-audit.test.ts expected list**

Open `apps/api/tests/security/endpoint-audit.test.ts`. Find `expectedFiles` array and add:

```
'nilo-trigger.routes.ts',
'nilo-sessions.routes.ts',
```

Also update the route count if the test checks a specific number.

Run:

```bash
cd apps/api && pnpm test tests/security/endpoint-audit.test.ts
```

Expected: PASS.

- [ ] **Step 5: Final commit**

```bash
git add apps/api/tests/
git commit -m "test(nilo): update endpoint audit for new nilo routes"
```

---

## Self-Review Checklist

Spec sections verified against plan tasks:

| Spec requirement | Task |
|-----------------|------|
| NiloPersistence interface | Task 1 (types.ts) |
| renderer + gateway extraction | Task 2 |
| agent tools + executor | Task 3 |
| agent prompts + processInbound | Task 4 |
| orchestrator (startSession, sendReminder, sendFarewell) | Task 5 |
| nilo_* Drizzle schema (6 tables) | Task 6 |
| drizzle-persistence.ts | Task 7 |
| flow-registry (Timmers hardcoded) | Task 8 |
| nilo module orchestrator | Task 8 |
| outbound webhook + Slack | Task 9 |
| pg-boss job handlers (4 jobs) | Task 9 |
| Trigger API with API key auth | Task 10 |
| Idempotency via external_ref | Task 10 |
| Twilio webhook nilo routing | Task 11 |
| Session list/detail/handoff API | Task 12 |
| Session monitor UI | Task 13 |
| Sidebar nav | Task 13 |
| Provisioning / smoke test | Task 14 |
| Full test suite + type check | Task 15 |
| RLS on all nilo_* tables | Task 6 (enableRLS + tenantRlsPolicies) |
| KNOWN_QUEUES in job-queue.ts | Task 9 |
| Endpoint audit test updated | Task 15 |
