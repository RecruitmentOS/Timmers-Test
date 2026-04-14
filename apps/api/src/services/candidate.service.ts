import { eq, and, ilike, isNull, or, inArray, sql } from "drizzle-orm";
import { withTenantContext } from "../lib/with-tenant-context.js";
import {
  candidates,
  candidateApplications,
  activityLog,
} from "../db/schema/index.js";
import type {
  CreateCandidateInput,
  UpdateCandidateInput,
} from "@recruitment-os/types";
import { getJobQueue } from "../lib/job-queue.js";

export const candidateService = {
  async list(
    orgId: string,
    filters?: {
      search?: string;
      source?: string;
      vacancyId?: string;
      stage?: string;
      ownerId?: string;
      qualificationStatus?: string;
    }
  ) {
    return withTenantContext(orgId, async (tx) => {
      const conditions = [isNull(candidates.deletedAt)];

      if (filters?.search) {
        conditions.push(
          ilike(
            sql`${candidates.firstName} || ' ' || ${candidates.lastName}`,
            `%${filters.search}%`
          )
        );
      }
      if (filters?.source) {
        conditions.push(eq(candidates.source, filters.source));
      }

      // If filtering by application-level fields, need to find candidate IDs first
      if (
        filters?.vacancyId ||
        filters?.stage ||
        filters?.ownerId ||
        filters?.qualificationStatus
      ) {
        const appConditions = [];
        if (filters.vacancyId) {
          appConditions.push(
            eq(candidateApplications.vacancyId, filters.vacancyId)
          );
        }
        if (filters.stage) {
          appConditions.push(
            eq(candidateApplications.currentStageId, filters.stage)
          );
        }
        if (filters.ownerId) {
          appConditions.push(
            eq(candidateApplications.ownerId, filters.ownerId)
          );
        }
        if (filters.qualificationStatus) {
          appConditions.push(
            eq(
              candidateApplications.qualificationStatus,
              filters.qualificationStatus as any
            )
          );
        }

        const appRows = await tx
          .select({ candidateId: candidateApplications.candidateId })
          .from(candidateApplications)
          .where(and(...appConditions));

        const candidateIds = appRows.map((r) => r.candidateId);
        if (candidateIds.length === 0) return [];

        conditions.push(inArray(candidates.id, candidateIds));
      }

      return tx
        .select()
        .from(candidates)
        .where(and(...conditions))
        .orderBy(sql`${candidates.createdAt} DESC`);
    });
  },

  async getById(orgId: string, id: string) {
    return withTenantContext(orgId, async (tx) => {
      const rows = await tx
        .select()
        .from(candidates)
        .where(and(eq(candidates.id, id), isNull(candidates.deletedAt)));
      return rows[0] ?? null;
    });
  },

  async create(orgId: string, userId: string, data: CreateCandidateInput) {
    return withTenantContext(orgId, async (tx) => {
      const [candidate] = await tx
        .insert(candidates)
        .values({
          organizationId: orgId,
          firstName: data.firstName,
          lastName: data.lastName,
          phone: data.phone ?? null,
          email: data.email ?? null,
          city: data.city ?? null,
          source: data.source ?? null,
          availabilityType: data.availabilityType ?? null,
          availabilityStartDate: data.availabilityStartDate
            ? new Date(data.availabilityStartDate)
            : null,
          contractType: data.contractType ?? null,
        })
        .returning();

      await tx.insert(activityLog).values({
        organizationId: orgId,
        entityType: "candidate",
        entityId: candidate.id,
        action: "created",
        actorId: userId,
        metadata: {
          name: `${candidate.firstName} ${candidate.lastName}`,
        },
      });

      // Queue async geocoding if city is provided
      if (data.city) {
        try {
          const boss = getJobQueue();
          await boss.send("geo.geocode_candidate", {
            orgId,
            candidateId: candidate.id,
            city: data.city,
          }, { retryLimit: 2, retryDelay: 5 });
        } catch {
          // Jobs may be disabled — don't fail candidate creation
          console.log("[candidate] geocoding job queue unavailable, skipping");
        }
      }

      return candidate;
    });
  },

  async update(orgId: string, id: string, data: UpdateCandidateInput) {
    return withTenantContext(orgId, async (tx) => {
      // Check if city changed (for geocoding decision)
      let cityChanged = false;
      if (data.city !== undefined) {
        const [existing] = await tx
          .select({ city: candidates.city })
          .from(candidates)
          .where(eq(candidates.id, id));
        cityChanged = existing?.city !== data.city;
      }

      const { availabilityStartDate, ...rest } = data;
      const [candidate] = await tx
        .update(candidates)
        .set({
          ...rest,
          ...(availabilityStartDate !== undefined
            ? { availabilityStartDate: availabilityStartDate ? new Date(availabilityStartDate) : null }
            : {}),
          updatedAt: new Date(),
        })
        .where(eq(candidates.id, id))
        .returning();

      if (candidate) {
        await tx.insert(activityLog).values({
          organizationId: orgId,
          entityType: "candidate",
          entityId: id,
          action: "updated",
          actorId: candidate.firstName, // Will be overridden in route with actual userId
          metadata: { fields: Object.keys(data) },
        });

        // Queue geocoding if city changed
        if (cityChanged && data.city) {
          try {
            const boss = getJobQueue();
            await boss.send("geo.geocode_candidate", {
              orgId,
              candidateId: id,
              city: data.city,
            });
          } catch {
            console.log("[candidate] geocoding job queue unavailable, skipping");
          }
        }
      }

      return candidate ?? null;
    });
  },

  async delete(orgId: string, id: string) {
    return withTenantContext(orgId, async (tx) => {
      await tx
        .update(candidates)
        .set({ deletedAt: new Date() })
        .where(eq(candidates.id, id));
    });
  },

  async getActivityTimeline(orgId: string, candidateId: string) {
    return withTenantContext(orgId, async (tx) => {
      // Get application IDs for this candidate
      const apps = await tx
        .select({ id: candidateApplications.id })
        .from(candidateApplications)
        .where(eq(candidateApplications.candidateId, candidateId));

      const appIds = apps.map((a) => a.id);

      // Get activity for candidate AND all their applications
      const candidateCondition = and(
        eq(activityLog.entityType, "candidate"),
        eq(activityLog.entityId, candidateId)
      );

      if (appIds.length === 0) {
        return tx
          .select()
          .from(activityLog)
          .where(candidateCondition)
          .orderBy(sql`${activityLog.createdAt} DESC`);
      }

      const applicationCondition = and(
        eq(activityLog.entityType, "application"),
        inArray(activityLog.entityId, appIds)
      );

      return tx
        .select()
        .from(activityLog)
        .where(or(candidateCondition, applicationCondition))
        .orderBy(sql`${activityLog.createdAt} DESC`);
    });
  },
};
