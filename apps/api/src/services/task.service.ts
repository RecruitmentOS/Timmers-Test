import { eq, and, lt, gt, sql } from "drizzle-orm";
import { withTenantContext } from "../lib/with-tenant-context.js";
import { tasks, activityLog } from "../db/schema/index.js";
import { domainEvents } from "../lib/domain-events.js";
import { getJobQueue } from "../lib/job-queue.js";
import type {
  CreateTaskInput,
  UpdateTaskInput,
} from "@recruitment-os/types";

type ListFilter = {
  assignedTo?: string;
  status?: "open" | "completed";
  dueBefore?: Date;
  dueAfter?: Date;
  vacancyId?: string;
};

/**
 * Task service — CRUD + completion + auto-reminder scheduling.
 *
 * Every mutation emits a domain event after its transaction commits.
 * When JOBS_ENABLED=true and a task has a dueDate, a delayed
 * `task.overdue_reminder` job is scheduled via pg-boss — handlers
 * (registered in jobs/job-handlers.ts) MUST wrap work in
 * withTenantContext(job.data.orgId, ...) because handlers run outside
 * the Hono request lifecycle and RLS context is not automatic.
 *
 * Polymorphism: exactly one of candidateId / vacancyId / clientId
 * must be provided. DB-level CHECK constraint enforces this as the
 * final safety net; the service fails fast with a friendly error.
 */
export const taskService = {
  async list(orgId: string, filter: ListFilter = {}) {
    return withTenantContext(orgId, async (tx) => {
      const wheres = [];
      if (filter.assignedTo)
        wheres.push(eq(tasks.assignedToUserId, filter.assignedTo));
      if (filter.status) wheres.push(eq(tasks.status, filter.status));
      if (filter.dueBefore) wheres.push(lt(tasks.dueDate, filter.dueBefore));
      if (filter.dueAfter) wheres.push(gt(tasks.dueDate, filter.dueAfter));
      if (filter.vacancyId) wheres.push(eq(tasks.vacancyId, filter.vacancyId));
      return tx
        .select()
        .from(tasks)
        .where(wheres.length ? and(...wheres) : undefined)
        .orderBy(sql`${tasks.dueDate} ASC NULLS LAST`);
    });
  },

  async getById(orgId: string, id: string) {
    return withTenantContext(orgId, async (tx) => {
      const rows = await tx.select().from(tasks).where(eq(tasks.id, id));
      return rows[0] ?? null;
    });
  },

  async create(orgId: string, userId: string, input: CreateTaskInput) {
    // Enforce "exactly one parent" at the service boundary so callers
    // get a friendly error before hitting the DB CHECK constraint.
    const parentCount =
      (input.candidateId ? 1 : 0) +
      (input.vacancyId ? 1 : 0) +
      (input.clientId ? 1 : 0);
    if (parentCount !== 1) {
      throw new Error(
        "Task must have exactly one of candidateId, vacancyId, or clientId"
      );
    }

    const task = await withTenantContext(orgId, async (tx) => {
      const [row] = await tx
        .insert(tasks)
        .values({
          organizationId: orgId,
          title: input.title,
          description: input.description ?? null,
          candidateId: input.candidateId ?? null,
          vacancyId: input.vacancyId ?? null,
          clientId: input.clientId ?? null,
          assignedToUserId: input.assignedToUserId,
          createdByUserId: userId,
          dueDate: input.dueDate ? new Date(input.dueDate) : null,
          priority: input.priority ?? "medium",
        })
        .returning();

      await tx.insert(activityLog).values({
        organizationId: orgId,
        entityType: "task",
        entityId: row.id,
        action: "created",
        actorId: userId,
      });

      return row;
    });

    domainEvents.emit({ type: "task.created", orgId, id: task.id });

    if (process.env.JOBS_ENABLED === "true" && task.dueDate) {
      try {
        await getJobQueue().send(
          "task.overdue_reminder",
          { taskId: task.id, orgId },
          { startAfter: task.dueDate }
        );
      } catch (err) {
        console.error(
          "[taskService.create] failed to schedule overdue reminder",
          err
        );
      }
    }

    return task;
  },

  async update(
    orgId: string,
    userId: string,
    id: string,
    patch: UpdateTaskInput
  ) {
    const updated = await withTenantContext(orgId, async (tx) => {
      const updates: Record<string, unknown> = {
        updatedAt: new Date(),
      };
      if (patch.title !== undefined) updates.title = patch.title;
      if (patch.description !== undefined)
        updates.description = patch.description;
      if (patch.assignedToUserId !== undefined)
        updates.assignedToUserId = patch.assignedToUserId;
      if (patch.priority !== undefined) updates.priority = patch.priority;
      if (patch.status !== undefined) updates.status = patch.status;
      if (patch.dueDate !== undefined) {
        updates.dueDate = patch.dueDate ? new Date(patch.dueDate) : null;
      }

      const [row] = await tx
        .update(tasks)
        .set(updates)
        .where(eq(tasks.id, id))
        .returning();

      await tx.insert(activityLog).values({
        organizationId: orgId,
        entityType: "task",
        entityId: id,
        action: "updated",
        actorId: userId,
        metadata: patch as Record<string, unknown>,
      });

      return row;
    });

    domainEvents.emit({ type: "task.updated", orgId, id });
    return updated;
  },

  async complete(orgId: string, userId: string, id: string) {
    const completed = await withTenantContext(orgId, async (tx) => {
      const [row] = await tx
        .update(tasks)
        .set({
          status: "completed",
          completedAt: new Date(),
          completedByUserId: userId,
          updatedAt: new Date(),
        })
        .where(eq(tasks.id, id))
        .returning();

      await tx.insert(activityLog).values({
        organizationId: orgId,
        entityType: "task",
        entityId: id,
        action: "completed",
        actorId: userId,
      });

      return row;
    });

    domainEvents.emit({ type: "task.completed", orgId, id });
    return completed;
  },

  async delete(orgId: string, id: string) {
    await withTenantContext(orgId, async (tx) => {
      await tx.delete(tasks).where(eq(tasks.id, id));
    });
  },
};
