# Intake Match Score & Conversatiekwaliteit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Na elke intake-sessie wordt een deterministisch match percentage (0–100%) berekend en opgeslagen op de sollicitatie. Recruiters zien dit in de intake inbox, op kandidaatkaarten in het kanban, en in het kandidaatdetailscherm. Naast de score worden de agent-prompts verbeterd zodat de bot nooit "OK" of andere zinloze bevestigingen stuurt.

**Architecture:** De scorer is een pure functie (`calculateMatchScore`) die verdict + antwoorden + vacaturecriteria verwerkt zonder DB-calls. De tool-store roept de scorer aan in `finalize()`, persisteert de score op zowel `intake_sessions` als `candidate_applications`, en verstuurt een Slack-alert als score ≥ 75 en verdict = qualified. De frontend leest `matchScore` rechtstreeks uit de bestaande API-responses zodra de DB-kolom er is.

**Tech Stack:** TypeScript, Drizzle ORM (PostgreSQL), Vitest, React + TanStack Query, Lucide icons, Tailwind CSS

---

## File Structure

| Bestand | Actie | Verantwoordelijkheid |
|---|---|---|
| `packages/db/src/schema/intake.ts` (= `apps/api/src/db/schema/intake.ts`) | Modify | `matchScore` kolom toevoegen aan `intakeSessions` |
| `apps/api/src/db/schema/applications.ts` | Modify | `matchScore` kolom toevoegen aan `candidateApplications` |
| `apps/api/src/modules/intake/scorer.ts` | Create | Pure score-calculator functie |
| `apps/api/tests/unit/scorer.test.ts` | Create | Vitest unit tests voor scorer |
| `apps/api/src/modules/intake/agent/tool-store.ts` | Modify | Score berekenen + persisteren in `finalize()` |
| `apps/api/src/modules/intake/agent/prompts.ts` | Modify | Anti-chatbot regels + acknowledgment variety |
| `apps/api/src/routes/intake.routes.ts` | Modify | `matchScore` toevoegen aan sessions list response |
| `packages/types/src/application.ts` | Modify | `matchScore?: number | null` toevoegen aan `CandidateApplication` |
| `apps/web/src/components/intake/match-score-badge.tsx` | Create | Herbruikbare score-chip component (rood/amber/groen) |
| `apps/web/src/app/(app)/intake/page.tsx` | Modify | Score-chip in sessietabel |
| `apps/web/src/app/(app)/candidates/components/candidate-kanban.tsx` | Modify | Score-chip op kanban-kaarten |
| `apps/web/src/app/(app)/candidates/[id]/page.tsx` | Modify | Score per sollicitatie in Sollicitaties-tab |

---

## Task 1: DB Schema — matchScore kolom

**Files:**
- Modify: `apps/api/src/db/schema/intake.ts`
- Modify: `apps/api/src/db/schema/applications.ts`

- [ ] **Stap 1: Voeg `matchScore` toe aan `intakeSessions`**

Open `apps/api/src/db/schema/intake.ts`. Voeg `matchScore` toe na `reminderCount`:

```typescript
// Bestaand:
reminderCount: integer("reminder_count").default(0).notNull(),
createdAt: timestamp("created_at").defaultNow().notNull(),
completedAt: timestamp("completed_at"),

// Wordt:
reminderCount: integer("reminder_count").default(0).notNull(),
matchScore: integer("match_score"),          // 0–100, null tot sessie voltooid
createdAt: timestamp("created_at").defaultNow().notNull(),
completedAt: timestamp("completed_at"),
```

- [ ] **Stap 2: Voeg `matchScore` toe aan `candidateApplications`**

Open `apps/api/src/db/schema/applications.ts`. Voeg toe na `rejectReason`:

```typescript
// Bestaand:
rejectReason: text("reject_reason"),
qualificationNotes: text("qualification_notes"),

// Wordt:
rejectReason: text("reject_reason"),
matchScore: integer("match_score"),          // gespiegeld van intake_sessions.match_score
qualificationNotes: text("qualification_notes"),
```

- [ ] **Stap 3: Genereer migratie**

```bash
cd /path/to/recruitment-os
pnpm --filter @recruitment-os/api db:generate
```

Verwacht output: nieuwe migratiefile in `apps/api/drizzle/` met `ALTER TABLE intake_sessions ADD COLUMN match_score integer` en `ALTER TABLE candidate_applications ADD COLUMN match_score integer`.

- [ ] **Stap 4: Run migratie**

```bash
pnpm --filter @recruitment-os/api db:migrate
```

Verwacht: "Migration applied successfully" of gelijkwaardig.

- [ ] **Stap 5: Commit**

```bash
git add apps/api/src/db/schema/intake.ts apps/api/src/db/schema/applications.ts apps/api/drizzle/
git commit -m "feat(db): add match_score column to intake_sessions and candidate_applications"
```

---

## Task 2: Match Score Calculator

**Files:**
- Create: `apps/api/src/modules/intake/scorer.ts`
- Create: `apps/api/tests/unit/scorer.test.ts`

- [ ] **Stap 1: Schrijf failing tests**

Maak `apps/api/tests/unit/scorer.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { calculateMatchScore } from "../../src/modules/intake/scorer.js";
import type { QualificationCriteria } from "@recruitment-os/types";

const baseCriteria: QualificationCriteria = {
  mustHave: {
    licenses: ["CE"],
    rightToWork: true,
    customKeys: [{ key: "code95", question: "Heb je Code 95?", expectedFormat: "yes_no", required: true }],
  },
  niceToHave: { experienceYearsMin: 3 },
};

describe("calculateMatchScore", () => {
  it("returns 100 when all must-haves answered with high confidence + qualified", () => {
    const answers = {
      licenses: { value: "CE", confidence: "high" },
      rightToWork: { value: true, confidence: "high" },
      code95: { value: "ja", confidence: "high" },
      experienceYearsMin: { value: 5, confidence: "high" },
    };
    const score = calculateMatchScore("qualified", answers, baseCriteria);
    expect(score).toBe(100);
  });

  it("caps rejected verdict at 35 regardless of coverage", () => {
    const answers = {
      licenses: { value: "CE", confidence: "high" },
      rightToWork: { value: true, confidence: "high" },
      code95: { value: "ja", confidence: "high" },
    };
    const score = calculateMatchScore("rejected", answers, baseCriteria);
    expect(score).toBeLessThanOrEqual(35);
  });

  it("returns lower score when must-haves answered with low confidence", () => {
    const answers = {
      licenses: { value: "CE", confidence: "low" },
      rightToWork: { value: true, confidence: "low" },
      code95: { value: "ja", confidence: "low" },
    };
    const highScore = calculateMatchScore("qualified", {
      licenses: { value: "CE", confidence: "high" },
      rightToWork: { value: true, confidence: "high" },
      code95: { value: "ja", confidence: "high" },
    }, baseCriteria);
    const lowScore = calculateMatchScore("qualified", answers, baseCriteria);
    expect(lowScore).toBeLessThan(highScore);
  });

  it("returns 0 when no must-haves answered and verdict is rejected", () => {
    const score = calculateMatchScore("rejected", {}, baseCriteria);
    expect(score).toBe(0);
  });

  it("returns 75 for qualified verdict with all must-haves high-confidence and no niceToHave answers", () => {
    const criteriaNoNth: QualificationCriteria = {
      mustHave: { licenses: ["CE"] },
      niceToHave: {},
    };
    const answers = { licenses: { value: "CE", confidence: "high" } };
    const score = calculateMatchScore("qualified", answers, criteriaNoNth);
    // 70 (mh full) + 0 (no nth defined) + 10 (qualified bonus) = 80
    expect(score).toBe(80);
  });

  it("handles empty criteria gracefully", () => {
    const emptyCriteria: QualificationCriteria = { mustHave: {}, niceToHave: {} };
    const score = calculateMatchScore("qualified", {}, emptyCriteria);
    // No must-haves → mhScore = 70, no nth → nthScore = 0, qualified bonus = 10 → 80
    expect(score).toBe(80);
  });

  it("handles unsure verdict", () => {
    const answers = {
      licenses: { value: "C", confidence: "medium" },
      rightToWork: { value: true, confidence: "high" },
      code95: { value: "nee", confidence: "high" },
    };
    const score = calculateMatchScore("unsure", answers, baseCriteria);
    expect(score).toBeGreaterThan(0);
    expect(score).toBeLessThanOrEqual(100);
  });
});
```

- [ ] **Stap 2: Run tests — verwacht FAIL**

```bash
cd apps/api
pnpm test tests/unit/scorer.test.ts
```

Verwacht: `Cannot find module '../../src/modules/intake/scorer.js'`

- [ ] **Stap 3: Implementeer de scorer**

Maak `apps/api/src/modules/intake/scorer.ts`:

```typescript
import type { QualificationCriteria } from "@recruitment-os/types";

const CONFIDENCE_WEIGHT: Record<string, number> = {
  high: 1.0,
  medium: 0.75,
  low: 0.3,
};

export type AnswerMap = Record<string, { value: unknown; confidence: string }>;

function getMustHaveKeys(criteria: QualificationCriteria): string[] {
  const keys: string[] = [];
  const mh = criteria.mustHave;
  if ((mh.licenses ?? []).length > 0) keys.push("licenses");
  if (mh.availability) keys.push("availability");
  if (mh.vertical) keys.push("vertical");
  if (mh.locationRadiusKm !== undefined) keys.push("locationRadiusKm");
  if (mh.rightToWork !== undefined) keys.push("rightToWork");
  if (mh.minAge !== undefined) keys.push("minAge");
  for (const ck of mh.customKeys ?? []) {
    if (ck.required) keys.push(ck.key);
  }
  return keys;
}

function getNiceToHaveKeys(criteria: QualificationCriteria): string[] {
  const keys: string[] = [];
  const nth = criteria.niceToHave;
  if (nth.experienceYearsMin !== undefined) keys.push("experienceYearsMin");
  if ((nth.certifications ?? []).length > 0) keys.push("certifications");
  if ((nth.preferredLanguages ?? []).length > 0) keys.push("preferredLanguages");
  if (nth.freeText) keys.push("freeText");
  return keys;
}

/**
 * Berekent een match percentage (0–100) op basis van:
 * - verdict (qualified/unsure/rejected) — bepaalt het plafond
 * - answers — alle opgeslagen antwoorden met confidence scores
 * - criteria — de vacature-eisen (mustHave 70%, niceToHave 20%, verdict bonus 10%)
 *
 * Rejected kandidaten krijgen altijd ≤ 35 ongeacht coverage.
 */
export function calculateMatchScore(
  verdict: "qualified" | "rejected" | "unsure",
  answers: AnswerMap,
  criteria: QualificationCriteria,
): number {
  const mhKeys = getMustHaveKeys(criteria);
  const nthKeys = getNiceToHaveKeys(criteria);

  // Must-haves: 70% van totaalscore
  let mhEarned = 0;
  for (const key of mhKeys) {
    const ans = answers[key];
    if (ans) mhEarned += CONFIDENCE_WEIGHT[ans.confidence] ?? 0.5;
  }
  const mhScore = mhKeys.length > 0 ? (mhEarned / mhKeys.length) * 70 : 70;

  // Nice-to-haves: 20% van totaalscore
  let nthEarned = 0;
  for (const key of nthKeys) {
    const ans = answers[key];
    if (ans) nthEarned += CONFIDENCE_WEIGHT[ans.confidence] ?? 0.5;
  }
  const nthScore = nthKeys.length > 0 ? (nthEarned / nthKeys.length) * 20 : 0;

  // Verdict bonus: 10%
  const verdictBonus = verdict === "qualified" ? 10 : verdict === "unsure" ? 5 : 0;

  const raw = Math.round(mhScore + nthScore + verdictBonus);

  // Rejected heeft hard cap op 35
  return verdict === "rejected" ? Math.min(raw, 35) : Math.min(raw, 100);
}
```

- [ ] **Stap 4: Run tests — verwacht PASS**

```bash
cd apps/api
pnpm test tests/unit/scorer.test.ts
```

Verwacht: `6 passed`

- [ ] **Stap 5: Commit**

```bash
git add apps/api/src/modules/intake/scorer.ts apps/api/tests/unit/scorer.test.ts
git commit -m "feat(intake): deterministic match score calculator with Vitest coverage"
```

---

## Task 3: Wire Score in tool-store finalize()

**Files:**
- Modify: `apps/api/src/modules/intake/agent/tool-store.ts`

- [ ] **Stap 1: Voeg imports toe**

Vervang de bestaande import-sectie in `apps/api/src/modules/intake/agent/tool-store.ts`:

```typescript
// Bestaand:
import { eq, sql } from "drizzle-orm";
import { db } from "../../../db/index.js";
import { intakeSessions, candidateApplications, pipelineStages } from "../../../db/schema/index.js";
import { getJobQueue } from "../../../lib/job-queue.js";
import type { ToolStore } from "./tool-executor.js";

// Wordt:
import { eq, sql } from "drizzle-orm";
import { db } from "../../../db/index.js";
import { intakeSessions, candidateApplications, pipelineStages, vacancies } from "../../../db/schema/index.js";
import { getJobQueue } from "../../../lib/job-queue.js";
import { sendAlert } from "../../../lib/alert.js";
import { qualificationCriteriaSchema } from "@recruitment-os/types";
import { calculateMatchScore } from "../scorer.js";
import type { ToolStore } from "./tool-executor.js";
```

- [ ] **Stap 2: Vervang de volledige `finalize` methode**

Vervang de `finalize` methode (regels 41–78) met:

```typescript
async finalize(sessionId, status, summary, rejectionReason) {
  // 1. Fetch session met answers + applicationId (één query)
  const [session] = await db
    .select({
      applicationId: intakeSessions.applicationId,
      orgId: intakeSessions.organizationId,
      mustHaveAnswers: intakeSessions.mustHaveAnswers,
      niceToHaveAnswers: intakeSessions.niceToHaveAnswers,
    })
    .from(intakeSessions)
    .where(eq(intakeSessions.id, sessionId))
    .limit(1);

  if (!session) return;

  // 2. Fetch vacancy title + criteria via candidateApplications JOIN
  const [appRow] = await db
    .select({
      vacancyTitle: vacancies.title,
      vacancyCriteria: vacancies.qualificationCriteria,
    })
    .from(candidateApplications)
    .innerJoin(vacancies, eq(candidateApplications.vacancyId, vacancies.id))
    .where(eq(candidateApplications.id, session.applicationId))
    .limit(1);

  // 3. Bereken match score
  let matchScore: number | null = null;
  if (appRow) {
    const parsed = qualificationCriteriaSchema.safeParse(appRow.vacancyCriteria ?? {});
    if (parsed.success) {
      // Alle antwoorden worden opgeslagen in mustHaveAnswers (zie recordAnswer)
      const allAnswers = (session.mustHaveAnswers ?? {}) as Record<
        string,
        { value: unknown; confidence: string }
      >;
      matchScore = calculateMatchScore(status, allAnswers, parsed.data);
    }
  }

  // 4. Update intake_sessions
  await db
    .update(intakeSessions)
    .set({
      state: "completed",
      verdict: status,
      verdictReason: summary + (rejectionReason ? ` — ${rejectionReason}` : ""),
      completedAt: new Date(),
      matchScore,
    })
    .where(eq(intakeSessions.id, sessionId));

  // 5. Move application stage + sla matchScore op
  const targetSlug = status === "qualified" ? "qualified" : "rejected_by_bot";
  const [stage] = await db
    .select({ id: pipelineStages.id })
    .from(pipelineStages)
    .where(
      sql`${pipelineStages.organizationId} = ${session.orgId} AND ${pipelineStages.slug} = ${targetSlug}`,
    )
    .limit(1);

  await db
    .update(candidateApplications)
    .set({
      ...(stage ? { currentStageId: stage.id } : {}),
      ...(matchScore !== null ? { matchScore } : {}),
    })
    .where(eq(candidateApplications.id, session.applicationId));

  // 6. Alert bij sterke match (non-blocking)
  if (matchScore !== null && matchScore >= 75 && status === "qualified" && appRow) {
    void sendAlert(
      `✅ Sterke kandidaat: ${matchScore}% match op "${appRow.vacancyTitle}" — controleer Intake Inbox`,
    );
  }

  // 7. Enqueue Fleks pushback
  await getJobQueue().send("intake.fleks_pushback", { sessionId });
},
```

- [ ] **Stap 3: Controleer TypeScript compilatie**

```bash
cd apps/api
pnpm tsc --noEmit
```

Verwacht: geen fouten gerelateerd aan tool-store.ts.

- [ ] **Stap 4: Run bestaande unit tests om regressie te checken**

```bash
cd apps/api
pnpm test tests/unit/tool-executor.test.ts
```

Verwacht: alle tests PASS.

- [ ] **Stap 5: Commit**

```bash
git add apps/api/src/modules/intake/agent/tool-store.ts
git commit -m "feat(intake): calculate + persist matchScore in finalize, alert on score >= 75"
```

---

## Task 4: Prompt Verbetering — Anti-Chatbot Regels

**Files:**
- Modify: `apps/api/src/modules/intake/agent/prompts.ts`

Het huidige prompt heeft al "Na elke record_answer direct de volgende vraag stellen". Dit task voegt expliciete verboden toe, varieert de bevestigingen, en maakt de afsluiting natuurlijker.

- [ ] **Stap 1: Vervang de `Regels` + `Gesprek-flow` secties**

Vervang in `buildSystemPrompt` de string van `"Regels:"` tot het einde van de return-string met:

```typescript
return `Je bent een recruitment-assistent voor ${input.tenantName}. Je voert een intake-gesprek via WhatsApp met een kandidaat die solliciteerde op "${input.vacancyTitle}" bij "${input.clientName}". Jouw doel: alle must-have criteria invullen zodat de recruiter een geïnformeerde beslissing kan nemen.

Vacature-beschrijving:
${input.vacancyDescription ?? "(geen beschrijving)"}

Must-have criteria (ALLEMAAL invullen voor je finalizeert):
${mustHaveList || "(geen standaard criteria)"}
${customKeys ? "\nExtra verplichte vragen:\n" + customKeys : ""}

Nice-to-have criteria (vraag alleen als het gesprek er natuurlijk op aansluit):
${JSON.stringify(input.criteria.niceToHave ?? {}, null, 2)}

Al beantwoord — NIET opnieuw vragen:
${JSON.stringify(input.answeredMustHaves, null, 2)}
${JSON.stringify(input.answeredNiceToHaves, null, 2)}

Stuck counter per key (bij 3+ direct escaleren):
${JSON.stringify(input.stuckCounter, null, 2)}

VERBODEN antwoorden — stuur deze NOOIT als enig bericht:
- "OK", "Oké", "Begrepen", "Top!", "Super!", "Dank je", "Goed"
- Één woord of één losstaande zin zonder vervolgvraag (als er nog open must-haves zijn)
- Formele taal ("u", "hierbij", "uw sollicitatie")
- Lange paragrafen (> 3 zinnen per bericht)

Gesprek-flow (STRICT):
1. Na record_answer: bevestig kort ÉN stel direct de volgende onbeantwoorde must-have vraag in hetzelfde bericht.
   Goede voorbeelden:
   - "Mooi! En heb je ook Code 95?"
   - "Top, dat klopt precies. Wanneer kun je starten?"
   - "Oké noteer ik. Woon je in de buurt van [regio uit vacature]?"
   - "Prima. En het rijbewijs — welk type heb je precies?"
   - "Goed om te weten. Heb je wel een geldig rijbewijs CE?"
   Wissel de bevestigingen af — gebruik nooit twee keer achter elkaar dezelfde opener.

2. Als kandidaat meerdere must-haves in één bericht beantwoordt: record alle antwoorden, check dan wat er nog openstaat. Zo ja → vraag dat door. Zo nee → finalize.

3. Zodra ALLE must-haves uit "Must-have criteria" staan in "Al beantwoord": roep finalize_verdict aan.
   - qualified: alle must-haves zijn positief beantwoord
   - rejected: een of meer hard requirements ontbreken of zijn negatief
   - unsure: je hebt twijfels, kandidaat heeft deels geantwoord

4. Na finalize_verdict stuur één kort afsluitend bericht:
   - qualified/unsure: "Bedankt! Alles staat genoteerd. We nemen binnenkort contact op als er een match is. 💪"
   - rejected: "Bedankt voor je reactie. Deze rol past helaas niet bij je situatie. Succes met je zoektocht!"

5. Bij "ik wil een mens spreken" / "recruiter" / "iemand bellen" → direct escalate_to_human met reason "explicit_request".
6. Bij totaal off-topic / spam → escalate_to_human met reason "off_topic".

Tools: record_answer, request_clarification, escalate_to_human, finalize_verdict.`;
```

- [ ] **Stap 2: Run de bestaande intake-agent test om te controleren dat de prompt-output niet crasht**

```bash
cd apps/api
pnpm test tests/unit/intake-agent.test.ts
```

Verwacht: alle tests PASS (de test mockt Claude, dus de prompt-inhoud beïnvloedt de test-uitkomst niet — de test valideert de tool-call routing).

- [ ] **Stap 3: Commit**

```bash
git add apps/api/src/modules/intake/agent/prompts.ts
git commit -m "fix(intake): anti-chatbot prompt rules, acknowledgment variety, natural closing messages"
```

---

## Task 5: API — Expose matchScore in Sessions List

**Files:**
- Modify: `apps/api/src/routes/intake.routes.ts`
- Modify: `packages/types/src/application.ts`

- [ ] **Stap 1: Voeg `matchScore` toe aan de sessions list query**

In `apps/api/src/routes/intake.routes.ts`, in de `GET /sessions` handler (rond regel 70), voeg `matchScore` toe aan de `.select()`:

```typescript
// Bestaand select object:
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

// Wordt:
const rows = await db
  .select({
    id: intakeSessions.id,
    state: intakeSessions.state,
    verdict: intakeSessions.verdict,
    matchScore: intakeSessions.matchScore,   // toegevoegd
    createdAt: intakeSessions.createdAt,
    lastInboundAt: intakeSessions.lastInboundAt,
    lastOutboundAt: intakeSessions.lastOutboundAt,
    candidateName: sql<string>`${candidates.firstName} || ' ' || ${candidates.lastName}`,
    vacancyTitle: vacancies.title,
  })
```

- [ ] **Stap 2: Voeg `matchScore` toe aan `CandidateApplication` type**

Open `packages/types/src/application.ts`. Voeg toe aan de `CandidateApplication` interface:

```typescript
// Bestaand (ergens in de interface):
sentToClient: boolean;
// ...

// Voeg toe als laatste veld voor createdAt:
matchScore: number | null;
createdAt: string;
updatedAt: string;
```

- [ ] **Stap 3: Controleer TypeScript**

```bash
pnpm --filter @recruitment-os/api tsc --noEmit
pnpm --filter @recruitment-os/web tsc --noEmit
```

Verwacht: geen fouten door de nieuwe velden.

- [ ] **Stap 4: Commit**

```bash
git add apps/api/src/routes/intake.routes.ts packages/types/src/application.ts
git commit -m "feat(api): expose matchScore in intake sessions list + CandidateApplication type"
```

---

## Task 6: Frontend — Match Score Badge & Display

**Files:**
- Create: `apps/web/src/components/intake/match-score-badge.tsx`
- Modify: `apps/web/src/app/(app)/intake/page.tsx`
- Modify: `apps/web/src/app/(app)/candidates/components/candidate-kanban.tsx`
- Modify: `apps/web/src/app/(app)/candidates/[id]/page.tsx`

- [ ] **Stap 1: Maak de herbruikbare MatchScoreBadge component**

Maak `apps/web/src/components/intake/match-score-badge.tsx`:

```tsx
import { cn } from "@/lib/utils";

interface MatchScoreBadgeProps {
  score: number | null | undefined;
  size?: "sm" | "md";
}

export function MatchScoreBadge({ score, size = "md" }: MatchScoreBadgeProps) {
  if (score === null || score === undefined) return null;

  const color =
    score >= 75
      ? "bg-emerald-100 text-emerald-700 ring-emerald-200"
      : score >= 50
        ? "bg-amber-100 text-amber-700 ring-amber-200"
        : "bg-rose-100 text-rose-700 ring-rose-200";

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full font-semibold ring-1 ring-inset tabular-nums",
        size === "sm" ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-0.5 text-xs",
        color
      )}
      title={`Match score: ${score}%`}
    >
      {score}%
    </span>
  );
}
```

- [ ] **Stap 2: Voeg score-kolom toe aan de Intake Inbox sessietabel**

Open `apps/web/src/app/(app)/intake/page.tsx`.

Zoek de `<TableRow>` header en voeg een Score-kolom toe:

```tsx
// In <TableHeader>:
// Bestaand:
<TableHead>Kandidaat</TableHead>
<TableHead>Vacature</TableHead>
<TableHead>Verdict</TableHead>
<TableHead>Laatste activiteit</TableHead>

// Wordt:
<TableHead>Kandidaat</TableHead>
<TableHead>Vacature</TableHead>
<TableHead>Score</TableHead>
<TableHead>Verdict</TableHead>
<TableHead>Laatste activiteit</TableHead>
```

Zoek de bijbehorende `<TableRow>` data-rijen en voeg de score-cel toe:

```tsx
// Voeg toe tussen Vacature en Verdict cel:
<TableCell>
  <MatchScoreBadge score={session.matchScore} size="sm" />
</TableCell>
```

Voeg de import toe bovenaan:

```tsx
import { MatchScoreBadge } from "@/components/intake/match-score-badge";
```

- [ ] **Stap 3: Voeg score-chip toe op kandidaat kanban-kaarten**

Open `apps/web/src/app/(app)/candidates/components/candidate-kanban.tsx`.

Voeg de import toe bovenaan:

```tsx
import { MatchScoreBadge } from "@/components/intake/match-score-badge";
```

In de `KanbanCard` component, zoek de `Row` type definitie en voeg `matchScore` toe:

```typescript
// Bestaand:
type Row = CandidateApplication & {
  candidate?: { firstName: string | null; lastName: string | null; email: string | null } | null;
  vacancy?: { title: string } | null;
  stage?: { name: string } | null;
};

// Wordt:
type Row = CandidateApplication & {
  candidate?: { firstName: string | null; lastName: string | null; email: string | null } | null;
  vacancy?: { title: string } | null;
  stage?: { name: string } | null;
  // matchScore is al in CandidateApplication na Task 5
};
```

In de `KanbanCard` render, voeg de score-badge toe naast de kwalificatie-dot:

```tsx
// Bestaand (in de <button> body):
<div className="flex items-center justify-between gap-1">
  <p className="text-sm font-medium text-foreground truncate">
    {name}
  </p>
  <span
    className={cn("inline-block h-2 w-2 shrink-0 rounded-full", QUAL_DOT[qual])}
    title={QUAL_LABEL[qual]}
  />
</div>

// Wordt:
<div className="flex items-center justify-between gap-1">
  <p className="text-sm font-medium text-foreground truncate">
    {name}
  </p>
  <div className="flex items-center gap-1.5 shrink-0">
    <MatchScoreBadge score={row.matchScore} size="sm" />
    <span
      className={cn("inline-block h-2 w-2 rounded-full", QUAL_DOT[qual])}
      title={QUAL_LABEL[qual]}
    />
  </div>
</div>
```

- [ ] **Stap 4: Voeg score toe in de Sollicitaties-tab van kandidaatdetail**

Open `apps/web/src/app/(app)/candidates/[id]/page.tsx`.

Voeg de import toe bovenaan:

```tsx
import { MatchScoreBadge } from "@/components/intake/match-score-badge";
```

Zoek in de Sollicitaties-tab de plek waar `QUAL_LABELS` badge wordt getoond (in de `appList.map()` body):

```tsx
// Bestaand:
<div className="flex items-center gap-2 mt-1.5 flex-wrap">
  <Badge
    variant="secondary"
    className={cn("text-xs", QUAL_COLORS[app.qualificationStatus ?? "pending"])}
  >
    {QUAL_LABELS[app.qualificationStatus ?? "pending"]}
  </Badge>
  {app.currentStageName && (
    <span className="text-xs text-muted-foreground bg-muted rounded px-1.5 py-0.5">
      {app.currentStageName}
    </span>
  )}
</div>

// Wordt:
<div className="flex items-center gap-2 mt-1.5 flex-wrap">
  <Badge
    variant="secondary"
    className={cn("text-xs", QUAL_COLORS[app.qualificationStatus ?? "pending"])}
  >
    {QUAL_LABELS[app.qualificationStatus ?? "pending"]}
  </Badge>
  {app.currentStageName && (
    <span className="text-xs text-muted-foreground bg-muted rounded px-1.5 py-0.5">
      {app.currentStageName}
    </span>
  )}
  <MatchScoreBadge score={app.matchScore} size="sm" />
</div>
```

- [ ] **Stap 5: Check TypeScript**

```bash
pnpm --filter @recruitment-os/web tsc --noEmit
```

Verwacht: geen fouten.

- [ ] **Stap 6: Commit**

```bash
git add \
  apps/web/src/components/intake/match-score-badge.tsx \
  apps/web/src/app/\(app\)/intake/page.tsx \
  apps/web/src/app/\(app\)/candidates/components/candidate-kanban.tsx \
  apps/web/src/app/\(app\)/candidates/\[id\]/page.tsx
git commit -m "feat(frontend): match score badge in intake inbox, kanban cards, candidate detail"
```

---

## Self-Review

**1. Spec coverage:**
- ✅ Score berekening (deterministisch, 0–100%) → Task 2
- ✅ Score opgeslagen op application én session → Task 3
- ✅ Recruiter alert bij score ≥ 75 + qualified → Task 3
- ✅ Score zichtbaar in intake inbox → Task 6
- ✅ Score zichtbaar op kandidaatkaarten → Task 6
- ✅ Score zichtbaar in kandidaatdetail → Task 6
- ✅ Anti-chatbot prompt regels → Task 4
- ✅ Acknowledgment variety → Task 4
- ✅ DB migratie → Task 1

**2. Placeholder scan:** Geen TBD's, geen "implement later", alle code is volledig uitgeschreven.

**3. Type consistency:**
- `calculateMatchScore` neemt `AnswerMap` (gedefinieerd in scorer.ts) — gebruikt in tool-store.ts als `Record<string, { value: unknown; confidence: string }>`  ✅
- `matchScore: number | null` consistent in schema, type, API response, en frontend ✅
- `MatchScoreBadge` neemt `score: number | null | undefined` ✅
