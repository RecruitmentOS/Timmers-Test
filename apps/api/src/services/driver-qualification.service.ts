import { eq, and } from "drizzle-orm";
import { withTenantContext } from "../lib/with-tenant-context.js";
import { driverQualifications } from "../db/schema/index.js";
import { vacancies } from "../db/schema/index.js";
import type {
  CreateDriverQualificationInput,
  LicenseBadge,
} from "@recruitment-os/types";

export const driverQualificationService = {
  async list(orgId: string, candidateId: string) {
    return withTenantContext(orgId, async (tx) => {
      return tx
        .select()
        .from(driverQualifications)
        .where(eq(driverQualifications.candidateId, candidateId));
    });
  },

  async create(orgId: string, input: CreateDriverQualificationInput) {
    return withTenantContext(orgId, async (tx) => {
      const [record] = await tx
        .insert(driverQualifications)
        .values({
          organizationId: orgId,
          candidateId: input.candidateId,
          type: input.type,
          adrType: input.adrType ?? null,
          cardNumber: input.cardNumber ?? null,
          issuedAt: input.issuedAt ?? null,
          expiresAt: input.expiresAt ?? null,
        })
        .returning();
      return record;
    });
  },

  async update(
    orgId: string,
    qualId: string,
    input: Partial<Omit<CreateDriverQualificationInput, "candidateId">>
  ) {
    return withTenantContext(orgId, async (tx) => {
      const [record] = await tx
        .update(driverQualifications)
        .set({
          ...(input.type !== undefined && { type: input.type }),
          ...(input.adrType !== undefined && { adrType: input.adrType }),
          ...(input.cardNumber !== undefined && { cardNumber: input.cardNumber }),
          ...(input.issuedAt !== undefined && { issuedAt: input.issuedAt }),
          ...(input.expiresAt !== undefined && { expiresAt: input.expiresAt }),
          updatedAt: new Date(),
        })
        .where(eq(driverQualifications.id, qualId))
        .returning();
      return record ?? null;
    });
  },

  async remove(orgId: string, qualId: string) {
    return withTenantContext(orgId, async (tx) => {
      await tx
        .delete(driverQualifications)
        .where(eq(driverQualifications.id, qualId));
    });
  },

  async getLicenseBadges(
    orgId: string,
    candidateId: string
  ): Promise<LicenseBadge[]> {
    return withTenantContext(orgId, async (tx) => {
      const quals = await tx
        .select()
        .from(driverQualifications)
        .where(eq(driverQualifications.candidateId, candidateId));

      const today = new Date().toISOString().split("T")[0];

      return quals.map((q) => ({
        type: q.type as LicenseBadge["type"],
        expired: q.expiresAt ? q.expiresAt < today : false,
        expiresAt: q.expiresAt ?? null,
      }));
    });
  },

  async checkLicenseMismatch(
    orgId: string,
    candidateId: string,
    vacancyId: string
  ): Promise<{ missing: string[]; hasAll: boolean }> {
    return withTenantContext(orgId, async (tx) => {
      // Load vacancy required licenses
      const [vacancy] = await tx
        .select({ requiredLicenses: vacancies.requiredLicenses })
        .from(vacancies)
        .where(eq(vacancies.id, vacancyId));

      if (!vacancy || !vacancy.requiredLicenses) {
        return { missing: [], hasAll: true };
      }

      const required = vacancy.requiredLicenses as string[];

      // Load candidate qualifications
      const quals = await tx
        .select({ type: driverQualifications.type })
        .from(driverQualifications)
        .where(eq(driverQualifications.candidateId, candidateId));

      const candidateTypes = new Set(quals.map((q) => q.type));
      const missing = required.filter((r) => !candidateTypes.has(r));

      return { missing, hasAll: missing.length === 0 };
    });
  },
};
