import { eq, sql } from "drizzle-orm";
import { withTenantContext } from "../lib/with-tenant-context.js";
import {
  candidateApplications,
  candidates,
  pipelineStages,
} from "../db/schema/index.js";

/**
 * Pipeline service — read-side only.
 *
 * Writes (stage moves, qualification updates, bulk actions) live on
 * applicationService. This service is purely the kanban board projection.
 *
 * Every method runs inside withTenantContext(orgId, ...) so RLS policies
 * on candidate_applications / pipeline_stages / candidates are honored.
 */
export const pipelineService = {
  /**
   * Returns { stages: [...] } for the given vacancy, where each stage carries
   * its own `applications` array. Each application is joined against
   * `candidates` for card data (firstName, lastName, source) and exposes
   * a `hasOverdueTask` boolean computed from an EXISTS subquery over tasks
   * linked to the same candidate (PIPE-07 overdue indicator).
   */
  async getBoard(orgId: string, vacancyId: string) {
    return withTenantContext(orgId, async (tx) => {
      const stages = await tx
        .select()
        .from(pipelineStages)
        .where(eq(pipelineStages.organizationId, orgId))
        .orderBy(sql`${pipelineStages.sortOrder} ASC`);

      const rows = await tx
        .select({
          id: candidateApplications.id,
          candidateId: candidateApplications.candidateId,
          vacancyId: candidateApplications.vacancyId,
          currentStageId: candidateApplications.currentStageId,
          ownerId: candidateApplications.ownerId,
          assignedAgentId: candidateApplications.assignedAgentId,
          qualificationStatus: candidateApplications.qualificationStatus,
          sentToClient: candidateApplications.sentToClient,
          sentToHiringManager: candidateApplications.sentToHiringManager,
          sourceDetail: candidateApplications.sourceDetail,
          updatedAt: candidateApplications.updatedAt,
          createdAt: candidateApplications.createdAt,
          candidateFirstName: candidates.firstName,
          candidateLastName: candidates.lastName,
          candidateSource: candidates.source,
          hasOverdueTask: sql<boolean>`EXISTS (
            SELECT 1 FROM tasks t
            WHERE t.candidate_id = ${candidateApplications.candidateId}
              AND t.status = 'open'
              AND t.due_date < now()
          )`,
        })
        .from(candidateApplications)
        .leftJoin(
          candidates,
          eq(candidateApplications.candidateId, candidates.id)
        )
        .where(eq(candidateApplications.vacancyId, vacancyId));

      return {
        stages: stages.map((s) => ({
          ...s,
          applications: rows.filter((r) => r.currentStageId === s.id),
        })),
      };
    });
  },
};
