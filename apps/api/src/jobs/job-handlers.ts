import { and, eq } from "drizzle-orm";
import type { Job } from "pg-boss";
import { getJobQueue } from "../lib/job-queue.js";
import { withTenantContext } from "../lib/with-tenant-context.js";
import { tasks } from "../db/schema/index.js";

type OverdueReminderData = { taskId: string; orgId: string };

/**
 * Register all pg-boss job handlers.
 *
 * CRITICAL RULE: Every handler MUST start its DB work with
 * `withTenantContext(job.data.orgId, async (tx) => {...})`. pg-boss
 * handlers run outside the Hono request lifecycle, so the tenant
 * context is NOT set automatically and RLS will reject queries
 * without it. Enforcing this at the handler boundary prevents
 * cross-tenant data leaks.
 */
export async function registerJobHandlers(): Promise<void> {
  if (process.env.JOBS_ENABLED !== "true") return;

  const boss = getJobQueue();

  // Delayed reminder when a task is still open past its due date.
  // Queued on task create/update; no-op if the task was completed in the meantime.
  await boss.work<OverdueReminderData>(
    "task.overdue_reminder",
    async ([job]: Job<OverdueReminderData>[]) => {
      // MUST wrap DB work in withTenantContext — pg-boss runs outside Hono.
      return withTenantContext(job.data.orgId, async (tx) => {
        const rows = await tx
          .select()
          .from(tasks)
          .where(
            and(eq(tasks.id, job.data.taskId), eq(tasks.status, "open"))
          );

        if (rows.length === 0) {
          console.log(
            `[jobs] task.overdue_reminder: task ${job.data.taskId} no longer open — noop`
          );
          return;
        }

        // Phase 2: log only. Phase 7 wires this to transactional email.
        console.log(
          `[jobs] task.overdue_reminder: task ${job.data.taskId} still open past due`
        );
      });
    }
  );
}
