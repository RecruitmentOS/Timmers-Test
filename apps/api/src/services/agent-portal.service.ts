import { eq, and, sql, gte, lte } from "drizzle-orm";
import { withTenantContext } from "../lib/with-tenant-context.js";
import {
  candidateApplications,
  candidates,
  vacancies,
  vacancyAssignments,
  pipelineStages,
  tasks,
} from "../db/schema/index.js";
import { applicationService } from "./application.service.js";
import { commentService } from "./comment.service.js";
import { taskService } from "./task.service.js";
import { AppError } from "../lib/errors.js";

/**
 * Agent portal service — all data access scoped to the agent's own assignments.
 *
 * AGNT-01 + AGNT-02: Agent sees ONLY vacancies assigned to them (via vacancy_assignments)
 * and candidates where assignedAgentId matches. No org-wide queries.
 *
 * Every method uses withTenantContext for RLS safety.
 */
export const agentPortalService = {
  /**
   * AGNT-01: Get vacancies assigned to agent via vacancy_assignments table.
   * Returns basic info: title, location, status, candidate count.
   */
  async getAgentVacancies(orgId: string, agentUserId: string) {
    return withTenantContext(orgId, async (tx) => {
      const rows = await tx
        .select({
          id: vacancies.id,
          title: vacancies.title,
          location: vacancies.location,
          status: vacancies.status,
          candidateCount: sql<number>`(
            SELECT count(*)::int FROM candidate_applications
            WHERE candidate_applications.vacancy_id = ${vacancies.id}
            AND candidate_applications.assigned_agent_id = ${agentUserId}
          )`,
        })
        .from(vacancies)
        .innerJoin(
          vacancyAssignments,
          and(
            eq(vacancyAssignments.vacancyId, vacancies.id),
            eq(vacancyAssignments.userId, agentUserId)
          )
        )
        .orderBy(sql`${vacancies.updatedAt} DESC`);

      return rows;
    });
  },

  /**
   * AGNT-02: Get candidates assigned to agent.
   * Joins candidate name, phone, email, city, current stage name,
   * qualification_status, vacancy title. Ordered by updatedAt DESC.
   */
  async getAgentCandidates(orgId: string, agentUserId: string) {
    return withTenantContext(orgId, async (tx) => {
      const rows = await tx
        .select({
          applicationId: candidateApplications.id,
          candidateId: candidateApplications.candidateId,
          vacancyId: candidateApplications.vacancyId,
          currentStageId: candidateApplications.currentStageId,
          qualificationStatus: candidateApplications.qualificationStatus,
          candidateFirstName: candidates.firstName,
          candidateLastName: candidates.lastName,
          candidatePhone: candidates.phone,
          candidateEmail: candidates.email,
          candidateCity: candidates.city,
          stageName: pipelineStages.name,
          vacancyTitle: vacancies.title,
          updatedAt: candidateApplications.updatedAt,
        })
        .from(candidateApplications)
        .leftJoin(
          candidates,
          eq(candidateApplications.candidateId, candidates.id)
        )
        .leftJoin(
          vacancies,
          eq(candidateApplications.vacancyId, vacancies.id)
        )
        .leftJoin(
          pipelineStages,
          eq(candidateApplications.currentStageId, pipelineStages.id)
        )
        .where(eq(candidateApplications.assignedAgentId, agentUserId))
        .orderBy(sql`${candidateApplications.updatedAt} DESC`);

      return rows;
    });
  },

  /**
   * AGNT-03: Update candidate stage — agent can only update their own assignments.
   * Verifies assignedAgentId === agentUserId before delegating to applicationService.moveStage.
   */
  async updateAgentCandidateStage(
    orgId: string,
    applicationId: string,
    newStageId: string,
    agentUserId: string
  ) {
    // Verify ownership
    const app = await withTenantContext(orgId, async (tx) => {
      const [row] = await tx
        .select({ assignedAgentId: candidateApplications.assignedAgentId })
        .from(candidateApplications)
        .where(eq(candidateApplications.id, applicationId));
      return row;
    });

    if (!app) {
      throw new AppError(404, "Application not found");
    }
    if (app.assignedAgentId !== agentUserId) {
      throw new AppError(403, "You can only update candidates assigned to you");
    }

    return applicationService.moveStage(orgId, applicationId, newStageId, agentUserId);
  },

  /**
   * AGNT-03: Add note to a candidate application — agent can only add notes to their own assignments.
   * Delegates to commentService.createComment with kind='comment', targetType='application', isInternal=false.
   */
  async addAgentNote(
    orgId: string,
    applicationId: string,
    body: string,
    agentUserId: string
  ) {
    // Verify ownership
    const app = await withTenantContext(orgId, async (tx) => {
      const [row] = await tx
        .select({ assignedAgentId: candidateApplications.assignedAgentId })
        .from(candidateApplications)
        .where(eq(candidateApplications.id, applicationId));
      return row;
    });

    if (!app) {
      throw new AppError(404, "Application not found");
    }
    if (app.assignedAgentId !== agentUserId) {
      throw new AppError(403, "You can only add notes to candidates assigned to you");
    }

    return commentService.createComment(orgId, {
      targetType: "application",
      targetId: applicationId,
      body,
      kind: "comment",
      isInternal: false,
    }, agentUserId);
  },

  /**
   * AGNT-04: Get tasks assigned to agent.
   * Delegates to taskService.list with assignedTo filter.
   */
  async getAgentTasks(orgId: string, agentUserId: string) {
    return taskService.list(orgId, { assignedTo: agentUserId });
  },

  /**
   * AGNT-04: Complete a task — verify task is assigned to agent first.
   */
  async completeAgentTask(orgId: string, taskId: string, agentUserId: string) {
    // Verify task ownership
    const task = await taskService.getById(orgId, taskId);
    if (!task) {
      throw new AppError(404, "Task not found");
    }
    if (task.assignedToUserId !== agentUserId) {
      throw new AppError(403, "You can only complete tasks assigned to you");
    }

    return taskService.complete(orgId, agentUserId, taskId);
  },

  /**
   * AGNT-05: Get personal stats for agent.
   * SQL aggregates for a given time period:
   * - candidatesAdded: COUNT applications where assignedAgentId = agent in period
   * - qualified: COUNT where qualificationStatus = 'yes' in period
   * - tasksCompleted: COUNT completed tasks in period
   */
  async getAgentStats(
    orgId: string,
    agentUserId: string,
    startDate: Date,
    endDate: Date
  ) {
    return withTenantContext(orgId, async (tx) => {
      // Count candidates added (applications assigned to agent in period)
      const [candidatesRow] = await tx
        .select({ count: sql<number>`count(*)::int` })
        .from(candidateApplications)
        .where(
          and(
            eq(candidateApplications.assignedAgentId, agentUserId),
            gte(candidateApplications.createdAt, startDate),
            lte(candidateApplications.createdAt, endDate)
          )
        );

      // Count qualified (qualification_status = 'yes' in period)
      const [qualifiedRow] = await tx
        .select({ count: sql<number>`count(*)::int` })
        .from(candidateApplications)
        .where(
          and(
            eq(candidateApplications.assignedAgentId, agentUserId),
            eq(candidateApplications.qualificationStatus, "yes"),
            gte(candidateApplications.updatedAt, startDate),
            lte(candidateApplications.updatedAt, endDate)
          )
        );

      // Count tasks completed in period
      const [tasksRow] = await tx
        .select({ count: sql<number>`count(*)::int` })
        .from(tasks)
        .where(
          and(
            eq(tasks.assignedToUserId, agentUserId),
            eq(tasks.status, "completed"),
            gte(tasks.completedAt, startDate),
            lte(tasks.completedAt, endDate)
          )
        );

      return {
        candidatesAdded: candidatesRow?.count ?? 0,
        qualified: qualifiedRow?.count ?? 0,
        tasksCompleted: tasksRow?.count ?? 0,
      };
    });
  },
};
