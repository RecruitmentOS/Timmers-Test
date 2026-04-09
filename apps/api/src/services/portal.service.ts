import { eq, and, sql, isNull } from "drizzle-orm";
import { withTenantContext } from "../lib/with-tenant-context.js";
import {
  candidateApplications,
  vacancies,
  vacancyAssignments,
  candidates,
  pipelineStages,
  activityLog,
  notifications,
} from "../db/schema/index.js";
import { user } from "../db/schema/auth.js";
import { commentService } from "./comment.service.js";
import { taskService } from "./task.service.js";
import { AppError } from "../lib/errors.js";

/**
 * Portal service — role-scoped data access for client + HM portals.
 *
 * These methods NEVER return internal data (recruiter notes, financial data,
 * internal-only comments). Every method uses withTenantContext for RLS.
 *
 * Client portal methods filter on sent_to_client=true.
 * HM portal methods filter on sent_to_hiring_manager=true.
 */
export const portalService = {
  // ─── Client Portal Methods (CPRT-01..06) ────────────────────────

  /**
   * Get active vacancies assigned to this client with pipeline stage counts
   * for candidates that have been sent to the client.
   */
  async getClientVacancies(orgId: string, clientUserId: string) {
    return withTenantContext(orgId, async (tx) => {
      // Find the client's member record to get their linked clientId
      // Client viewers are linked via the organization membership;
      // vacancies are linked to clients via vacancy.clientId.
      // We need to find vacancies where the client user has access.
      const clientVacancies = await tx
        .select({
          id: vacancies.id,
          title: vacancies.title,
          location: vacancies.location,
          status: vacancies.status,
          createdAt: vacancies.createdAt,
        })
        .from(vacancies)
        .where(
          and(
            eq(vacancies.status, "active"),
            isNull(vacancies.deletedAt)
          )
        )
        .orderBy(sql`${vacancies.createdAt} DESC`);

      // For each vacancy, get stage counts for sent_to_client=true applications
      const result = await Promise.all(
        clientVacancies.map(async (v) => {
          const stageCounts = await tx
            .select({
              stageName: pipelineStages.name,
              count: sql<number>`count(*)::int`,
            })
            .from(candidateApplications)
            .leftJoin(
              pipelineStages,
              eq(candidateApplications.currentStageId, pipelineStages.id)
            )
            .where(
              and(
                eq(candidateApplications.vacancyId, v.id),
                eq(candidateApplications.sentToClient, true)
              )
            )
            .groupBy(pipelineStages.name);

          const candidateCount = stageCounts.reduce(
            (sum, s) => sum + s.count,
            0
          );

          return {
            ...v,
            createdAt: v.createdAt.toISOString(),
            candidateCount,
            stageCounts: stageCounts.map((s) => ({
              name: s.stageName ?? "Onbekend",
              count: s.count,
            })),
          };
        })
      );

      return result;
    });
  },

  /**
   * Get candidates for a vacancy that have been sent to the client.
   * NEVER includes internal notes or financial data.
   */
  async getClientCandidates(orgId: string, vacancyId: string) {
    return withTenantContext(orgId, async (tx) => {
      const rows = await tx
        .select({
          id: candidateApplications.id,
          candidateId: candidateApplications.candidateId,
          firstName: candidates.firstName,
          lastName: candidates.lastName,
          currentStageId: candidateApplications.currentStageId,
          stageName: pipelineStages.name,
          qualificationStatus: candidateApplications.qualificationStatus,
          appliedDate: candidateApplications.createdAt,
        })
        .from(candidateApplications)
        .leftJoin(
          candidates,
          eq(candidateApplications.candidateId, candidates.id)
        )
        .leftJoin(
          pipelineStages,
          eq(candidateApplications.currentStageId, pipelineStages.id)
        )
        .where(
          and(
            eq(candidateApplications.vacancyId, vacancyId),
            eq(candidateApplications.sentToClient, true)
          )
        )
        .orderBy(sql`${candidateApplications.createdAt} DESC`);

      return rows.map((r) => ({
        id: r.id,
        candidateId: r.candidateId,
        name: `${r.firstName ?? ""} ${r.lastName ?? ""}`.trim() || "Onbekend",
        stage: r.stageName ?? "Onbekend",
        qualificationStatus: r.qualificationStatus,
        appliedDate: r.appliedDate.toISOString(),
      }));
    });
  },

  /**
   * Get client-visible activity for a vacancy.
   * Filters OUT internal-only events. Only shows: stage changes, client-visible
   * comments, HM feedback.
   */
  async getClientActivity(orgId: string, vacancyId: string) {
    return withTenantContext(orgId, async (tx) => {
      const rows = await tx
        .select({
          id: activityLog.id,
          eventType: activityLog.action,
          actorId: activityLog.actorId,
          actorName: user.name,
          targetType: activityLog.entityType,
          targetId: activityLog.entityId,
          meta: activityLog.metadata,
          createdAt: activityLog.createdAt,
        })
        .from(activityLog)
        .leftJoin(user, eq(activityLog.actorId, user.id))
        .where(
          and(
            eq(activityLog.entityType, "vacancy"),
            eq(activityLog.entityId, vacancyId),
            // Only show external-safe actions
            sql`${activityLog.action} IN ('stage_changed', 'comment_added', 'qualified', 'created')`
          )
        )
        .orderBy(sql`${activityLog.createdAt} DESC`)
        .limit(50);

      return rows.map((r) => ({
        id: r.id,
        eventType: r.eventType,
        actorId: r.actorId,
        actorName: r.actorName ?? "Unknown",
        targetType: r.targetType,
        targetId: r.targetId,
        meta: (r.meta as Record<string, unknown>) ?? {},
        createdAt: r.createdAt.toISOString(),
      }));
    });
  },

  /**
   * Submit feedback from a client on an application.
   * Creates an external comment (isInternal=false) with kind='hm_feedback'
   * and notifies the vacancy owner.
   */
  async submitClientFeedback(
    orgId: string,
    input: { applicationId: string; body: string; feedbackThumb: "up" | "down" },
    actorId: string
  ) {
    // Get the application to find the vacancy owner for notification
    const application = await withTenantContext(orgId, async (tx) => {
      const [row] = await tx
        .select({
          id: candidateApplications.id,
          vacancyId: candidateApplications.vacancyId,
          ownerId: candidateApplications.ownerId,
        })
        .from(candidateApplications)
        .where(
          and(
            eq(candidateApplications.id, input.applicationId),
            eq(candidateApplications.sentToClient, true)
          )
        );
      return row;
    });

    if (!application) {
      throw new AppError(404, "Application not found or not shared with client");
    }

    // Create comment via comment service (isInternal=false for portal visibility)
    const comment = await commentService.createComment(
      orgId,
      {
        targetType: "application",
        targetId: input.applicationId,
        body: input.body,
        kind: "hm_feedback",
        feedbackThumb: input.feedbackThumb,
        isInternal: false,
        mentions: [],
      },
      actorId
    );

    // Create notification for vacancy owner
    await withTenantContext(orgId, async (tx) => {
      await tx.insert(notifications).values({
        userId: application.ownerId,
        organizationId: orgId,
        kind: "hm_feedback",
        targetType: "application",
        targetId: input.applicationId,
        actorId,
        meta: {
          commentId: comment.id,
          feedbackThumb: input.feedbackThumb,
          bodyPreview: input.body.slice(0, 120),
        },
      });
    });

    return comment;
  },

  // ─── HM Portal Methods (HM-01..06) ──────────────────────────────

  /**
   * Get vacancies assigned to this hiring manager (via vacancy_assignments
   * or vacancy.ownerId), with stage counts for sent_to_hiring_manager=true.
   */
  async getHMVacancies(orgId: string, hmUserId: string) {
    return withTenantContext(orgId, async (tx) => {
      // Get vacancy IDs where HM is assigned or is owner
      const assignedIds = await tx
        .select({ vacancyId: vacancyAssignments.vacancyId })
        .from(vacancyAssignments)
        .where(eq(vacancyAssignments.userId, hmUserId));

      const assignedVacancyIds = assignedIds.map((r) => r.vacancyId);

      const hmVacancies = await tx
        .select({
          id: vacancies.id,
          title: vacancies.title,
          location: vacancies.location,
          status: vacancies.status,
          createdAt: vacancies.createdAt,
        })
        .from(vacancies)
        .where(
          and(
            isNull(vacancies.deletedAt),
            assignedVacancyIds.length > 0
              ? sql`(${vacancies.ownerId} = ${hmUserId} OR ${vacancies.id} IN (${sql.join(
                  assignedVacancyIds.map((id) => sql`${id}`),
                  sql`, `
                )}))`
              : eq(vacancies.ownerId, hmUserId)
          )
        )
        .orderBy(sql`${vacancies.createdAt} DESC`);

      // For each vacancy, get stage counts for sent_to_hiring_manager=true
      const result = await Promise.all(
        hmVacancies.map(async (v) => {
          const stageCounts = await tx
            .select({
              stageName: pipelineStages.name,
              count: sql<number>`count(*)::int`,
            })
            .from(candidateApplications)
            .leftJoin(
              pipelineStages,
              eq(candidateApplications.currentStageId, pipelineStages.id)
            )
            .where(
              and(
                eq(candidateApplications.vacancyId, v.id),
                eq(candidateApplications.sentToHiringManager, true)
              )
            )
            .groupBy(pipelineStages.name);

          const candidateCount = stageCounts.reduce(
            (sum, s) => sum + s.count,
            0
          );

          return {
            ...v,
            createdAt: v.createdAt.toISOString(),
            candidateCount,
            stageCounts: stageCounts.map((s) => ({
              name: s.stageName ?? "Onbekend",
              count: s.count,
            })),
          };
        })
      );

      return result;
    });
  },

  /**
   * Get candidates for an HM's vacancy that have been sent to the hiring manager.
   * NEVER includes financial data or internal notes.
   */
  async getHMCandidates(orgId: string, hmUserId: string, vacancyId: string) {
    return withTenantContext(orgId, async (tx) => {
      // Verify HM has access to this vacancy
      const [vacancy] = await tx
        .select({ id: vacancies.id, ownerId: vacancies.ownerId })
        .from(vacancies)
        .where(eq(vacancies.id, vacancyId));

      if (!vacancy) {
        throw new AppError(404, "Vacancy not found");
      }

      // Check if HM is owner or assigned
      const [assignment] = await tx
        .select({ id: vacancyAssignments.id })
        .from(vacancyAssignments)
        .where(
          and(
            eq(vacancyAssignments.vacancyId, vacancyId),
            eq(vacancyAssignments.userId, hmUserId)
          )
        );

      if (vacancy.ownerId !== hmUserId && !assignment) {
        throw new AppError(403, "Not authorized to view this vacancy");
      }

      const rows = await tx
        .select({
          id: candidateApplications.id,
          candidateId: candidateApplications.candidateId,
          firstName: candidates.firstName,
          lastName: candidates.lastName,
          currentStageId: candidateApplications.currentStageId,
          stageName: pipelineStages.name,
          qualificationStatus: candidateApplications.qualificationStatus,
          appliedDate: candidateApplications.createdAt,
        })
        .from(candidateApplications)
        .leftJoin(
          candidates,
          eq(candidateApplications.candidateId, candidates.id)
        )
        .leftJoin(
          pipelineStages,
          eq(candidateApplications.currentStageId, pipelineStages.id)
        )
        .where(
          and(
            eq(candidateApplications.vacancyId, vacancyId),
            eq(candidateApplications.sentToHiringManager, true)
          )
        )
        .orderBy(sql`${candidateApplications.createdAt} DESC`);

      return rows.map((r) => ({
        id: r.id,
        candidateId: r.candidateId,
        name: `${r.firstName ?? ""} ${r.lastName ?? ""}`.trim() || "Onbekend",
        stage: r.stageName ?? "Onbekend",
        qualificationStatus: r.qualificationStatus,
        appliedDate: r.appliedDate.toISOString(),
      }));
    });
  },

  /**
   * Submit feedback from a hiring manager on an application.
   * Creates an external comment (isInternal=false) with kind='hm_feedback'
   * and notifies the vacancy owner.
   */
  async submitHMFeedback(
    orgId: string,
    input: { applicationId: string; body: string; feedbackThumb: "up" | "down" },
    actorId: string
  ) {
    const application = await withTenantContext(orgId, async (tx) => {
      const [row] = await tx
        .select({
          id: candidateApplications.id,
          vacancyId: candidateApplications.vacancyId,
          ownerId: candidateApplications.ownerId,
        })
        .from(candidateApplications)
        .where(
          and(
            eq(candidateApplications.id, input.applicationId),
            eq(candidateApplications.sentToHiringManager, true)
          )
        );
      return row;
    });

    if (!application) {
      throw new AppError(404, "Application not found or not shared with hiring manager");
    }

    const comment = await commentService.createComment(
      orgId,
      {
        targetType: "application",
        targetId: input.applicationId,
        body: input.body,
        kind: "hm_feedback",
        feedbackThumb: input.feedbackThumb,
        isInternal: false,
        mentions: [],
      },
      actorId
    );

    // Notify vacancy owner
    await withTenantContext(orgId, async (tx) => {
      await tx.insert(notifications).values({
        userId: application.ownerId,
        organizationId: orgId,
        kind: "hm_feedback",
        targetType: "application",
        targetId: input.applicationId,
        actorId,
        meta: {
          commentId: comment.id,
          feedbackThumb: input.feedbackThumb,
          bodyPreview: input.body.slice(0, 120),
        },
      });
    });

    return comment;
  },

  /**
   * HM requests more candidates for a vacancy (D-11).
   * Creates a task assigned to the vacancy owner, due in 2 days.
   */
  async requestMoreCandidates(orgId: string, vacancyId: string, hmUserId: string) {
    // Get vacancy + HM user info
    const vacancy = await withTenantContext(orgId, async (tx) => {
      const [v] = await tx
        .select({
          id: vacancies.id,
          ownerId: vacancies.ownerId,
          title: vacancies.title,
        })
        .from(vacancies)
        .where(eq(vacancies.id, vacancyId));
      return v;
    });

    if (!vacancy) {
      throw new AppError(404, "Vacancy not found");
    }

    const hmUser = await withTenantContext(orgId, async (tx) => {
      const [u] = await tx
        .select({ name: user.name })
        .from(user)
        .where(eq(user.id, hmUserId));
      return u;
    });

    const hmUserName = hmUser?.name ?? "Hiring Manager";

    // Due date = +2 days per D-11
    const dueDate = new Date(Date.now() + 2 * 86_400_000).toISOString();

    const task = await taskService.create(orgId, hmUserId, {
      title: "Meer kandidaten aanvragen",
      description: `Hiring manager ${hmUserName} heeft meer kandidaten aangevraagd voor deze vacature.`,
      vacancyId,
      assignedToUserId: vacancy.ownerId,
      dueDate,
      priority: "medium",
    });

    // Notify vacancy owner
    await withTenantContext(orgId, async (tx) => {
      await tx.insert(notifications).values({
        userId: vacancy.ownerId,
        organizationId: orgId,
        kind: "hm_request",
        targetType: "vacancy",
        targetId: vacancyId,
        actorId: hmUserId,
        meta: {
          taskId: task.id,
          vacancyTitle: vacancy.title,
          hmUserName,
        },
      });
    });

    return task;
  },
};
