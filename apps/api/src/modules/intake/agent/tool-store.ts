// apps/api/src/modules/intake/agent/tool-store.ts
import { eq, sql } from "drizzle-orm";
import { db } from "../../../db/index.js";
import {
  intakeSessions,
  candidateApplications,
  pipelineStages,
  vacancies,
} from "../../../db/schema/index.js";
import { getJobQueue } from "../../../lib/job-queue.js";
import { sendAlert } from "../../../lib/alert.js";
import { qualificationCriteriaSchema } from "@recruitment-os/types";
import { calculateMatchScore } from "../scorer.js";
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
      // 1. Fetch session with answers + applicationId
      const [session] = await db
        .select({
          applicationId: intakeSessions.applicationId,
          orgId: intakeSessions.organizationId,
          mustHaveAnswers: intakeSessions.mustHaveAnswers,
        })
        .from(intakeSessions)
        .where(eq(intakeSessions.id, sessionId))
        .limit(1);

      if (!session) return;

      // 2. Fetch vacancy criteria via candidateApplications JOIN
      const [appRow] = await db
        .select({
          vacancyTitle: vacancies.title,
          vacancyCriteria: vacancies.qualificationCriteria,
        })
        .from(candidateApplications)
        .innerJoin(vacancies, eq(candidateApplications.vacancyId, vacancies.id))
        .where(eq(candidateApplications.id, session.applicationId))
        .limit(1);

      // 3. Calculate match score
      let matchScore: number | null = null;
      if (appRow) {
        const parsed = qualificationCriteriaSchema.safeParse(appRow.vacancyCriteria ?? {});
        if (parsed.success) {
          const allAnswers = (session.mustHaveAnswers ?? {}) as Record<
            string,
            { value: unknown; confidence: string }
          >;
          matchScore = calculateMatchScore(status, allAnswers, parsed.data);
        }
      }

      // 4. Update intake_sessions with score
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

      // 5. Move application stage + persist matchScore
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

      // 6. Alert on strong match (non-blocking)
      if (matchScore !== null && matchScore >= 75 && status === "qualified" && appRow) {
        void sendAlert(
          `✅ Sterke kandidaat: ${matchScore}% match op "${appRow.vacancyTitle}" — controleer Intake Inbox`,
        );
      }

      // 7. Enqueue Fleks pushback
      await getJobQueue().send("intake.fleks_pushback", { sessionId });
    },
  };
}
