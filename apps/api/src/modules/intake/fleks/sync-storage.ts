import { eq, and } from "drizzle-orm";
import { withTenantContext } from "../../../lib/with-tenant-context.js";
import {
  vacancies, candidates, candidateApplications, pipelineStages,
  fleksSyncCursors, intakeSessions,
} from "../../../db/schema/index.js";
import type { SyncStorage } from "./sync.service.js";
import type { FleksJobCandidate } from "@recruitment-os/types";

export function createSyncStorage(): SyncStorage {
  return {
    async loadCursor(orgId, entity) {
      return withTenantContext(orgId, async (tx) => {
        const [row] = await tx
          .select()
          .from(fleksSyncCursors)
          .where(
            and(
              eq(fleksSyncCursors.organizationId, orgId),
              eq(fleksSyncCursors.entityType, entity),
            ),
          )
          .limit(1);
        return row?.lastUpdatedAt ? row.lastUpdatedAt.toISOString() : null;
      });
    },

    async saveCursor(orgId, entity, cursor, seenIds) {
      await withTenantContext(orgId, async (tx) => {
        await tx
          .insert(fleksSyncCursors)
          .values({
            organizationId: orgId,
            entityType: entity,
            lastUpdatedAt: new Date(cursor),
            lastSyncAt: new Date(),
            lastSeenIds: seenIds ?? [],
          })
          .onConflictDoUpdate({
            target: [fleksSyncCursors.organizationId, fleksSyncCursors.entityType],
            set: {
              lastUpdatedAt: new Date(cursor),
              lastSyncAt: new Date(),
              lastSeenIds: seenIds ?? [],
            },
          });
      });
    },

    async upsertVacancyFromFleks(orgId, job) {
      return withTenantContext(orgId, async (tx) => {
        const [existing] = await tx
          .select({ id: vacancies.id, intakeEnabled: vacancies.intakeEnabled })
          .from(vacancies)
          .where(
            and(
              eq(vacancies.organizationId, orgId),
              eq(vacancies.fleksJobUuid, job.uuid),
            ),
          )
          .limit(1);
        if (existing) return { id: existing.id, intakeEnabled: existing.intakeEnabled ?? false };
        const [created] = await tx
          .insert(vacancies)
          .values({
            organizationId: orgId,
            title: job.functionName,
            description: job.functionDescription ?? "",
            fleksJobUuid: job.uuid,
            status: "active",
            intakeEnabled: false,
            ownerId: "00000000-0000-0000-0000-000000000000",
          } as never)
          .returning({ id: vacancies.id, intakeEnabled: vacancies.intakeEnabled });
        return { id: created.id, intakeEnabled: created.intakeEnabled ?? false };
      });
    },

    async findActiveIntakeVacancies(orgId) {
      return withTenantContext(orgId, async (tx) => {
        const rows = await tx
          .select({ id: vacancies.id, fleksJobUuid: vacancies.fleksJobUuid })
          .from(vacancies)
          .where(
            and(
              eq(vacancies.organizationId, orgId),
              eq(vacancies.intakeEnabled, true),
              eq(vacancies.status, "active"),
            ),
          );
        return rows
          .filter((r): r is { id: string; fleksJobUuid: string } => r.fleksJobUuid !== null);
      });
    },

    async isCandidateKnown(orgId, fleksEmployeeUuid) {
      return withTenantContext(orgId, async (tx) => {
        const [row] = await tx
          .select({ id: candidates.id })
          .from(candidates)
          .where(
            and(
              eq(candidates.organizationId, orgId),
              eq(candidates.fleksEmployeeUuid, fleksEmployeeUuid),
            ),
          )
          .limit(1);
        return !!row;
      });
    },

    async createCandidateAndSession(orgId, { vacancyId, fleksEmployee }) {
      return withTenantContext(orgId, async (tx) => {
        const [cand] = await tx
          .insert(candidates)
          .values({
            organizationId: orgId,
            firstName: fleksEmployee.firstName,
            lastName: fleksEmployee.lastName,
            email: fleksEmployee.email ?? null,
            phone: fleksEmployee.phoneNumber ?? null,
            fleksEmployeeUuid: fleksEmployee.uuid,
          } as never)
          .returning({ id: candidates.id });

        const [stage] = await tx
          .select({ id: pipelineStages.id })
          .from(pipelineStages)
          .where(
            and(
              eq(pipelineStages.organizationId, orgId),
              eq(pipelineStages.slug, "fleks_intake"),
            ),
          )
          .limit(1);
        if (!stage) throw new Error("fleks_intake stage missing — run seed");

        const [app] = await tx
          .insert(candidateApplications)
          .values({
            organizationId: orgId,
            candidateId: cand.id,
            vacancyId,
            currentStageId: stage.id,
            qualificationStatus: "pending",
            sourceDetail: "fleks_v2",
          } as never)
          .returning({ id: candidateApplications.id });

        const [session] = await tx
          .insert(intakeSessions)
          .values({
            organizationId: orgId,
            applicationId: app.id,
            state: "awaiting_first_reply",
          })
          .returning({ id: intakeSessions.id });

        return { sessionId: session.id };
      });
    },
  };
}
