import { eq, and, sql } from "drizzle-orm";
import { withTenantContext } from "../lib/with-tenant-context.js";
import {
  candidateApplications,
  applicationStageHistory,
  activityLog,
  candidates,
  vacancies,
} from "../db/schema/index.js";
import type { CreateApplicationInput } from "@recruitment-os/types";

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

  async getById(orgId: string, id: string) {
    return withTenantContext(orgId, async (tx) => {
      const rows = await tx
        .select()
        .from(candidateApplications)
        .where(eq(candidateApplications.id, id));
      return rows[0] ?? null;
    });
  },

  async create(
    orgId: string,
    userId: string,
    data: CreateApplicationInput
  ) {
    return withTenantContext(orgId, async (tx) => {
      const [application] = await tx
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

      // Record in activity log
      await tx.insert(activityLog).values({
        organizationId: orgId,
        entityType: "application",
        entityId: application.id,
        action: "created",
        actorId: userId,
        metadata: {
          candidateId: data.candidateId,
          vacancyId: data.vacancyId,
        },
      });

      return application;
    });
  },

  async moveStage(
    orgId: string,
    applicationId: string,
    toStageId: string,
    movedBy: string
  ) {
    return withTenantContext(orgId, async (tx) => {
      // Get current stage
      const [current] = await tx
        .select({ currentStageId: candidateApplications.currentStageId })
        .from(candidateApplications)
        .where(eq(candidateApplications.id, applicationId));

      const fromStageId = current?.currentStageId ?? null;

      // Update application stage
      const [application] = await tx
        .update(candidateApplications)
        .set({
          currentStageId: toStageId,
          updatedAt: new Date(),
        })
        .where(eq(candidateApplications.id, applicationId))
        .returning();

      // INSERT into application_stage_history (audit trail per APP-03)
      await tx.insert(applicationStageHistory).values({
        organizationId: orgId,
        applicationId,
        fromStageId,
        toStageId,
        movedBy,
      });

      // Activity log
      await tx.insert(activityLog).values({
        organizationId: orgId,
        entityType: "application",
        entityId: applicationId,
        action: "stage_changed",
        actorId: movedBy,
        metadata: { from: fromStageId, to: toStageId },
      });

      return application;
    });
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
    return withTenantContext(orgId, async (tx) => {
      const [application] = await tx
        .update(candidateApplications)
        .set({
          sentToClient: sent,
          updatedAt: new Date(),
        })
        .where(eq(candidateApplications.id, applicationId))
        .returning();
      return application;
    });
  },

  async updateQualification(
    orgId: string,
    applicationId: string,
    status: string,
    rejectReason?: string
  ) {
    return withTenantContext(orgId, async (tx) => {
      const [application] = await tx
        .update(candidateApplications)
        .set({
          qualificationStatus: status as any,
          updatedAt: new Date(),
        })
        .where(eq(candidateApplications.id, applicationId))
        .returning();

      await tx.insert(activityLog).values({
        organizationId: orgId,
        entityType: "application",
        entityId: applicationId,
        action: "qualification_updated",
        actorId: application.ownerId,
        metadata: { status, rejectReason: rejectReason ?? null },
      });

      return application;
    });
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
