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
