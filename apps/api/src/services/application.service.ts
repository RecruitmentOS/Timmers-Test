import { eq, and, sql } from "drizzle-orm";
import { withTenantContext } from "../lib/with-tenant-context.js";
import {
  candidateApplications,
  applicationStageHistory,
  activityLog,
  candidates,
  vacancies,
  tasks,
  taskAutoRules,
  applicationTags,
  pipelineStages,
} from "../db/schema/index.js";
import type { CreateApplicationInput } from "@recruitment-os/types";
import { domainEvents } from "../lib/domain-events.js";
import { getJobQueue } from "../lib/job-queue.js";

/**
 * Action payload shapes for bulkUpdate. These mirror the
 * z.discriminatedUnion in application.routes.ts and the
 * BulkAction union in @recruitment-os/types 1:1 (nested `payload`).
 */
type BulkOp =
  | {
      action: "move";
      applicationIds: string[];
      payload: { stageId: string };
    }
  | {
      action: "reject";
      applicationIds: string[];
      payload: { rejectReason: string; rejectStageId?: string };
    }
  | {
      action: "assign";
      applicationIds: string[];
      payload: { ownerId?: string; agentUserId?: string };
    }
  | {
      action: "tag";
      applicationIds: string[];
      payload: { tag: string };
    };

type BulkByFilterOp =
  | {
      action: "move";
      filter: BulkFilter;
      payload: { stageId: string };
    }
  | {
      action: "reject";
      filter: BulkFilter;
      payload: { rejectReason: string; rejectStageId?: string };
    }
  | {
      action: "assign";
      filter: BulkFilter;
      payload: { ownerId?: string; agentUserId?: string };
    }
  | {
      action: "tag";
      filter: BulkFilter;
      payload: { tag: string };
    };

type BulkFilter = {
  stageId?: string;
  source?: string;
  vacancyId?: string;
  ownerId?: string;
  qualificationStatus?: "pending" | "yes" | "maybe" | "no";
};

type ListParams = {
  page?: number;
  limit?: number;
  stageId?: string;
  source?: string;
  vacancyId?: string;
  ownerId?: string;
  qualificationStatus?: "pending" | "yes" | "maybe" | "no";
};

export const applicationService = {
  async listByVacancy(orgId: string, vacancyId: string) {
    return withTenantContext(orgId, async (tx) => {
      return tx
        .select({
          id: candidateApplications.id,
          organizationId: candidateApplications.organizationId,
          candidateId: candidateApplications.candidateId,
          vacancyId: candidateApplications.vacancyId,
          currentStageId: candidateApplications.currentStageId,
          ownerId: candidateApplications.ownerId,
          qualificationStatus: candidateApplications.qualificationStatus,
          sourceDetail: candidateApplications.sourceDetail,
          assignedAgentId: candidateApplications.assignedAgentId,
          sentToClient: candidateApplications.sentToClient,
          createdAt: candidateApplications.createdAt,
          updatedAt: candidateApplications.updatedAt,
          candidateFirstName: candidates.firstName,
          candidateLastName: candidates.lastName,
        })
        .from(candidateApplications)
        .leftJoin(
          candidates,
          eq(candidateApplications.candidateId, candidates.id)
        )
        .where(eq(candidateApplications.vacancyId, vacancyId))
        .orderBy(sql`${candidateApplications.createdAt} DESC`);
    });
  },

  async listByCandidate(orgId: string, candidateId: string) {
    return withTenantContext(orgId, async (tx) => {
      return tx
        .select({
          id: candidateApplications.id,
          organizationId: candidateApplications.organizationId,
          candidateId: candidateApplications.candidateId,
          vacancyId: candidateApplications.vacancyId,
          currentStageId: candidateApplications.currentStageId,
          ownerId: candidateApplications.ownerId,
          qualificationStatus: candidateApplications.qualificationStatus,
          sourceDetail: candidateApplications.sourceDetail,
          assignedAgentId: candidateApplications.assignedAgentId,
          sentToClient: candidateApplications.sentToClient,
          createdAt: candidateApplications.createdAt,
          updatedAt: candidateApplications.updatedAt,
          vacancyTitle: vacancies.title,
          vacancyStatus: vacancies.status,
        })
        .from(candidateApplications)
        .leftJoin(
          vacancies,
          eq(candidateApplications.vacancyId, vacancies.id)
        )
        .where(eq(candidateApplications.candidateId, candidateId))
        .orderBy(sql`${candidateApplications.createdAt} DESC`);
    });
  },

  /**
   * Paginated list used by the candidate list view and the
   * SelectAllMatchingBanner flow (needs `total` to offer select-all).
   *
   * Returns CandidateApplicationListResponse { rows, total, pages, page, limit }.
   * Default page=1, limit=50, max limit=200.
   */
  async listPaginated(orgId: string, params: ListParams) {
    const page = Math.max(1, params.page ?? 1);
    const limit = Math.min(200, Math.max(1, params.limit ?? 50));
    const offset = (page - 1) * limit;

    return withTenantContext(orgId, async (tx) => {
      const wheres = [];
      if (params.stageId)
        wheres.push(eq(candidateApplications.currentStageId, params.stageId));
      if (params.vacancyId)
        wheres.push(eq(candidateApplications.vacancyId, params.vacancyId));
      if (params.ownerId)
        wheres.push(eq(candidateApplications.ownerId, params.ownerId));
      if (params.qualificationStatus)
        wheres.push(
          eq(
            candidateApplications.qualificationStatus,
            params.qualificationStatus
          )
        );
      const whereClause = wheres.length ? and(...wheres) : undefined;

      const [rows, totalRows] = await Promise.all([
        tx
          .select({
            id: candidateApplications.id,
            organizationId: candidateApplications.organizationId,
            candidateId: candidateApplications.candidateId,
            vacancyId: candidateApplications.vacancyId,
            currentStageId: candidateApplications.currentStageId,
            ownerId: candidateApplications.ownerId,
            qualificationStatus: candidateApplications.qualificationStatus,
            sourceDetail: candidateApplications.sourceDetail,
            assignedAgentId: candidateApplications.assignedAgentId,
            sentToClient: candidateApplications.sentToClient,
            createdAt: candidateApplications.createdAt,
            updatedAt: candidateApplications.updatedAt,
            candidate: {
              firstName: candidates.firstName,
              lastName: candidates.lastName,
              email: candidates.email,
            },
            vacancy: {
              title: vacancies.title,
            },
            stage: {
              name: pipelineStages.name,
            },
          })
          .from(candidateApplications)
          .leftJoin(candidates, eq(candidateApplications.candidateId, candidates.id))
          .leftJoin(vacancies, eq(candidateApplications.vacancyId, vacancies.id))
          .leftJoin(pipelineStages, eq(candidateApplications.currentStageId, pipelineStages.id))
          .where(whereClause)
          .limit(limit)
          .offset(offset)
          .orderBy(sql`${candidateApplications.updatedAt} DESC`),
        tx
          .select({ total: sql<number>`count(*)::int` })
          .from(candidateApplications)
          .where(whereClause),
      ]);

      const total = totalRows[0]?.total ?? 0;
      return {
        rows,
        total,
        pages: Math.max(1, Math.ceil(total / limit)),
        page,
        limit,
      };
    });
  },

  async getById(orgId: string, id: string) {
    return withTenantContext(orgId, async (tx) => {
      const rows = await tx
        .select()
        .from(candidateApplications)
        .where(eq(candidateApplications.id, id));
      return rows[0] ?? null;
    });
  },

  async create(orgId: string, userId: string, data: CreateApplicationInput) {
    const application = await withTenantContext(orgId, async (tx) => {
      const [row] = await tx
        .insert(candidateApplications)
        .values({
          organizationId: orgId,
          candidateId: data.candidateId,
          vacancyId: data.vacancyId,
          ownerId: userId,
          qualificationStatus: "pending",
          sentToClient: false,
          sourceDetail: data.sourceDetail ?? null,
        })
        .returning();

      await tx.insert(activityLog).values({
        organizationId: orgId,
        entityType: "application",
        entityId: row.id,
        action: "created",
        actorId: userId,
        metadata: {
          candidateId: data.candidateId,
          vacancyId: data.vacancyId,
        },
      });

      return row;
    });

    domainEvents.emit({
      type: "application.created",
      orgId,
      id: application.id,
      vacancyId: application.vacancyId,
    });
    return application;
  },

  /**
   * Move an application to a new stage.
   *
   * Writes application_stage_history, auto-creates tasks from any
   * matching task_auto_rules for the target stage (synchronously, in
   * the same transaction per 02-CONTEXT.md decision), writes an
   * activity_log row, and emits domain events. If JOBS_ENABLED=true
   * and a created task has a dueDate, an overdue reminder is scheduled
   * via pg-boss after the transaction commits.
   */
  async moveStage(
    orgId: string,
    applicationId: string,
    toStageId: string,
    movedBy: string
  ) {
    const result = await withTenantContext(orgId, async (tx) => {
      const [current] = await tx
        .select({
          currentStageId: candidateApplications.currentStageId,
          candidateId: candidateApplications.candidateId,
          ownerId: candidateApplications.ownerId,
          vacancyId: candidateApplications.vacancyId,
        })
        .from(candidateApplications)
        .where(eq(candidateApplications.id, applicationId));
      if (!current) throw new Error(`Application ${applicationId} not found`);

      const fromStageId = current.currentStageId ?? null;

      await tx
        .update(candidateApplications)
        .set({
          currentStageId: toStageId,
          updatedAt: new Date(),
        })
        .where(eq(candidateApplications.id, applicationId));

      await tx.insert(applicationStageHistory).values({
        organizationId: orgId,
        applicationId,
        fromStageId,
        toStageId,
        movedBy,
      });

      // Auto-create tasks from task_auto_rules (TASK-07).
      // Synchronous in-transaction insert — NOT pg-boss (pg-boss is
      // reserved for delayed jobs like overdue reminders).
      const rules = await tx
        .select()
        .from(taskAutoRules)
        .where(eq(taskAutoRules.triggerStageId, toStageId));

      const createdTasks: { id: string; dueDate: Date | null }[] = [];
      for (const rule of rules) {
        const dueDate = new Date(
          Date.now() + rule.dueOffsetDays * 86_400_000
        );
        const [t] = await tx
          .insert(tasks)
          .values({
            organizationId: orgId,
            title: rule.titleTemplate,
            candidateId: current.candidateId,
            assignedToUserId: current.ownerId,
            createdByUserId: movedBy,
            dueDate,
            priority: rule.priority,
            autoCreatedFromStageId: toStageId,
          })
          .returning({ id: tasks.id, dueDate: tasks.dueDate });
        createdTasks.push(t);
      }

      await tx.insert(activityLog).values({
        organizationId: orgId,
        entityType: "application",
        entityId: applicationId,
        action: "stage_changed",
        actorId: movedBy,
        metadata: {
          fromStageId,
          toStageId,
          autoTasksCreated: createdTasks.length,
        },
      });

      return { fromStageId, toStageId, vacancyId: current.vacancyId, createdTasks };
    });

    domainEvents.emit({
      type: "application.stage_changed",
      orgId,
      id: applicationId,
      vacancyId: result.vacancyId,
      fromStageId: result.fromStageId,
      toStageId: result.toStageId,
    });

    for (const t of result.createdTasks) {
      domainEvents.emit({ type: "task.created", orgId, id: t.id });
      if (process.env.JOBS_ENABLED === "true" && t.dueDate) {
        try {
          await getJobQueue().send(
            "task.overdue_reminder",
            { taskId: t.id, orgId },
            { startAfter: t.dueDate }
          );
        } catch (err) {
          console.error("[applicationService.moveStage] failed to schedule reminder", err);
        }
      }
    }

    return this.getById(orgId, applicationId);
  },

  async assignAgent(
    orgId: string,
    applicationId: string,
    agentUserId: string
  ) {
    return withTenantContext(orgId, async (tx) => {
      const [application] = await tx
        .update(candidateApplications)
        .set({
          assignedAgentId: agentUserId,
          updatedAt: new Date(),
        })
        .where(eq(candidateApplications.id, applicationId))
        .returning();
      return application;
    });
  },

  async markSentToClient(
    orgId: string,
    applicationId: string,
    sent: boolean
  ) {
    const application = await withTenantContext(orgId, async (tx) => {
      const [row] = await tx
        .update(candidateApplications)
        .set({
          sentToClient: sent,
          updatedAt: new Date(),
        })
        .where(eq(candidateApplications.id, applicationId))
        .returning();
      return row;
    });
    return application;
  },

  /**
   * Employer-mode counterpart to markSentToClient. Sets the
   * `sent_to_hiring_manager` boolean that Phase 3's hiring manager
   * portal will read directly. Label-only difference in UI
   * ("Sent to hiring manager" vs "Sent to client").
   */
  async markSentToHiringManager(
    orgId: string,
    applicationId: string,
    sent: boolean
  ) {
    await withTenantContext(orgId, async (tx) => {
      await tx
        .update(candidateApplications)
        .set({
          sentToHiringManager: sent,
          updatedAt: new Date(),
        })
        .where(eq(candidateApplications.id, applicationId));
    });
    return this.getById(orgId, applicationId);
  },

  /**
   * Rich qualification verdict: writes status + rejectReason +
   * qualificationNotes in one UPDATE (columns added in Plan 02-01),
   * optionally advances stage when status=yes or status=no and
   * advanceStage=true. Emits `application.qualified`.
   */
  async qualify(
    orgId: string,
    userId: string,
    applicationId: string,
    data: {
      status: "yes" | "maybe" | "no";
      rejectReason?: string;
      qualificationNotes?: string;
      advanceStage?: boolean;
    }
  ) {
    await withTenantContext(orgId, async (tx) => {
      await tx
        .update(candidateApplications)
        .set({
          qualificationStatus: data.status,
          rejectReason: data.status === "no" ? data.rejectReason ?? null : null,
          qualificationNotes: data.qualificationNotes ?? null,
          updatedAt: new Date(),
        })
        .where(eq(candidateApplications.id, applicationId));

      await tx.insert(activityLog).values({
        organizationId: orgId,
        entityType: "application",
        entityId: applicationId,
        action: "qualified",
        actorId: userId,
        metadata: {
          status: data.status,
          rejectReason: data.rejectReason ?? null,
          qualificationNotes: data.qualificationNotes ?? null,
        },
      });
    });

    if (data.advanceStage) {
      const targetName =
        data.status === "yes"
          ? "Qualified"
          : data.status === "no"
            ? "Rejected/On hold"
            : null;
      if (targetName) {
        const stage = await withTenantContext(orgId, async (tx) => {
          const rows = await tx
            .select({ id: pipelineStages.id })
            .from(pipelineStages)
            .where(
              and(
                eq(pipelineStages.organizationId, orgId),
                eq(pipelineStages.name, targetName)
              )
            );
          return rows[0] ?? null;
        });
        if (stage) {
          await this.moveStage(orgId, applicationId, stage.id, userId);
        }
      }
    }

    domainEvents.emit({
      type: "application.qualified",
      orgId,
      id: applicationId,
      status: data.status,
    });
    return this.getById(orgId, applicationId);
  },

  /**
   * Legacy method kept for backward compatibility with any Phase 1
   * callers. New code should use `qualify()` which writes the rich
   * columns (reject_reason, qualification_notes) and emits a domain event.
   */
  async updateQualification(
    orgId: string,
    applicationId: string,
    status: string,
    rejectReason?: string
  ) {
    const application = await withTenantContext(orgId, async (tx) => {
      const [row] = await tx
        .update(candidateApplications)
        .set({
          qualificationStatus: status as
            | "pending"
            | "yes"
            | "maybe"
            | "no",
          rejectReason: status === "no" ? rejectReason ?? null : null,
          updatedAt: new Date(),
        })
        .where(eq(candidateApplications.id, applicationId))
        .returning();

      await tx.insert(activityLog).values({
        organizationId: orgId,
        entityType: "application",
        entityId: applicationId,
        action: "qualification_updated",
        actorId: row.ownerId,
        metadata: { status, rejectReason: rejectReason ?? null },
      });

      return row;
    });

    domainEvents.emit({
      type: "application.qualified",
      orgId,
      id: applicationId,
      status,
    });
    return application;
  },

  /**
   * Bulk action across a caller-supplied list of application IDs.
   * Runs every per-row mutation inside a single withTenantContext
   * transaction so RLS + atomic rollback both work.
   *
   * Action-specific behavior:
   * - move:    updates currentStageId + inserts history row per app
   * - reject:  sets qualificationStatus='no' + rejectReason + moves
   *            to Rejected/On hold (or caller-supplied rejectStageId)
   * - assign:  sets ownerId OR assignedAgentId (keeps existing value
   *            if not provided via raw SQL coalesce)
   * - tag:     inserts into application_tags with onConflictDoNothing
   *
   * Writes ONE activity_log summary row with the full ID list, then
   * emits `application.bulk_{action}` after commit.
   */
  async bulkUpdate(orgId: string, userId: string, op: BulkOp) {
    const ids = await withTenantContext(orgId, async (tx) => {
      const touched: string[] = [];

      let rejectStageIdFallback: string | null = null;
      if (op.action === "reject") {
        const [rejectedStage] = await tx
          .select({ id: pipelineStages.id })
          .from(pipelineStages)
          .where(
            and(
              eq(pipelineStages.organizationId, orgId),
              eq(pipelineStages.name, "Rejected/On hold")
            )
          );
        rejectStageIdFallback = rejectedStage?.id ?? null;
      }

      for (const appId of op.applicationIds) {
        switch (op.action) {
          case "move": {
            const [currentRow] = await tx
              .select({ from: candidateApplications.currentStageId })
              .from(candidateApplications)
              .where(eq(candidateApplications.id, appId));
            await tx
              .update(candidateApplications)
              .set({
                currentStageId: op.payload.stageId,
                updatedAt: new Date(),
              })
              .where(eq(candidateApplications.id, appId));
            await tx.insert(applicationStageHistory).values({
              organizationId: orgId,
              applicationId: appId,
              fromStageId: currentRow?.from ?? null,
              toStageId: op.payload.stageId,
              movedBy: userId,
            });
            break;
          }
          case "reject": {
            const targetStage =
              op.payload.rejectStageId ?? rejectStageIdFallback;
            await tx
              .update(candidateApplications)
              .set({
                qualificationStatus: "no",
                rejectReason: op.payload.rejectReason,
                ...(targetStage ? { currentStageId: targetStage } : {}),
                updatedAt: new Date(),
              })
              .where(eq(candidateApplications.id, appId));
            break;
          }
          case "assign": {
            const updates: Record<string, unknown> = {
              updatedAt: new Date(),
            };
            if (op.payload.ownerId !== undefined) {
              updates.ownerId = op.payload.ownerId;
            }
            if (op.payload.agentUserId !== undefined) {
              updates.assignedAgentId = op.payload.agentUserId;
            }
            await tx
              .update(candidateApplications)
              .set(updates)
              .where(eq(candidateApplications.id, appId));
            break;
          }
          case "tag": {
            await tx
              .insert(applicationTags)
              .values({
                organizationId: orgId,
                applicationId: appId,
                label: op.payload.tag,
                createdByUserId: userId,
              })
              .onConflictDoNothing();
            break;
          }
        }
        touched.push(appId);
      }

      if (touched.length > 0) {
        await tx.insert(activityLog).values({
          organizationId: orgId,
          entityType: "application",
          entityId: touched[0]!,
          action: `bulk_${op.action}`,
          actorId: userId,
          metadata: {
            count: touched.length,
            ids: touched,
            payload: op.payload,
          },
        });
      }

      return touched;
    });

    // Emit a bulk domain event after commit. Event type narrows on action.
    const eventType = `application.bulk_${op.action}` as
      | "application.bulk_move"
      | "application.bulk_reject"
      | "application.bulk_assign"
      | "application.bulk_tag";
    domainEvents.emit({ type: eventType, orgId, ids });

    return { updated: ids.length, ids };
  },

  /**
   * "Select all matching the filter" bulk path (BULK-01).
   * Enumerates matching IDs server-side in batches of 500 and calls
   * bulkUpdate per batch. Returns { updated, batches } so the frontend
   * can surface progress information.
   */
  async bulkByFilter(orgId: string, userId: string, op: BulkByFilterOp) {
    const BATCH = 500;
    let batches = 0;
    let updated = 0;

    const ids = await withTenantContext(orgId, async (tx) => {
      const wheres = [];
      if (op.filter.stageId)
        wheres.push(eq(candidateApplications.currentStageId, op.filter.stageId));
      if (op.filter.vacancyId)
        wheres.push(eq(candidateApplications.vacancyId, op.filter.vacancyId));
      if (op.filter.ownerId)
        wheres.push(eq(candidateApplications.ownerId, op.filter.ownerId));
      if (op.filter.qualificationStatus)
        wheres.push(
          eq(
            candidateApplications.qualificationStatus,
            op.filter.qualificationStatus
          )
        );
      const rows = await tx
        .select({ id: candidateApplications.id })
        .from(candidateApplications)
        .where(wheres.length ? and(...wheres) : undefined);
      return rows.map((r) => r.id);
    });

    for (let i = 0; i < ids.length; i += BATCH) {
      const slice = ids.slice(i, i + BATCH);
      // Re-dispatch as a regular bulk action with the nested payload shape.
      // TypeScript needs the action field narrowed with `as const` per branch.
      switch (op.action) {
        case "move": {
          const res = await this.bulkUpdate(orgId, userId, {
            action: "move",
            applicationIds: slice,
            payload: op.payload,
          });
          updated += res.updated;
          break;
        }
        case "reject": {
          const res = await this.bulkUpdate(orgId, userId, {
            action: "reject",
            applicationIds: slice,
            payload: op.payload,
          });
          updated += res.updated;
          break;
        }
        case "assign": {
          const res = await this.bulkUpdate(orgId, userId, {
            action: "assign",
            applicationIds: slice,
            payload: op.payload,
          });
          updated += res.updated;
          break;
        }
        case "tag": {
          const res = await this.bulkUpdate(orgId, userId, {
            action: "tag",
            applicationIds: slice,
            payload: op.payload,
          });
          updated += res.updated;
          break;
        }
      }
      batches += 1;
    }

    return { updated, batches };
  },

  async getStageHistory(orgId: string, applicationId: string) {
    return withTenantContext(orgId, async (tx) => {
      return tx
        .select()
        .from(applicationStageHistory)
        .where(eq(applicationStageHistory.applicationId, applicationId))
        .orderBy(sql`${applicationStageHistory.createdAt} ASC`);
    });
  },
};
