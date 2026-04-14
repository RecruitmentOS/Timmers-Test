import { eq } from "drizzle-orm";
import { withTenantContext } from "../lib/with-tenant-context.js";
import {
  placements,
  candidateApplications,
  vacancies,
} from "../db/schema/index.js";
import type {
  CreatePlacementInput,
  UpdatePlacementInput,
} from "@recruitment-os/types";

export const placementService = {
  async create(orgId: string, userId: string, input: CreatePlacementInput) {
    return withTenantContext(orgId, async (tx) => {
      // Look up the application to get candidateId, vacancyId, clientId
      const [application] = await tx
        .select()
        .from(candidateApplications)
        .where(eq(candidateApplications.id, input.applicationId));

      if (!application) {
        throw new Error("Application not found");
      }

      if (application.organizationId !== orgId) {
        throw new Error("Application does not belong to this organization");
      }

      // Check if a placement already exists for this application
      const existing = await tx
        .select({ id: placements.id })
        .from(placements)
        .where(eq(placements.applicationId, input.applicationId));

      if (existing.length > 0) {
        throw new Error("A placement already exists for this application");
      }

      // Look up vacancy to get clientId (agency mode)
      const [vacancy] = await tx
        .select({ clientId: vacancies.clientId })
        .from(vacancies)
        .where(eq(vacancies.id, application.vacancyId));

      const [placement] = await tx
        .insert(placements)
        .values({
          organizationId: orgId,
          applicationId: input.applicationId,
          candidateId: application.candidateId,
          vacancyId: application.vacancyId,
          clientId: vacancy?.clientId ?? null,
          agreedRate: input.agreedRate != null ? String(input.agreedRate) : null,
          inlenersbeloning: input.inlenersbeloning ?? false,
          startDate: input.startDate ? new Date(input.startDate) : null,
          notes: input.notes ?? null,
          createdBy: userId,
        })
        .returning();

      return placement;
    });
  },

  async getByApplication(orgId: string, applicationId: string) {
    return withTenantContext(orgId, async (tx) => {
      const rows = await tx
        .select()
        .from(placements)
        .where(eq(placements.applicationId, applicationId));
      return rows[0] ?? null;
    });
  },

  async update(orgId: string, placementId: string, input: UpdatePlacementInput) {
    return withTenantContext(orgId, async (tx) => {
      const { agreedRate, startDate, ...rest } = input;
      const [placement] = await tx
        .update(placements)
        .set({
          ...rest,
          ...(agreedRate !== undefined
            ? { agreedRate: agreedRate != null ? String(agreedRate) : null }
            : {}),
          ...(startDate !== undefined
            ? { startDate: startDate ? new Date(startDate) : null }
            : {}),
          updatedAt: new Date(),
        })
        .where(eq(placements.id, placementId))
        .returning();

      return placement ?? null;
    });
  },

  async listByVacancy(orgId: string, vacancyId: string) {
    return withTenantContext(orgId, async (tx) => {
      return tx
        .select()
        .from(placements)
        .where(eq(placements.vacancyId, vacancyId));
    });
  },

  async listByClient(orgId: string, clientId: string) {
    return withTenantContext(orgId, async (tx) => {
      return tx
        .select()
        .from(placements)
        .where(eq(placements.clientId, clientId));
    });
  },
};
